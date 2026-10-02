// Hello World
"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { ArrowRight, CalendarPlus, Download, Loader2, MessageCircle, Receipt, UserPlus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getAppointments } from "@/app/actions/appointments"
import { getPatients } from "@/app/actions/patients"
import { getProfessionals } from "@/app/actions/professionals"
import { getBudgets } from "@/app/actions/budget-actions"
import { getAllPendingPayments } from "@/app/actions/financial-actions"
import { getTodayBirthdays } from "@/app/actions/dashboard"
import { CLINICAL_STATUS, clinicalStatusOf, type ClinicalStatus } from "@/lib/appointment-status"
import { budgetPhase, type Budget } from "@/lib/budget-types"
import { BRL, formatDateBR } from "@/lib/payment-plan"
import { DEMO_PATIENTS, DEMO_PROFESSIONALS, buildDemoAppointments, buildDemoBudgets } from "@/lib/demo-clinic"

interface OverviewTabProps {
  user: { email: string; name: string }
  onNavigate: (tab: string) => void
  isDemo?: boolean
}

interface DayAppointment {
  id: string
  time: string
  end: string
  patient: string
  professional: string
  status: ClinicalStatus
  planned: string | null
}

interface OverduePayment {
  id: string
  patient: string
  amount: number
  due: string
}

interface Birthday {
  id: string
  name: string
  phone: string | null
}

type PendingRow = { id: string; amount: number; due_date: string | null; patients?: { name?: string } | { name?: string }[] | null }
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const addMinutes = (time: string, minutes: number) => {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

/** Mesa: pirâmide invertida — indicadores do dia, depois agenda e pendências, por fim avisos. */
export default function OverviewTab({ user, onNavigate, isDemo = false }: OverviewTabProps) {
  const t = useTranslations("dashboard.overview")
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState<DayAppointment[]>([])
  const [openBudgets, setOpenBudgets] = useState<Budget[]>([])
  const [overdue, setOverdue] = useState<OverduePayment[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [greeting, setGreeting] = useState("Olá")

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite")
    try {
      setShowInstall(!window.matchMedia("(display-mode: standalone)").matches && localStorage.getItem("vwd:hide_pwa_banner") !== "1")
    } catch {
      setShowInstall(false)
    }
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    return () => window.removeEventListener("beforeinstallprompt", onPrompt)
  }, [])

  useEffect(() => {
    const todayISO = toISO(new Date())
    const load = async () => {
      if (isDemo) {
        const names = new Map(DEMO_PATIENTS.map((p) => [p.id, p.name]))
        const profs = new Map(DEMO_PROFESSIONALS.map((p) => [p.id, p.name]))
        setToday(
          buildDemoAppointments()
            .filter((a) => a.appointment_date === todayISO)
            .map((a) => ({
              id: a.id,
              time: a.appointment_time.slice(0, 5),
              end: addMinutes(a.appointment_time.slice(0, 5), a.duration_minutes),
              patient: names.get(a.patient_id) || "Paciente",
              professional: profs.get(a.professional_id) || "",
              status: a.clinical_status,
              planned: a.planned_procedure,
            })),
        )
        setOpenBudgets(buildDemoBudgets().filter((b) => budgetPhase(b.status) === "open"))
        setOverdue([{ id: "o1", patient: "Otávio Ramalho", amount: 500, due: "2026-09-11" }])
        setBirthdays([{ id: "b1", name: "Marina Teixeira", phone: "(62) 99377-5562" }])
        return
      }
      const [apts, patients, profs, budgets, pending, bdays] = await Promise.all([
        getAppointments().catch(() => []),
        getPatients().catch(() => []),
        getProfessionals().catch(() => []),
        getBudgets(),
        getAllPendingPayments(100),
        getTodayBirthdays(),
      ])
      const names = new Map(patients.map((p) => [p.id, p.name]))
      const profNames = new Map(profs.map((p) => [p.id, p.name]))
      setToday(
        apts
          .filter((a) => a.appointment_date === todayISO)
          .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
          .map((a) => ({
            id: a.id,
            time: a.appointment_time.slice(0, 5),
            end: addMinutes(a.appointment_time.slice(0, 5), a.duration_minutes || 30),
            patient: names.get(a.patient_id) || "Paciente",
            professional: profNames.get(a.professional_id) || "",
            status: clinicalStatusOf(a),
            planned: a.planned_procedure ?? null,
          })),
      )
      setOpenBudgets(budgets.filter((b) => budgetPhase(b.status) === "open"))
      setOverdue(
        (pending as PendingRow[])
          .filter((p) => (p.due_date || "") < todayISO)
          .map((p) => {
            const rel = Array.isArray(p.patients) ? p.patients[0] : p.patients
            return { id: p.id, patient: rel?.name || "Paciente", amount: Number(p.amount || 0), due: p.due_date || "" }
          }),
      )
      setBirthdays(bdays.filter((b) => b.type === "client").map((b) => ({ id: b.id, name: b.name, phone: b.phone ?? null })))
    }
    load()
      .catch((error) => console.error("Error loading desk:", error))
      .finally(() => setLoading(false))
  }, [isDemo])

  const kpis = useMemo(() => {
    const inClinic = today.filter((a) => a.status === "reception" || a.status === "in_care").length
    const confirmed = today.filter((a) => a.status === "confirmed").length
    const openValue = openBudgets.reduce((s, b) => s + (b.total_amount || 0), 0)
    const overdueValue = overdue.reduce((s, p) => s + p.amount, 0)
    return [
      { label: "Consultas hoje", value: String(today.length), meta: `${confirmed} confirmada(s) · ${inClinic} na clínica`, tab: "appointments" },
      { label: "Orçamentos em andamento", value: BRL.format(openValue), meta: `${openBudgets.length} aguardando decisão`, tab: "budgets" },
      { label: "Recebimentos vencidos", value: BRL.format(overdueValue), meta: `${overdue.length} parcela(s)`, tab: "financial" },
      { label: "Aniversariantes", value: String(birthdays.length), meta: "pacientes hoje", tab: "patients" },
    ]
  }, [today, openBudgets, overdue, birthdays])

  const install = async () => {
    if (installEvent) {
      await installEvent.prompt()
      const { outcome } = await installEvent.userChoice
      if (outcome === "accepted") setShowInstall(false)
      setInstallEvent(null)
      return
    }
    toast({ title: t("pwa.toast.title"), description: t("pwa.toast.description") })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Carregando a mesa…</span>
      </div>
    )
  }

  const firstName = (user.name || "").split(" ")[0]

  return (
    <div className="space-y-6">
      {/* Saudação e atalhos */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold tracking-[-0.025em] text-ink">
            {greeting}
            {firstName ? `, ${firstName}` : ""}.
          </h2>
          <p className="mt-1 text-[14px] text-ink-soft">
            {today.length === 0 ? "Nenhuma consulta marcada para hoje." : `Hoje são ${today.length} consulta(s) na agenda.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Novo agendamento", icon: CalendarPlus, tab: "appointments", primary: true },
            { label: "Novo orçamento", icon: Receipt, tab: "budgets", primary: false },
            { label: "Novo paciente", icon: UserPlus, tab: "patients", primary: false },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => onNavigate(a.tab)}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-sm px-4 text-[14px] font-semibold transition-colors",
                a.primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-background text-ink hover:bg-surface",
              )}
            >
              <a.icon className="h-4 w-4" aria-hidden />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topo da pirâmide: indicadores */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores do dia">
        {kpis.map((k, i) => (
          <motion.button
            key={k.label}
            type="button"
            onClick={() => onNavigate(k.tab)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28, delay: i * 0.05 }}
            className="group bg-background p-5 text-left transition-colors hover:bg-surface"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold tabular tracking-[-0.02em] text-ink">{k.value}</p>
            <p className="mt-1 flex items-center justify-between text-[12.5px] text-muted-foreground">
              {k.meta}
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
            </p>
          </motion.button>
        ))}
      </section>

      {/* Meio: agenda (61,8%) e pendências (38,2%) */}
      <div className="grid gap-6 xl:grid-cols-[1.618fr_1fr]">
        <section className="min-w-0 rounded-md border border-border bg-background" aria-labelledby="desk-today">
          <div className="flex min-h-12 items-center justify-between border-b border-hairline px-5">
            <h3 id="desk-today" className="font-display text-[14.5px] font-semibold text-ink">
              Agenda de hoje
            </h3>
            <button type="button" onClick={() => onNavigate("appointments")} className="min-h-10 text-[13px] font-medium text-primary hover:underline">
              Abrir agenda
            </button>
          </div>
          {today.length === 0 ? (
            <p className="px-5 py-12 text-center text-[13.5px] text-muted-foreground">A agenda de hoje está livre.</p>
          ) : (
            <ol className="relative px-5 py-3">
              <span className="absolute bottom-6 left-[96px] top-6 w-px bg-hairline" aria-hidden />
              {today.map((a, i) => {
                const meta = CLINICAL_STATUS[a.status]
                return (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28, delay: Math.min(i, 8) * 0.04 }}
                    className="relative grid grid-cols-[64px_1fr] items-start gap-6 py-3"
                  >
                    <span className="pt-0.5 text-right font-display text-[13px] font-semibold tabular text-ink">
                      {a.time}
                      <span className="block text-[11px] font-normal text-muted-foreground">{a.end}</span>
                    </span>
                    <span className={cn("absolute left-[72px] top-[18px] h-2 w-2 rounded-full ring-4 ring-background", meta.rail)} aria-hidden />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14.5px] font-semibold text-ink">{a.patient}</span>
                        <span className={cn("rounded-xs border px-1.5 py-px text-[11px] font-semibold", meta.chip)}>{meta.label}</span>
                      </span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">{[a.planned, a.professional].filter(Boolean).join(" · ")}</span>
                    </span>
                  </motion.li>
                )
              })}
            </ol>
          )}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="rounded-md border border-border bg-background" aria-labelledby="desk-budgets">
            <div className="flex min-h-12 items-center justify-between border-b border-hairline px-5">
              <h3 id="desk-budgets" className="font-display text-[14.5px] font-semibold text-ink">
                Orçamentos aguardando decisão
              </h3>
              <span className="text-[12px] text-muted-foreground">{openBudgets.length}</span>
            </div>
            {openBudgets.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nenhum orçamento em andamento.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {openBudgets.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => onNavigate("budgets")} className="flex min-h-12 w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-surface">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{b.patient?.name || "Paciente"}</span>
                        <span className="block text-[12px] text-muted-foreground">
                          {(b.items || []).length} procedimento(s) · {formatDateBR(b.created_at)}
                        </span>
                      </span>
                      <span className="font-display text-[14px] font-semibold tabular text-ink">{BRL.format(b.total_amount || 0)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-md border border-border bg-background" aria-labelledby="desk-overdue">
            <div className="flex min-h-12 items-center justify-between border-b border-hairline px-5">
              <h3 id="desk-overdue" className="font-display text-[14.5px] font-semibold text-ink">
                Recebimentos vencidos
              </h3>
              <button type="button" onClick={() => onNavigate("financial")} className="min-h-10 text-[13px] font-medium text-primary hover:underline">
                Financeiro
              </button>
            </div>
            {overdue.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nada vencido.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {overdue.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex min-h-12 items-center gap-3 px-5 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{p.patient}</span>
                      <span className="block text-[12px] text-rose-700">Venceu em {formatDateBR(p.due)}</span>
                    </span>
                    <span className="font-display text-[14px] font-semibold tabular text-ink">{BRL.format(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Base: aniversariantes e app */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.618fr]">
        <section className="rounded-md border border-border bg-background" aria-labelledby="desk-birthdays">
          <div className="flex min-h-12 items-center border-b border-hairline px-5">
            <h3 id="desk-birthdays" className="font-display text-[14.5px] font-semibold text-ink">
              Aniversariantes de hoje
            </h3>
          </div>
          {birthdays.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted-foreground">{t("noBirthdays")}</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {birthdays.map((b) => {
                const digits = (b.phone || "").replace(/\D/g, "")
                const link =
                  digits.length >= 10
                    ? `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}?text=${encodeURIComponent(`Feliz aniversário, ${b.name.split(" ")[0]}!`)}`
                    : null
                return (
                  <li key={b.id} className="flex min-h-12 items-center justify-between gap-3 px-5 py-2.5">
                    <span className="text-[13.5px] font-semibold text-ink">{b.name}</span>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border px-3 text-[12.5px] font-medium text-ink hover:bg-surface">
                        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                        Parabenizar
                      </a>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {showInstall && (
          <section className="relative flex flex-col justify-between gap-4 rounded-md border border-border bg-background p-5 sm:flex-row sm:items-center" aria-labelledby="desk-pwa">
            <div className="min-w-0 pr-8">
              <h3 id="desk-pwa" className="font-display text-[14.5px] font-semibold text-ink">
                {t("pwa.title")}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{t("pwa.description")}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={install} className="inline-flex h-11 items-center gap-2 rounded-sm bg-[#0f1f33] px-4 text-[13.5px] font-semibold text-white hover:bg-[#1b2f48]">
                <Download className="h-4 w-4" aria-hidden />
                {t("pwa.install")}
              </button>
              <button type="button" onClick={() => onNavigate("tutorial")} className="h-11 rounded-sm border border-border px-4 text-[13.5px] font-medium text-ink hover:bg-surface">
                {t("pwa.tutorial")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowInstall(false)
                try {
                  localStorage.setItem("vwd:hide_pwa_banner", "1")
                } catch {
                  // ignorado
                }
              }}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-ink"
              aria-label="Dispensar aviso do app"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </section>
        )}
      </div>
    </div>
  )
}
