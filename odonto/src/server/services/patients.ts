import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { ageOn, todayInTz } from "@/domain/dates";
import { formatCpf, isValidCpf, maskCpf, onlyDigits, searchKey } from "@/domain/text";
import { audit } from "../audit";
import { assertCan, can, type Ctx } from "../context";
import { patientAlerts, patientResponsibles, patients, professionals, schedulingTasks, users } from "../db/schema";
import { ConflictError, isUniqueViolation, NotFoundError } from "../errors";
import { nextCounter } from "../idempotency";
import { parseInput, zCivilDate, zId, zOptionalText, zRequiredText } from "../validation";

const zPhone = z
  .string()
  .trim()
  .transform((v) => onlyDigits(v))
  .refine((v) => v === "" || (v.length >= 10 && v.length <= 13), { message: "Telefone com DDD (10 a 13 dígitos)" })
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

const zCpf = z
  .string()
  .trim()
  .transform((v) => onlyDigits(v))
  .refine((v) => v === "" || isValidCpf(v), { message: "CPF inválido" })
  .transform((v) => (v === "" ? null : v))
  .nullish()
  .transform((v) => v ?? null);

const zEmail = z
  .string()
  .trim()
  .refine((v) => v === "" || z.email().safeParse(v).success, { message: "E-mail inválido" })
  .transform((v) => (v === "" ? null : v.toLowerCase()))
  .nullish()
  .transform((v) => v ?? null);

function buildSearchKey(fullName: string, socialName: string | null): string {
  return [searchKey(fullName), searchKey(socialName)].filter(Boolean).join(" ");
}

export interface DuplicateCandidate {
  id: string;
  code: number;
  fullName: string;
  phone: string | null;
  birthDate: string | null;
  reasons: string[];
}

/** Possíveis duplicidades: mesmo CPF, mesmo telefone ou mesmo nome. Nunca une cadastros sozinho. */
export async function findPossibleDuplicates(
  ctx: Ctx,
  input: { fullName: string; phone?: string | null; cpf?: string | null; birthDate?: string | null; excludeId?: string | null },
): Promise<DuplicateCandidate[]> {
  const key = searchKey(input.fullName);
  const phone = onlyDigits(input.phone);
  const cpf = onlyDigits(input.cpf);
  const conditions = [eq(patients.searchKey, key)];
  if (phone.length >= 10) conditions.push(or(eq(patients.phone, phone), eq(patients.phoneAlt, phone))!);
  if (cpf.length === 11) conditions.push(eq(patients.cpf, cpf));
  const rows = await ctx.db
    .select({
      id: patients.id,
      code: patients.code,
      fullName: patients.fullName,
      phone: patients.phone,
      phoneAlt: patients.phoneAlt,
      cpf: patients.cpf,
      birthDate: patients.birthDate,
      searchKey: patients.searchKey,
    })
    .from(patients)
    .where(and(eq(patients.organizationId, ctx.orgId), input.excludeId ? ne(patients.id, input.excludeId) : undefined, or(...conditions)))
    .limit(10);
  return rows.map((r) => {
    const reasons: string[] = [];
    if (cpf.length === 11 && r.cpf === cpf) reasons.push("Mesmo CPF");
    if (phone.length >= 10 && (r.phone === phone || r.phoneAlt === phone)) reasons.push("Mesmo telefone");
    if (r.searchKey === key) reasons.push(input.birthDate && r.birthDate === input.birthDate ? "Mesmo nome e nascimento" : "Mesmo nome");
    return { id: r.id, code: r.code, fullName: r.fullName, phone: r.phone, birthDate: r.birthDate, reasons };
  });
}

const quickSchema = z.object({
  fullName: zRequiredText("Nome", 200),
  phone: zPhone,
  confirmNotDuplicate: z.boolean().default(false),
});

export type QuickCreateResult =
  | { status: "created"; id: string; code: number }
  | { status: "possible_duplicates"; candidates: DuplicateCandidate[] };

/** Cadastro rápido (nome + contato) para marcar a primeira consulta. */
export async function quickCreatePatient(ctx: Ctx, input: z.input<typeof quickSchema>): Promise<QuickCreateResult> {
  assertCan(ctx, "patients.edit");
  const data = parseInput(quickSchema, input);
  if (!data.confirmNotDuplicate) {
    const candidates = await findPossibleDuplicates(ctx, { fullName: data.fullName, phone: data.phone });
    if (candidates.length > 0) return { status: "possible_duplicates", candidates };
  }
  return ctx.db.transaction(async (tx) => {
    const code = await nextCounter(tx, ctx.orgId, "patient");
    const [row] = await tx
      .insert(patients)
      .values({
        organizationId: ctx.orgId,
        code,
        fullName: data.fullName,
        phone: data.phone,
        searchKey: buildSearchKey(data.fullName, null),
        createdBy: ctx.userId,
      })
      .returning({ id: patients.id });
    await audit(tx, ctx, { action: "patient.create", entityType: "patient", entityId: row!.id, summary: `Paciente nº ${code} cadastrado (rápido)` });
    return { status: "created" as const, id: row!.id, code };
  });
}

const patientSchema = z.object({
  id: zId.nullish(),
  version: z.number().int().nullish(),
  fullName: zRequiredText("Nome", 200),
  socialName: zOptionalText(200),
  birthDate: zCivilDate.nullish().transform((v) => v ?? null),
  cpf: zCpf,
  phone: zPhone,
  phoneAlt: zPhone,
  email: zEmail,
  zip: zOptionalText(9),
  street: zOptionalText(200),
  number: zOptionalText(20),
  complement: zOptionalText(100),
  district: zOptionalText(120),
  city: zOptionalText(120),
  state: zOptionalText(2),
  origin: zOptionalText(120),
  referredBy: zOptionalText(160),
  referenceProfessionalId: zId.nullish().transform((v) => v ?? null),
  adminNotes: zOptionalText(4000),
  confirmNotDuplicate: z.boolean().default(false),
});

export type SavePatientResult =
  | { status: "saved"; id: string }
  | { status: "possible_duplicates"; candidates: DuplicateCandidate[] };

export async function savePatient(ctx: Ctx, input: z.input<typeof patientSchema>): Promise<SavePatientResult> {
  assertCan(ctx, "patients.edit");
  const data = parseInput(patientSchema, input);
  if (data.referenceProfessionalId) {
    const [p] = await ctx.db
      .select({ id: professionals.id })
      .from(professionals)
      .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, data.referenceProfessionalId)));
    if (!p) throw new NotFoundError("Profissional");
  }
  if (!data.confirmNotDuplicate) {
    const candidates = await findPossibleDuplicates(ctx, { ...data, excludeId: data.id ?? null });
    if (candidates.length > 0) return { status: "possible_duplicates", candidates };
  }
  // CPF só é alterado por quem pode ver documentos; os demais mantêm o valor atual.
  const canDocs = can(ctx, "patients.view_documents");
  const values = {
    fullName: data.fullName,
    socialName: data.socialName,
    birthDate: data.birthDate,
    phone: data.phone,
    phoneAlt: data.phoneAlt,
    email: data.email,
    zip: data.zip,
    street: data.street,
    number: data.number,
    complement: data.complement,
    district: data.district,
    city: data.city,
    state: data.state?.toUpperCase() ?? null,
    origin: data.origin,
    referredBy: data.referredBy,
    referenceProfessionalId: data.referenceProfessionalId,
    adminNotes: data.adminNotes,
    searchKey: buildSearchKey(data.fullName, data.socialName),
    ...(canDocs ? { cpf: data.cpf } : {}),
  };
  try {
    return await ctx.db.transaction(async (tx) => {
      if (data.id) {
        const [row] = await tx
          .update(patients)
          .set({ ...values, updatedAt: new Date(), version: sql`${patients.version} + 1` })
          .where(
            and(
              eq(patients.organizationId, ctx.orgId),
              eq(patients.id, data.id),
              data.version ? eq(patients.version, data.version) : undefined,
            ),
          )
          .returning({ id: patients.id });
        if (!row) {
          const [exists] = await tx.select({ id: patients.id }).from(patients).where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, data.id)));
          if (!exists) throw new NotFoundError("Paciente");
          throw new ConflictError("O cadastro foi alterado por outra pessoa. Recarregue a página para ver a versão atual.");
        }
        await audit(tx, ctx, { action: "patient.update", entityType: "patient", entityId: row.id, summary: "Cadastro do paciente atualizado" });
        return { status: "saved" as const, id: row.id };
      }
      const code = await nextCounter(tx, ctx.orgId, "patient");
      const [row] = await tx
        .insert(patients)
        .values({ organizationId: ctx.orgId, code, createdBy: ctx.userId, ...values, cpf: canDocs ? data.cpf : null })
        .returning({ id: patients.id });
      await audit(tx, ctx, { action: "patient.create", entityType: "patient", entityId: row!.id, summary: `Paciente nº ${code} cadastrado` });
      return { status: "saved" as const, id: row!.id };
    });
  } catch (err) {
    if (isUniqueViolation(err, "patients_org_cpf_uq")) throw new ConflictError("Já existe paciente com este CPF");
    throw err;
  }
}

export async function setPatientStatus(ctx: Ctx, patientId: string, status: "active" | "archived") {
  assertCan(ctx, "patients.edit");
  const [row] = await ctx.db
    .update(patients)
    .set({ status, updatedAt: new Date(), version: sql`${patients.version} + 1` })
    .where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, patientId)))
    .returning({ id: patients.id });
  if (!row) throw new NotFoundError("Paciente");
  await audit(ctx.db, ctx, {
    action: status === "archived" ? "patient.archive" : "patient.reactivate",
    entityType: "patient",
    entityId: patientId,
    summary: status === "archived" ? "Paciente arquivado" : "Paciente reativado",
  });
}

function presentPatient(ctx: Ctx, p: typeof patients.$inferSelect) {
  const canDocs = can(ctx, "patients.view_documents");
  return {
    ...p,
    cpf: canDocs ? (p.cpf ? formatCpf(p.cpf) : null) : null,
    cpfMasked: p.cpf ? maskCpf(p.cpf) : null,
    hasCpf: Boolean(p.cpf),
    age: p.birthDate ? ageOn(p.birthDate, todayInTz(ctx.timezone)) : null,
    adminNotes: p.adminNotes,
  };
}

export type PatientView = ReturnType<typeof presentPatient>;

export async function getPatient(ctx: Ctx, id: string): Promise<PatientView> {
  assertCan(ctx, "patients.view");
  const [row] = await ctx.db.select().from(patients).where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, id)));
  if (!row) throw new NotFoundError("Paciente");
  return presentPatient(ctx, row);
}

/** Usado por outros serviços para garantir que o paciente pertence à clínica. */
export async function assertPatientInOrg(ctx: Pick<Ctx, "db" | "orgId">, id: string) {
  const [row] = await ctx.db
    .select({ id: patients.id, fullName: patients.fullName, status: patients.status, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, id)));
  if (!row) throw new NotFoundError("Paciente");
  return row;
}

const searchSchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["active", "archived", "all"]).default("active"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

export async function searchPatients(ctx: Ctx, input: z.input<typeof searchSchema>) {
  assertCan(ctx, "patients.view");
  const data = parseInput(searchSchema, input);
  const digits = onlyDigits(data.q);
  const textKey = searchKey(data.q);
  const filters = [eq(patients.organizationId, ctx.orgId)];
  if (data.status !== "all") filters.push(eq(patients.status, data.status));
  if (data.q) {
    const options = [ilike(patients.searchKey, `%${textKey.replace(/[%_\\]/g, "\\$&")}%`)];
    if (digits.length >= 4) {
      options.push(ilike(patients.phone, `%${digits}%`), ilike(patients.phoneAlt, `%${digits}%`));
      if (digits.length === 11 && can(ctx, "patients.view_documents")) options.push(eq(patients.cpf, digits));
      if (digits.length <= 6) options.push(eq(patients.code, Number(digits)));
    } else if (digits.length > 0 && digits === data.q) {
      options.push(eq(patients.code, Number(digits)));
    }
    filters.push(or(...options)!);
  }
  const where = and(...filters);
  const [total] = await ctx.db.select({ n: count() }).from(patients).where(where);
  const rows = await ctx.db
    .select()
    .from(patients)
    .where(where)
    .orderBy(asc(patients.searchKey))
    .limit(data.pageSize)
    .offset((data.page - 1) * data.pageSize);
  return { items: rows.map((r) => presentPatient(ctx, r)), total: total?.n ?? 0, page: data.page, pageSize: data.pageSize };
}

// ---------------------------------------------------------------------------
// Responsáveis
// ---------------------------------------------------------------------------

export async function listResponsibles(ctx: Ctx, patientId: string) {
  assertCan(ctx, "patients.view");
  await assertPatientInOrg(ctx, patientId);
  const rows = await ctx.db
    .select()
    .from(patientResponsibles)
    .where(and(eq(patientResponsibles.organizationId, ctx.orgId), eq(patientResponsibles.patientId, patientId)));
  const canDocs = can(ctx, "patients.view_documents");
  return rows.map((r) => ({ ...r, cpf: canDocs ? r.cpf : r.cpf ? maskCpf(r.cpf) : null }));
}

const responsibleSchema = z.object({
  id: zId.nullish(),
  patientId: zId,
  name: zRequiredText("Nome do responsável", 200),
  relationship: zOptionalText(80),
  cpf: zCpf,
  phone: zPhone,
  email: zEmail,
  isFinancialResponsible: z.boolean().default(false),
});

export async function saveResponsible(ctx: Ctx, input: z.input<typeof responsibleSchema>) {
  assertCan(ctx, "patients.edit");
  const data = parseInput(responsibleSchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  const values = {
    name: data.name,
    relationship: data.relationship,
    phone: data.phone,
    email: data.email,
    isFinancialResponsible: data.isFinancialResponsible,
    ...(can(ctx, "patients.view_documents") ? { cpf: data.cpf } : {}),
  };
  if (data.id) {
    const [row] = await ctx.db
      .update(patientResponsibles)
      .set(values)
      .where(and(eq(patientResponsibles.organizationId, ctx.orgId), eq(patientResponsibles.id, data.id), eq(patientResponsibles.patientId, data.patientId)))
      .returning({ id: patientResponsibles.id });
    if (!row) throw new NotFoundError("Responsável");
    return { id: row.id };
  }
  const [row] = await ctx.db
    .insert(patientResponsibles)
    .values({ organizationId: ctx.orgId, patientId: data.patientId, ...values })
    .returning({ id: patientResponsibles.id });
  await audit(ctx.db, ctx, { action: "responsible.create", entityType: "patient", entityId: data.patientId, summary: "Responsável adicionado" });
  return { id: row!.id };
}

export async function deleteResponsible(ctx: Ctx, patientId: string, id: string) {
  assertCan(ctx, "patients.edit");
  await ctx.db
    .delete(patientResponsibles)
    .where(and(eq(patientResponsibles.organizationId, ctx.orgId), eq(patientResponsibles.patientId, patientId), eq(patientResponsibles.id, id)));
}

// ---------------------------------------------------------------------------
// Alertas (administrativos e clínicos separados por permissão)
// ---------------------------------------------------------------------------

export async function listAlerts(ctx: Ctx, patientId: string, opts: { includeResolved?: boolean } = {}) {
  assertCan(ctx, "patients.view");
  const showClinical = can(ctx, "clinical.view");
  return ctx.db
    .select({
      alert: patientAlerts,
      authorName: users.name,
    })
    .from(patientAlerts)
    .leftJoin(users, eq(users.id, patientAlerts.createdBy))
    .where(
      and(
        eq(patientAlerts.organizationId, ctx.orgId),
        eq(patientAlerts.patientId, patientId),
        showClinical ? undefined : eq(patientAlerts.kind, "administrative"),
        opts.includeResolved ? undefined : isNull(patientAlerts.resolvedAt),
      ),
    )
    .orderBy(sql`case ${patientAlerts.priority} when 'high' then 0 when 'normal' then 1 else 2 end`, desc(patientAlerts.createdAt));
}

const alertSchema = z.object({
  patientId: zId,
  kind: z.enum(["administrative", "clinical"]),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  text: zRequiredText("Texto do alerta", 500),
});

export async function createAlert(ctx: Ctx, input: z.input<typeof alertSchema>) {
  const data = parseInput(alertSchema, input);
  assertCan(ctx, data.kind === "clinical" ? "clinical.edit" : "patients.edit");
  await assertPatientInOrg(ctx, data.patientId);
  const [row] = await ctx.db
    .insert(patientAlerts)
    .values({ organizationId: ctx.orgId, ...data, createdBy: ctx.userId })
    .returning({ id: patientAlerts.id });
  await audit(ctx.db, ctx, { action: "alert.create", entityType: "patient", entityId: data.patientId, summary: `Alerta ${data.kind === "clinical" ? "clínico" : "administrativo"} criado` });
  return { id: row!.id };
}

export async function resolveAlert(ctx: Ctx, alertId: string, note: string | null) {
  const [alert] = await ctx.db
    .select()
    .from(patientAlerts)
    .where(and(eq(patientAlerts.organizationId, ctx.orgId), eq(patientAlerts.id, alertId)));
  if (!alert) throw new NotFoundError("Alerta");
  assertCan(ctx, alert.kind === "clinical" ? "clinical.edit" : "patients.edit");
  await ctx.db
    .update(patientAlerts)
    .set({ resolvedAt: new Date(), resolvedBy: ctx.userId, resolutionNote: note?.trim() || null })
    .where(and(eq(patientAlerts.organizationId, ctx.orgId), eq(patientAlerts.id, alertId)));
  await audit(ctx.db, ctx, { action: "alert.resolve", entityType: "patient", entityId: alert.patientId, summary: "Alerta resolvido" });
}

// ---------------------------------------------------------------------------
// Pendências de agendamento (retornos/procedimentos aguardando data)
// ---------------------------------------------------------------------------

export async function listSchedulingTasks(ctx: Ctx, opts: { patientId?: string; status?: "open" | "all" } = {}) {
  assertCan(ctx, "schedule.view");
  return ctx.db
    .select({
      task: schedulingTasks,
      patientName: patients.fullName,
      responsibleName: users.name,
    })
    .from(schedulingTasks)
    .innerJoin(patients, and(eq(patients.id, schedulingTasks.patientId), eq(patients.organizationId, schedulingTasks.organizationId)))
    .leftJoin(users, eq(users.id, schedulingTasks.responsibleUserId))
    .where(
      and(
        eq(schedulingTasks.organizationId, ctx.orgId),
        opts.patientId ? eq(schedulingTasks.patientId, opts.patientId) : undefined,
        opts.status === "all" ? undefined : eq(schedulingTasks.status, "open"),
      ),
    )
    .orderBy(sql`${schedulingTasks.dueDate} asc nulls last`, asc(schedulingTasks.createdAt));
}

const taskSchema = z.object({
  patientId: zId,
  treatmentItemId: zId.nullish().transform((v) => v ?? null),
  reason: zRequiredText("Motivo", 300),
  dueDate: zCivilDate.nullish().transform((v) => v ?? null),
  responsibleUserId: zId.nullish().transform((v) => v ?? null),
});

export async function createSchedulingTask(ctx: Ctx, input: z.input<typeof taskSchema>) {
  assertCan(ctx, "schedule.edit");
  const data = parseInput(taskSchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  const [row] = await ctx.db
    .insert(schedulingTasks)
    .values({ organizationId: ctx.orgId, ...data, createdBy: ctx.userId })
    .returning({ id: schedulingTasks.id });
  return { id: row!.id };
}

export async function cancelSchedulingTask(ctx: Ctx, taskId: string) {
  assertCan(ctx, "schedule.edit");
  const [row] = await ctx.db
    .update(schedulingTasks)
    .set({ status: "cancelled", resolvedAt: new Date(), resolvedBy: ctx.userId })
    .where(and(eq(schedulingTasks.organizationId, ctx.orgId), eq(schedulingTasks.id, taskId), eq(schedulingTasks.status, "open")))
    .returning({ id: schedulingTasks.id });
  if (!row) throw new NotFoundError("Pendência");
}
