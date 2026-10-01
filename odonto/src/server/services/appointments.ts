import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABEL,
  canTransition,
  isWithinBusinessHours,
  OCCUPYING_STATUSES,
  OPEN_STATUSES,
  rangesOverlap,
  REMINDER_PREFERENCES,
  requiresReason,
  ScheduleRuleError,
  validateTimeRange,
  type AppointmentStatus,
  type ReminderPreference,
} from "@/domain/appointments";
import { addDays, compareCivil, formatDateBR, minutesToHHMM, weekdayOf, zonedToInstant, type CivilDate } from "@/domain/dates";
import { audit } from "../audit";
import { assertCan, can, type Ctx } from "../context";
import type { Tx } from "../db/client";
import {
  appointmentProcedures,
  appointments,
  appointmentStatusHistory,
  clinicalProgressEntries,
  organizationSettings,
  patients,
  professionals,
  scheduleBlocks,
  schedulingTasks,
  treatmentItems,
  users,
} from "../db/schema";
import { q } from "../db/sql";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError, pgErrorCode, ValidationError } from "../errors";
import { parseInput, zCivilDate, zId, zOptionalText, zRequiredText } from "../validation";
import { cancelPendingReminders, scheduleAppointmentReminder } from "./notifications";

// ---------------------------------------------------------------------------
// Consulta da agenda
// ---------------------------------------------------------------------------

export interface AgendaBlock {
  id: string;
  professionalId: string | null;
  date: CivilDate;
  startMinute: number;
  endMinute: number;
  reason: string;
  kind: "single" | "weekly";
}

async function blocksForRange(db: Ctx["db"] | Tx, orgId: string, from: CivilDate, to: CivilDate, professionalId?: string | null): Promise<AgendaBlock[]> {
  const rows = await db
    .select()
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.organizationId, orgId),
        eq(scheduleBlocks.active, true),
        professionalId ? or(isNull(scheduleBlocks.professionalId), eq(scheduleBlocks.professionalId, professionalId)) : undefined,
        or(
          and(eq(scheduleBlocks.kind, "single"), gte(scheduleBlocks.localDate, from), lte(scheduleBlocks.localDate, to)),
          and(eq(scheduleBlocks.kind, "weekly"), lte(scheduleBlocks.startDate, to), or(isNull(scheduleBlocks.untilDate), gte(scheduleBlocks.untilDate, from))),
        ),
      ),
    );
  const out: AgendaBlock[] = [];
  for (const b of rows) {
    if (b.kind === "single") {
      out.push({ id: b.id, professionalId: b.professionalId, date: b.localDate!, startMinute: b.startMinute, endMinute: b.endMinute, reason: b.reason, kind: "single" });
      continue;
    }
    for (let d = from; compareCivil(d, to) <= 0; d = addDays(d, 1)) {
      if (weekdayOf(d) !== b.weekday) continue;
      if (compareCivil(d, b.startDate!) < 0) continue;
      if (b.untilDate && compareCivil(d, b.untilDate) > 0) continue;
      out.push({ id: b.id, professionalId: b.professionalId, date: d, startMinute: b.startMinute, endMinute: b.endMinute, reason: b.reason, kind: "weekly" });
    }
  }
  return out;
}

const agendaSchema = z.object({ from: zCivilDate, to: zCivilDate, professionalId: zId.nullish() });

export async function getAgenda(ctx: Ctx, input: z.input<typeof agendaSchema>) {
  assertCan(ctx, "schedule.view");
  const data = parseInput(agendaSchema, input);
  if (compareCivil(data.to, data.from) < 0 || compareCivil(data.to, addDays(data.from, 42)) > 0) throw new ValidationError("Período inválido");
  const showClinical = can(ctx, "clinical.view");
  const rows = await ctx.db
    .select({
      appointment: appointments,
      patientName: patients.fullName,
      patientSocialName: patients.socialName,
      patientPhone: patients.phone,
      professionalName: professionals.name,
      professionalColor: professionals.color,
      procedureCount: sql<number>`(select count(*)::int from ${appointmentProcedures} where ${q(appointmentProcedures.appointmentId)} = ${q(appointments.id)})`,
    })
    .from(appointments)
    .innerJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.organizationId, appointments.organizationId)))
    .innerJoin(professionals, and(eq(professionals.id, appointments.professionalId), eq(professionals.organizationId, appointments.organizationId)))
    .where(
      and(
        eq(appointments.organizationId, ctx.orgId),
        gte(appointments.localDate, data.from),
        lte(appointments.localDate, data.to),
        data.professionalId ? eq(appointments.professionalId, data.professionalId) : undefined,
      ),
    )
    .orderBy(asc(appointments.localDate), asc(appointments.startMinute));
  const blocks = await blocksForRange(ctx.db, ctx.orgId, data.from, data.to, data.professionalId);
  const [settings] = await ctx.db
    .select({ businessHours: organizationSettings.businessHours, slotMinutes: organizationSettings.slotMinutes })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, ctx.orgId));
  return {
    appointments: rows.map((r) => ({
      id: r.appointment.id,
      patientId: r.appointment.patientId,
      patientName: r.patientSocialName || r.patientName,
      patientPhone: r.patientPhone,
      professionalId: r.appointment.professionalId,
      professionalName: r.professionalName,
      professionalColor: r.professionalColor,
      date: r.appointment.localDate,
      startMinute: r.appointment.startMinute,
      endMinute: r.appointment.endMinute,
      status: r.appointment.status as AppointmentStatus,
      isFirstVisit: r.appointment.isFirstVisit,
      isOverbook: r.appointment.isOverbook,
      planned: showClinical ? r.appointment.planned : null,
      procedureCount: r.procedureCount,
      version: r.appointment.version,
      rescheduledFromId: r.appointment.rescheduledFromId,
    })),
    blocks,
    businessHours: settings?.businessHours ?? { days: [] },
    slotMinutes: settings?.slotMinutes ?? 15,
  };
}

export type AgendaData = Awaited<ReturnType<typeof getAgenda>>;

export async function getAppointment(ctx: Ctx, id: string) {
  assertCan(ctx, "schedule.view");
  const [row] = await ctx.db
    .select({ appointment: appointments, patientName: patients.fullName, patientPhone: patients.phone, professionalName: professionals.name })
    .from(appointments)
    .innerJoin(patients, and(eq(patients.id, appointments.patientId), eq(patients.organizationId, appointments.organizationId)))
    .innerJoin(professionals, and(eq(professionals.id, appointments.professionalId), eq(professionals.organizationId, appointments.organizationId)))
    .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.id, id)));
  if (!row) throw new NotFoundError("Consulta");
  const showClinical = can(ctx, "clinical.view");
  const procs = await ctx.db
    .select({ link: appointmentProcedures, item: treatmentItems })
    .from(appointmentProcedures)
    .innerJoin(treatmentItems, eq(treatmentItems.id, appointmentProcedures.treatmentItemId))
    .where(and(eq(appointmentProcedures.organizationId, ctx.orgId), eq(appointmentProcedures.appointmentId, id)));
  const history = await ctx.db
    .select({ entry: appointmentStatusHistory, userName: users.name })
    .from(appointmentStatusHistory)
    .leftJoin(users, eq(users.id, appointmentStatusHistory.changedBy))
    .where(and(eq(appointmentStatusHistory.organizationId, ctx.orgId), eq(appointmentStatusHistory.appointmentId, id)))
    .orderBy(asc(appointmentStatusHistory.changedAt));
  const [createdBy] = row.appointment.createdBy
    ? await ctx.db.select({ name: users.name }).from(users).where(eq(users.id, row.appointment.createdBy))
    : [];
  const [next] = await ctx.db
    .select({ id: appointments.id, localDate: appointments.localDate, startMinute: appointments.startMinute })
    .from(appointments)
    .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.rescheduledFromId, id)));
  return {
    ...row.appointment,
    status: row.appointment.status as AppointmentStatus,
    planned: showClinical ? row.appointment.planned : null,
    performed: showClinical ? row.appointment.performed : null,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    professionalName: row.professionalName,
    createdByName: createdBy?.name ?? null,
    procedures: procs.map((p) => ({
      treatmentItemId: p.item.id,
      procedureName: p.item.procedureName,
      specialtyName: p.item.specialtyName,
      locationLabel: p.item.locationLabel,
      clinicalStatus: p.item.clinicalStatus,
      outcome: p.link.outcome,
      note: showClinical ? p.link.note : null,
    })),
    history: history.map((h) => ({ ...h.entry, userName: h.userName })),
    rescheduledTo: next ?? null,
  };
}

// ---------------------------------------------------------------------------
// Conflitos
// ---------------------------------------------------------------------------

export interface ScheduleConflict {
  kind: "appointment" | "block" | "outside_hours";
  description: string;
}

async function findConflicts(
  tx: Tx,
  ctx: Ctx,
  args: { professionalId: string; date: CivilDate; startMinute: number; endMinute: number; excludeAppointmentId?: string },
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = [];
  const sameDay = await tx
    .select({ id: appointments.id, startMinute: appointments.startMinute, endMinute: appointments.endMinute, patientName: patients.fullName })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(
      and(
        eq(appointments.organizationId, ctx.orgId),
        eq(appointments.professionalId, args.professionalId),
        eq(appointments.localDate, args.date),
        inArray(appointments.status, [...OCCUPYING_STATUSES]),
        args.excludeAppointmentId ? ne(appointments.id, args.excludeAppointmentId) : undefined,
      ),
    );
  for (const a of sameDay) {
    if (rangesOverlap(args.startMinute, args.endMinute, a.startMinute, a.endMinute)) {
      conflicts.push({ kind: "appointment", description: `Conflita com consulta de ${a.patientName} (${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)})` });
    }
  }
  const blocks = await blocksForRange(tx, ctx.orgId, args.date, args.date, args.professionalId);
  for (const b of blocks) {
    if (rangesOverlap(args.startMinute, args.endMinute, b.startMinute, b.endMinute)) {
      conflicts.push({ kind: "block", description: `Horário bloqueado: ${b.reason} (${minutesToHHMM(b.startMinute)}–${minutesToHHMM(b.endMinute)})` });
    }
  }
  const [settings] = await tx
    .select({ businessHours: organizationSettings.businessHours })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, ctx.orgId));
  if (settings && !isWithinBusinessHours(settings.businessHours, weekdayOf(args.date), args.startMinute, args.endMinute)) {
    conflicts.push({ kind: "outside_hours", description: "Fora do expediente configurado da clínica" });
  }
  return conflicts;
}

export class ScheduleConflictError extends ConflictError {
  readonly conflicts: ScheduleConflict[];
  readonly overbookAllowed: boolean;
  constructor(conflicts: ScheduleConflict[], overbookAllowed: boolean) {
    super(conflicts.map((c) => c.description).join("; "));
    this.conflicts = conflicts;
    this.overbookAllowed = overbookAllowed;
  }
}

/** Trava por profissional+dia: gravações simultâneas são serializadas e revalidadas. */
async function lockProfessionalDay(tx: Tx, orgId: string, professionalId: string, date: CivilDate) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`appt:${orgId}:${professionalId}:${date}`}))`);
}

async function getSlotMinutes(tx: Tx, orgId: string): Promise<number> {
  const [s] = await tx.select({ slot: organizationSettings.slotMinutes }).from(organizationSettings).where(eq(organizationSettings.organizationId, orgId));
  return s?.slot ?? 15;
}

/**
 * Decide se os conflitos podem ser aceitos. Conflito com consulta/bloqueio
 * exige permissão de encaixe e confirmação deliberada; fora do expediente
 * exige apenas confirmação.
 */
function resolveConflicts(ctx: Ctx, conflicts: ScheduleConflict[], confirm: { overbook: boolean; outsideHours: boolean }) {
  const hard = conflicts.filter((c) => c.kind !== "outside_hours");
  const soft = conflicts.filter((c) => c.kind === "outside_hours");
  const overbookAllowed = can(ctx, "schedule.overbook");
  if (hard.length > 0 && (!confirm.overbook || !overbookAllowed)) throw new ScheduleConflictError(conflicts, overbookAllowed);
  if (soft.length > 0 && !confirm.outsideHours) throw new ScheduleConflictError(conflicts, overbookAllowed);
  return { isOverbook: hard.length > 0 };
}

function translateDbConflict(err: unknown): never {
  if (pgErrorCode(err) === "23P01") {
    throw new ConflictError("Outro usuário acabou de ocupar este horário. Atualize a agenda e tente novamente.");
  }
  throw err;
}

async function assertTreatmentItemsForPatient(tx: Tx, ctx: Ctx, patientId: string, itemIds: string[]) {
  if (itemIds.length === 0) return;
  const rows = await tx
    .select({ id: treatmentItems.id, patientId: treatmentItems.patientId, status: treatmentItems.clinicalStatus })
    .from(treatmentItems)
    .where(and(eq(treatmentItems.organizationId, ctx.orgId), inArray(treatmentItems.id, itemIds)));
  // Itens de outro paciente ou de outra clínica são recusados (manipulação de ID).
  if (rows.length !== new Set(itemIds).size || rows.some((r) => r.patientId !== patientId)) {
    throw new ValidationError("Procedimento não pertence a este paciente");
  }
  if (rows.some((r) => r.status === "cancelled")) throw new ValidationError("Procedimento cancelado não pode ser programado");
}

// ---------------------------------------------------------------------------
// Criação, correção de horário e remarcação
// ---------------------------------------------------------------------------

const timeFields = {
  professionalId: zId,
  date: zCivilDate,
  startMinute: z.number().int().min(0).max(1440),
  endMinute: z.number().int().min(0).max(1440),
  confirmOverbook: z.boolean().default(false),
  overbookReason: zOptionalText(300),
  confirmOutsideHours: z.boolean().default(false),
};

const createSchema = z.object({
  patientId: zId,
  ...timeFields,
  status: z.enum(["scheduled", "confirmed"]).default("scheduled"),
  isFirstVisit: z.boolean().default(false),
  planned: zOptionalText(2000),
  notes: zOptionalText(2000),
  reminderPreference: z.enum(REMINDER_PREFERENCES).default("none"),
  treatmentItemIds: z.array(zId).max(50).default([]),
  schedulingTaskId: zId.nullish(),
});

export async function createAppointment(ctx: Ctx, input: z.input<typeof createSchema>): Promise<{ id: string; isOverbook: boolean; durationMinutes: number }> {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(createSchema, input);
  try {
    return await ctx.db.transaction(async (tx) => {
      const slot = await getSlotMinutes(tx, ctx.orgId);
      let duration: number;
      try {
        duration = validateTimeRange(data.startMinute, data.endMinute, slot);
      } catch (err) {
        if (err instanceof ScheduleRuleError) throw new ValidationError(err.message);
        throw err;
      }
      const [patient] = await tx
        .select({ id: patients.id, status: patients.status })
        .from(patients)
        .where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, data.patientId)));
      if (!patient) throw new NotFoundError("Paciente");
      const [prof] = await tx
        .select({ id: professionals.id, active: professionals.active })
        .from(professionals)
        .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, data.professionalId)));
      if (!prof) throw new NotFoundError("Profissional");
      if (!prof.active) throw new BusinessRuleError("Profissional inativo");
      await assertTreatmentItemsForPatient(tx, ctx, data.patientId, data.treatmentItemIds);
      await lockProfessionalDay(tx, ctx.orgId, data.professionalId, data.date);
      const conflicts = await findConflicts(tx, ctx, data);
      const { isOverbook } = resolveConflicts(ctx, conflicts, { overbook: data.confirmOverbook, outsideHours: data.confirmOutsideHours });
      if (isOverbook && !data.overbookReason) throw new ValidationError("Informe o motivo do encaixe", { overbookReason: "Obrigatório para encaixe" });
      const startsAt = zonedToInstant(data.date, data.startMinute, ctx.timezone);
      const endsAt = zonedToInstant(data.date, data.endMinute, ctx.timezone);
      const [appt] = await tx
        .insert(appointments)
        .values({
          organizationId: ctx.orgId,
          patientId: data.patientId,
          professionalId: data.professionalId,
          startsAt,
          endsAt,
          localDate: data.date,
          startMinute: data.startMinute,
          endMinute: data.endMinute,
          status: data.status,
          isFirstVisit: data.isFirstVisit,
          planned: data.planned,
          notes: data.notes,
          reminderPreference: data.reminderPreference,
          isOverbook,
          overbookReason: isOverbook ? data.overbookReason : null,
          statusChangedAt: new Date(),
          statusChangedBy: ctx.userId,
          createdBy: ctx.userId,
        })
        .returning({ id: appointments.id });
      const id = appt!.id;
      await tx.insert(appointmentStatusHistory).values({
        organizationId: ctx.orgId,
        appointmentId: id,
        kind: "created",
        toStatus: data.status,
        toStartsAt: startsAt,
        changedBy: ctx.userId,
        reason: isOverbook ? `Encaixe: ${data.overbookReason}` : null,
      });
      if (data.treatmentItemIds.length > 0) {
        await tx
          .insert(appointmentProcedures)
          .values([...new Set(data.treatmentItemIds)].map((treatmentItemId) => ({ organizationId: ctx.orgId, appointmentId: id, treatmentItemId })));
        await tx
          .update(schedulingTasks)
          .set({ status: "scheduled", appointmentId: id, resolvedAt: new Date(), resolvedBy: ctx.userId })
          .where(
            and(
              eq(schedulingTasks.organizationId, ctx.orgId),
              eq(schedulingTasks.status, "open"),
              inArray(schedulingTasks.treatmentItemId, data.treatmentItemIds),
            ),
          );
      }
      if (data.schedulingTaskId) {
        await tx
          .update(schedulingTasks)
          .set({ status: "scheduled", appointmentId: id, resolvedAt: new Date(), resolvedBy: ctx.userId })
          .where(and(eq(schedulingTasks.organizationId, ctx.orgId), eq(schedulingTasks.id, data.schedulingTaskId), eq(schedulingTasks.patientId, data.patientId)));
      }
      await scheduleAppointmentReminder(tx, ctx, { id, patientId: data.patientId, startsAt, reminderPreference: data.reminderPreference });
      await audit(tx, ctx, {
        action: "appointment.create",
        entityType: "appointment",
        entityId: id,
        summary: `Consulta agendada para ${formatDateBR(data.date)} ${minutesToHHMM(data.startMinute)}–${minutesToHHMM(data.endMinute)}${isOverbook ? " (encaixe)" : ""}`,
      });
      return { id, isOverbook, durationMinutes: duration };
    });
  } catch (err) {
    translateDbConflict(err);
  }
}

async function loadForUpdate(tx: Tx, ctx: Ctx, id: string) {
  const [row] = await tx
    .select()
    .from(appointments)
    .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.id, id)))
    .for("update");
  if (!row) throw new NotFoundError("Consulta");
  return row;
}

const moveSchema = z.object({ appointmentId: zId, expectedVersion: z.number().int(), ...timeFields });

/**
 * Correção de horário (arrastar, redimensionar ou editar no formulário). Fica
 * registrada no histórico; para consulta já comunicada ao paciente, use a
 * remarcação, que preserva a consulta anterior.
 */
export async function moveAppointment(ctx: Ctx, input: z.input<typeof moveSchema>) {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(moveSchema, input);
  try {
    return await ctx.db.transaction(async (tx) => {
      const appt = await loadForUpdate(tx, ctx, data.appointmentId);
      if (appt.version !== data.expectedVersion) throw new ConflictError("A consulta foi alterada por outra pessoa. Atualize a agenda.");
      if (!["scheduled", "confirmed"].includes(appt.status)) throw new BusinessRuleError("Somente consultas agendadas ou confirmadas podem mudar de horário");
      const slot = await getSlotMinutes(tx, ctx.orgId);
      try {
        validateTimeRange(data.startMinute, data.endMinute, slot);
      } catch (err) {
        if (err instanceof ScheduleRuleError) throw new ValidationError(err.message);
        throw err;
      }
      const [prof] = await tx
        .select({ id: professionals.id, active: professionals.active })
        .from(professionals)
        .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, data.professionalId)));
      if (!prof?.active) throw new NotFoundError("Profissional");
      await lockProfessionalDay(tx, ctx.orgId, data.professionalId, data.date);
      const conflicts = await findConflicts(tx, ctx, { ...data, excludeAppointmentId: appt.id });
      const { isOverbook } = resolveConflicts(ctx, conflicts, { overbook: data.confirmOverbook, outsideHours: data.confirmOutsideHours });
      const startsAt = zonedToInstant(data.date, data.startMinute, ctx.timezone);
      const endsAt = zonedToInstant(data.date, data.endMinute, ctx.timezone);
      await tx
        .update(appointments)
        .set({
          professionalId: data.professionalId,
          localDate: data.date,
          startMinute: data.startMinute,
          endMinute: data.endMinute,
          startsAt,
          endsAt,
          isOverbook,
          overbookReason: isOverbook ? (data.overbookReason ?? appt.overbookReason ?? "Encaixe") : null,
          updatedAt: new Date(),
          version: sql`${appointments.version} + 1`,
        })
        .where(eq(appointments.id, appt.id));
      await tx.insert(appointmentStatusHistory).values({
        organizationId: ctx.orgId,
        appointmentId: appt.id,
        kind: "time_change",
        fromStartsAt: appt.startsAt,
        toStartsAt: startsAt,
        changedBy: ctx.userId,
        reason: `Correção de horário: ${formatDateBR(appt.localDate)} ${minutesToHHMM(appt.startMinute)}–${minutesToHHMM(appt.endMinute)} → ${formatDateBR(data.date)} ${minutesToHHMM(data.startMinute)}–${minutesToHHMM(data.endMinute)}`,
      });
      if (appt.startsAt.getTime() !== startsAt.getTime()) {
        await cancelPendingReminders(tx, ctx.orgId, appt.id, "Horário alterado");
        await scheduleAppointmentReminder(tx, ctx, { id: appt.id, patientId: appt.patientId, startsAt, reminderPreference: appt.reminderPreference as ReminderPreference });
      }
      await audit(tx, ctx, { action: "appointment.move", entityType: "appointment", entityId: appt.id, summary: "Horário da consulta corrigido" });
      return { id: appt.id, isOverbook };
    });
  } catch (err) {
    translateDbConflict(err);
  }
}

const detailsSchema = z.object({
  appointmentId: zId,
  expectedVersion: z.number().int(),
  isFirstVisit: z.boolean(),
  planned: zOptionalText(2000),
  notes: zOptionalText(2000),
  reminderPreference: z.enum(REMINDER_PREFERENCES),
  treatmentItemIds: z.array(zId).max(50),
});

export async function updateAppointmentDetails(ctx: Ctx, input: z.input<typeof detailsSchema>) {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(detailsSchema, input);
  return ctx.db.transaction(async (tx) => {
    const appt = await loadForUpdate(tx, ctx, data.appointmentId);
    if (appt.version !== data.expectedVersion) throw new ConflictError("A consulta foi alterada por outra pessoa. Atualize a agenda.");
    await assertTreatmentItemsForPatient(tx, ctx, appt.patientId, data.treatmentItemIds);
    // Previsto só é alterado por quem pode ver conteúdo clínico.
    const plannedUpdate = can(ctx, "clinical.view") ? { planned: data.planned } : {};
    await tx
      .update(appointments)
      .set({
        isFirstVisit: data.isFirstVisit,
        notes: data.notes,
        reminderPreference: data.reminderPreference,
        ...plannedUpdate,
        updatedAt: new Date(),
        version: sql`${appointments.version} + 1`,
      })
      .where(eq(appointments.id, appt.id));
    const current = await tx
      .select()
      .from(appointmentProcedures)
      .where(and(eq(appointmentProcedures.organizationId, ctx.orgId), eq(appointmentProcedures.appointmentId, appt.id)));
    const wanted = new Set(data.treatmentItemIds);
    const removable = current.filter((c) => !wanted.has(c.treatmentItemId) && c.outcome === null);
    if (removable.length > 0) {
      await tx.delete(appointmentProcedures).where(inArray(appointmentProcedures.id, removable.map((r) => r.id)));
    }
    const toAdd = [...wanted].filter((id) => !current.some((c) => c.treatmentItemId === id));
    if (toAdd.length > 0) {
      await tx.insert(appointmentProcedures).values(toAdd.map((treatmentItemId) => ({ organizationId: ctx.orgId, appointmentId: appt.id, treatmentItemId })));
    }
    if (appt.reminderPreference !== data.reminderPreference) {
      await cancelPendingReminders(tx, ctx.orgId, appt.id, "Preferência de lembrete alterada");
      if (OPEN_STATUSES.includes(appt.status as AppointmentStatus)) {
        await scheduleAppointmentReminder(tx, ctx, { id: appt.id, patientId: appt.patientId, startsAt: appt.startsAt, reminderPreference: data.reminderPreference });
      }
    }
    await tx.insert(appointmentStatusHistory).values({ organizationId: ctx.orgId, appointmentId: appt.id, kind: "edit", changedBy: ctx.userId, reason: "Dados da consulta atualizados" });
  });
}

const statusSchema = z.object({
  appointmentId: zId,
  expectedVersion: z.number().int().nullish(),
  to: z.enum(APPOINTMENT_STATUSES),
  reason: zOptionalText(500),
});

/** Mudança explícita de situação. Confirmar exige ação do usuário; finalizar não conclui procedimentos. */
export async function changeAppointmentStatus(ctx: Ctx, input: z.input<typeof statusSchema>) {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(statusSchema, input);
  if (data.to === "cancelled_rescheduled" || data.to === "no_show_rescheduled") {
    throw new ValidationError("Use a remarcação para vincular a nova consulta");
  }
  try {
    return await ctx.db.transaction(async (tx) => {
      const appt = await loadForUpdate(tx, ctx, data.appointmentId);
      if (data.expectedVersion && appt.version !== data.expectedVersion) throw new ConflictError("A consulta foi alterada por outra pessoa. Atualize a agenda.");
      const from = appt.status as AppointmentStatus;
      if (from === data.to) return;
      if (!canTransition(from, data.to)) {
        throw new BusinessRuleError(`Não é possível passar de "${APPOINTMENT_STATUS_LABEL[from]}" para "${APPOINTMENT_STATUS_LABEL[data.to]}"`);
      }
      if (requiresReason(data.to) && !data.reason) throw new ValidationError("Informe o motivo", { reason: "Obrigatório" });
      if (OCCUPYING_STATUSES.includes(data.to) && !OCCUPYING_STATUSES.includes(from)) {
        // Reativar consulta desmarcada: revalida o horário.
        await lockProfessionalDay(tx, ctx.orgId, appt.professionalId, appt.localDate);
        const conflicts = await findConflicts(tx, ctx, { ...appt, date: appt.localDate, excludeAppointmentId: appt.id });
        if (conflicts.some((c) => c.kind !== "outside_hours") && !appt.isOverbook) throw new ScheduleConflictError(conflicts, can(ctx, "schedule.overbook"));
      }
      const isCancel = data.to === "cancelled_by_clinic" || data.to === "cancelled_by_patient" || data.to === "no_show";
      await tx
        .update(appointments)
        .set({
          status: data.to,
          cancelReason: isCancel ? data.reason : appt.cancelReason,
          statusChangedAt: new Date(),
          statusChangedBy: ctx.userId,
          updatedAt: new Date(),
          version: sql`${appointments.version} + 1`,
        })
        .where(eq(appointments.id, appt.id));
      await tx.insert(appointmentStatusHistory).values({
        organizationId: ctx.orgId,
        appointmentId: appt.id,
        kind: "status",
        fromStatus: from,
        toStatus: data.to,
        reason: data.reason,
        changedBy: ctx.userId,
      });
      if (!OPEN_STATUSES.includes(data.to)) await cancelPendingReminders(tx, ctx.orgId, appt.id, `Consulta: ${APPOINTMENT_STATUS_LABEL[data.to]}`);
      await audit(tx, ctx, {
        action: "appointment.status",
        entityType: "appointment",
        entityId: appt.id,
        summary: `${APPOINTMENT_STATUS_LABEL[from]} → ${APPOINTMENT_STATUS_LABEL[data.to]}`,
      });
    });
  } catch (err) {
    translateDbConflict(err);
  }
}

const rescheduleSchema = z.object({
  appointmentId: zId,
  reason: zRequiredText("Motivo da remarcação", 500),
  requestedBy: z.enum(["patient", "clinic"]).default("patient"),
  ...timeFields,
});

/**
 * Remarcação: a consulta antiga é preservada como "Desmarcado e remarcado"
 * (ou "Faltou e remarcado") e vinculada à nova, que passa a ocupar o horário.
 */
export async function rescheduleAppointment(ctx: Ctx, input: z.input<typeof rescheduleSchema>): Promise<{ newAppointmentId: string; cancelledReminders: number }> {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(rescheduleSchema, input);
  try {
    return await ctx.db.transaction(async (tx) => {
      const old = await loadForUpdate(tx, ctx, data.appointmentId);
      const from = old.status as AppointmentStatus;
      if (!["scheduled", "confirmed", "no_show", "cancelled_by_patient", "cancelled_by_clinic"].includes(from)) {
        throw new BusinessRuleError("Esta consulta não pode ser remarcada");
      }
      const [already] = await tx.select({ id: appointments.id }).from(appointments).where(eq(appointments.rescheduledFromId, old.id));
      if (already) throw new BusinessRuleError("Consulta já remarcada");
      const slot = await getSlotMinutes(tx, ctx.orgId);
      try {
        validateTimeRange(data.startMinute, data.endMinute, slot);
      } catch (err) {
        if (err instanceof ScheduleRuleError) throw new ValidationError(err.message);
        throw err;
      }
      const toStatus: AppointmentStatus = from === "no_show" ? "no_show_rescheduled" : "cancelled_rescheduled";
      // Libera o horário antigo antes de verificar o novo (pode ser o mesmo dia/profissional).
      await tx
        .update(appointments)
        .set({
          status: toStatus,
          cancelReason: `${data.requestedBy === "patient" ? "Pedido do paciente" : "Pedido da clínica"}: ${data.reason}`,
          statusChangedAt: new Date(),
          statusChangedBy: ctx.userId,
          updatedAt: new Date(),
          version: sql`${appointments.version} + 1`,
        })
        .where(eq(appointments.id, old.id));
      await lockProfessionalDay(tx, ctx.orgId, data.professionalId, data.date);
      const conflicts = await findConflicts(tx, ctx, data);
      const { isOverbook } = resolveConflicts(ctx, conflicts, { overbook: data.confirmOverbook, outsideHours: data.confirmOutsideHours });
      const startsAt = zonedToInstant(data.date, data.startMinute, ctx.timezone);
      const endsAt = zonedToInstant(data.date, data.endMinute, ctx.timezone);
      const [created] = await tx
        .insert(appointments)
        .values({
          organizationId: ctx.orgId,
          patientId: old.patientId,
          professionalId: data.professionalId,
          startsAt,
          endsAt,
          localDate: data.date,
          startMinute: data.startMinute,
          endMinute: data.endMinute,
          status: "scheduled",
          isFirstVisit: old.isFirstVisit,
          planned: old.planned,
          notes: old.notes,
          reminderPreference: old.reminderPreference,
          isOverbook,
          overbookReason: isOverbook ? (data.overbookReason ?? "Encaixe na remarcação") : null,
          rescheduledFromId: old.id,
          statusChangedAt: new Date(),
          statusChangedBy: ctx.userId,
          createdBy: ctx.userId,
        })
        .returning({ id: appointments.id });
      const newId = created!.id;
      const procs = await tx
        .select({ treatmentItemId: appointmentProcedures.treatmentItemId, outcome: appointmentProcedures.outcome })
        .from(appointmentProcedures)
        .where(eq(appointmentProcedures.appointmentId, old.id));
      const carry = procs.filter((p) => p.outcome === null);
      if (carry.length > 0) {
        await tx.insert(appointmentProcedures).values(carry.map((p) => ({ organizationId: ctx.orgId, appointmentId: newId, treatmentItemId: p.treatmentItemId })));
      }
      await tx.insert(appointmentStatusHistory).values([
        { organizationId: ctx.orgId, appointmentId: old.id, kind: "reschedule", fromStatus: from, toStatus, reason: data.reason, changedBy: ctx.userId, fromStartsAt: old.startsAt, toStartsAt: startsAt },
        { organizationId: ctx.orgId, appointmentId: newId, kind: "created", toStatus: "scheduled", reason: `Remarcação de ${formatDateBR(old.localDate)} ${minutesToHHMM(old.startMinute)}`, changedBy: ctx.userId, fromStartsAt: old.startsAt, toStartsAt: startsAt },
      ]);
      const cancelledReminders = await cancelPendingReminders(tx, ctx.orgId, old.id, "Consulta remarcada");
      await scheduleAppointmentReminder(tx, ctx, { id: newId, patientId: old.patientId, startsAt, reminderPreference: old.reminderPreference as ReminderPreference });
      await audit(tx, ctx, {
        action: "appointment.reschedule",
        entityType: "appointment",
        entityId: old.id,
        summary: `Consulta remarcada para ${formatDateBR(data.date)} ${minutesToHHMM(data.startMinute)}`,
        changes: { newAppointmentId: newId },
      });
      return { newAppointmentId: newId, cancelledReminders };
    });
  } catch (err) {
    translateDbConflict(err);
  }
}

// ---------------------------------------------------------------------------
// Desfecho clínico do atendimento
// ---------------------------------------------------------------------------

const outcomeSchema = z.object({
  appointmentId: zId,
  performed: zOptionalText(4000),
  finish: z.boolean().default(false),
  procedures: z
    .array(
      z.object({
        treatmentItemId: zId,
        outcome: z.enum(["performed", "partial", "not_performed"]),
        resultingStatus: z.enum(["not_started", "in_progress", "completed"]),
        sessionLabel: zOptionalText(80),
        note: zOptionalText(2000),
      }),
    )
    .default([]),
});

/**
 * O profissional registra o que foi realizado e o estado resultante de cada
 * procedimento. Finalizar a consulta não conclui itens nem mexe no financeiro.
 */
export async function recordAppointmentOutcome(ctx: Ctx, input: z.input<typeof outcomeSchema>) {
  assertCan(ctx, "clinical.edit");
  const data = parseInput(outcomeSchema, input);
  return ctx.db.transaction(async (tx) => {
    const appt = await loadForUpdate(tx, ctx, data.appointmentId);
    const links = await tx
      .select()
      .from(appointmentProcedures)
      .where(and(eq(appointmentProcedures.organizationId, ctx.orgId), eq(appointmentProcedures.appointmentId, appt.id)));
    for (const p of data.procedures) {
      const link = links.find((l) => l.treatmentItemId === p.treatmentItemId);
      if (!link) throw new ValidationError("Procedimento não está programado nesta consulta");
      const [item] = await tx
        .select()
        .from(treatmentItems)
        .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.id, p.treatmentItemId), eq(treatmentItems.patientId, appt.patientId)))
        .for("update");
      if (!item) throw new NotFoundError("Item de tratamento");
      if (item.clinicalStatus === "cancelled") throw new BusinessRuleError("Item cancelado");
      await tx.update(appointmentProcedures).set({ outcome: p.outcome, note: p.note }).where(eq(appointmentProcedures.id, link.id));
      await tx.insert(clinicalProgressEntries).values({
        organizationId: ctx.orgId,
        treatmentItemId: item.id,
        patientId: appt.patientId,
        appointmentId: appt.id,
        professionalId: appt.professionalId,
        sessionLabel: p.sessionLabel,
        description: p.note ?? (p.outcome === "performed" ? "Realizado" : p.outcome === "partial" ? "Realizado parcialmente" : "Não realizado"),
        resultingStatus: p.resultingStatus,
        createdBy: ctx.userId,
      });
      if (item.clinicalStatus !== p.resultingStatus) {
        await tx
          .update(treatmentItems)
          .set({
            clinicalStatus: p.resultingStatus,
            completedAt: p.resultingStatus === "completed" ? new Date() : null,
            updatedAt: new Date(),
            version: sql`${treatmentItems.version} + 1`,
          })
          .where(eq(treatmentItems.id, item.id));
      }
    }
    const nextStatus = data.finish ? "finished" : appt.status;
    if (data.finish && !canTransition(appt.status as AppointmentStatus, "finished") && appt.status !== "finished") {
      throw new BusinessRuleError("Esta consulta não pode ser finalizada no estado atual");
    }
    await tx
      .update(appointments)
      .set({
        performed: data.performed ?? appt.performed,
        status: nextStatus,
        ...(data.finish && appt.status !== "finished" ? { statusChangedAt: new Date(), statusChangedBy: ctx.userId } : {}),
        updatedAt: new Date(),
        version: sql`${appointments.version} + 1`,
      })
      .where(eq(appointments.id, appt.id));
    if (data.finish && appt.status !== "finished") {
      await tx.insert(appointmentStatusHistory).values({ organizationId: ctx.orgId, appointmentId: appt.id, kind: "status", fromStatus: appt.status, toStatus: "finished", changedBy: ctx.userId });
      await cancelPendingReminders(tx, ctx.orgId, appt.id, "Consulta finalizada");
    }
    await audit(tx, ctx, {
      action: "appointment.outcome",
      entityType: "appointment",
      entityId: appt.id,
      summary: `Atendimento registrado (${data.procedures.length} procedimento(s))${data.finish ? " e finalizado" : ""}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Pendências e listas por paciente
// ---------------------------------------------------------------------------

/** Consultas passadas sem desfecho: nunca presume falta ou conclusão. */
export async function listPendingClosure(ctx: Ctx, opts: { patientId?: string } = {}) {
  assertCan(ctx, "schedule.view");
  return ctx.db
    .select({ appointment: appointments, patientName: patients.fullName, professionalName: professionals.name })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(
      and(
        eq(appointments.organizationId, ctx.orgId),
        lt(appointments.endsAt, new Date()),
        inArray(appointments.status, [...OPEN_STATUSES]),
        opts.patientId ? eq(appointments.patientId, opts.patientId) : undefined,
      ),
    )
    .orderBy(desc(appointments.startsAt))
    .limit(200);
}

export async function listPatientAppointments(ctx: Ctx, patientId: string) {
  assertCan(ctx, "schedule.view");
  const rows = await ctx.db
    .select({ appointment: appointments, professionalName: professionals.name })
    .from(appointments)
    .innerJoin(professionals, eq(professionals.id, appointments.professionalId))
    .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.patientId, patientId)))
    .orderBy(desc(appointments.startsAt));
  const now = Date.now();
  const showClinical = can(ctx, "clinical.view");
  const list = rows.map((r) => ({
    ...r.appointment,
    status: r.appointment.status as AppointmentStatus,
    planned: showClinical ? r.appointment.planned : null,
    performed: showClinical ? r.appointment.performed : null,
    professionalName: r.professionalName,
  }));
  return {
    future: list.filter((a) => a.startsAt.getTime() >= now && OCCUPYING_STATUSES.includes(a.status)).reverse(),
    pendingClosure: list.filter((a) => a.endsAt.getTime() < now && OPEN_STATUSES.includes(a.status)),
    missedOrCancelled: list.filter((a) => !OCCUPYING_STATUSES.includes(a.status)),
    past: list.filter((a) => a.startsAt.getTime() < now && a.status === "finished"),
    all: list,
  };
}

// ---------------------------------------------------------------------------
// Bloqueios de agenda
// ---------------------------------------------------------------------------

const blockSchema = z
  .object({
    professionalId: zId.nullish().transform((v) => v ?? null),
    kind: z.enum(["single", "weekly"]),
    date: zCivilDate.nullish(),
    weekday: z.number().int().min(0).max(6).nullish(),
    startDate: zCivilDate.nullish(),
    untilDate: zCivilDate.nullish(),
    startMinute: z.number().int().min(0).max(1440),
    endMinute: z.number().int().min(0).max(1440),
    reason: zRequiredText("Motivo", 200),
  })
  .refine((b) => b.endMinute > b.startMinute, { message: "Horário final deve ser posterior ao inicial", path: ["endMinute"] })
  .refine((b) => (b.kind === "single" ? Boolean(b.date) : b.weekday !== null && b.weekday !== undefined && Boolean(b.startDate)), {
    message: "Informe a data (único) ou o dia da semana e o início (recorrente)",
    path: ["kind"],
  });

export async function createBlock(ctx: Ctx, input: z.input<typeof blockSchema>) {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(blockSchema, input);
  if (data.professionalId) {
    const [p] = await ctx.db
      .select({ id: professionals.id })
      .from(professionals)
      .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, data.professionalId)));
    if (!p) throw new NotFoundError("Profissional");
  }
  const [row] = await ctx.db
    .insert(scheduleBlocks)
    .values({
      organizationId: ctx.orgId,
      professionalId: data.professionalId,
      kind: data.kind,
      localDate: data.kind === "single" ? data.date! : null,
      weekday: data.kind === "weekly" ? data.weekday! : null,
      startDate: data.kind === "weekly" ? data.startDate! : null,
      untilDate: data.kind === "weekly" ? (data.untilDate ?? null) : null,
      startMinute: data.startMinute,
      endMinute: data.endMinute,
      reason: data.reason,
      createdBy: ctx.userId,
    })
    .returning({ id: scheduleBlocks.id });
  await audit(ctx.db, ctx, { action: "schedule_block.create", entityType: "schedule_block", entityId: row!.id, summary: `Bloqueio de agenda: ${data.reason}` });
  return { id: row!.id };
}

export async function deactivateBlock(ctx: Ctx, blockId: string) {
  assertCan(ctx, "schedule.edit");
  const [row] = await ctx.db
    .update(scheduleBlocks)
    .set({ active: false })
    .where(and(eq(scheduleBlocks.organizationId, ctx.orgId), eq(scheduleBlocks.id, blockId)))
    .returning({ id: scheduleBlocks.id });
  if (!row) throw new NotFoundError("Bloqueio");
  await audit(ctx.db, ctx, { action: "schedule_block.remove", entityType: "schedule_block", entityId: blockId, summary: "Bloqueio de agenda removido" });
}

export async function listBlocks(ctx: Ctx) {
  assertCan(ctx, "schedule.view");
  return ctx.db
    .select({ block: scheduleBlocks, professionalName: professionals.name })
    .from(scheduleBlocks)
    .leftJoin(professionals, eq(professionals.id, scheduleBlocks.professionalId))
    .where(and(eq(scheduleBlocks.organizationId, ctx.orgId), eq(scheduleBlocks.active, true)))
    .orderBy(asc(scheduleBlocks.kind), asc(scheduleBlocks.localDate), asc(scheduleBlocks.weekday));
}

export { ForbiddenError };
