import { and, asc, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { OCCUPYING_STATUSES } from "@/domain/appointments";
import { audit } from "../audit";
import { assertCan, assertCanAny, type Ctx } from "../context";
import {
  appointmentProcedures,
  appointments,
  budgets,
  clinicalProgressEntries,
  patients,
  professionals,
  treatmentItems,
  treatments,
  users,
} from "../db/schema";
import { q } from "../db/sql";
import { BusinessRuleError, NotFoundError } from "../errors";
import { parseInput, zId, zOptionalText, zRequiredText } from "../validation";

export type ClinicalStatus = "not_started" | "in_progress" | "completed" | "cancelled";

export const CLINICAL_STATUS_LABEL: Record<ClinicalStatus, string> = {
  not_started: "Não realizado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/**
 * Evolução = itens concluídos / itens ativos aprovados (cancelados fora do
 * denominador). Critério operacional, sem ponderar preço e sem avaliação clínica.
 */
export function progressOf(items: { clinicalStatus: string }[]): { completed: number; active: number; percent: number | null; label: string } {
  const active = items.filter((i) => i.clinicalStatus !== "cancelled");
  const completed = active.filter((i) => i.clinicalStatus === "completed").length;
  if (active.length === 0) return { completed: 0, active: 0, percent: null, label: "Sem itens ativos" };
  const percent = Math.floor((completed * 100) / active.length);
  return { completed, active: active.length, percent, label: `${completed} de ${active.length} itens concluídos (${percent}%)` };
}

const listSchema = z.object({
  patientId: zId,
  filter: z.enum(["pending", "not_started", "in_progress", "completed", "cancelled", "all"]).default("pending"),
});

export async function listPatientTreatmentItems(ctx: Ctx, input: z.input<typeof listSchema>) {
  assertCanAny(ctx, "schedule.view", "clinical.view", "budgets.view");
  const data = parseInput(listSchema, input);
  const statuses: ClinicalStatus[] =
    data.filter === "pending"
      ? ["not_started", "in_progress"]
      : data.filter === "all"
        ? ["not_started", "in_progress", "completed", "cancelled"]
        : [data.filter];
  const rows = await ctx.db
    .select({
      item: treatmentItems,
      budgetNumber: budgets.number,
      budgetId: budgets.id,
      nextAppointmentAt: sql<string | null>`(select min(${q(appointments.startsAt)})::text from ${appointmentProcedures}
        join ${appointments} on ${q(appointments.id)} = ${q(appointmentProcedures.appointmentId)}
        where ${q(appointmentProcedures.treatmentItemId)} = ${q(treatmentItems.id)}
          and ${q(appointments.startsAt)} > now()
          and ${q(appointments.status)} in ('scheduled','confirmed','arrived','in_progress'))`,
      sessions: sql<number>`(select count(*)::int from ${clinicalProgressEntries} where ${q(clinicalProgressEntries.treatmentItemId)} = ${q(treatmentItems.id)})`,
    })
    .from(treatmentItems)
    .innerJoin(treatments, eq(treatments.id, treatmentItems.treatmentId))
    .innerJoin(budgets, eq(budgets.id, treatments.budgetId))
    .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.patientId, data.patientId), inArray(treatmentItems.clinicalStatus, statuses)))
    .orderBy(asc(budgets.number), asc(treatmentItems.createdAt));
  return rows.map((r) => ({
    ...r.item,
    clinicalStatus: r.item.clinicalStatus as ClinicalStatus,
    budgetNumber: r.budgetNumber,
    budgetId: r.budgetId,
    nextAppointmentAt: r.nextAppointmentAt,
    sessions: r.sessions,
  }));
}

export async function patientTreatmentSummary(ctx: Ctx, patientId: string) {
  assertCanAny(ctx, "schedule.view", "clinical.view", "budgets.view");
  const rows = await ctx.db
    .select({ treatment: treatments, budgetNumber: budgets.number })
    .from(treatments)
    .innerJoin(budgets, eq(budgets.id, treatments.budgetId))
    .where(and(eq(treatments.organizationId, ctx.orgId), eq(treatments.patientId, patientId)))
    .orderBy(desc(treatments.createdAt));
  const items = await ctx.db
    .select({ treatmentId: treatmentItems.treatmentId, clinicalStatus: treatmentItems.clinicalStatus })
    .from(treatmentItems)
    .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.patientId, patientId)));
  return {
    overall: progressOf(items),
    treatments: rows.map((r) => ({
      ...r.treatment,
      budgetNumber: r.budgetNumber,
      progress: progressOf(items.filter((i) => i.treatmentId === r.treatment.id)),
    })),
  };
}

const statusSchema = z.object({
  treatmentItemId: zId,
  status: z.enum(["not_started", "in_progress", "completed"]),
  description: zRequiredText("Descrição da evolução", 4000),
  sessionLabel: zOptionalText(80),
  appointmentId: zId.nullish().transform((v) => v ?? null),
});

/** Evolução registrada pelo profissional; não altera nada no financeiro. */
export async function recordProgress(ctx: Ctx, input: z.input<typeof statusSchema>) {
  assertCan(ctx, "clinical.edit");
  const data = parseInput(statusSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(treatmentItems)
      .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.id, data.treatmentItemId)))
      .for("update");
    if (!item) throw new NotFoundError("Item de tratamento");
    if (item.clinicalStatus === "cancelled") throw new BusinessRuleError("Item cancelado não recebe evolução");
    if (data.appointmentId) {
      const [a] = await tx
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(eq(appointments.organizationId, ctx.orgId), eq(appointments.id, data.appointmentId), eq(appointments.patientId, item.patientId)));
      if (!a) throw new NotFoundError("Consulta");
    }
    const [prof] = await tx
      .select({ id: professionals.id })
      .from(professionals)
      .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.userId, ctx.userId)));
    await tx.insert(clinicalProgressEntries).values({
      organizationId: ctx.orgId,
      treatmentItemId: item.id,
      patientId: item.patientId,
      appointmentId: data.appointmentId,
      professionalId: prof?.id ?? null,
      sessionLabel: data.sessionLabel,
      description: data.description,
      resultingStatus: data.status,
      createdBy: ctx.userId,
    });
    await tx
      .update(treatmentItems)
      .set({
        clinicalStatus: data.status,
        completedAt: data.status === "completed" ? new Date() : null,
        updatedAt: new Date(),
        version: sql`${treatmentItems.version} + 1`,
      })
      .where(eq(treatmentItems.id, item.id));
    await audit(tx, ctx, {
      action: "treatment_item.progress",
      entityType: "treatment_item",
      entityId: item.id,
      summary: `Evolução registrada: ${CLINICAL_STATUS_LABEL[item.clinicalStatus as ClinicalStatus]} → ${CLINICAL_STATUS_LABEL[data.status]}`,
    });
  });
}

const cancelSchema = z.object({ treatmentItemId: zId, reason: zRequiredText("Motivo do cancelamento clínico", 500) });

/** Cancelamento clínico preserva o histórico e sinaliza análise financeira separada. */
export async function cancelTreatmentItem(ctx: Ctx, input: z.input<typeof cancelSchema>) {
  assertCan(ctx, "treatments.edit");
  const data = parseInput(cancelSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(treatmentItems)
      .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.id, data.treatmentItemId)))
      .for("update");
    if (!item) throw new NotFoundError("Item de tratamento");
    if (item.clinicalStatus === "cancelled") throw new BusinessRuleError("Item já cancelado");
    if (item.clinicalStatus === "completed") throw new BusinessRuleError("Item concluído não pode ser cancelado; registre um adendo clínico");
    await tx
      .update(treatmentItems)
      .set({
        clinicalStatus: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: ctx.userId,
        cancelledReason: data.reason,
        financialReviewPending: true,
        updatedAt: new Date(),
        version: sql`${treatmentItems.version} + 1`,
      })
      .where(eq(treatmentItems.id, item.id));
    await audit(tx, ctx, {
      action: "treatment_item.cancel",
      entityType: "treatment_item",
      entityId: item.id,
      summary: `Item "${item.procedureName}" cancelado clinicamente; ajuste financeiro pendente de análise`,
    });
  });
}

export async function resolveFinancialReview(ctx: Ctx, treatmentItemId: string, note: string) {
  assertCan(ctx, "finance.edit");
  const [row] = await ctx.db
    .update(treatmentItems)
    .set({ financialReviewPending: false, updatedAt: new Date() })
    .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.id, treatmentItemId), eq(treatmentItems.financialReviewPending, true)))
    .returning({ id: treatmentItems.id });
  if (!row) throw new NotFoundError("Pendência financeira");
  await audit(ctx.db, ctx, { action: "treatment_item.financial_review", entityType: "treatment_item", entityId: treatmentItemId, summary: `Análise financeira do cancelamento concluída: ${note}` });
}

export async function progressEntries(ctx: Ctx, treatmentItemId: string) {
  assertCan(ctx, "clinical.view");
  return ctx.db
    .select({ entry: clinicalProgressEntries, authorName: users.name, professionalName: professionals.name })
    .from(clinicalProgressEntries)
    .leftJoin(users, eq(users.id, clinicalProgressEntries.createdBy))
    .leftJoin(professionals, eq(professionals.id, clinicalProgressEntries.professionalId))
    .where(and(eq(clinicalProgressEntries.organizationId, ctx.orgId), eq(clinicalProgressEntries.treatmentItemId, treatmentItemId)))
    .orderBy(asc(clinicalProgressEntries.createdAt));
}

/** Procedimentos aprovados ainda sem consulta futura (relatório e pendências). */
export async function listUnscheduledItems(ctx: Ctx) {
  assertCanAny(ctx, "schedule.view", "reports.view");
  return ctx.db
    .select({ item: treatmentItems, patientName: patients.fullName, budgetNumber: budgets.number })
    .from(treatmentItems)
    .innerJoin(patients, eq(patients.id, treatmentItems.patientId))
    .innerJoin(treatments, eq(treatments.id, treatmentItems.treatmentId))
    .innerJoin(budgets, eq(budgets.id, treatments.budgetId))
    .where(
      and(
        eq(treatmentItems.organizationId, ctx.orgId),
        inArray(treatmentItems.clinicalStatus, ["not_started", "in_progress"]),
        sql`not exists (select 1 from ${appointmentProcedures} ap join ${appointments} a on a.id = ap.appointment_id
          where ap.treatment_item_id = ${q(treatmentItems.id)} and a.starts_at > now()
          and a.status in (${sql.raw(OCCUPYING_STATUSES.map((s) => `'${s}'`).join(","))}))`,
      ),
    )
    .orderBy(asc(patients.fullName), asc(budgets.number))
    .limit(500);
}

export { gt };
