// Hello World
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, Check, Copy, Loader2, Plus, Printer, Receipt, Search, Trash2, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  closeBudgetWithPlan,
  createBudget,
  deleteBudget,
  duplicateBudget,
  getBudgetInstallments,
  getBudgets,
  settleInstallment,
  updateBudgetStatus,
  type BudgetInstallmentRow,
} from "@/app/actions/budget-actions"
import { getProducts } from "@/app/actions/price-table-actions"
import { getPatients } from "@/app/actions/patients"
import { getProfessionals } from "@/app/actions/professionals"
import { BudgetComposer, type BudgetSubmission, type ComposerPatient, type ComposerProfessional } from "./budget-composer"
import { PanelHeader } from "@/components/dental/form-primitives"
import {
  BUDGET_STATUS_COLORS,
  BUDGET_STATUS_LABELS,
  EXECUTION_LABELS,
  PAYMENT_METHOD_LABELS,
  budgetPhase,
  type Budget,
  type BudgetPhase,
  type BudgetStatus,
  type ServiceProduct,
} from "@/lib/budget-types"
import { regionLabel, regionShort, regionSortKey, resolveItemRegion } from "@/lib/dental-regions"
import { BRL, buildPaymentPlan, formatDateBR, todayISO, type PlanPaymentMethod } from "@/lib/payment-plan"
import { DEMO_PATIENTS, DEMO_PRODUCTS, DEMO_PROFESSIONALS, buildDemoBudgets } from "@/lib/demo-clinic"

/** Número curto exibido ao usuário (sufixo numérico quando houver; senão, início do UUID). */
export function budgetCode(id: string): string {
  const numeric = /(\d{3,})$/.exec(id)
  return numeric ? numeric[1] : id.slice(0, 6).toUpperCase()
}

type Filter = "all" | BudgetPhase

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "open", label: "Em andamento" },
  { id: "closed", label: "Fechados" },
  { id: "rejected", label: "Reprovados" },
]

function planFromBudget(budget: Budget) {
  const method = (budget.payment_method as PlanPaymentMethod | undefined) || budget.payment_methods?.[0]?.method || "pix"
  return buildPaymentPlan({
    gross: budget.total_amount || 0,
    discount: { mode: "amount", value: 0 },
    downPayment: budget.down_payment || 0,
    installments: budget.installment_count || 0,
    firstDueDate: budget.first_due_date?.slice(0, 10) || todayISO(),
    method,
  })
}

export default function BudgetTab({ isDemo = false, initialPatientId }: { isDemo?: boolean; initialPatientId?: string }) {
  const { toast } = useToast()
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [products, setProducts] = useState<ServiceProduct[]>([])
  const [patients, setPatients] = useState<ComposerPatient[]>([])
  const [professionals, setProfessionals] = useState<ComposerProfessional[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")
  const [prefillPatientId, setPrefillPatientId] = useState(initialPatientId)
  const [view, setView] = useState<{ kind: "list" } | { kind: "new" } | { kind: "detail"; id: string }>(
    initialPatientId ? { kind: "new" } : { kind: "list" },
  )

  // "Novo orçamento" aberto a partir da ficha do paciente
  useEffect(() => {
    try {
      const fromRecord = sessionStorage.getItem("vwd:budget_prefill_patient")
      if (fromRecord) {
        sessionStorage.removeItem("vwd:budget_prefill_patient")
        setPrefillPatientId(fromRecord)
        setView({ kind: "new" })
      }
    } catch {
      // armazenamento de sessão indisponível
    }
  }, [])
  const [demoInstallments, setDemoInstallments] = useState<Record<string, BudgetInstallmentRow[]>>({})

  const load = useCallback(async () => {
    if (isDemo) {
      setBudgets(buildDemoBudgets())
      setProducts(DEMO_PRODUCTS)
      setPatients(DEMO_PATIENTS.map((p) => ({ id: p.id, name: p.name, phone: p.phone })))
      setProfessionals(DEMO_PROFESSIONALS.map((p) => ({ id: p.id, name: p.name })))
      setLoading(false)
      return
    }
    try {
      const [b, p, pt, pr] = await Promise.all([getBudgets(), getProducts(), getPatients(), getProfessionals()])
      setBudgets(b)
      setProducts(p)
      setPatients(pt.map((x) => ({ id: x.id, name: x.name, phone: x.phone })))
      setProfessionals(pr.filter((x) => x.status !== "inactive").map((x) => ({ id: x.id, name: x.name })))
    } catch (error) {
      console.error("Error loading budgets:", error)
      toast({ title: "Não foi possível carregar os orçamentos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [isDemo, toast])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const open = budgets.filter((b) => budgetPhase(b.status) === "open")
    const closed = budgets.filter((b) => budgetPhase(b.status) === "closed")
    const decided = budgets.filter((b) => budgetPhase(b.status) !== "open").length
    const sum = (list: Budget[]) => list.reduce((s, b) => s + (b.total_amount || 0), 0)
    return {
      openCount: open.length,
      openValue: sum(open),
      closedCount: closed.length,
      closedValue: sum(closed),
      conversion: decided > 0 ? Math.round((closed.length / decided) * 100) : 0,
      ticket: closed.length > 0 ? sum(closed) / closed.length : 0,
    }
  }, [budgets])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return budgets.filter((b) => {
      if (filter !== "all" && budgetPhase(b.status) !== filter) return false
      if (!q) return true
      return (b.patient?.name || "").toLowerCase().includes(q) || budgetCode(b.id).toLowerCase().includes(q)
    })
  }, [budgets, filter, query])

  // ---------------------------------------------------------------- dados
  const submit = async ({ payload, schedule, mode }: BudgetSubmission) => {
    if (isDemo) {
      const id = `demo-bud-${1903 + budgets.length}`
      const patient = patients.find((p) => p.id === payload.patient_id)
      const total = Math.round((payload.items.reduce((s, it) => s + it.unit_price * it.quantity, 0) - (payload.discount_amount || 0)) * 100) / 100
      const created = new Date().toISOString()
      const budget: Budget = {
        id,
        user_id: "demo",
        patient_id: payload.patient_id,
        status: mode === "close" ? "approved" : "draft",
        notes: payload.notes || null,
        valid_until: payload.valid_until || null,
        down_payment: payload.down_payment,
        installment_count: payload.installment_count,
        installment_interval: "monthly",
        installment_value: 0,
        subtotal: total,
        total_tax: 0,
        total_amount: total,
        total_cost: payload.items.reduce((s, it) => s + it.cost_per_unit, 0),
        net_revenue: total,
        professional_id: payload.professional_id,
        discount_amount: payload.discount_amount,
        first_due_date: payload.first_due_date,
        payment_method: payload.payment_method,
        created_at: created,
        updated_at: created,
        patient: patient ? { id: patient.id, name: patient.name } : null,
        payment_methods: [],
        items: payload.items.map((it, i) => ({
          ...it,
          id: `${id}-item-${i}`,
          budget_id: id,
          subtotal: it.unit_price,
          tax_amount: 0,
          total: it.unit_price,
          execution_status: "pending",
          created_at: created,
        })),
      }
      setBudgets((prev) => [budget, ...prev])
      if (mode === "close") {
        setDemoInstallments((prev) => ({
          ...prev,
          [id]: schedule.map((s, i) => ({ id: `${id}-p-${i}`, amount: s.amount, status: "pending", due_date: s.dueDate, payment_date: null, notes: s.label, method: s.method, installment_number: s.number })),
        }))
      }
      return { installmentsCreated: mode === "close" ? schedule.length : 0 }
    }

    const res = await createBudget(payload)
    if (!res.success || !res.data) throw new Error(res.error || "Erro ao salvar o orçamento.")
    if (mode === "draft") return { installmentsCreated: 0 }
    const closed = await closeBudgetWithPlan(res.data.id, schedule)
    if (!closed.success) throw new Error(closed.error || "Orçamento salvo, mas as parcelas não foram lançadas.")
    return { installmentsCreated: closed.created ?? 0 }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Carregando orçamentos…</span>
      </div>
    )
  }

  if (view.kind === "new") {
    return (
      <BudgetComposer
        patients={patients}
        products={products}
        professionals={professionals}
        initialPatientId={prefillPatientId}
        submit={submit}
        onCancel={() => {
          setPrefillPatientId(undefined)
          setView({ kind: "list" })
        }}
        onSaved={async () => {
          setPrefillPatientId(undefined)
          setView({ kind: "list" })
          if (!isDemo) await load()
        }}
      />
    )
  }

  if (view.kind === "detail") {
    const budget = budgets.find((b) => b.id === view.id)
    if (budget) {
      return (
        <BudgetDetail
          budget={budget}
          isDemo={isDemo}
          professionals={professionals}
          demoInstallments={demoInstallments[budget.id]}
          onBack={() => setView({ kind: "list" })}
          onChanged={async (patch) => {
            if (isDemo) {
              if (patch?.status) setBudgets((prev) => prev.map((b) => (b.id === budget.id ? { ...b, status: patch.status! } : b)))
              if (patch?.installments) setDemoInstallments((prev) => ({ ...prev, [budget.id]: patch.installments! }))
              if (patch?.deleted) {
                setBudgets((prev) => prev.filter((b) => b.id !== budget.id))
                setView({ kind: "list" })
              }
              return
            }
            if (patch?.deleted) setView({ kind: "list" })
            await load()
          }}
        />
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Topo da pirâmide: KPIs */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-4" aria-label="Indicadores de orçamentos">
        {[
          { label: "Em andamento", value: BRL.format(stats.openValue), meta: `${stats.openCount} orçamento(s)` },
          { label: "Fechados", value: BRL.format(stats.closedValue), meta: `${stats.closedCount} orçamento(s)` },
          { label: "Conversão", value: `${stats.conversion}%`, meta: "fechados ÷ decididos" },
          { label: "Ticket médio", value: BRL.format(stats.ticket), meta: "por orçamento fechado" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: i * 0.05 }}
            className="bg-background p-4 sm:p-5"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 font-display text-xl font-semibold tabular tracking-[-0.01em] text-ink sm:text-2xl">{kpi.value}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{kpi.meta}</p>
          </motion.div>
        ))}
      </section>

      {/* Meio: filtros e ação */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-sm border border-border bg-background p-1" role="tablist" aria-label="Filtrar orçamentos">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("relative min-h-10 rounded-xs px-3.5 text-[13px] font-medium transition-colors", filter === f.id ? "text-ink" : "text-muted-foreground hover:text-ink")}
            >
              {filter === f.id && <motion.span layoutId="vwo-budget-filter" className="absolute inset-0 rounded-xs bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} aria-hidden />}
              <span className="relative">{f.label}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paciente ou número"
              aria-label="Buscar orçamento"
              className="h-11 w-full rounded-sm border border-input bg-background pl-9 pr-3 text-[14px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setView({ kind: "new" })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Novo orçamento
          </button>
        </div>
      </div>

      {/* Base: lista */}
      <section className="overflow-hidden rounded-md border border-border bg-background" aria-label="Orçamentos">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            <p className="font-display text-base font-semibold text-ink">Nenhum orçamento por aqui</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">Crie um orçamento marcando os procedimentos direto no odontograma.</p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            <li className="hidden grid-cols-[96px_1.6fr_1fr_1fr_120px] gap-4 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground md:grid" aria-hidden>
              <span>Nº</span>
              <span>Paciente</span>
              <span>Procedimentos</span>
              <span className="text-right">Valor</span>
              <span className="text-right">Status</span>
            </li>
            {filtered.map((b, i) => {
              const items = b.items || []
              const teeth = items.map((it) => resolveItemRegion(it).region).filter((r) => r.kind === "tooth").length
              return (
                <motion.li
                  key={b.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30, delay: Math.min(i, 10) * 0.025 }}
                >
                  <button
                    type="button"
                    onClick={() => setView({ kind: "detail", id: b.id })}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition-colors hover:bg-surface sm:px-5 md:grid-cols-[96px_1.6fr_1fr_1fr_120px]"
                  >
                    <span className="font-display text-[13px] font-semibold tabular text-primary md:order-none">#{budgetCode(b.id)}</span>
                    <span className="order-3 col-span-2 min-w-0 md:order-none md:col-span-1">
                      <span className="block truncate text-[14.5px] font-semibold text-ink">{b.patient?.name || "Paciente"}</span>
                      <span className="block text-[12px] text-muted-foreground">Cadastro {formatDateBR(b.created_at)}</span>
                    </span>
                    <span className="order-4 text-[13px] text-ink-soft md:order-none">
                      {items.length} item(ns){teeth ? ` · ${teeth} dente(s)` : ""}
                    </span>
                    <span className="order-5 text-right font-display text-[15px] font-semibold tabular text-ink md:order-none">{BRL.format(b.total_amount || 0)}</span>
                    <span className="order-2 text-right md:order-none">
                      <span className={cn("inline-block rounded-xs px-2 py-0.5 text-[11px] font-semibold", BUDGET_STATUS_COLORS[b.status])}>{BUDGET_STATUS_LABELS[b.status]}</span>
                    </span>
                  </button>
                </motion.li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

/* ================================================================== */
/* Detalhe                                                             */
/* ================================================================== */

interface DetailPatch {
  status?: BudgetStatus
  installments?: BudgetInstallmentRow[]
  deleted?: boolean
}

function BudgetDetail({
  budget,
  isDemo,
  professionals,
  demoInstallments,
  onBack,
  onChanged,
}: {
  budget: Budget
  isDemo: boolean
  professionals: ComposerProfessional[]
  demoInstallments?: BudgetInstallmentRow[]
  onBack: () => void
  onChanged: (patch?: DetailPatch) => Promise<void>
}) {
  const { toast } = useToast()
  const [installments, setInstallments] = useState<BudgetInstallmentRow[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const phase = budgetPhase(budget.status)
  const plan = useMemo(() => planFromBudget(budget), [budget])

  useEffect(() => {
    let active = true
    if (isDemo) {
      const fallback =
        demoInstallments ??
        (phase === "closed"
          ? plan.schedule.map((s, i) => ({
              id: `${budget.id}-p-${i}`,
              amount: s.amount,
              status: i < 2 ? "paid" : "pending",
              due_date: s.dueDate,
              payment_date: i < 2 ? s.dueDate : null,
              notes: s.label,
              method: s.method,
              installment_number: s.number,
            }))
          : [])
      setInstallments(fallback)
      return
    }
    getBudgetInstallments(budget.id).then((rows) => active && setInstallments(rows))
    return () => {
      active = false
    }
  }, [budget.id, isDemo, demoInstallments, phase, plan])

  const items = useMemo(
    () =>
      (budget.items || [])
        .map((it) => ({ ...it, resolved: resolveItemRegion(it) }))
        .sort((a, b) => regionSortKey(a.resolved.region) - regionSortKey(b.resolved.region)),
    [budget.items],
  )
  const professional = professionals.find((p) => p.id === budget.professional_id)
  const received = (installments || []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0)
  const today = todayISO()
  const overdue = (installments || []).filter((p) => p.status !== "paid" && (p.due_date || "") < today).reduce((s, p) => s + p.amount, 0)
  const toReceive = Math.max(0, (budget.total_amount || 0) - received)
  const executed = items.filter((it) => it.execution_status === "completed").length

  const run = async (key: string, action: () => Promise<DetailPatch | void>, success: string) => {
    setBusy(key)
    try {
      const patch = await action()
      await onChanged(patch || undefined)
      toast({ title: success })
    } catch (error) {
      toast({ title: "Não foi possível concluir", description: error instanceof Error ? error.message : undefined, variant: "destructive" })
    } finally {
      setBusy(null)
    }
  }

  const closeBudget = () =>
    run(
      "close",
      async () => {
        if (isDemo) {
          const rows = plan.schedule.map((s, i) => ({ id: `${budget.id}-p-${i}`, amount: s.amount, status: "pending", due_date: s.dueDate, payment_date: null, notes: s.label, method: s.method, installment_number: s.number }))
          setInstallments(rows)
          return { status: "approved", installments: rows }
        }
        const res = await closeBudgetWithPlan(budget.id, plan.schedule)
        if (!res.success) throw new Error(res.error)
      },
      "Orçamento fechado e parcelas lançadas",
    )

  const setStatus = (status: BudgetStatus, message: string) =>
    run(
      status,
      async () => {
        if (isDemo) return { status }
        const res = await updateBudgetStatus(budget.id, status)
        if (!res.success) throw new Error(res.error)
      },
      message,
    )

  const receive = (row: BudgetInstallmentRow) =>
    run(
      `pay-${row.id}`,
      async () => {
        if (isDemo) {
          const rows = (installments || []).map((p) => (p.id === row.id ? { ...p, status: "paid", payment_date: today } : p))
          setInstallments(rows)
          return { installments: rows }
        }
        const res = await settleInstallment(row.id)
        if (!res.success) throw new Error(res.error)
        setInstallments((prev) => (prev || []).map((p) => (p.id === row.id ? { ...p, status: "paid", payment_date: today } : p)))
      },
      "Recebimento registrado",
    )

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-border text-ink-soft hover:bg-surface hover:text-ink print:hidden"
            aria-label="Voltar para a lista de orçamentos"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Orçamento #{budgetCode(budget.id)}</h2>
              <span className={cn("rounded-xs px-2 py-0.5 text-[11px] font-semibold", BUDGET_STATUS_COLORS[budget.status])}>{BUDGET_STATUS_LABELS[budget.status]}</span>
            </div>
            <p className="mt-1 text-[14px] text-ink-soft">
              <span className="font-semibold text-ink">{budget.patient?.name || "Paciente"}</span>
              {professional ? ` · ${professional.name}` : ""} · cadastro {formatDateBR(budget.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {phase === "open" && (
            <>
              <button
                type="button"
                onClick={closeBudget}
                disabled={busy !== null}
                className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy === "close" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
                Fechar e lançar parcelas
              </button>
              <button
                type="button"
                onClick={() => setStatus("rejected", "Orçamento reprovado")}
                disabled={busy !== null}
                className="inline-flex h-11 items-center gap-2 rounded-sm border border-rose-200 px-4 text-[14px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
                Reprovar
              </button>
            </>
          )}
          {budget.status === "approved" && (
            <button
              type="button"
              onClick={() => setStatus("paid", "Orçamento quitado")}
              disabled={busy !== null}
              className="inline-flex h-11 items-center gap-2 rounded-sm border border-emerald-200 px-4 text-[14px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden />
              Marcar como quitado
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-sm border border-border px-4 text-[14px] font-medium text-ink hover:bg-surface">
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir
          </button>
          {!isDemo && (
            <button
              type="button"
              onClick={() =>
                run("dup", async () => {
                  const res = await duplicateBudget(budget.id)
                  if (!res.success) throw new Error(res.error)
                }, "Orçamento duplicado")
              }
              className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border text-ink-soft hover:bg-surface"
              aria-label="Duplicar orçamento"
              title="Duplicar"
            >
              <Copy className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border text-destructive hover:bg-destructive/5"
            aria-label="Excluir orçamento"
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* KPIs financeiros do orçamento (como na ficha: orçamento, recebido, a receber, atrasado) */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border lg:grid-cols-5" aria-label="Resumo financeiro">
        {[
          { label: "Orçamento", value: BRL.format(budget.total_amount || 0), tone: "text-ink" },
          { label: "Recebido", value: BRL.format(received), tone: "text-emerald-700" },
          { label: "A receber", value: BRL.format(toReceive), tone: "text-primary" },
          { label: "Atrasado", value: BRL.format(overdue), tone: overdue > 0 ? "text-rose-700" : "text-ink" },
          { label: "Tratamento", value: `${items.length ? Math.round((executed / items.length) * 100) : 0}%`, tone: "text-ink" },
        ].map((k) => (
          <div key={k.label} className="bg-background p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
            <p className={cn("mt-1.5 font-display text-lg font-semibold tabular", k.tone)}>{k.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.618fr_1fr]">
        {/* Procedimentos */}
        <section className="min-w-0 rounded-md border border-border bg-background" aria-label="Procedimentos do orçamento">
          <PanelHeader title="Procedimentos" aside={<span className="text-[12px] text-muted-foreground">{items.length} item(ns)</span>} />
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  <th scope="col" className="px-5 py-2.5 font-medium">Procedimento</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Região</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Execução</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-5 py-3 font-medium text-ink">{it.resolved.name}</td>
                    <td className="px-3 py-3 text-ink-soft" title={regionLabel(it.resolved.region)}>
                      <span className="rounded-xs bg-secondary px-1.5 py-0.5 font-display text-[11px] font-semibold tabular">{regionShort(it.resolved.region)}</span>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-muted-foreground">{EXECUTION_LABELS[it.execution_status || "pending"]}</td>
                    <td className="px-5 py-3 text-right tabular text-ink">{BRL.format(it.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={3} className="px-5 py-3 text-right text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                    {budget.discount_amount ? `Desconto ${BRL.format(budget.discount_amount)} · ` : ""}Total
                  </td>
                  <td className="px-5 py-3 text-right font-display text-base font-semibold tabular text-ink">{BRL.format(budget.total_amount || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {budget.notes && <p className="whitespace-pre-line border-t border-hairline px-5 py-3 text-[13px] text-ink-soft">{budget.notes}</p>}
        </section>

        {/* Plano de pagamento / parcelas */}
        <section className="min-w-0 self-start rounded-md border border-border bg-background" aria-label="Plano de pagamento">
          <PanelHeader
            title="Plano de pagamento"
            aside={
              <span className="text-[12px] text-muted-foreground">
                {plan.downPayment > 0 ? `Entrada + ` : ""}
                {budget.installment_count || 1}x · {PAYMENT_METHOD_LABELS[(budget.payment_method as PlanPaymentMethod) || "pix"] || "—"}
              </span>
            }
          />
          {installments === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            </div>
          ) : installments.length === 0 ? (
            <div className="px-5 py-6 text-[13px] text-muted-foreground">
              <p>Previsão (ainda não lançada no contas a receber):</p>
              <ul className="mt-3 divide-y divide-hairline">
                {plan.schedule.map((s) => (
                  <li key={`${s.number}-${s.dueDate}`} className="flex justify-between py-2 tabular">
                    <span>
                      {s.label} · {formatDateBR(s.dueDate)}
                    </span>
                    <span className="text-ink">{BRL.format(s.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              <AnimatePresence initial={false}>
                {installments.map((row, idx) => {
                  const isPaid = row.status === "paid"
                  const isLate = !isPaid && (row.due_date || "") < today
                  return (
                    <motion.li key={row.id} layout className="flex items-center gap-3 px-5 py-2.5">
                      <span className="w-14 shrink-0 font-display text-[12px] font-semibold tabular text-ink-soft">
                        {row.installment_number === 0 || /Entrada/.test(row.notes || "") ? "Entr." : `${row.installment_number ?? idx + 1}ª`}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] tabular text-ink">{BRL.format(row.amount)}</span>
                        <span className={cn("block text-[12px]", isLate ? "font-semibold text-rose-700" : "text-muted-foreground")}>
                          {isPaid ? `Recebido em ${formatDateBR(row.payment_date)}` : `Vence ${formatDateBR(row.due_date)}${isLate ? " · atrasada" : ""}`}
                        </span>
                      </span>
                      {isPaid ? (
                        <span className="inline-flex h-9 items-center gap-1 rounded-xs bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-800">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          Pago
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => receive(row)}
                          disabled={busy !== null}
                          className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-border px-3 text-[12.5px] font-semibold text-ink hover:border-primary hover:text-primary disabled:opacity-50 print:hidden"
                        >
                          {busy === `pay-${row.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                          Receber
                        </button>
                      )}
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir orçamento #{budgetCode(budget.id)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Os procedimentos vinculados serão removidos. Parcelas já lançadas no contas a receber permanecem no financeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                run(
                  "delete",
                  async () => {
                    if (!isDemo) {
                      const res = await deleteBudget(budget.id)
                      if (!res.success) throw new Error(res.error)
                    }
                    return { deleted: true }
                  },
                  "Orçamento excluído",
                )
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
