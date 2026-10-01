import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { BILLING_UNITS, LOCATION_KINDS, type BillingUnit, type LocationKind } from "@/domain/budget";
import { audit } from "../audit";
import { assertCan, can, type Ctx } from "../context";
import type { DbOrTx } from "../db/client";
import { priceTableItems, priceTables, procedures, specialties } from "../db/schema";
import { BusinessRuleError, ConflictError, isUniqueViolation, NotFoundError } from "../errors";
import { parseInput, zCents, zId, zOptionalText, zRequiredText } from "../validation";

// ---------------------------------------------------------------------------
// Especialidades
// ---------------------------------------------------------------------------

export async function listSpecialties(ctx: Ctx, opts: { includeInactive?: boolean } = {}) {
  return ctx.db
    .select()
    .from(specialties)
    .where(and(eq(specialties.organizationId, ctx.orgId), opts.includeInactive ? undefined : eq(specialties.active, true)))
    .orderBy(asc(specialties.sortOrder), asc(specialties.name));
}

const specialtySchema = z.object({ id: zId.nullish(), name: zRequiredText("Nome da especialidade", 120), active: z.boolean().default(true) });

export async function saveSpecialty(ctx: Ctx, input: z.input<typeof specialtySchema>) {
  assertCan(ctx, "catalog.manage");
  const data = parseInput(specialtySchema, input);
  try {
    if (data.id) {
      const [row] = await ctx.db
        .update(specialties)
        .set({ name: data.name, active: data.active })
        .where(and(eq(specialties.organizationId, ctx.orgId), eq(specialties.id, data.id)))
        .returning({ id: specialties.id });
      if (!row) throw new NotFoundError("Especialidade");
      await audit(ctx.db, ctx, { action: "specialty.update", entityType: "specialty", entityId: row.id, summary: `Especialidade atualizada: ${data.name}`, changes: { active: data.active } });
      return { id: row.id };
    }
    const [row] = await ctx.db
      .insert(specialties)
      .values({ organizationId: ctx.orgId, name: data.name, active: data.active, sortOrder: 100 })
      .returning({ id: specialties.id });
    await audit(ctx.db, ctx, { action: "specialty.create", entityType: "specialty", entityId: row!.id, summary: `Especialidade criada: ${data.name}` });
    return { id: row!.id };
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError("Já existe uma especialidade com este nome");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Procedimentos
// ---------------------------------------------------------------------------

export async function listProcedures(ctx: Ctx, opts: { specialtyId?: string; includeInactive?: boolean } = {}) {
  return ctx.db
    .select({
      procedure: procedures,
      specialtyName: specialties.name,
    })
    .from(procedures)
    .innerJoin(specialties, and(eq(specialties.id, procedures.specialtyId), eq(specialties.organizationId, procedures.organizationId)))
    .where(
      and(
        eq(procedures.organizationId, ctx.orgId),
        opts.specialtyId ? eq(procedures.specialtyId, opts.specialtyId) : undefined,
        opts.includeInactive ? undefined : eq(procedures.active, true),
      ),
    )
    .orderBy(asc(specialties.sortOrder), asc(specialties.name), asc(procedures.name));
}

export async function getProcedure(ctx: Ctx, id: string) {
  const [row] = await ctx.db
    .select({ procedure: procedures, specialtyName: specialties.name, specialtyActive: specialties.active })
    .from(procedures)
    .innerJoin(specialties, and(eq(specialties.id, procedures.specialtyId), eq(specialties.organizationId, procedures.organizationId)))
    .where(and(eq(procedures.organizationId, ctx.orgId), eq(procedures.id, id)));
  if (!row) throw new NotFoundError("Procedimento");
  return row;
}

const procedureSchema = z
  .object({
    id: zId.nullish(),
    specialtyId: zId,
    code: z
      .string()
      .trim()
      .min(1, { message: "Código é obrigatório" })
      .max(30)
      .regex(/^[\w.\-/]+$/, { message: "Use letras, números, ponto, hífen ou barra" }),
    name: zRequiredText("Nome do procedimento", 200),
    description: zOptionalText(2000),
    billingUnit: z.enum(BILLING_UNITS),
    allowedLocations: z.array(z.enum(LOCATION_KINDS)).min(1, { message: "Escolha ao menos uma localização permitida" }),
    suggestedMinutes: z.number().int().min(5).max(600).nullish(),
    active: z.boolean().default(true),
  })
  .superRefine((p, ctx) => {
    const need: Partial<Record<BillingUnit, LocationKind>> = { tooth: "teeth", arch: "arches", hemiarch: "hemiarches" };
    const required = need[p.billingUnit];
    if (required && !(p.allowedLocations.length === 1 && p.allowedLocations[0] === required)) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedLocations"],
        message: "Cobrança por região exige exatamente a localização correspondente (dente, arcada ou hemiarcada)",
      });
    }
  });

export async function saveProcedure(ctx: Ctx, input: z.input<typeof procedureSchema>) {
  assertCan(ctx, "catalog.manage");
  const data = parseInput(procedureSchema, input);
  const [spec] = await ctx.db
    .select({ id: specialties.id })
    .from(specialties)
    .where(and(eq(specialties.organizationId, ctx.orgId), eq(specialties.id, data.specialtyId)));
  if (!spec) throw new NotFoundError("Especialidade");
  const values = {
    specialtyId: data.specialtyId,
    code: data.code,
    name: data.name,
    description: data.description,
    billingUnit: data.billingUnit,
    allowedLocations: [...new Set(data.allowedLocations)],
    suggestedMinutes: data.suggestedMinutes ?? null,
    active: data.active,
    updatedAt: new Date(),
  };
  try {
    if (data.id) {
      const [row] = await ctx.db
        .update(procedures)
        .set(values)
        .where(and(eq(procedures.organizationId, ctx.orgId), eq(procedures.id, data.id)))
        .returning({ id: procedures.id });
      if (!row) throw new NotFoundError("Procedimento");
      await audit(ctx.db, ctx, { action: "procedure.update", entityType: "procedure", entityId: row.id, summary: `Procedimento atualizado: ${data.name}`, changes: { code: data.code, billingUnit: data.billingUnit, active: data.active } });
      return { id: row.id };
    }
    const [row] = await ctx.db.insert(procedures).values({ organizationId: ctx.orgId, ...values }).returning({ id: procedures.id });
    await audit(ctx.db, ctx, { action: "procedure.create", entityType: "procedure", entityId: row!.id, summary: `Procedimento criado: ${data.name}` });
    return { id: row!.id };
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError("Já existe um procedimento com este código");
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Tabelas de preço
// ---------------------------------------------------------------------------

export async function listPriceTables(ctx: Ctx, opts: { includeInactive?: boolean } = {}) {
  return ctx.db
    .select()
    .from(priceTables)
    .where(and(eq(priceTables.organizationId, ctx.orgId), opts.includeInactive ? undefined : eq(priceTables.active, true)))
    .orderBy(sql`${priceTables.isDefault} desc`, asc(priceTables.name));
}

const priceTableSchema = z.object({
  id: zId.nullish(),
  name: zRequiredText("Nome da tabela", 120),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export async function savePriceTable(ctx: Ctx, input: z.input<typeof priceTableSchema>) {
  assertCan(ctx, "catalog.manage");
  const data = parseInput(priceTableSchema, input);
  if (data.isDefault && !data.active) throw new BusinessRuleError("A tabela padrão precisa estar ativa");
  return ctx.db.transaction(async (tx) => {
    if (data.isDefault) {
      await tx.update(priceTables).set({ isDefault: false }).where(eq(priceTables.organizationId, ctx.orgId));
    }
    try {
      let id = data.id ?? null;
      if (id) {
        const [row] = await tx
          .update(priceTables)
          .set({ name: data.name, active: data.active, isDefault: data.isDefault })
          .where(and(eq(priceTables.organizationId, ctx.orgId), eq(priceTables.id, id)))
          .returning({ id: priceTables.id });
        if (!row) throw new NotFoundError("Tabela de preços");
      } else {
        const [row] = await tx
          .insert(priceTables)
          .values({ organizationId: ctx.orgId, name: data.name, active: data.active, isDefault: data.isDefault })
          .returning({ id: priceTables.id });
        id = row!.id;
      }
      const [defaults] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(priceTables)
        .where(and(eq(priceTables.organizationId, ctx.orgId), eq(priceTables.isDefault, true)));
      if ((defaults?.n ?? 0) === 0) throw new BusinessRuleError("Mantenha uma tabela padrão");
      await audit(tx, ctx, { action: "price_table.save", entityType: "price_table", entityId: id, summary: `Tabela de preços salva: ${data.name}` });
      return { id };
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictError("Já existe uma tabela com este nome");
      throw err;
    }
  });
}

/** Preços vigentes de uma tabela. Ausência de linha = preço não cadastrado. */
export async function listPrices(ctx: Ctx, priceTableId: string) {
  const [table] = await ctx.db
    .select({ id: priceTables.id })
    .from(priceTables)
    .where(and(eq(priceTables.organizationId, ctx.orgId), eq(priceTables.id, priceTableId)));
  if (!table) throw new NotFoundError("Tabela de preços");
  return ctx.db
    .select({ procedureId: priceTableItems.procedureId, priceCents: priceTableItems.priceCents, updatedAt: priceTableItems.updatedAt })
    .from(priceTableItems)
    .where(and(eq(priceTableItems.organizationId, ctx.orgId), eq(priceTableItems.priceTableId, priceTableId)));
}

export async function getReferencePrice(db: DbOrTx, orgId: string, priceTableId: string, procedureId: string): Promise<number | null> {
  const [row] = await db
    .select({ priceCents: priceTableItems.priceCents })
    .from(priceTableItems)
    .where(
      and(
        eq(priceTableItems.organizationId, orgId),
        eq(priceTableItems.priceTableId, priceTableId),
        eq(priceTableItems.procedureId, procedureId),
      ),
    );
  return row ? row.priceCents : null;
}

const setPriceSchema = z.object({
  priceTableId: zId,
  procedureId: zId,
  /** null remove o preço (volta a "não cadastrado"). */
  priceCents: zCents.nullable(),
});

/** Alterar a tabela nunca recalcula orçamentos já salvos (itens guardam cópia do preço). */
export async function setPrice(ctx: Ctx, input: z.input<typeof setPriceSchema>) {
  assertCan(ctx, "catalog.manage");
  const data = parseInput(setPriceSchema, input);
  const [table] = await ctx.db
    .select({ id: priceTables.id, name: priceTables.name })
    .from(priceTables)
    .where(and(eq(priceTables.organizationId, ctx.orgId), eq(priceTables.id, data.priceTableId)));
  if (!table) throw new NotFoundError("Tabela de preços");
  const proc = await getProcedure(ctx, data.procedureId);
  await ctx.db.transaction(async (tx) => {
    const before = await getReferencePrice(tx, ctx.orgId, data.priceTableId, data.procedureId);
    if (data.priceCents === null) {
      await tx
        .delete(priceTableItems)
        .where(
          and(
            eq(priceTableItems.organizationId, ctx.orgId),
            eq(priceTableItems.priceTableId, data.priceTableId),
            eq(priceTableItems.procedureId, data.procedureId),
          ),
        );
    } else {
      await tx
        .insert(priceTableItems)
        .values({
          organizationId: ctx.orgId,
          priceTableId: data.priceTableId,
          procedureId: data.procedureId,
          priceCents: data.priceCents,
          updatedBy: ctx.userId,
        })
        .onConflictDoUpdate({
          target: [priceTableItems.priceTableId, priceTableItems.procedureId],
          set: { priceCents: data.priceCents, updatedAt: new Date(), updatedBy: ctx.userId },
        });
    }
    await audit(tx, ctx, {
      action: "price.set",
      entityType: "price_table_item",
      entityId: `${data.priceTableId}:${data.procedureId}`,
      summary: `Preço de "${proc.procedure.name}" na tabela "${table.name}" alterado`,
      changes: { beforeCents: before, afterCents: data.priceCents },
    });
  });
}

/** Catálogo para o formulário do orçamento: especialidade → procedimentos → preço da tabela. */
export async function catalogForBudget(ctx: Ctx, priceTableId: string) {
  const [specs, procs, prices] = await Promise.all([
    listSpecialties(ctx),
    listProcedures(ctx),
    ctx.db
      .select({ procedureId: priceTableItems.procedureId, priceCents: priceTableItems.priceCents })
      .from(priceTableItems)
      .where(and(eq(priceTableItems.organizationId, ctx.orgId), eq(priceTableItems.priceTableId, priceTableId))),
  ]);
  const priceMap = new Map(prices.map((p) => [p.procedureId, p.priceCents]));
  const showPrices = can(ctx, "budgets.view");
  return {
    specialties: specs.map((s) => ({ id: s.id, name: s.name })),
    procedures: procs.map(({ procedure: p }) => ({
      id: p.id,
      specialtyId: p.specialtyId,
      code: p.code,
      name: p.name,
      billingUnit: p.billingUnit as BillingUnit,
      allowedLocations: p.allowedLocations as LocationKind[],
      suggestedMinutes: p.suggestedMinutes,
      referencePriceCents: showPrices ? (priceMap.get(p.id) ?? null) : null,
    })),
  };
}

export async function proceduresByIds(ctx: Ctx, ids: string[]) {
  if (ids.length === 0) return [];
  return ctx.db
    .select()
    .from(procedures)
    .where(and(eq(procedures.organizationId, ctx.orgId), inArray(procedures.id, ids)));
}
