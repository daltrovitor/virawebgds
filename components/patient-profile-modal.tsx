// Hello World
"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  AlertTriangle,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Receipt,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Odontogram, { type ToothData } from "@/components/dental/odontogram"
import { TOOTH_CONDITION_LABELS, toothName, type ToothCondition } from "@/lib/teeth"
import { getPatientById, updatePatientFiles, updatePatientNotes, updatePatientPhoto, type Patient } from "@/app/actions/patients"
import { getPatientAppointments, updateAppointmentOccurrence } from "@/app/actions/appointments"
import { getPatientFinancialSummary, getRecentPayments, type Payment } from "@/app/actions/financial-actions"
import { getPatientBudgetSummaries, getPatientTreatmentQueue, type PatientBudgetSummary, type TreatmentQueueItem } from "@/app/actions/budget-actions"
import { getProfessionals } from "@/app/actions/professionals"
import { mapDbErrorToUserMessage } from "@/lib/error-messages"
import PaymentModal from "@/components/financial/payment-modal"
import { PatientFinancialTab } from "@/components/financial/patient-financial-tab"
import { CLINICAL_STATUS, clinicalStatusOf, isAbsenceOrCancellation, needsStatusClosure } from "@/lib/appointment-status"
import { BUDGET_STATUS_LABELS, EXECUTION_LABELS, budgetPhase } from "@/lib/budget-types"
import { decodeRegion, regionShort, splitRegionSuffix } from "@/lib/dental-regions"
import { anamnesisAlerts, loadAnamnesis, type ClinicalAlert } from "@/lib/anamnesis"
import { BRL, formatDateBR } from "@/lib/payment-plan"
import { DEMO_PATIENTS, DEMO_PROFESSIONALS, buildDemoAppointments, buildDemoBudgets } from "@/lib/demo-clinic"
import { createClient } from "@/lib/supabase-client"

interface PatientProfileModalProps {
  patientId: string | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
  isDemo?: boolean
}

interface ApptRow {
  id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: string
  clinical_status?: string | null
  notes: string | null
  planned_procedure?: string | null
  occurrence?: string | null
}

type StoredFile = { id: string; name: string; url: string; type: "image" | "file"; uploadedAt: string }

type TabId = "record" | "odontogram" | "treatment" | "appointments" | "financial" | "files" | "data"
const TABS: { id: TabId; label: string }[] = [
  { id: "record", label: "Ficha" },
  { id: "odontogram", label: "Odontograma" },
  { id: "treatment", label: "Tratamento" },
  { id: "appointments", label: "Agendamentos" },
  { id: "financial", label: "Financeiro" },
  { id: "files", label: "Imagens e arquivos" },
  { id: "data", label: "Dados e anamnese" },
]

/** "47 anos, 9 meses e 30 dias" — idade completa como nas fichas odontológicas. */
function fullAge(birth: string | null | undefined): string | null {
  if (!birth) return null
  const [y, m, d] = birth.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return null
  const now = new Date()
  let years = now.getFullYear() - y
  let months = now.getMonth() + 1 - m
  let days = now.getDate() - d
  if (days < 0) {
    months -= 1
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  if (years < 0 || years > 130) return null
  const parts = [`${years} ano${years === 1 ? "" : "s"}`, `${months} ${months === 1 ? "mês" : "meses"}`, `${days} dia${days === 1 ? "" : "s"}`]
  return `${parts[0]}, ${parts[1]} e ${parts[2]}`
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function waLink(phone?: string | null): string | null {
  const digits = (phone || "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`
}

const goToTab = (tab: string) => window.dispatchEvent(new CustomEvent("vwd:goto_tab", { detail: tab }))

export default function PatientProfileModal({ patientId, isOpen, onClose, onUpdate, isDemo = false }: PatientProfileModalProps) {
  const { toast } = useToast()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TabId>("record")
  const [appointments, setAppointments] = useState<ApptRow[]>([])
  const [professionals, setProfessionals] = useState<Map<string, string>>(new Map())
  const [budgets, setBudgets] = useState<PatientBudgetSummary[]>([])
  const [queue, setQueue] = useState<TreatmentQueueItem[]>([])
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([])
  const [financialSummary, setFinancialSummary] = useState<{ paid: number; due: number; discounts: number } | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [files, setFiles] = useState<StoredFile[]>([])
  const [notes, setNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    setAlerts(anamnesisAlerts(loadAnamnesis(patientId)))
    try {
      if (isDemo) {
        const demo = DEMO_PATIENTS.find((p) => p.id === patientId) || DEMO_PATIENTS[0]
        setPatient({
          id: patientId,
          user_id: "demo",
          name: demo.name,
          email: demo.email,
          phone: demo.phone,
          cpf: demo.cpf,
          date_of_birth: demo.date_of_birth,
          birthday: null,
          address: demo.address,
          notes: "Prefere atendimento no período da manhã.",
          profile_photo_url: null,
          patient_files: [],
          status: "active",
          payment_status: null,
          last_payment_date: null,
          payment_due_date: null,
          created_at: "2024-02-10T12:00:00.000Z",
          updated_at: "2026-09-28T12:00:00.000Z",
        })
        setNotes("Prefere atendimento no período da manhã.")
        setAppointments(buildDemoAppointments().filter((a) => a.patient_id === demo.id))
        setProfessionals(new Map(DEMO_PROFESSIONALS.map((p) => [p.id, p.name])))
        const demoBudgets = buildDemoBudgets().filter((b) => b.patient_id === demo.id)
        setBudgets(
          demoBudgets.map((b) => {
            const items = b.items || []
            const closed = budgetPhase(b.status) === "closed"
            return {
              id: b.id,
              status: b.status,
              created_at: b.created_at,
              updated_at: b.updated_at,
              total_amount: b.total_amount,
              discount_amount: b.discount_amount || 0,
              items: items.length,
              executed: items.filter((i) => i.execution_status === "completed").length,
              received: closed ? Math.round((b.total_amount / Math.max(1, b.installment_count)) * 2 * 100) / 100 : 0,
              pending: closed ? Math.round((b.total_amount - (b.total_amount / Math.max(1, b.installment_count)) * 2) * 100) / 100 : 0,
              overdue: 0,
            }
          }),
        )
        setQueue(
          demoBudgets
            .filter((b) => budgetPhase(b.status) === "closed")
            .flatMap((b) =>
              (b.items || []).map((it) => ({
                id: it.id,
                budget_id: b.id,
                budget_tag: `#${b.id.replace(/\D/g, "")}`,
                product_name: it.product_name,
                tooth: it.tooth ?? null,
                region: it.region ?? null,
                execution_status: it.execution_status || "pending",
                trackable: true,
              })),
            ),
        )
        setFinancialSummary({ paid: 6416.67, due: 25683.33, discounts: 0 })
        setPayments([])
        setFiles([])
        return
      }

      const [data, apts, profs, budgetRows, queueRows, fin, recent] = await Promise.all([
        getPatientById(patientId),
        getPatientAppointments(patientId),
        getProfessionals(),
        getPatientBudgetSummaries(patientId),
        getPatientTreatmentQueue(patientId),
        getPatientFinancialSummary(patientId),
        getRecentPayments(50),
      ])
      setPatient(data)
      setNotes(data.notes || "")
      setFiles((data.patient_files as StoredFile[] | null) || [])
      setAppointments(apts as ApptRow[])
      setProfessionals(new Map(profs.map((p) => [p.id, p.name])))
      setBudgets(budgetRows)
      setQueue(queueRows)
      setFinancialSummary(fin)
      setPayments(recent)
    } catch (error) {
      toast({
        title: "Não foi possível abrir a ficha",
        description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [patientId, isDemo, toast])

  useEffect(() => {
    if (isOpen && patientId) {
      setTab("record")
      load()
    }
  }, [isOpen, patientId, load])

  // ---------------------------------------------------------------- derivados
  const today = new Date().toISOString().slice(0, 10)
  const groups = useMemo(() => {
    const withStatus = appointments.map((a) => ({ ...a, cs: clinicalStatusOf(a) }))
    const byDateDesc = (a: ApptRow, b: ApptRow) => `${b.appointment_date}${b.appointment_time}`.localeCompare(`${a.appointment_date}${a.appointment_time}`)
    return {
      future: withStatus
        .filter((a) => a.appointment_date >= today && !isAbsenceOrCancellation(a.cs))
        .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`)),
      unclosed: withStatus.filter((a) => a.appointment_date < today && needsStatusClosure(a.cs)).sort(byDateDesc),
      absences: withStatus.filter((a) => isAbsenceOrCancellation(a.cs)).sort(byDateDesc),
      all: withStatus.sort(byDateDesc),
    }
  }, [appointments, today])

  const images = files.filter((f) => f.type === "image")

  // ---------------------------------------------------------------- ações
  const saveNotes = async () => {
    if (!patientId) return
    setSavingNotes(true)
    try {
      if (!isDemo) await updatePatientNotes(patientId, notes)
      setPatient((p) => (p ? { ...p, notes } : p))
      toast({ title: "Observações salvas" })
      onUpdate?.()
    } catch (error) {
      toast({ title: "Não foi possível salvar", description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)), variant: "destructive" })
    } finally {
      setSavingNotes(false)
    }
  }

  const readAsDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!patientId || !file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem (JPG, PNG ou WebP).", variant: "destructive" })
      return
    }
    setUploadingPhoto(true)
    try {
      const url = await readAsDataUrl(file)
      if (!isDemo) await updatePatientPhoto(patientId, url)
      setPatient((p) => (p ? { ...p, profile_photo_url: url } : p))
      toast({ title: "Foto atualizada" })
      onUpdate?.()
    } catch (error) {
      toast({ title: "Falha no envio", description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)), variant: "destructive" })
    } finally {
      setUploadingPhoto(false)
    }
  }

  const uploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!patientId || !e.target.files?.length) return
    setUploadingFiles(true)
    try {
      const added: StoredFile[] = []
      for (const file of Array.from(e.target.files)) {
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: await readAsDataUrl(file),
          type: file.type.startsWith("image/") ? "image" : "file",
          uploadedAt: new Date().toISOString(),
        })
      }
      const next = [...files, ...added]
      if (!isDemo) await updatePatientFiles(patientId, next)
      setFiles(next)
      toast({ title: `${added.length} arquivo(s) adicionado(s)` })
      onUpdate?.()
    } catch (error) {
      toast({ title: "Falha no envio", description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)), variant: "destructive" })
    } finally {
      setUploadingFiles(false)
      e.target.value = ""
    }
  }

  const deleteFile = async (id: string) => {
    if (!patientId) return
    const next = files.filter((f) => f.id !== id)
    try {
      if (!isDemo) await updatePatientFiles(patientId, next)
      setFiles(next)
      toast({ title: "Arquivo removido" })
    } catch {
      toast({ title: "Não foi possível remover", variant: "destructive" })
    }
  }

  const startBudget = () => {
    if (!patientId) return
    try {
      sessionStorage.setItem("vwd:budget_prefill_patient", patientId)
    } catch {
      // segue sem pré-seleção
    }
    onClose()
    goToTab("budgets")
  }

  const startAppointment = () => {
    onClose()
    goToTab("appointments")
  }

  const age = fullAge(patient?.date_of_birth || patient?.birthday)
  const whatsapp = waLink(patient?.phone)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94vh] w-[98vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl" data-lenis-prevent>
        {loading || !patient ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24" role="status">
            <DialogTitle className="sr-only">Ficha do paciente</DialogTitle>
            <DialogDescription className="sr-only">Carregando dados do paciente</DialogDescription>
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <span className="text-[13px] text-muted-foreground">Abrindo ficha…</span>
          </div>
        ) : (
          <>
            {/* Cabeçalho da ficha */}
            <header className="shrink-0 border-b border-border px-5 pb-0 pt-5 sm:px-8 sm:pt-7">
              <div className="flex flex-col gap-5 pr-10 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                  <div className="relative shrink-0">
                    <div className="h-20 w-20 overflow-hidden rounded-full border border-border bg-secondary sm:h-24 sm:w-24">
                      {patient.profile_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- data URL armazenada no cadastro
                        <img src={patient.profile_photo_url} alt={`Foto de ${patient.name}`} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-ink-soft">{initials(patient.name)}</span>
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-ink-soft shadow-sm hover:text-primary">
                      {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                      <span className="sr-only">Trocar foto</span>
                      <input type="file" accept="image/*" className="sr-only" onChange={uploadPhoto} disabled={uploadingPhoto} />
                    </label>
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="font-display text-2xl font-semibold uppercase tracking-[-0.01em] text-ink sm:text-[1.75rem]">{patient.name}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-[13px] text-muted-foreground">{age || "Data de nascimento não informada"}</DialogDescription>
                    <dl className="mt-2 grid gap-x-6 gap-y-0.5 text-[13px] text-ink-soft sm:grid-cols-2">
                      {patient.phone && (
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">Celular</dt>
                          <dd>
                            {whatsapp ? (
                              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                                <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                                {patient.phone}
                              </a>
                            ) : (
                              patient.phone
                            )}
                          </dd>
                        </div>
                      )}
                      {patient.cpf && (
                        <div className="flex gap-1.5">
                          <dt className="text-muted-foreground">CPF</dt>
                          <dd className="tabular">{patient.cpf}</dd>
                        </div>
                      )}
                      {patient.email && (
                        <div className="flex min-w-0 gap-1.5">
                          <dt className="text-muted-foreground">E-mail</dt>
                          <dd className="truncate">{patient.email}</dd>
                        </div>
                      )}
                      {patient.address && (
                        <div className="flex min-w-0 gap-1.5 sm:col-span-2">
                          <dt className="text-muted-foreground">Endereço</dt>
                          <dd className="truncate">{patient.address}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" onClick={startAppointment} className="inline-flex h-11 items-center gap-2 rounded-sm border border-border px-4 text-[13.5px] font-semibold text-ink hover:bg-surface">
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                    Agendar
                  </button>
                  <button type="button" onClick={startBudget} className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90">
                    <Receipt className="h-4 w-4" aria-hidden />
                    Novo orçamento
                  </button>
                </div>
              </div>

              {/* Alertas: anamnese (críticos) e observação da ficha */}
              {(alerts.length > 0 || patient.notes) && (
                <div className="mt-5 space-y-2">
                  {alerts.length > 0 && (
                    <div className="flex gap-3 rounded-sm border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900" role="alert">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden />
                      <p>
                        <strong className="font-semibold">Alertas da anamnese:</strong> {alerts.map((a) => a.title + (a.details ? ` (${a.details})` : "")).join(" · ")}
                      </p>
                    </div>
                  )}
                  {patient.notes && (
                    <div className="flex gap-3 rounded-sm border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                      <p className="line-clamp-2 whitespace-pre-line">{patient.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Abas */}
              <nav className="-mx-1 mt-5 flex overflow-x-auto" role="tablist" aria-label="Seções da ficha">
                {TABS.map((tItem) => (
                  <button
                    key={tItem.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === tItem.id}
                    onClick={() => setTab(tItem.id)}
                    className={cn("relative min-h-12 shrink-0 px-3.5 text-[13.5px] font-medium transition-colors", tab === tItem.id ? "text-ink" : "text-muted-foreground hover:text-ink")}
                  >
                    {tItem.label}
                    {tab === tItem.id && <motion.span layoutId="vwo-record-tab" className="absolute inset-x-2 bottom-0 h-[2px] bg-primary" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  </button>
                ))}
              </nav>
            </header>

            {/* Conteúdo */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface px-5 py-6 sm:px-8" data-lenis-prevent>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
                  {tab === "record" && (
                    <div className="grid gap-5 lg:grid-cols-[1fr_1.618fr]">
                      <div className="min-w-0 space-y-5">
                        <AppointmentList title="Agendamentos futuros" rows={groups.future} professionals={professionals} empty="Nenhum agendamento futuro." onSeeAll={() => setTab("appointments")} />
                        <AppointmentList title="Agendamentos sem baixa de status" rows={groups.unclosed} professionals={professionals} empty="Tudo em dia." onSeeAll={() => setTab("appointments")} />
                        <AppointmentList title="Faltas e desmarcações" rows={groups.absences} professionals={professionals} empty="Nenhuma falta registrada." onSeeAll={() => setTab("appointments")} />
                      </div>
                      <div className="min-w-0 space-y-5">
                        <ImageCarousel images={images} onAdd={() => setTab("files")} />
                        <BudgetSummaryPanel budgets={budgets} onNew={startBudget} />
                      </div>
                    </div>
                  )}

                  {tab === "odontogram" && patientId && <PatientOdontogram patientId={patientId} isDemo={isDemo} />}

                  {tab === "treatment" && <TreatmentQueue items={queue} />}

                  {tab === "appointments" && (
                    <Panel title="Histórico de agendamentos" aside={`${groups.all.length} registro(s)`}>
                      {groups.all.length === 0 ? (
                        <EmptyLine text="Nenhum agendamento registrado." />
                      ) : (
                        <ul className="divide-y divide-hairline">
                          {groups.all.map((a) => (
                            <li key={a.id} className="space-y-2 px-4 py-3.5 sm:px-5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[14px] font-semibold text-ink">
                                  <span className="inline-block first-letter:uppercase">{new Date(`${a.appointment_date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                                  <span className="font-normal text-ink-soft"> · {a.appointment_time.slice(0, 5)}</span>
                                  {professionals.get(a.professional_id) && <span className="font-normal text-muted-foreground"> · {professionals.get(a.professional_id)}</span>}
                                </p>
                                <span className={cn("rounded-xs border px-2 py-0.5 text-[11.5px] font-semibold", CLINICAL_STATUS[a.cs].chip)}>{CLINICAL_STATUS[a.cs].label}</span>
                              </div>
                              {a.planned_procedure && (
                                <p className="text-[13px] text-ink-soft">
                                  <span className="text-muted-foreground">Previsto:</span> {a.planned_procedure}
                                </p>
                              )}
                              <OccurrenceEditor
                                value={a.occurrence || ""}
                                onSave={async (text) => {
                                  if (!isDemo) await updateAppointmentOccurrence(a.id, text)
                                  setAppointments((prev) => prev.map((x) => (x.id === a.id ? { ...x, occurrence: text } : x)))
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </Panel>
                  )}

                  {tab === "financial" && patientId && (
                    <div className="space-y-5">
                      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-3" aria-label="Resumo financeiro">
                        {[
                          { label: "Recebido", value: financialSummary?.paid ?? 0, tone: "text-emerald-700" },
                          { label: "A receber", value: financialSummary?.due ?? 0, tone: "text-primary" },
                          { label: "Descontos", value: financialSummary?.discounts ?? 0, tone: "text-ink" },
                        ].map((k) => (
                          <div key={k.label} className="bg-background p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
                            <p className={cn("mt-1 font-display text-xl font-semibold tabular", k.tone)}>{BRL.format(k.value)}</p>
                          </div>
                        ))}
                      </section>
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setShowPaymentModal(true)} className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90">
                          Registrar recebimento
                        </button>
                      </div>
                      <PatientFinancialTab
                        patientId={patientId}
                        payments={payments.filter((p) => p.patient_id === patientId)}
                        onOpenPaymentModal={(pendingId) => {
                          setPendingPaymentId(pendingId || null)
                          setShowPaymentModal(true)
                        }}
                      />
                    </div>
                  )}

                  {tab === "files" && (
                    <div className="space-y-5">
                      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-6 py-10 text-center hover:border-primary/60">
                        {uploadingFiles ? <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden /> : <Upload className="h-6 w-6 text-primary" aria-hidden />}
                        <span className="font-display text-[15px] font-semibold text-ink">Adicionar radiografias, fotos e documentos</span>
                        <span className="text-[12.5px] text-muted-foreground">Imagens, PDF, Word ou Excel</span>
                        <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only" onChange={uploadFiles} disabled={uploadingFiles} />
                      </label>
                      {files.length === 0 ? (
                        <EmptyLine text="Nenhum arquivo nesta ficha." />
                      ) : (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {files.map((f) => (
                            <li key={f.id} className="group overflow-hidden rounded-md border border-border bg-background">
                              {f.type === "image" ? (
                                // eslint-disable-next-line @next/next/no-img-element -- arquivo do paciente em data URL
                                <img src={f.url} alt={f.name} className="h-40 w-full object-cover" />
                              ) : (
                                <div className="flex h-40 items-center justify-center bg-secondary">
                                  <FileIcon className="h-8 w-8 text-muted-foreground" aria-hidden />
                                </div>
                              )}
                              <div className="flex items-center gap-2 px-3 py-2">
                                <p className="min-w-0 flex-1 truncate text-[13px] text-ink" title={f.name}>
                                  {f.name}
                                </p>
                                <a href={f.url} download={f.name} className="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-ink" aria-label={`Baixar ${f.name}`}>
                                  <Download className="h-4 w-4" aria-hidden />
                                </a>
                                <button type="button" onClick={() => deleteFile(f.id)} className="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground hover:bg-destructive/5 hover:text-destructive" aria-label={`Remover ${f.name}`}>
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {tab === "data" && (
                    <div className="grid gap-5 lg:grid-cols-[1.618fr_1fr]">
                      <Panel title="Observações da ficha">
                        <div className="space-y-3 p-4 sm:p-5">
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={8}
                            aria-label="Observações da ficha"
                            placeholder="Ex.: contrato assinado e entregue, preferências de horário, responsável financeiro…"
                            className="w-full rounded-sm border border-input bg-background px-3 py-2.5 text-[14px] leading-relaxed focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          />
                          <button type="button" onClick={saveNotes} disabled={savingNotes} className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                            {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                            Salvar observações
                          </button>
                        </div>
                      </Panel>
                      <Panel title="Anamnese" aside={alerts.length ? `${alerts.length} alerta(s)` : undefined}>
                        {alerts.length === 0 ? (
                          <div className="space-y-3 p-4 sm:p-5">
                            <p className="text-[13px] text-muted-foreground">Nenhum alerta registrado para este paciente.</p>
                            <button
                              type="button"
                              onClick={() => {
                                onClose()
                                goToTab("anamnesis")
                              }}
                              className="inline-flex h-10 items-center rounded-sm border border-border px-3 text-[13px] font-medium text-ink hover:bg-surface"
                            >
                              Preencher anamnese
                            </button>
                          </div>
                        ) : (
                          <ul className="divide-y divide-hairline">
                            {alerts.map((a) => (
                              <li key={a.id} className="px-4 py-3 sm:px-5">
                                <p className={cn("text-[13.5px] font-semibold", a.critical ? "text-rose-800" : "text-ink")}>{a.title}</p>
                                {a.details && <p className="text-[12.5px] text-ink-soft">{a.details}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </Panel>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </DialogContent>

      {patientId && !isDemo && (
        <PaymentModal
          open={showPaymentModal}
          onOpenChange={(open) => {
            setShowPaymentModal(open)
            if (!open) {
              setPendingPaymentId(null)
              load()
            }
          }}
          defaultPatientId={patientId}
          onSaved={load}
          initialSettlePending={Boolean(pendingPaymentId)}
          initialPendingPaymentId={pendingPaymentId}
        />
      )}
    </Dialog>
  )
}

/* ================================================================== */
/* Subcomponentes                                                      */
/* ================================================================== */

function Panel({ title, aside, children, action }: { title: string; aside?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-md border border-border bg-background">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-hairline px-4 sm:px-5">
        <h3 className="font-display text-[14.5px] font-semibold text-ink">{title}</h3>
        <div className="flex items-center gap-2">
          {aside && <span className="text-[12px] text-muted-foreground">{aside}</span>}
          {action}
        </div>
      </div>
      {children}
    </section>
  )
}

function EmptyLine({ text }: { text: string }) {
  return <p className="px-4 py-6 text-center text-[13px] text-muted-foreground sm:px-5">{text}</p>
}

function AppointmentList({
  title,
  rows,
  professionals,
  empty,
  onSeeAll,
}: {
  title: string
  rows: Array<ApptRow & { cs: ReturnType<typeof clinicalStatusOf> }>
  professionals: Map<string, string>
  empty: string
  onSeeAll: () => void
}) {
  const visible = rows.slice(0, 4)
  return (
    <Panel
      title={title}
      action={
        rows.length > 4 ? (
          <button type="button" onClick={onSeeAll} className="h-9 rounded-sm border border-border px-2.5 text-[12px] font-medium text-ink hover:bg-surface">
            Ver todos ({rows.length})
          </button>
        ) : undefined
      }
    >
      {visible.length === 0 ? (
        <EmptyLine text={empty} />
      ) : (
        <ul className="divide-y divide-hairline">
          {visible.map((a) => {
            const end = (() => {
              const [h, m] = a.appointment_time.split(":").map(Number)
              const mins = h * 60 + m + (a.duration_minutes || 0)
              return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
            })()
            const prof = professionals.get(a.professional_id)
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold tabular text-ink">
                    {formatDateBR(a.appointment_date)} · {a.appointment_time.slice(0, 5)} às {end}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {CLINICAL_STATUS[a.cs].label}
                    {a.planned_procedure ? ` · ${a.planned_procedure}` : ""}
                  </p>
                </div>
                {prof && (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-[11px] font-semibold text-ink-soft" title={prof} aria-label={prof}>
                    {initials(prof.replace(/^(Dra?\.)\s*/i, ""))}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

function ImageCarousel({ images, onAdd }: { images: StoredFile[]; onAdd: () => void }) {
  const [index, setIndex] = useState(0)
  const current = images[Math.min(index, images.length - 1)]
  return (
    <Panel
      title="Imagens"
      aside={images.length ? `${Math.min(index, images.length - 1) + 1} de ${images.length}` : undefined}
      action={
        <button type="button" onClick={onAdd} className="h-9 rounded-sm border border-border px-2.5 text-[12px] font-medium text-ink hover:bg-surface">
          Adicionar
        </button>
      }
    >
      {!current ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <ImageIcon className="h-7 w-7 text-muted-foreground/60" aria-hidden />
          <p className="text-[13px] text-muted-foreground">Radiografias e fotos clínicas aparecem aqui.</p>
        </div>
      ) : (
        <div className="relative bg-[#0b1522]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={current.id}
              src={current.url}
              alt={current.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mx-auto h-72 w-full object-contain"
            />
          </AnimatePresence>
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm bg-white/90 text-ink hover:bg-white" aria-label="Imagem anterior">
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <button type="button" onClick={() => setIndex((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-sm bg-white/90 text-ink hover:bg-white" aria-label="Próxima imagem">
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      )}
    </Panel>
  )
}

const PHASE_TINT = {
  open: "bg-amber-50/70",
  closed: "bg-emerald-50/70",
  rejected: "bg-rose-50/60",
} as const

function BudgetSummaryPanel({ budgets, onNew }: { budgets: PatientBudgetSummary[]; onNew: () => void }) {
  return (
    <Panel
      title="Orçamentos"
      action={
        <button type="button" onClick={onNew} className="h-9 rounded-sm bg-primary px-3 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90">
          Novo
        </button>
      }
    >
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-hairline px-4 py-2 text-[11.5px] text-muted-foreground sm:px-5" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-amber-200 bg-amber-50" />Em andamento</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-emerald-200 bg-emerald-50" />Fechado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-xs border border-rose-200 bg-rose-50" />Reprovado</span>
      </div>
      {budgets.length === 0 ? (
        <EmptyLine text="Nenhum orçamento para este paciente." />
      ) : (
        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Nº</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Tratamento</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Orçamento</th>
                <th scope="col" className="px-2 py-2.5 font-medium">Recebido</th>
                <th scope="col" className="px-2 py-2.5 font-medium">A receber</th>
                <th scope="col" className="px-4 py-2.5 font-medium sm:px-5">Atrasado</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => {
                const phase = budgetPhase(b.status)
                const progress = b.items ? Math.round((b.executed / b.items) * 100) : 0
                const receivedPct = b.total_amount ? Math.round((b.received / b.total_amount) * 100) : 0
                return (
                  <tr key={b.id} className={cn("border-t border-hairline align-top", PHASE_TINT[phase])}>
                    <td className="px-4 py-3 sm:px-5">
                      <p className="font-display font-semibold tabular text-primary">#{/(\d{3,})$/.exec(b.id)?.[1] ?? b.id.slice(0, 6).toUpperCase()}</p>
                      <p className="text-[11.5px] font-semibold text-ink-soft">{BUDGET_STATUS_LABELS[b.status]}</p>
                      <p className="text-[11.5px] text-muted-foreground">{formatDateBR(b.created_at)}</p>
                    </td>
                    <td className="px-2 py-3 tabular text-ink">{progress}%</td>
                    <td className="px-2 py-3 tabular">
                      <p className="text-ink">{BRL.format(b.total_amount + b.discount_amount)}</p>
                      {b.discount_amount > 0 && <p className="text-[11.5px] text-amber-800">− {BRL.format(b.discount_amount)}</p>}
                      <p className="font-semibold text-ink">{BRL.format(b.total_amount)}</p>
                    </td>
                    <td className="px-2 py-3 tabular">
                      <p className="font-semibold text-emerald-700">{BRL.format(b.received)}</p>
                      <p className="text-[11.5px] text-muted-foreground">{receivedPct}%</p>
                    </td>
                    <td className="px-2 py-3 tabular text-primary">{BRL.format(b.pending)}</td>
                    <td className={cn("px-4 py-3 tabular sm:px-5", b.overdue > 0 ? "font-semibold text-rose-700" : "text-muted-foreground")}>{BRL.format(b.overdue)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function TreatmentQueue({ items }: { items: TreatmentQueueItem[] }) {
  const done = items.filter((i) => i.execution_status === "completed").length
  return (
    <Panel title="Plano de tratamento" aside={items.length ? `${done} de ${items.length} concluído(s)` : undefined}>
      {items.length === 0 ? (
        <EmptyLine text="Os procedimentos aparecem aqui quando um orçamento é fechado." />
      ) : (
        <>
          <div className="px-4 pt-4 sm:px-5" aria-hidden>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(done / items.length) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
            </div>
          </div>
          <ul className="mt-2 divide-y divide-hairline">
            {items.map((item) => {
              const legacy = splitRegionSuffix(item.product_name)
              const hasCols = Boolean(item.region) || typeof item.tooth === "number"
              const region = hasCols ? decodeRegion(item.region, item.tooth) : legacy.region
              const name = hasCols ? item.product_name : legacy.name
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-12 shrink-0 rounded-xs bg-secondary px-1.5 py-0.5 text-center font-display text-[11px] font-semibold tabular text-ink-soft">{regionShort(region)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{name}</span>
                    <span className="block text-[12px] text-muted-foreground">Orçamento {item.budget_tag}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-xs border px-2 py-0.5 text-[11.5px] font-semibold",
                      item.execution_status === "completed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : item.execution_status === "in_progress"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-border bg-background text-ink-soft",
                    )}
                  >
                    {EXECUTION_LABELS[item.execution_status]}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Panel>
  )
}

function OccurrenceEditor({ value, onSave }: { value: string; onSave: (text: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  useEffect(() => setText(value), [value])

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[13px]", value ? "text-ink-soft" : "italic text-muted-foreground")}>
          <span className="not-italic text-muted-foreground">Realizado:</span> {value || "sem registro"}
        </p>
        <button type="button" onClick={() => setEditing(true)} className="h-9 shrink-0 rounded-sm px-2.5 text-[12.5px] font-medium text-primary hover:bg-accent">
          {value ? "Editar" : "Registrar"}
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        autoFocus
        aria-label="Evolução do atendimento"
        className="w-full rounded-sm border border-input bg-background px-3 py-2 text-[13.5px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave(text)
              setEditing(false)
              toast({ title: "Evolução registrada" })
            } catch {
              toast({ title: "Não foi possível salvar", variant: "destructive" })
            } finally {
              setSaving(false)
            }
          }}
          className="inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Salvar
        </button>
        <button type="button" onClick={() => { setText(value); setEditing(false) }} className="h-10 rounded-sm border border-border px-4 text-[13px] font-medium text-ink hover:bg-surface">
          Cancelar
        </button>
      </div>
    </div>
  )
}

/** Odontograma da ficha: mesmo armazenamento da aba Odontograma (sem dados fictícios para pacientes reais). */
function PatientOdontogram({ patientId, isDemo }: { patientId: string; isDemo: boolean }) {
  const { toast } = useToast()
  const [teeth, setTeeth] = useState<Record<number, ToothData>>({})
  const [selected, setSelected] = useState<number[]>([])
  const [inspected, setInspected] = useState<number | null>(null)
  const [condition, setCondition] = useState<ToothCondition>("healthy")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    try {
      const raw = isDemo ? null : localStorage.getItem(`vwd:odontogram:${patientId}`)
      setTeeth(raw ? (JSON.parse(raw) as Record<number, ToothData>) : isDemo ? { 11: { condition: "prosthesis", notes: "Faceta E.max" }, 21: { condition: "prosthesis", notes: "Faceta E.max" }, 36: { condition: "endodontic" } } : {})
    } catch {
      setTeeth({})
    }
  }, [patientId, isDemo])

  const apply = (cond: ToothCondition) => {
    if (inspected === null) return
    setCondition(cond)
    setTeeth((prev) => ({ ...prev, [inspected]: { ...prev[inspected], condition: cond, notes: note } }))
  }

  const save = async () => {
    setSaving(true)
    try {
      if (!isDemo) {
        localStorage.setItem(`vwd:odontogram:${patientId}`, JSON.stringify(teeth))
        try {
          await createClient().from("odontogram_records").upsert({ patient_id: patientId, data: teeth, updated_at: new Date().toISOString() } as never)
        } catch {
          // tabela opcional (migração 070)
        }
      }
      toast({ title: "Odontograma salvo" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Odontogram
        selectedTeeth={selected}
        onSelectionChange={setSelected}
        teethData={teeth}
        onToothClick={(t) => {
          setInspected(t)
          setCondition(teeth[t]?.condition || "healthy")
          setNote(teeth[t]?.notes || "")
        }}
      />
      {inspected !== null && (
        <section className="space-y-3 rounded-md border border-border bg-background p-4" aria-label={`Dente ${inspected}`}>
          <p className="text-[13.5px] font-semibold text-ink">
            Dente {inspected} <span className="font-normal text-muted-foreground">· {toothName(inspected)}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TOOTH_CONDITION_LABELS) as ToothCondition[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={condition === c}
                onClick={() => apply(c)}
                className={cn("min-h-9 rounded-sm border px-2.5 text-[12px] font-medium", condition === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-ink-soft hover:border-primary/50")}
              >
                {TOOTH_CONDITION_LABELS[c]}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => inspected !== null && setTeeth((prev) => ({ ...prev, [inspected]: { ...prev[inspected], condition, notes: note } }))}
            placeholder="Anotação clínica do dente"
            aria-label="Anotação clínica do dente"
            className="h-11 w-full rounded-sm border border-input bg-background px-3 text-[14px] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </section>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Salvar odontograma
        </button>
      </div>
    </div>
  )
}
