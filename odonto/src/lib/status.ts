import type { Tone } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@/domain/appointments";
import { BUDGET_STATUS_LABEL, type BudgetStatus } from "@/domain/budget";

export const APPOINTMENT_TONE: Record<AppointmentStatus, Tone> = {
  scheduled: "neutral",
  confirmed: "info",
  arrived: "warning",
  in_progress: "accent",
  finished: "success",
  no_show: "danger",
  cancelled_by_patient: "neutral",
  cancelled_by_clinic: "neutral",
  cancelled_rescheduled: "neutral",
  no_show_rescheduled: "danger",
};

export function appointmentBadge(status: AppointmentStatus) {
  return { tone: APPOINTMENT_TONE[status], label: APPOINTMENT_STATUS_LABEL[status] };
}

export const BUDGET_TONE: Record<BudgetStatus, Tone> = {
  draft: "neutral",
  negotiating: "info",
  partially_approved: "accent",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export function budgetBadge(status: BudgetStatus) {
  return { tone: BUDGET_TONE[status], label: BUDGET_STATUS_LABEL[status] };
}

export const TITLE_TONE: Record<string, Tone> = { open: "info", partial: "warning", paid: "success", cancelled: "neutral" };
export const TITLE_LABEL: Record<string, string> = { open: "Em aberto", partial: "Parcial", paid: "Quitado", cancelled: "Cancelado" };

export const CLINICAL_TONE: Record<string, Tone> = { not_started: "neutral", in_progress: "accent", completed: "success", cancelled: "neutral" };
export const CLINICAL_LABEL: Record<string, string> = { not_started: "Não realizado", in_progress: "Em andamento", completed: "Concluído", cancelled: "Cancelado" };

export const BANK_TX_LABEL: Record<string, string> = { pending: "Pendente", reconciled: "Conciliado", ignored: "Ignorado" };
export const BANK_TX_TONE: Record<string, Tone> = { pending: "warning", reconciled: "success", ignored: "neutral" };
