export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "arrived",
  "in_progress",
  "finished",
  "no_show",
  "cancelled_by_patient",
  "cancelled_by_clinic",
  "cancelled_rescheduled",
  "no_show_rescheduled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Paciente na recepção",
  in_progress: "Em atendimento",
  finished: "Finalizado",
  no_show: "Faltou",
  cancelled_by_patient: "Desmarcado pelo paciente",
  cancelled_by_clinic: "Desmarcado pela clínica",
  cancelled_rescheduled: "Desmarcado e remarcado",
  no_show_rescheduled: "Faltou e remarcado",
};

/** Estados que ocupam o horário do profissional. */
export const OCCUPYING_STATUSES: readonly AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "arrived",
  "in_progress",
  "finished",
];

/** Estados ainda sem desfecho registrado. */
export const OPEN_STATUSES: readonly AppointmentStatus[] = ["scheduled", "confirmed", "arrived", "in_progress"];

export const CANCELLATION_STATUSES: readonly AppointmentStatus[] = [
  "cancelled_by_patient",
  "cancelled_by_clinic",
  "cancelled_rescheduled",
  "no_show_rescheduled",
];

/** Transições permitidas por ação direta de status (remarcação tem fluxo próprio). */
const TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  scheduled: ["confirmed", "arrived", "in_progress", "finished", "no_show", "cancelled_by_patient", "cancelled_by_clinic"],
  confirmed: ["scheduled", "arrived", "in_progress", "finished", "no_show", "cancelled_by_patient", "cancelled_by_clinic"],
  arrived: ["confirmed", "in_progress", "finished", "no_show", "cancelled_by_patient", "cancelled_by_clinic"],
  in_progress: ["arrived", "finished"],
  finished: ["in_progress"],
  no_show: ["scheduled", "confirmed"],
  cancelled_by_patient: ["scheduled"],
  cancelled_by_clinic: ["scheduled"],
  cancelled_rescheduled: [],
  no_show_rescheduled: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: AppointmentStatus): readonly AppointmentStatus[] {
  return TRANSITIONS[from];
}

export function requiresReason(to: AppointmentStatus): boolean {
  return to === "cancelled_by_patient" || to === "cancelled_by_clinic" || to === "no_show";
}

export class ScheduleRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleRuleError";
  }
}

/** Valida horário dentro de um único dia, em múltiplos da grade (15 min padrão). */
export function validateTimeRange(startMinutes: number, endMinutes: number, slotMinutes = 15): number {
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) {
    throw new ScheduleRuleError("Horário inválido");
  }
  if (startMinutes < 0 || endMinutes > 24 * 60) throw new ScheduleRuleError("Consulta deve ocorrer em um único dia");
  if (endMinutes <= startMinutes) throw new ScheduleRuleError("Horário final deve ser posterior ao inicial");
  if (startMinutes % slotMinutes !== 0 || endMinutes % slotMinutes !== 0) {
    throw new ScheduleRuleError(`Horários devem seguir a grade de ${slotMinutes} minutos`);
  }
  return endMinutes - startMinutes;
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Arredonda minutos para a grade mais próxima (usado no arrastar/redimensionar). */
export function snapToSlot(minutes: number, slotMinutes = 15): number {
  return Math.round(minutes / slotMinutes) * slotMinutes;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface WeeklyBlockRule {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
}

export interface BusinessHours {
  /** Índice 0 = domingo. Lista vazia = fechado. */
  days: { start: number; end: number }[][];
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  days: [[], [{ start: 480, end: 1080 }], [{ start: 480, end: 1080 }], [{ start: 480, end: 1080 }], [{ start: 480, end: 1080 }], [{ start: 480, end: 1080 }], []],
};

export function isWithinBusinessHours(hours: BusinessHours, weekday: number, start: number, end: number): boolean {
  return (hours.days[weekday] ?? []).some((p) => start >= p.start && end <= p.end);
}

export const REMINDER_PREFERENCES = ["none", "whatsapp", "sms", "email"] as const;
export type ReminderPreference = (typeof REMINDER_PREFERENCES)[number];
export const REMINDER_PREFERENCE_LABEL: Record<ReminderPreference, string> = {
  none: "Sem lembrete",
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
};

/** Link de atalho para conversa; não envia mensagem sozinho. */
export function whatsappLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (!digits.startsWith("55") || digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}`;
}
