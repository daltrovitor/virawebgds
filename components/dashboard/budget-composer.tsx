// Hello World
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { ArchChart } from "@/components/dental/arch-chart"
import { Field, MoneyInput, NativeSelect, PanelHeader, SearchPicker, TextArea, TextInput, parseBRL } from "@/components/dental/form-primitives"
import type { CreateBudgetPayload } from "@/app/actions/budget-actions"
import { calculateItemTotals } from "@/lib/budget-calculations"
import { encodeRegion, regionLabel, regionShort, regionSortKey, type DentalRegion } from "@/lib/dental-regions"
import {
  BRL,
  buildPaymentPlan,
  formatDateBR,
  rebalanceSchedule,
  scheduleTotal,
  todayISO,
  type PlanPaymentMethod,
  type PlannedInstallment,
} from "@/lib/payment-plan"
import { PAYMENT_METHOD_LABELS, type BudgetItemDraft, type ServiceProduct } from "@/lib/budget-types"

export interface ComposerPatient {
  id: string
  name: string
  phone?: string | null
}

export interface ComposerProfessional {
  id: string
  name: string
}

interface BudgetLine {
  key: string
  product_id: string
  product_name: string
  unit_price: number
  cost_per_unit: number
  tax_percent: number
  region: DentalRegion
}

type Step = "budget" | "plan"

const STEPS: { id: Step; label: string; caption: string }[] = [
  { id: "budget", label: "Orçamento", caption: "Procedimentos e dentes" },
  { id: "plan", label: "Plano de pagamento", caption: "Desconto, entrada e parcelas" },
]

const expandRegions = (regions: DentalRegion[]): DentalRegion[] =>
  [...regions].sort((a, b) => regionSortKey(a) - regionSortKey(b))

/** Valor editável da parcela: edita localmente e redistribui o saldo só ao confirmar (blur/Enter). */
function AmountCell({ amount, label, onCommit }: { amount: number; label: string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const value = parseBRL(draft)
    setDraft(null)
    if (Math.abs(value - amount) > 0.004) onCommit(value)
  }
  return (
    <MoneyInput
      ariaLabel={label}
      value={draft ?? amount.toFixed(2).replace(".", ",")}
      onValueChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          commit()
        }
      }}
      className="w-36"
    />
  )
}

export interface BudgetSubmission {
  payload: CreateBudgetPayload
  schedule: PlannedInstallment[]
  mode: "draft" | "close"
}

export interface BudgetComposerProps {
  patients: ComposerPatient[]
  products: ServiceProduct[]
  professionals: ComposerProfessional[]
  initialPatientId?: string
  /** Persiste o orçamento (servidor ou demonstração). Retorna quantos lançamentos foram gerados. */
  submit: (submission: BudgetSubmission) => Promise<{ installmentsCreated: number }>
  onCancel: () => void
  onSaved: () => void
}

export function BudgetComposer({ patients, products, professionals, initialPatientId, submit, onCancel, onSaved }: BudgetComposerProps) {
  const { toast } = useToast()
  const [step, setStepState] = useState<Step>("budget")
  const [saving, setSaving] = useState<null | "draft" | "close">(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const setStep = (next: Step) => {
    setStepState(next)
    // Leva o topo do editor à vista ao trocar de etapa (lista longa de procedimentos)
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))
  }

  // Cabeçalho
  const [patientId, setPatientId] = useState(initialPatientId || "")
  const [professionalId, setProfessionalId] = useState(professionals.length === 1 ? professionals[0].id : "")
  const [validUntil, setValidUntil] = useState("")
  const [notes, setNotes] = useState("")

  // Definição de procedimento
  const categories = useMemo(() => {
    const map = new Map<string, string>()
    products.forEach((p) => {
      if (p.active === false) return
      map.set(p.category_id, p.category?.name || "Sem especialidade")
    })
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
  }, [products])
  const [categoryId, setCategoryId] = useState("all")
  const [productId, setProductId] = useState("")
  const [price, setPrice] = useState("")
  const [regions, setRegions] = useState<DentalRegion[]>([])
  const [lines, setLines] = useState<BudgetLine[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const visibleProducts = useMemo(
    () =>
      products
        .filter((p) => p.active !== false && (categoryId === "all" || p.category_id === categoryId))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [products, categoryId],
  )
  const selectedProduct = products.find((p) => p.id === productId)

  useEffect(() => {
    if (selectedProduct) setPrice(selectedProduct.base_price.toFixed(2).replace(".", ","))
  }, [selectedProduct])

  const lineTotal = (line: BudgetLine) =>
    calculateItemTotals({ product_id: line.product_id, product_name: line.product_name, quantity: 1, unit_price: line.unit_price, cost_per_unit: line.cost_per_unit, tax_percent: line.tax_percent }).total
  const gross = useMemo(() => Math.round(lines.reduce((sum, l) => sum + lineTotal(l), 0) * 100) / 100, [lines])

  const coverage = useMemo(() => {
    const map: Record<number, number> = {}
    lines.forEach((l) => {
      if (l.region.kind === "tooth") map[l.region.tooth] = (map[l.region.tooth] || 0) + 1
    })
    return map
  }, [lines])

  const includeProcedure = () => {
    if (!selectedProduct) {
      toast({ title: "Escolha o procedimento", description: "Selecione a especialidade e o procedimento da tabela.", variant: "destructive" })
      return
    }
    if (regions.length === 0) {
      toast({ title: "Selecione a região", description: "Clique nos dentes, em um hemiarco, na arcada ou em “Procedimento sem região”.", variant: "destructive" })
      return
    }
    const unit = parseBRL(price)
    if (unit <= 0) {
      toast({ title: "Valor inválido", description: "Informe o valor do procedimento.", variant: "destructive" })
      return
    }
    const added = expandRegions(regions).map((region) => ({
      key: crypto.randomUUID(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      unit_price: unit,
      cost_per_unit: selectedProduct.cost || 0,
      tax_percent: selectedProduct.tax_percent || 0,
      region,
    }))
    setLines((prev) => [...prev, ...added])
    setRegions([])
  }

  const removeChecked = () => {
    setLines((prev) => prev.filter((l) => !checked.has(l.key)))
    setChecked(new Set())
  }

  // Plano de pagamento
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent")
  const [discountInput, setDiscountInput] = useState("0")
  const [downInput, setDownInput] = useState("0")
  const [installments, setInstallments] = useState(1)
  const [firstDueDate, setFirstDueDate] = useState(todayISO())
  const [method, setMethod] = useState<PlanPaymentMethod>("pix")

  const plan = useMemo(
    () =>
      buildPaymentPlan({
        gross,
        discount: { mode: discountMode, value: parseBRL(discountInput) },
        downPayment: parseBRL(downInput),
        installments,
        firstDueDate,
        method,
      }),
    [gross, discountMode, discountInput, downInput, installments, firstDueDate, method],
  )
  const [schedule, setSchedule] = useState<PlannedInstallment[]>(plan.schedule)
  useEffect(() => setSchedule(plan.schedule), [plan])
  const scheduleMismatch = Math.abs(scheduleTotal(schedule) - plan.net) > 0.009

  const canProceed = Boolean(patientId) && lines.length > 0

  const save = async (mode: "draft" | "close") => {
    if (!canProceed) return
    if (mode === "close" && scheduleMismatch) {
      toast({ title: "Parcelas não fecham com o total", description: `A soma das parcelas deve ser ${BRL.format(plan.net)}.`, variant: "destructive" })
      return
    }
    setSaving(mode)
    try {
      const items: BudgetItemDraft[] = lines.map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: 1,
        unit_price: l.unit_price,
        cost_per_unit: l.cost_per_unit,
        tax_percent: l.tax_percent,
        tooth: l.region.kind === "tooth" ? l.region.tooth : null,
        region: encodeRegion(l.region),
      }))
      const count = schedule.filter((s) => s.number > 0).length
      const payload: CreateBudgetPayload = {
        patient_id: patientId,
        items,
        notes,
        valid_until: validUntil,
        down_payment: plan.downPayment,
        installment_count: count,
        installment_interval: "monthly",
        payment_methods: [{ method, amount: plan.net }],
        status: "draft",
        professional_id: professionalId || null,
        discount_amount: plan.discountAmount,
        first_due_date: firstDueDate,
        payment_method: method,
      }
      const result = await submit({ payload, schedule, mode })
      if (mode === "close") {
        toast({ title: "Orçamento fechado", description: `${result.installmentsCreated} lançamento(s) enviados ao contas a receber.` })
      } else {
        toast({ title: "Orçamento salvo", description: "Ficou em andamento — feche quando o paciente aprovar." })
      }
      onSaved()
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" })
    } finally {
      setSaving(null)
    }
  }

  const patientOptions = useMemo(
    () => patients.map((p) => ({ id: p.id, label: p.name, meta: p.phone || null })),
    [patients],
  )

  return (
    <div ref={rootRef} className="scroll-mt-24 space-y-6">
      {/* Cabeçalho do editor */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 w-11 items-center justify-center rounded-sm border border-border text-ink-soft hover:bg-surface hover:text-ink"
            aria-label="Voltar para a lista de orçamentos"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Novo orçamento</h2>
            <p className="text-[13px] text-muted-foreground">Defina os procedimentos no odontograma e configure o plano de pagamento.</p>
          </div>
        </div>

        {/* Etapas (morph do indicador com layoutId) */}
        <div className="grid grid-cols-2 rounded-sm border border-border bg-background p-1" role="tablist" aria-label="Etapas do orçamento">
          {STEPS.map((s, i) => {
            const active = s.id === step
            const disabled = s.id === "plan" && !canProceed
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={disabled}
                onClick={() => setStep(s.id)}
                className={cn("relative min-h-12 rounded-xs px-4 text-left transition-colors disabled:opacity-50", active ? "text-ink" : "text-muted-foreground hover:text-ink")}
              >
                {active && (
                  <motion.span layoutId="vwo-budget-step" className="absolute inset-0 rounded-xs bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} aria-hidden />
                )}
                <span className="relative flex items-center gap-2">
                  <span className={cn("font-display text-[11px] font-semibold tabular", active ? "text-primary" : "")}>0{i + 1}</span>
                  <span className="text-[13px] font-semibold">{s.label}</span>
                </span>
                <span className="relative hidden text-[11px] text-muted-foreground sm:block">{s.caption}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Identificação */}
      <section className="grid gap-4 rounded-md border border-border bg-background p-4 sm:p-5 md:grid-cols-[1.618fr_1fr_0.8fr]" aria-label="Identificação do orçamento">
        <Field label="Paciente">
          <SearchPicker options={patientOptions} value={patientId} onChange={setPatientId} placeholder="Buscar por nome ou telefone" label="Paciente" emptyText="Nenhum paciente encontrado" />
        </Field>
        <Field label="Dentista indicado" htmlFor="budget-professional">
          <NativeSelect id="budget-professional" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Não informado</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Validade" htmlFor="budget-valid">
          <TextInput id="budget-valid" type="date" value={validUntil} min={todayISO()} onChange={(e) => setValidUntil(e.target.value)} />
        </Field>
      </section>

      <AnimatePresence mode="wait" initial={false}>
        {step === "budget" ? (
          <motion.div
            key="budget"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="grid gap-6 xl:grid-cols-[1.618fr_1fr]"
          >
            {/* Coluna dominante: procedimento + odontograma */}
            <section className="min-w-0 rounded-md border border-border bg-background" aria-labelledby="define-procedure">
              <PanelHeader title="Defina o procedimento e selecione os dentes" />
              <h3 id="define-procedure" className="sr-only">Definir procedimento</h3>
              <div className="grid gap-3 p-4 sm:grid-cols-[1fr_1.4fr_0.8fr_auto] sm:items-end sm:p-5">
                <Field label="Especialidade" htmlFor="proc-category">
                  <NativeSelect
                    id="proc-category"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value)
                      setProductId("")
                    }}
                  >
                    <option value="all">Todas</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Procedimento" htmlFor="proc-product">
                  <NativeSelect id="proc-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                    <option value="">{visibleProducts.length ? "Selecione" : "Cadastre procedimentos na Tabela de Preços"}</option>
                    {visibleProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Valor" htmlFor="proc-price">
                  <MoneyInput id="proc-price" value={price} onValueChange={setPrice} />
                </Field>
                <button
                  type="button"
                  onClick={includeProcedure}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Incluir
                </button>
              </div>
              <div className="px-2 pb-4 sm:px-5 sm:pb-5">
                <ArchChart value={regions} onChange={setRegions} coverage={coverage} />
              </div>
            </section>

            {/* Coluna de contexto: procedimentos vinculados */}
            <section className="min-w-0 self-start rounded-md border border-border bg-background xl:sticky xl:top-24" aria-label="Procedimentos vinculados">
              <PanelHeader
                title="Procedimentos vinculados"
                aside={<span className="text-[12px] tabular text-muted-foreground">{lines.length} item(ns)</span>}
              />
              {lines.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-muted-foreground">
                  Escolha um procedimento, marque os dentes e clique em <strong className="font-semibold text-ink">Incluir</strong>.
                  <br />
                  Cada dente vira uma linha do orçamento.
                </p>
              ) : (
                <ul className="max-h-[480px] divide-y divide-hairline overflow-y-auto" data-lenis-prevent>
                  <AnimatePresence initial={false}>
                    {lines.map((line) => {
                      const isChecked = checked.has(line.key)
                      return (
                        <motion.li
                          key={line.key}
                          layout
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 24 }}
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        >
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 hover:bg-surface sm:px-5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = new Set(checked)
                                if (e.target.checked) next.add(line.key)
                                else next.delete(line.key)
                                setChecked(next)
                              }}
                              className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-medium text-ink">{line.product_name}</span>
                              <span className="block text-[12px] text-muted-foreground">{regionLabel(line.region)}</span>
                            </span>
                            <span className="shrink-0 rounded-xs bg-secondary px-1.5 py-0.5 font-display text-[11px] font-semibold tabular text-ink-soft">
                              {regionShort(line.region)}
                            </span>
                            <span className="w-24 shrink-0 text-right text-[13px] tabular text-ink">{BRL.format(lineTotal(line))}</span>
                          </label>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ul>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={removeChecked}
                  disabled={checked.size === 0}
                  className="inline-flex min-h-10 items-center gap-2 rounded-sm px-2 text-[13px] font-medium text-destructive hover:bg-destructive/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Remover selecionados
                </button>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Total</p>
                  <p className="font-display text-xl font-semibold tabular text-ink">{BRL.format(gross)}</p>
                </div>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div
            key="plan"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="grid gap-6 xl:grid-cols-[1fr_1.618fr]"
          >
            {/* Configuração */}
            <section className="min-w-0 self-start rounded-md border border-border bg-background" aria-label="Configurar plano">
              <PanelHeader title="Configure" />
              <div className="space-y-4 p-4 sm:p-5">
                <dl className="grid grid-cols-3 gap-3 rounded-sm bg-surface p-3">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Orçamento</dt>
                    <dd className="font-display text-[15px] font-semibold tabular text-ink">{BRL.format(plan.gross)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Desconto</dt>
                    <dd className="font-display text-[15px] font-semibold tabular text-ink">− {BRL.format(plan.discountAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">Total</dt>
                    <dd className="font-display text-[15px] font-semibold tabular text-primary">{BRL.format(plan.net)}</dd>
                  </div>
                </dl>

                <Field label="Desconto" htmlFor="plan-discount">
                  <div className="flex gap-2">
                    <div className="inline-flex shrink-0 rounded-sm border border-border p-0.5" role="group" aria-label="Tipo de desconto">
                      {(["percent", "amount"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={discountMode === m}
                          onClick={() => setDiscountMode(m)}
                          className={cn("min-h-9 min-w-11 rounded-xs px-2 text-[13px] font-semibold", discountMode === m ? "bg-secondary text-ink" : "text-muted-foreground")}
                        >
                          {m === "percent" ? "%" : "R$"}
                        </button>
                      ))}
                    </div>
                    <TextInput id="plan-discount" inputMode="decimal" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} className="tabular" />
                  </div>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Valor de entrada" htmlFor="plan-down">
                    <MoneyInput id="plan-down" value={downInput} onValueChange={setDownInput} />
                  </Field>
                  <Field label="Qtd. de parcelas" htmlFor="plan-count">
                    <NativeSelect id="plan-count" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n === 1 ? "À vista (1x)" : `${n}x`}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="Início do pagamento" htmlFor="plan-start">
                    <TextInput id="plan-start" type="date" value={firstDueDate} onChange={(e) => e.target.value && setFirstDueDate(e.target.value)} />
                  </Field>
                  <Field label="Forma de pagamento" htmlFor="plan-method">
                    <NativeSelect id="plan-method" value={method} onChange={(e) => setMethod(e.target.value as PlanPaymentMethod)}>
                      {(Object.keys(PAYMENT_METHOD_LABELS) as PlanPaymentMethod[]).map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>

                <Field label="Observações" htmlFor="plan-notes">
                  <TextArea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições combinadas, convênio, etc." />
                </Field>
              </div>
            </section>

            {/* Cronograma */}
            <section className="min-w-0 rounded-md border border-border bg-background" aria-label="Parcelas">
              <PanelHeader
                title="Parcelas"
                aside={
                  <span className={cn("text-[12px] tabular", scheduleMismatch ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {BRL.format(scheduleTotal(schedule))} de {BRL.format(plan.net)}
                  </span>
                }
              />
              <div className="overflow-x-auto" data-lenis-prevent>
                <table className="w-full min-w-[520px] text-[13.5px]">
                  <thead>
                    <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Parcela</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Vencimento</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Valor</th>
                      <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Forma</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {schedule.map((row, index) => (
                      <tr key={`${row.number}-${index}`}>
                        <td className="px-4 py-2 font-display font-semibold tabular text-ink sm:px-5">{row.label}</td>
                        <td className="px-3 py-2">
                          <TextInput
                            type="date"
                            aria-label={`Vencimento da parcela ${row.label}`}
                            value={row.dueDate}
                            onChange={(e) => {
                              const v = e.target.value
                              if (!v) return
                              setSchedule((prev) => prev.map((r, i) => (i === index ? { ...r, dueDate: v } : r)))
                            }}
                            className="h-10"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <AmountCell
                            label={`Valor da parcela ${row.label}`}
                            amount={row.amount}
                            onCommit={(v) => setSchedule((prev) => rebalanceSchedule(prev, index, v, plan.net))}
                          />
                        </td>
                        <td className="px-4 py-2 text-ink-soft sm:px-5">{PAYMENT_METHOD_LABELS[row.method]}</td>
                      </tr>
                    ))}
                    {schedule.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                          Sem valores a receber.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-hairline px-4 py-3 text-[12px] text-muted-foreground sm:px-5">
                Ao fechar, cada linha entra no contas a receber como pendente, com vencimento em {formatDateBR(schedule[0]?.dueDate)}
                {schedule.length > 1 ? ` até ${formatDateBR(schedule[schedule.length - 1]?.dueDate)}` : ""}.
              </p>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de ações fixa */}
      <div className="sticky bottom-0 z-20 -mx-1 rounded-t-md border border-border bg-background/95 shadow-[0_-8px_24px_-16px_rgba(15,31,51,0.25)] backdrop-blur print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{step === "budget" ? "Total do orçamento" : "Total com desconto"}</p>
            <p className="font-display text-lg font-semibold tabular text-ink">{BRL.format(step === "budget" ? gross : plan.net)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {step === "budget" ? (
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStep("plan")}
                className="inline-flex h-12 items-center gap-2 rounded-sm bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Plano de pagamento
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!canProceed || saving !== null}
                  onClick={() => save("draft")}
                  className="inline-flex h-12 items-center gap-2 rounded-sm border border-border bg-background px-5 text-[14px] font-semibold text-ink hover:bg-surface disabled:opacity-50"
                >
                  {saving === "draft" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Salvar em andamento
                </button>
                <button
                  type="button"
                  disabled={!canProceed || saving !== null}
                  onClick={() => save("close")}
                  className="inline-flex h-12 items-center gap-2 rounded-sm bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {saving === "close" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                  Fechar e lançar parcelas
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BudgetComposer
