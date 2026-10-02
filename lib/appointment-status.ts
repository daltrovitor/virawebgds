// Hello World
/**
 * Status clínico da consulta (recepção odontológica).
 * O banco legado só aceita status "grossos" (scheduled | completed | cancelled) — a coluna
 * `appointments.clinical_status` (migração 071) guarda o detalhe; sem ela, o detalhe é derivado.
 */

export type CoarseAppointmentStatus = "scheduled" | "completed" | "cancelled"

export type ClinicalStatus =
  | "scheduled"
  | "confirmed"
  | "reception"
  | "in_care"
  | "finished"
  | "missed"
  | "missed_rescheduled"
  | "cancelled_patient"
  | "cancelled_clinic"
  | "cancelled_rescheduled"

interface StatusMeta {
  label: string
  coarse: CoarseAppointmentStatus
  /** Bloco da agenda: fundo + texto (tons sóbrios, sem neon). */
  block: string
  /** Selo pequeno em listas. */
  chip: string
  /** Cor sólida para a barra lateral do bloco. */
  rail: string
}

export const CLINICAL_STATUS_ORDER: readonly ClinicalStatus[] = [
  "scheduled",
  "confirmed",
  "reception",
  "in_care",
  "finished",
  "missed",
  "missed_rescheduled",
  "cancelled_patient",
  "cancelled_clinic",
  "cancelled_rescheduled",
]

export const CLINICAL_STATUS: Record<ClinicalStatus, StatusMeta> = {
  scheduled: {
    label: "Agendado",
    coarse: "scheduled",
    block: "bg-sky-50 text-sky-950 hover:bg-sky-100",
    chip: "bg-sky-50 text-sky-800 border-sky-200",
    rail: "bg-sky-600",
  },
  confirmed: {
    label: "Confirmado",
    coarse: "scheduled",
    block: "bg-indigo-50 text-indigo-950 hover:bg-indigo-100",
    chip: "bg-indigo-50 text-indigo-800 border-indigo-200",
    rail: "bg-indigo-600",
  },
  reception: {
    label: "Cliente na recepção",
    coarse: "scheduled",
    block: "bg-amber-50 text-amber-950 hover:bg-amber-100",
    chip: "bg-amber-50 text-amber-900 border-amber-200",
    rail: "bg-amber-500",
  },
  in_care: {
    label: "Em atendimento",
    coarse: "scheduled",
    block: "bg-teal-50 text-teal-950 hover:bg-teal-100",
    chip: "bg-teal-50 text-teal-800 border-teal-200",
    rail: "bg-teal-600",
  },
  finished: {
    label: "Finalizado",
    coarse: "completed",
    block: "bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-200",
    rail: "bg-emerald-600",
  },
  missed: {
    label: "Faltou",
    coarse: "cancelled",
    block: "bg-rose-50 text-rose-950 hover:bg-rose-100",
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    rail: "bg-rose-600",
  },
  missed_rescheduled: {
    label: "Faltou — remarcado",
    coarse: "cancelled",
    block: "bg-rose-50/70 text-rose-950 hover:bg-rose-100",
    chip: "bg-rose-50 text-rose-800 border-rose-200",
    rail: "bg-rose-400",
  },
  cancelled_patient: {
    label: "Desmarcado pelo paciente",
    coarse: "cancelled",
    block: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    rail: "bg-slate-400",
  },
  cancelled_clinic: {
    label: "Desmarcado pela clínica",
    coarse: "cancelled",
    block: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    rail: "bg-slate-500",
  },
  cancelled_rescheduled: {
    label: "Desmarcado — remarcado",
    coarse: "cancelled",
    block: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    rail: "bg-slate-300",
  },
}

export function isClinicalStatus(value: unknown): value is ClinicalStatus {
  return typeof value === "string" && value in CLINICAL_STATUS
}

/** Status efetivo de um agendamento, com fallback para bancos sem a coluna detalhada. */
export function clinicalStatusOf(apt: { status?: string | null; clinical_status?: string | null }): ClinicalStatus {
  if (isClinicalStatus(apt.clinical_status)) return apt.clinical_status
  switch (apt.status) {
    case "completed":
      return "finished"
    case "cancelled":
    case "canceled":
      return "cancelled_patient"
    case "no-show":
    case "no_show":
      return "missed"
    default:
      return "scheduled"
  }
}

/** Consultas que contam como "sem baixa": já passaram e não foram finalizadas, desmarcadas nem marcadas como falta. */
export function needsStatusClosure(status: ClinicalStatus): boolean {
  return status === "scheduled" || status === "confirmed" || status === "reception" || status === "in_care"
}

export function isAbsenceOrCancellation(status: ClinicalStatus): boolean {
  return CLINICAL_STATUS[status].coarse === "cancelled"
}
