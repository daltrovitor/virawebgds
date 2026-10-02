// Hello World
"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CalendarClock, Check, ExternalLink, Loader2, MessageCircle, Pencil, Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { Field, NativeSelect, TextArea } from "@/components/dental/form-primitives"
import {
  CLINICAL_STATUS,
  CLINICAL_STATUS_ORDER,
  clinicalStatusOf,
  type ClinicalStatus,
} from "@/lib/appointment-status"
import { EXECUTION_LABELS, type BudgetItemExecution } from "@/lib/budget-types"
import { decodeRegion, regionShort, splitRegionSuffix } from "@/lib/dental-regions"
import type { Appointment } from "./weekly-view"
import type { TreatmentQueueItem } from "@/app/actions/budget-actions"

export interface SheetPatient {
  id: string
  name: string
  phone?: string | null
}

/** Próximo passo natural do fluxo da recepção. */
const NEXT_STEP: Partial<Record<ClinicalStatus, { to: ClinicalStatus; label: string }>> = {
  scheduled: { to: "confirmed", label: "Confirmar" },
  confirmed: { to: "reception", label: "Paciente chegou" },
  reception: { to: "in_care", label: "Iniciar atendimento" },
  in_care: { to: "finished", label: "Finalizar" },
}

type QueueFilter = "pending" | "in_progress" | "completed" | "all"
const QUEUE_FILTERS: { id: QueueFilter; label: string }[] = [
  { id: "pending", label: "Não realizado" },
  { id: "in_progress", label: "Em andamento" },
  { id: "completed", label: "Concluído" },
  { id: "all", label: "Todos" },
]

const fmtTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`

function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return null
  const full = digits.startsWith("55") ? digits : `55${digits}`
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`
}

export interface AppointmentSheetProps {
  appointment: Appointment | null
  patient?: SheetPatient
  professionalName?: string
  onClose: () => void
  onStatusChange: (id: string, status: ClinicalStatus) => Promise<void>
  onSaveDetails: (id: string, details: { planned_procedure: string; occurrence: string; first_visit: boolean }) => Promise<void>
  onOpenPatient: (patientId: string) => void
  onEdit: (appointment: Appointment) => void
  onDelete: (id: string) => void
  loadQueue: (patientId: string) => Promise<TreatmentQueueItem[]>
  onExecutionChange: (item: TreatmentQueueItem, status: BudgetItemExecution, appointmentId: string) => Promise<boolean>
}

export function AppointmentSheet({
  appointment,
  patient,
  professionalName,
  onClose,
  onStatusChange,
  onSaveDetails,
  onOpenPatient,
  onEdit,
  onDelete,
  loadQueue,
  onExecutionChange,
}: AppointmentSheetProps) {
  const [status, setStatus] = useState<ClinicalStatus>("scheduled")
  const [savingStatus, setSavingStatus] = useState(false)
  const [planned, setPlanned] = useState("")
  const [performed, setPerformed] = useState("")
  const [firstVisit, setFirstVisit] = useState(false)
  const [savingDetails, setSavingDetails] = useState(false)
  const [queue, setQueue] = useState<TreatmentQueueItem[] | null>(null)
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("pending")
  const [busyItem, setBusyItem] = useState<string | null>(null)

  useEffect(() => {
    if (!appointment) return
    setStatus(clinicalStatusOf(appointment))
    setPlanned(appointment.planned_procedure || "")
    setPerformed(appointment.occurrence || "")
    setFirstVisit(Boolean(appointment.first_visit))
    setQueue(null)
    setQueueFilter("pending")
    let active = true
    loadQueue(appointment.patient_id).then((rows) => active && setQueue(rows))
    return () => {
      active = false
    }
  }, [appointment, loadQueue])

  const start = appointment ? Number(appointment.appointment_time.slice(0, 2)) * 60 + Number(appointment.appointment_time.slice(3, 5)) : 0
  const end = start + (appointment?.duration_minutes || 0)
  const dateLabel = appointment
    ? new Date(`${appointment.appointment_date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : ""

  const waLink = useMemo(() => {
    if (!appointment || !patient?.phone) return null
    const first = patient.name.split(" ")[0]
    const msg = `Olá, ${first}! Confirmamos sua consulta ${dateLabel} às ${fmtTime(start)}${professionalName ? ` com ${professionalName}` : ""}. Podemos confirmar sua presença?`
    return whatsappLink(patient.phone, msg)
  }, [appointment, patient, dateLabel, start, professionalName])

  const filteredQueue = useMemo(
    () => (queue || []).filter((q) => queueFilter === "all" || q.execution_status === queueFilter),
    [queue, queueFilter],
  )

  const changeStatus = async (next: ClinicalStatus) => {
    if (!appointment || next === status) return
    const previous = status
    setStatus(next)
    setSavingStatus(true)
    try {
      await onStatusChange(appointment.id, next)
    } catch {
      setStatus(previous)
    } finally {
      setSavingStatus(false)
    }
  }

  const detailsDirty =
    appointment &&
    (planned !== (appointment.planned_procedure || "") || performed !== (appointment.occurrence || "") || firstVisit !== Boolean(appointment.first_visit))

  const meta = CLINICAL_STATUS[status]
  const next = NEXT_STEP[status]

  return (
    <Sheet open={Boolean(appointment)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[560px]" data-lenis-prevent>
        {appointment && (
          <>
            <SheetHeader className="gap-1 border-b border-hairline px-5 pb-4 pt-5 pr-14">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Agendamento</p>
              <SheetTitle className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">{patient?.name || "Paciente"}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
                <span className="inline-block first-letter:uppercase">{dateLabel}</span>
                <span aria-hidden>·</span>
                <span className="tabular">
                  {fmtTime(start)}–{fmtTime(end)}
                </span>
                {professionalName && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{professionalName}</span>
                  </>
                )}
              </SheetDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPatient(appointment.patient_id)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border px-3 text-[13px] font-medium text-ink hover:bg-surface"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Ficha do paciente
                </button>
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border px-3 text-[13px] font-medium text-ink hover:bg-surface"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    Confirmar pelo WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(appointment)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border px-3 text-[13px] font-medium text-ink hover:bg-surface"
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  Remarcar
                </button>
              </div>
            </SheetHeader>

            {/* Status da consulta */}
            <section className="space-y-3 border-b border-hairline px-5 py-5" aria-labelledby="sheet-status">
              <div className="flex items-center justify-between gap-3">
                <h3 id="sheet-status" className="font-display text-[14px] font-semibold text-ink">
                  Status da consulta
                </h3>
                <span className={cn("inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-[12px] font-semibold", meta.chip)}>
                  {savingStatus && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                  {meta.label}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <NativeSelect aria-label="Status da consulta" value={status} onChange={(e) => changeStatus(e.target.value as ClinicalStatus)} disabled={savingStatus}>
                  {CLINICAL_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {CLINICAL_STATUS[s].label}
                    </option>
                  ))}
                </NativeSelect>
                {next && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => changeStatus(next.to)}
                    disabled={savingStatus}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    {next.label}
                  </motion.button>
                )}
              </div>
              <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm border border-border px-3">
                <span className="text-[13.5px] text-ink">Primeira consulta</span>
                <input type="checkbox" checked={firstVisit} onChange={(e) => setFirstVisit(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
              </label>
            </section>

            {/* Descrição sobre o atendimento */}
            <section className="space-y-3 border-b border-hairline px-5 py-5" aria-labelledby="sheet-description">
              <h3 id="sheet-description" className="font-display text-[14px] font-semibold text-ink">
                Descrição sobre o atendimento
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Previsto" htmlFor="apt-planned">
                  <TextArea id="apt-planned" value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="O que está programado" />
                </Field>
                <Field label="Realizado" htmlFor="apt-performed">
                  <TextArea id="apt-performed" value={performed} onChange={(e) => setPerformed(e.target.value)} placeholder="Evolução do atendimento" />
                </Field>
              </div>
              <AnimatePresence>
                {detailsDirty && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <button
                      type="button"
                      disabled={savingDetails}
                      onClick={async () => {
                        setSavingDetails(true)
                        try {
                          await onSaveDetails(appointment.id, { planned_procedure: planned, occurrence: performed, first_visit: firstVisit })
                        } finally {
                          setSavingDetails(false)
                        }
                      }}
                      className="inline-flex h-11 items-center gap-2 rounded-sm bg-[#0f1f33] px-5 text-[14px] font-semibold text-white hover:bg-[#1b2f48] disabled:opacity-60"
                    >
                      {savingDetails && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                      Salvar descrição
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {/* Procedimentos a realizar */}
            <section className="space-y-3 px-5 py-5" aria-labelledby="sheet-queue">
              <div className="flex items-center justify-between gap-2">
                <h3 id="sheet-queue" className="font-display text-[14px] font-semibold text-ink">
                  Procedimentos a realizar
                </h3>
                <span className="text-[12px] text-muted-foreground">de orçamentos fechados</span>
              </div>
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtrar procedimentos">
                {QUEUE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={queueFilter === f.id}
                    onClick={() => setQueueFilter(f.id)}
                    className={cn(
                      "min-h-10 rounded-sm border px-3 text-[12.5px] font-medium",
                      queueFilter === f.id ? "border-primary bg-accent text-ink" : "border-border text-muted-foreground hover:text-ink",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {queue === null ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                </div>
              ) : filteredQueue.length === 0 ? (
                <p className="rounded-sm bg-surface px-3 py-4 text-center text-[13px] text-muted-foreground">
                  {queue.length === 0 ? "Nenhum orçamento fechado para este paciente." : "Nada nesta situação."}
                </p>
              ) : (
                <ul className="divide-y divide-hairline rounded-sm border border-border">
                  {filteredQueue.map((item) => {
                    const legacy = splitRegionSuffix(item.product_name)
                    const region = item.region || typeof item.tooth === "number" ? decodeRegion(item.region, item.tooth) : legacy.region
                    const name = item.region || typeof item.tooth === "number" ? item.product_name : legacy.name
                    const done = item.execution_status === "completed"
                    return (
                      <li key={item.id}>
                        <label className={cn("flex min-h-12 items-center gap-3 px-3 py-2", item.trackable ? "cursor-pointer hover:bg-surface" : "cursor-default")}>
                          <input
                            type="checkbox"
                            checked={done}
                            disabled={!item.trackable || busyItem === item.id}
                            onChange={async (e) => {
                              const target: BudgetItemExecution = e.target.checked ? "completed" : "pending"
                              setBusyItem(item.id)
                              const ok = await onExecutionChange(item, target, appointment.id)
                              if (ok) setQueue((prev) => (prev || []).map((q) => (q.id === item.id ? { ...q, execution_status: target } : q)))
                              setBusyItem(null)
                            }}
                            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                            aria-label={`Marcar ${name} como concluído`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[13.5px] font-medium", done ? "text-muted-foreground line-through" : "text-ink")}>{name}</span>
                            <span className="block text-[12px] text-muted-foreground">
                              {EXECUTION_LABELS[item.execution_status]} · Orç. {item.budget_tag}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-xs bg-secondary px-1.5 py-0.5 font-display text-[11px] font-semibold tabular text-ink-soft">{regionShort(region)}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="mt-auto flex justify-end border-t border-hairline px-5 py-4">
              <button
                type="button"
                onClick={() => onDelete(appointment.id)}
                className="inline-flex h-11 items-center gap-2 rounded-sm px-3 text-[13px] font-medium text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Excluir agendamento
              </button>
              <button
                type="button"
                onClick={() => onEdit(appointment)}
                className="ml-2 inline-flex h-11 items-center gap-2 rounded-sm border border-border px-4 text-[13px] font-medium text-ink hover:bg-surface"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Editar
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default AppointmentSheet
