import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  BudgetRuleError,
  expandItems,
  findDuplicates,
  isBudgetEditable,
  LOCATION_KINDS,
  locationLabel,
  locationSignature,
  statusAfterApproval,
  type ApprovalStatus,
  type BillingUnit,
  type BudgetStatus,
  type ItemLocation,
  type ItemScope,
  type LocationKind,
  type LocationSelection,
} from "@/domain/budget";
import { addDays, todayInTz } from "@/domain/dates";
import { formatBRL, sumCents, type DiscountInput } from "@/domain/money";
import { computeAgreementTotals, PAYMENT_METHODS, validatePlan, type PaymentPlan } from "@/domain/payment-plan";
import { searchKey } from "@/domain/text";
import { audit } from "../audit";
import { assertCan, can, type Ctx } from "../context";
import type { Tx } from "../db/client";
import {
  agreementItemAllocations,
  budgetApprovals,
  budgetItemLocations,
  budgetItems,
  budgetRevisions,
  budgets,
  organizationSettings,
  patientCredits,
  patients,
  paymentAgreements,
  priceTables,
  procedures,
  professionals,
  receivableAdjustments,
  receivables,
  specialties,
  treatmentItems,
  treatments,
  users,
} from "../db/schema";
import { q } from "../db/sql";
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { nextCounter, withIdempotency } from "../idempotency";
import { parseInput, zCents, zCivilDate, zId, zOptionalText } from "../validation";
import { getReferencePrice } from "./catalog";
import { assertPatientInOrg } from "./patients";
import { systemCategoryId } from "./organizations";

// ---------------------------------------------------------------------------
// Criação e leitura
// ---------------------------------------------------------------------------

const createSchema = z.object({
  patientId: zId,
  professionalId: zId.nullish().transform((v) => v ?? null),
  priceTableId: zId.nullish().transform((v) => v ?? null),
  budgetDate: zCivilDate.nullish(),
  origin: zOptionalText(120),
  notes: zOptionalText(4000),
});

export async function createBudget(ctx: Ctx, input: z.input<typeof createSchema>): Promise<{ id: string; number: number }> {
  assertCan(ctx, "budgets.edit");
  const data = parseInput(createSchema, input);
  await assertPatientInOrg(ctx, data.patientId);
  if (data.professionalId) {
    const [p] = await ctx.db
      .select({ id: professionals.id })
      .from(professionals)
      .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, data.professionalId)));
    if (!p) throw new NotFoundError("Profissional");
  }
  const [table] = await ctx.db
    .select({ id: priceTables.id })
    .from(priceTables)
    .where(
      and(
        eq(priceTables.organizationId, ctx.orgId),
        eq(priceTables.active, true),
        data.priceTableId ? eq(priceTables.id, data.priceTableId) : eq(priceTables.isDefault, true),
      ),
    );
  if (!table) throw new NotFoundError("Tabela de preços");
  const [settings] = await ctx.db
    .select({ validity: organizationSettings.budgetValidityDays })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, ctx.orgId));
  const budgetDate = data.budgetDate ?? todayInTz(ctx.timezone);
  return ctx.db.transaction(async (tx) => {
    const number = await nextCounter(tx, ctx.orgId, "budget");
    const [budget] = await tx
      .insert(budgets)
      .values({
        organizationId: ctx.orgId,
        number,
        patientId: data.patientId,
        professionalId: data.professionalId,
        priceTableId: table.id,
        budgetDate,
        validUntil: addDays(budgetDate, settings?.validity ?? 30),
        origin: data.origin,
        notes: data.notes,
        createdBy: ctx.userId,
      })
      .returning({ id: budgets.id });
    const [rev] = await tx
      .insert(budgetRevisions)
      .values({ organizationId: ctx.orgId, budgetId: budget!.id, number: 1, createdBy: ctx.userId })
      .returning({ id: budgetRevisions.id });
    await tx.update(budgets).set({ currentRevisionId: rev!.id }).where(eq(budgets.id, budget!.id));
    await audit(tx, ctx, { action: "budget.create", entityType: "budget", entityId: budget!.id, summary: `Orçamento nº ${number} criado` });
    return { id: budget!.id, number };
  });
}

async function loadBudgetRow(ctx: Pick<Ctx, "db" | "orgId">, budgetId: string, tx?: Tx, lock = false) {
  const db = tx ?? ctx.db;
  const q = db
    .select()
    .from(budgets)
    .where(and(eq(budgets.organizationId, ctx.orgId), eq(budgets.id, budgetId)));
  const [row] = lock ? await q.for("update") : await q;
  if (!row) throw new NotFoundError("Orçamento");
  return row;
}

async function loadRevision(tx: Tx | Ctx["db"], orgId: string, revisionId: string) {
  const [rev] = await tx
    .select()
    .from(budgetRevisions)
    .where(and(eq(budgetRevisions.organizationId, orgId), eq(budgetRevisions.id, revisionId)));
  if (!rev) throw new NotFoundError("Revisão do orçamento");
  return rev;
}

export interface BudgetItemView {
  id: string;
  lineageId: string;
  procedureId: string;
  specialtyId: string;
  procedureCode: string;
  procedureName: string;
  specialtyName: string;
  billingUnit: BillingUnit;
  locationScope: ItemScope;
  locationLabel: string;
  locations: ItemLocation[];
  quantity: number;
  referencePriceCents: number | null;
  unitPriceCents: number;
  subtotalCents: number;
  approvalStatus: ApprovalStatus;
  duplicateJustification: string | null;
  notes: string | null;
  sortOrder: number;
}

async function loadItems(db: Tx | Ctx["db"], orgId: string, revisionId: string): Promise<BudgetItemView[]> {
  const items = await db
    .select()
    .from(budgetItems)
    .where(and(eq(budgetItems.organizationId, orgId), eq(budgetItems.revisionId, revisionId)))
    .orderBy(asc(budgetItems.sortOrder), asc(budgetItems.createdAt));
  if (items.length === 0) return [];
  const locs = await db
    .select()
    .from(budgetItemLocations)
    .where(
      and(
        eq(budgetItemLocations.organizationId, orgId),
        inArray(
          budgetItemLocations.itemId,
          items.map((i) => i.id),
        ),
      ),
    );
  return items.map((i) => ({
    id: i.id,
    lineageId: i.lineageId,
    procedureId: i.procedureId,
    specialtyId: i.specialtyId,
    procedureCode: i.procedureCode,
    procedureName: i.procedureName,
    specialtyName: i.specialtyName,
    billingUnit: i.billingUnit as BillingUnit,
    locationScope: i.locationScope as ItemScope,
    locationLabel: i.locationLabel,
    locations: locs
      .filter((l) => l.itemId === i.id)
      .map((l): ItemLocation =>
        l.kind === "tooth"
          ? { kind: "tooth", tooth: l.tooth! }
          : l.kind === "arch"
            ? { kind: "arch", arch: l.arch as "upper" | "lower" }
            : { kind: "hemiarch", hemiarch: l.hemiarch as 1 | 2 | 3 | 4 },
      ),
    quantity: i.quantity,
    referencePriceCents: i.referencePriceCents,
    unitPriceCents: i.unitPriceCents,
    subtotalCents: i.subtotalCents,
    approvalStatus: i.approvalStatus as ApprovalStatus,
    duplicateJustification: i.duplicateJustification,
    notes: i.notes,
    sortOrder: i.sortOrder,
  }));
}

export async function getBudget(ctx: Ctx, budgetId: string) {
  assertCan(ctx, "budgets.view");
  const budget = await loadBudgetRow(ctx, budgetId);
  const [patient] = await ctx.db
    .select({ id: patients.id, fullName: patients.fullName, code: patients.code, phone: patients.phone, birthDate: patients.birthDate })
    .from(patients)
    .where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, budget.patientId)));
  const revisions = await ctx.db
    .select({ revision: budgetRevisions, authorName: users.name })
    .from(budgetRevisions)
    .leftJoin(users, eq(users.id, budgetRevisions.createdBy))
    .where(and(eq(budgetRevisions.organizationId, ctx.orgId), eq(budgetRevisions.budgetId, budgetId)))
    .orderBy(asc(budgetRevisions.number));
  const current = revisions.find((r) => r.revision.id === budget.currentRevisionId)?.revision ?? null;
  const items = current ? await loadItems(ctx.db, ctx.orgId, current.id) : [];
  const [table] = await ctx.db
    .select({ id: priceTables.id, name: priceTables.name })
    .from(priceTables)
    .where(and(eq(priceTables.organizationId, ctx.orgId), eq(priceTables.id, budget.priceTableId)));
  const [prof] = budget.professionalId
    ? await ctx.db
        .select({ id: professionals.id, name: professionals.name })
        .from(professionals)
        .where(and(eq(professionals.organizationId, ctx.orgId), eq(professionals.id, budget.professionalId)))
    : [];
  const agreements = await ctx.db
    .select()
    .from(paymentAgreements)
    .where(and(eq(paymentAgreements.organizationId, ctx.orgId), eq(paymentAgreements.budgetId, budgetId)))
    .orderBy(desc(paymentAgreements.createdAt));
  const activeAgreement = agreements.find((a) => a.status === "active") ?? null;
  const showFinance = can(ctx, "finance.view") || can(ctx, "budgets.approve");
  const titles =
    activeAgreement && showFinance
      ? await ctx.db
          .select()
          .from(receivables)
          .where(and(eq(receivables.organizationId, ctx.orgId), eq(receivables.budgetId, budgetId)))
          .orderBy(asc(receivables.dueDate), asc(receivables.installmentNumber))
      : [];
  const credits = showFinance
    ? await ctx.db
        .select()
        .from(patientCredits)
        .where(and(eq(patientCredits.organizationId, ctx.orgId), inArray(patientCredits.agreementId, agreements.map((a) => a.id).concat(["00000000-0000-0000-0000-000000000000"]))))
    : [];
  const editable = current?.status === "open" && (isBudgetEditable(budget.status as BudgetStatus) || current.number > 1);
  return {
    budget: { ...budget, status: budget.status as BudgetStatus },
    patient: patient!,
    priceTable: table ?? null,
    professional: prof ?? null,
    revisions: revisions.map((r) => ({ ...r.revision, authorName: r.authorName })),
    currentRevision: current,
    items,
    subtotalCents: sumCents(items.map((i) => i.subtotalCents)),
    editable,
    revisionInProgress: Boolean(current && current.status === "open" && current.number > 1),
    // Sem permissão financeira, apenas a existência do acordo é informada.
    activeAgreement: showFinance
      ? activeAgreement
      : activeAgreement
        ? { id: activeAgreement.id, status: activeAgreement.status, hidden: true as const }
        : null,
    agreements: showFinance ? agreements : [],
    receivables: titles.map((r) => ({
      ...r,
      balanceCents: r.originalCents + r.adjustmentCents - r.paidPrincipalCents - r.discountGrantedCents,
    })),
    credits,
    showFinance,
  };
}

export type BudgetDetail = Awaited<ReturnType<typeof getBudget>>;

const listSchema = z.object({
  q: z.string().trim().max(120).default(""),
  status: z.enum(["all", "draft", "negotiating", "partially_approved", "approved", "rejected", "cancelled"]).default("all"),
  patientId: zId.nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

export async function listBudgets(ctx: Ctx, input: z.input<typeof listSchema>) {
  assertCan(ctx, "budgets.view");
  const data = parseInput(listSchema, input);
  const subtotal = sql<number>`coalesce((select sum(${q(budgetItems.subtotalCents)}) from ${budgetItems} where ${q(budgetItems.revisionId)} = ${q(budgets.currentRevisionId)} and ${q(budgetItems.approvalStatus)} <> 'rejected'), 0)::bigint`;
  const filters = [eq(budgets.organizationId, ctx.orgId)];
  if (data.status !== "all") filters.push(eq(budgets.status, data.status));
  if (data.patientId) filters.push(eq(budgets.patientId, data.patientId));
  if (data.q) {
    const num = Number(data.q.replace(/\D/g, ""));
    const opts = [ilike(patients.searchKey, `%${searchKey(data.q).replace(/[%_\\]/g, "\\$&")}%`)];
    if (Number.isInteger(num) && num > 0) opts.push(eq(budgets.number, num));
    filters.push(or(...opts)!);
  }
  const where = and(...filters);
  const [total] = await ctx.db
    .select({ n: count() })
    .from(budgets)
    .innerJoin(patients, and(eq(patients.id, budgets.patientId), eq(patients.organizationId, budgets.organizationId)))
    .where(where);
  const rows = await ctx.db
    .select({
      id: budgets.id,
      number: budgets.number,
      status: budgets.status,
      budgetDate: budgets.budgetDate,
      patientId: patients.id,
      patientName: patients.fullName,
      professionalName: professionals.name,
      subtotalCents: subtotal,
      agreedTotalCents: sql<number | null>`(select ${q(paymentAgreements.totalCents)} from ${paymentAgreements} where ${q(paymentAgreements.budgetId)} = ${q(budgets.id)} and ${q(paymentAgreements.status)} = 'active' limit 1)`,
      revisionOpen: sql<boolean>`exists(select 1 from ${budgetRevisions} where ${q(budgetRevisions.budgetId)} = ${q(budgets.id)} and ${q(budgetRevisions.status)} = 'open' and ${q(budgetRevisions.number)} > 1)`,
    })
    .from(budgets)
    .innerJoin(patients, and(eq(patients.id, budgets.patientId), eq(patients.organizationId, budgets.organizationId)))
    .leftJoin(professionals, and(eq(professionals.id, budgets.professionalId), eq(professionals.organizationId, budgets.organizationId)))
    .where(where)
    .orderBy(desc(budgets.number))
    .limit(data.pageSize)
    .offset((data.page - 1) * data.pageSize);
  return {
    items: rows.map((r) => ({
      ...r,
      status: r.status as BudgetStatus,
      subtotalCents: Number(r.subtotalCents),
      agreedTotalCents: r.agreedTotalCents === null ? null : Number(r.agreedTotalCents),
    })),
    total: total?.n ?? 0,
    page: data.page,
    pageSize: data.pageSize,
  };
}

// ---------------------------------------------------------------------------
// Itens
// ---------------------------------------------------------------------------

/** Garante revisão aberta (rascunho/negociação ou revisão em andamento). */
async function openRevisionFor(tx: Tx, ctx: Ctx, budgetId: string) {
  const budget = await loadBudgetRow(ctx, budgetId, tx, true);
  if (!budget.currentRevisionId) throw new BusinessRuleError("Orçamento sem revisão ativa");
  const rev = await loadRevision(tx, ctx.orgId, budget.currentRevisionId);
  if (rev.status !== "open") {
    throw new BusinessRuleError("Orçamento aprovado: inicie uma revisão para alterar itens ou valores");
  }
  if (rev.number === 1 && !isBudgetEditable(budget.status as BudgetStatus)) {
    throw new BusinessRuleError("Orçamento recusado ou cancelado não pode ser alterado. Reabra a negociação.");
  }
  return { budget, rev };
}

async function touchBudget(tx: Tx, ctx: Ctx, budgetId: string, status?: BudgetStatus) {
  await tx
    .update(budgets)
    .set({ version: sql`${budgets.version} + 1`, updatedAt: new Date(), ...(status ? { status } : {}) })
    .where(and(eq(budgets.organizationId, ctx.orgId), eq(budgets.id, budgetId)));
}

const selectionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("teeth"), teeth: z.array(z.number().int()).min(1, { message: "Selecione ao menos um dente" }).max(52) }),
  z.object({ kind: z.literal("arches"), arches: z.array(z.enum(["upper", "lower"])).min(1, { message: "Selecione a arcada" }).max(2) }),
  z.object({
    kind: z.literal("hemiarches"),
    hemiarches: z
      .array(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]))
      .min(1, { message: "Selecione a hemiarcada" })
      .max(4),
  }),
]);

const addItemsSchema = z.object({
  budgetId: zId,
  procedureId: zId,
  selection: selectionSchema,
  quantity: z.number().int().min(1).max(999).default(1),
  /** Se omitido, usa o preço vigente da tabela do orçamento. */
  unitPriceCents: zCents.nullish(),
  duplicateJustification: zOptionalText(500),
  notes: zOptionalText(1000),
});

export class DuplicateItemError extends ConflictError {
  readonly duplicates: string[];
  constructor(duplicates: string[]) {
    super("Este procedimento já está no orçamento para a mesma localização. Informe uma justificativa para incluir novamente.");
    this.duplicates = duplicates;
  }
}

export async function addItems(ctx: Ctx, input: z.input<typeof addItemsSchema>): Promise<{ itemIds: string[]; totalCents: number }> {
  assertCan(ctx, "budgets.edit");
  const data = parseInput(addItemsSchema, input);
  return ctx.db.transaction(async (tx) => {
    const { budget, rev } = await openRevisionFor(tx, ctx, data.budgetId);
    const [proc] = await tx
      .select({ procedure: procedures, specialtyName: specialties.name, specialtyActive: specialties.active })
      .from(procedures)
      .innerJoin(specialties, and(eq(specialties.id, procedures.specialtyId), eq(specialties.organizationId, procedures.organizationId)))
      .where(and(eq(procedures.organizationId, ctx.orgId), eq(procedures.id, data.procedureId)));
    if (!proc) throw new NotFoundError("Procedimento");
    if (!proc.procedure.active || !proc.specialtyActive) throw new BusinessRuleError("Procedimento ou especialidade inativa");
    const reference = await getReferencePrice(tx, ctx.orgId, budget.priceTableId, proc.procedure.id);
    const unitPrice = data.unitPriceCents ?? reference;
    if (unitPrice === null || unitPrice === undefined) {
      throw new ValidationError("Procedimento sem preço cadastrado nesta tabela. Informe o valor do item.", {
        unitPriceCents: "Informe o valor",
      });
    }
    let drafts;
    try {
      drafts = expandItems({
        billingUnit: proc.procedure.billingUnit as BillingUnit,
        allowedLocations: proc.procedure.allowedLocations as LocationKind[],
        selection: data.selection as LocationSelection,
        quantity: data.quantity,
        unitPriceCents: unitPrice,
      });
    } catch (err) {
      if (err instanceof BudgetRuleError) throw new ValidationError(err.message);
      throw err;
    }
    const existing = await tx
      .select({ procedureId: budgetItems.procedureId, signature: budgetItems.locationSignature, approvalStatus: budgetItems.approvalStatus })
      .from(budgetItems)
      .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.revisionId, rev.id)));
    const dups = findDuplicates(
      proc.procedure.id,
      drafts,
      existing.map((e) => ({ ...e, approvalStatus: e.approvalStatus as ApprovalStatus })),
    );
    if (dups.length > 0 && !data.duplicateJustification) throw new DuplicateItemError(dups);
    const [maxSort] = await tx
      .select({ m: sql<number>`coalesce(max(${budgetItems.sortOrder}), 0)::int` })
      .from(budgetItems)
      .where(eq(budgetItems.revisionId, rev.id));
    let sort = maxSort?.m ?? 0;
    const ids: string[] = [];
    for (const d of drafts) {
      const sig = locationSignature(d.scope, d.locations);
      const [item] = await tx
        .insert(budgetItems)
        .values({
          organizationId: ctx.orgId,
          budgetId: budget.id,
          revisionId: rev.id,
          procedureId: proc.procedure.id,
          specialtyId: proc.procedure.specialtyId,
          procedureCode: proc.procedure.code,
          procedureName: proc.procedure.name,
          specialtyName: proc.specialtyName,
          billingUnit: proc.procedure.billingUnit,
          locationScope: d.scope,
          locationLabel: locationLabel(d.scope, d.locations),
          locationSignature: sig,
          quantity: d.quantity,
          referencePriceCents: reference,
          unitPriceCents: d.unitPriceCents,
          subtotalCents: d.subtotalCents,
          duplicateJustification: dups.includes(sig) ? data.duplicateJustification : null,
          notes: data.notes,
          sortOrder: ++sort,
          createdBy: ctx.userId,
        })
        .returning({ id: budgetItems.id });
      if (d.locations.length > 0) {
        await tx.insert(budgetItemLocations).values(
          d.locations.map((l) => ({
            organizationId: ctx.orgId,
            itemId: item!.id,
            kind: l.kind,
            tooth: l.kind === "tooth" ? l.tooth : null,
            arch: l.kind === "arch" ? l.arch : null,
            hemiarch: l.kind === "hemiarch" ? l.hemiarch : null,
          })),
        );
      }
      ids.push(item!.id);
    }
    await touchBudget(tx, ctx, budget.id);
    await audit(tx, ctx, {
      action: "budget.items_add",
      entityType: "budget",
      entityId: budget.id,
      summary: `${drafts.length} item(ns) de "${proc.procedure.name}" incluído(s)`,
      changes: {
        unitPriceCents: unitPrice,
        referencePriceCents: reference,
        priceEdited: reference !== unitPrice,
        duplicateJustified: dups.length > 0,
      },
    });
    return { itemIds: ids, totalCents: sumCents(drafts.map((d) => d.subtotalCents)) };
  });
}

const updateItemSchema = z.object({
  itemId: zId,
  unitPriceCents: zCents,
  quantity: z.number().int().min(1).max(999).nullish(),
  notes: zOptionalText(1000),
});

/** O preço do item é editável e não altera a tabela de referência. */
export async function updateItem(ctx: Ctx, input: z.input<typeof updateItemSchema>) {
  assertCan(ctx, "budgets.edit");
  const data = parseInput(updateItemSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(budgetItems)
      .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.id, data.itemId)));
    if (!item) throw new NotFoundError("Item do orçamento");
    const { rev } = await openRevisionFor(tx, ctx, item.budgetId);
    if (item.revisionId !== rev.id) throw new BusinessRuleError("Item pertence a uma versão anterior do orçamento");
    const unit = item.billingUnit as BillingUnit;
    const quantity = unit === "session" || unit === "global" ? (data.quantity ?? item.quantity) : 1;
    await tx
      .update(budgetItems)
      .set({
        unitPriceCents: data.unitPriceCents,
        quantity,
        subtotalCents: data.unitPriceCents * quantity,
        notes: data.notes,
        updatedAt: new Date(),
      })
      .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.id, item.id)));
    await touchBudget(tx, ctx, item.budgetId);
    await audit(tx, ctx, {
      action: "budget.item_update",
      entityType: "budget",
      entityId: item.budgetId,
      summary: `Valor do item "${item.procedureName}" (${item.locationLabel}) alterado`,
      changes: { beforeUnitCents: item.unitPriceCents, afterUnitCents: data.unitPriceCents, beforeQty: item.quantity, afterQty: quantity },
    });
  });
}

export async function removeItem(ctx: Ctx, itemId: string) {
  assertCan(ctx, "budgets.edit");
  return ctx.db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(budgetItems)
      .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.id, itemId)));
    if (!item) throw new NotFoundError("Item do orçamento");
    const { rev } = await openRevisionFor(tx, ctx, item.budgetId);
    if (item.revisionId !== rev.id) throw new BusinessRuleError("Item pertence a uma versão anterior do orçamento");
    await tx.delete(budgetItems).where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.id, item.id)));
    await touchBudget(tx, ctx, item.budgetId);
    await audit(tx, ctx, {
      action: "budget.item_remove",
      entityType: "budget",
      entityId: item.budgetId,
      summary: `Item "${item.procedureName}" (${item.locationLabel}) removido`,
      changes: { subtotalCents: item.subtotalCents },
    });
  });
}

// ---------------------------------------------------------------------------
// Negociação (simulação) e mudanças de situação
// ---------------------------------------------------------------------------

const discountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("amount"), cents: zCents }),
  z.object({ type: z.literal("percent"), basisPoints: z.number().int().min(0).max(10000) }),
]);

const planLineSchema = z.object({
  amountCents: zCents,
  dueDate: zCivilDate,
  method: z.enum(PAYMENT_METHODS),
  methodNote: zOptionalText(120),
});

const planSchema = z.object({
  downPayment: planLineSchema.nullable(),
  installments: z.array(planLineSchema).max(120),
});

const negotiationSchema = z.object({
  budgetId: zId,
  approvedItemIds: z.array(zId),
  discount: discountSchema,
  plan: planSchema,
  notes: zOptionalText(2000),
});

/** Salva a simulação na revisão. Não cria dívida nem receita. */
export async function saveNegotiation(ctx: Ctx, input: z.input<typeof negotiationSchema>) {
  assertCan(ctx, "budgets.edit");
  const data = parseInput(negotiationSchema, input);
  return ctx.db.transaction(async (tx) => {
    const { budget, rev } = await openRevisionFor(tx, ctx, data.budgetId);
    await tx
      .update(budgetRevisions)
      .set({ negotiation: { ...data, savedAt: new Date().toISOString() } })
      .where(and(eq(budgetRevisions.organizationId, ctx.orgId), eq(budgetRevisions.id, rev.id)));
    const status = budget.status === "draft" ? "negotiating" : undefined;
    await touchBudget(tx, ctx, budget.id, status);
    await audit(tx, ctx, { action: "budget.negotiation", entityType: "budget", entityId: budget.id, summary: "Simulação de negociação salva" });
  });
}

const statusChangeSchema = z.object({
  budgetId: zId,
  status: z.enum(["negotiating", "rejected", "cancelled"]),
  reason: zOptionalText(500),
});

export async function changeBudgetStatus(ctx: Ctx, input: z.input<typeof statusChangeSchema>) {
  assertCan(ctx, "budgets.edit");
  const data = parseInput(statusChangeSchema, input);
  return ctx.db.transaction(async (tx) => {
    const budget = await loadBudgetRow(ctx, data.budgetId, tx, true);
    const current = budget.status as BudgetStatus;
    const hasAgreement = await tx
      .select({ id: paymentAgreements.id })
      .from(paymentAgreements)
      .where(and(eq(paymentAgreements.organizationId, ctx.orgId), eq(paymentAgreements.budgetId, budget.id)));
    if (hasAgreement.length > 0) {
      throw new BusinessRuleError("Orçamento com acordo aprovado: use uma revisão para alterar valores ou itens");
    }
    const allowed: Record<string, BudgetStatus[]> = {
      negotiating: ["draft", "rejected", "cancelled"],
      rejected: ["draft", "negotiating"],
      cancelled: ["draft", "negotiating", "rejected"],
    };
    if (!allowed[data.status]!.includes(current)) throw new BusinessRuleError("Mudança de situação não permitida");
    if ((data.status === "rejected" || data.status === "cancelled") && !data.reason) {
      throw new ValidationError("Informe o motivo", { reason: "Informe o motivo" });
    }
    if (data.status === "rejected") {
      await tx
        .update(budgetItems)
        .set({ approvalStatus: "rejected" })
        .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.revisionId, budget.currentRevisionId!)));
    } else if (data.status === "negotiating" && current === "rejected") {
      await tx
        .update(budgetItems)
        .set({ approvalStatus: "pending" })
        .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.revisionId, budget.currentRevisionId!)));
    }
    await touchBudget(tx, ctx, budget.id, data.status);
    await audit(tx, ctx, {
      action: "budget.status",
      entityType: "budget",
      entityId: budget.id,
      summary: `Orçamento nº ${budget.number}: ${current} → ${data.status}${data.reason ? ` (${data.reason})` : ""}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Aprovação (integral/parcial) e revisões
// ---------------------------------------------------------------------------

const approveSchema = z.object({
  budgetId: zId,
  expectedVersion: z.number().int(),
  idempotencyKey: z.string().min(8).max(100),
  approvedItemIds: z.array(zId).min(1, { message: "Selecione ao menos um item aprovado" }),
  discount: discountSchema,
  /** Primeira aprovação: plano do total. Revisão: plano apenas da diferença a maior. */
  plan: planSchema,
  notes: zOptionalText(2000),
});

export interface ApprovalResult {
  agreementId: string;
  totalCents: number;
  receivableIds: string[];
  treatmentItemIds: string[];
  adjustmentCents: number;
  creditCents: number;
}

export async function approveBudget(ctx: Ctx, input: z.input<typeof approveSchema>): Promise<ApprovalResult & { replayed: boolean }> {
  assertCan(ctx, "budgets.approve");
  const data = parseInput(approveSchema, input);
  return ctx.db.transaction(async (tx) => {
    const { result, replayed } = await withIdempotency(tx, ctx.orgId, "budget.approve", `${data.budgetId}:${data.idempotencyKey}`, async () => {
      const budget = await loadBudgetRow(ctx, data.budgetId, tx, true);
      if (budget.version !== data.expectedVersion) {
        throw new ConflictError("O orçamento foi alterado desde que você abriu esta tela. Revise os valores antes de aprovar.");
      }
      if (!budget.currentRevisionId) throw new BusinessRuleError("Orçamento sem revisão");
      const rev = await loadRevision(tx, ctx.orgId, budget.currentRevisionId);
      if (rev.status !== "open") throw new BusinessRuleError("Esta versão do orçamento já foi aprovada");
      if (rev.number === 1 && !isBudgetEditable(budget.status as BudgetStatus)) {
        throw new BusinessRuleError("Reabra a negociação antes de aprovar");
      }
      const items = await loadItems(tx, ctx.orgId, rev.id);
      const approvedSet = new Set(data.approvedItemIds);
      if ([...approvedSet].some((id) => !items.some((i) => i.id === id))) throw new ValidationError("Item aprovado não pertence a esta versão");
      const approved = items.filter((i) => approvedSet.has(i.id));
      const totals = computeAgreementTotals(
        approved.map((i) => i.subtotalCents),
        data.discount as DiscountInput,
      );

      // Acordo anterior (quando é revisão de um orçamento já aprovado).
      const [previous] = await tx
        .select()
        .from(paymentAgreements)
        .where(and(eq(paymentAgreements.organizationId, ctx.orgId), eq(paymentAgreements.budgetId, budget.id), eq(paymentAgreements.status, "active")))
        .for("update");
      const delta = previous ? totals.totalCents - previous.totalCents : totals.totalCents;
      const planTarget = Math.max(delta, 0);
      const plan = data.plan as PaymentPlan;
      const planErrors = validatePlan(plan, planTarget);
      if (planErrors.length > 0) throw new ValidationError(planErrors[0]!, { plan: planErrors.join("; ") });

      // 1. Situação dos itens, revisão e orçamento
      for (const item of items) {
        await tx
          .update(budgetItems)
          .set({ approvalStatus: approvedSet.has(item.id) ? "approved" : "rejected" })
          .where(and(eq(budgetItems.organizationId, ctx.orgId), eq(budgetItems.id, item.id)));
      }
      await tx
        .update(budgetRevisions)
        .set({ status: "approved", approvedAt: new Date(), approvedBy: ctx.userId })
        .where(eq(budgetRevisions.id, rev.id));
      if (rev.previousRevisionId) {
        await tx.update(budgetRevisions).set({ status: "superseded" }).where(eq(budgetRevisions.id, rev.previousRevisionId));
      }
      const newStatus = statusAfterApproval(approved.length, items.length);
      await touchBudget(tx, ctx, budget.id, newStatus);
      await tx.insert(budgetApprovals).values({
        organizationId: ctx.orgId,
        budgetId: budget.id,
        revisionId: rev.id,
        approvedBy: ctx.userId,
        approvedItemCount: approved.length,
        rejectedItemCount: items.length - approved.length,
        totalCents: totals.totalCents,
        notes: data.notes,
      });

      // 2. Acordo de pagamento e rateio do desconto por item
      if (previous) {
        await tx.update(paymentAgreements).set({ status: "superseded" }).where(eq(paymentAgreements.id, previous.id));
      }
      const discount = data.discount as DiscountInput;
      const [agreement] = await tx
        .insert(paymentAgreements)
        .values({
          organizationId: ctx.orgId,
          budgetId: budget.id,
          revisionId: rev.id,
          patientId: budget.patientId,
          subtotalCents: totals.subtotalCents,
          discountType: discount.type,
          discountValue: discount.type === "amount" ? discount.cents : discount.type === "percent" ? discount.basisPoints : 0,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          downPaymentCents: plan.downPayment?.amountCents ?? 0,
          installmentsCount: plan.installments.length,
          previousAgreementId: previous?.id ?? null,
          adjustmentCents: previous ? delta : 0,
          notes: data.notes,
          createdBy: ctx.userId,
        })
        .returning({ id: paymentAgreements.id });
      const agreementId = agreement!.id;
      if (approved.length > 0) {
        await tx.insert(agreementItemAllocations).values(
          approved.map((item, i) => ({
            organizationId: ctx.orgId,
            agreementId,
            budgetItemId: item.id,
            grossCents: item.subtotalCents,
            discountCents: totals.itemDiscounts[i]!,
            netCents: item.subtotalCents - totals.itemDiscounts[i]!,
          })),
        );
      }

      // 3. Títulos a receber (criados uma única vez por versão/acordo)
      const categoryId = await systemCategoryId(tx, ctx.orgId, "treatment_revenue");
      const today = todayInTz(ctx.timezone);
      const receivableIds: string[] = [];
      const lines = [
        ...(plan.downPayment ? [{ kind: "down_payment" as const, n: null as number | null, line: plan.downPayment }] : []),
        ...plan.installments.map((line, i) => ({ kind: "installment" as const, n: i + 1, line })),
      ];
      for (const { kind, n, line } of lines) {
        const label =
          kind === "down_payment"
            ? "Entrada"
            : `Parcela ${n}/${plan.installments.length}`;
        const [r] = await tx
          .insert(receivables)
          .values({
            organizationId: ctx.orgId,
            patientId: budget.patientId,
            agreementId,
            budgetId: budget.id,
            kind: previous ? "adjustment" : kind,
            installmentNumber: n,
            description: `Orçamento nº ${budget.number}${previous ? ` (revisão ${rev.number})` : ""} — ${label}`,
            categoryId,
            competenceDate: today,
            dueDate: line.dueDate,
            originalCents: line.amountCents,
            expectedMethod: line.method,
            methodNote: line.methodNote ?? null,
            createdBy: ctx.userId,
          })
          .returning({ id: receivables.id });
        receivableIds.push(r!.id);
      }

      // 4. Revisão para menor: reduz saldo aberto; excedente pago vira crédito pendente de decisão.
      let creditCents = 0;
      if (previous && delta < 0) {
        let toReduce = -delta;
        const open = await tx
          .select()
          .from(receivables)
          .where(
            and(
              eq(receivables.organizationId, ctx.orgId),
              eq(receivables.budgetId, budget.id),
              inArray(receivables.status, ["open", "partial"]),
            ),
          )
          .orderBy(desc(receivables.dueDate), desc(receivables.installmentNumber))
          .for("update");
        for (const r of open) {
          if (toReduce === 0) break;
          const balance = r.originalCents + r.adjustmentCents - r.paidPrincipalCents - r.discountGrantedCents;
          const cut = Math.min(balance, toReduce);
          if (cut <= 0) continue;
          await tx.insert(receivableAdjustments).values({
            organizationId: ctx.orgId,
            receivableId: r.id,
            amountCents: -cut,
            reason: `Revisão ${rev.number} do orçamento nº ${budget.number}`,
            source: "revision",
            agreementId,
            createdBy: ctx.userId,
          });
          const newAdj = r.adjustmentCents - cut;
          const remaining = r.originalCents + newAdj - r.paidPrincipalCents - r.discountGrantedCents;
          await tx
            .update(receivables)
            .set({
              adjustmentCents: newAdj,
              status: remaining === 0 ? (r.paidPrincipalCents > 0 ? "paid" : "cancelled") : r.status,
              cancelledAt: remaining === 0 && r.paidPrincipalCents === 0 ? new Date() : r.cancelledAt,
              cancelReason: remaining === 0 && r.paidPrincipalCents === 0 ? `Zerado pela revisão ${rev.number}` : r.cancelReason,
              updatedAt: new Date(),
              version: sql`${receivables.version} + 1`,
            })
            .where(eq(receivables.id, r.id));
          toReduce -= cut;
        }
        if (toReduce > 0) {
          creditCents = toReduce;
          await tx.insert(patientCredits).values({
            organizationId: ctx.orgId,
            patientId: budget.patientId,
            agreementId,
            amountCents: toReduce,
            reason: `Revisão ${rev.number} do orçamento nº ${budget.number}: valor pago excede o novo total`,
            createdBy: ctx.userId,
          });
        }
      }

      // 5. Tratamento: itens aprovados viram itens de tratamento, preservando a linhagem.
      const [existingTreatment] = await tx
        .select()
        .from(treatments)
        .where(and(eq(treatments.organizationId, ctx.orgId), eq(treatments.budgetId, budget.id)));
      let treatmentId = existingTreatment?.id;
      if (!treatmentId) {
        const [t] = await tx
          .insert(treatments)
          .values({ organizationId: ctx.orgId, patientId: budget.patientId, budgetId: budget.id })
          .returning({ id: treatments.id });
        treatmentId = t!.id;
      }
      const currentTreatmentItems = await tx
        .select()
        .from(treatmentItems)
        .where(and(eq(treatmentItems.organizationId, ctx.orgId), eq(treatmentItems.treatmentId, treatmentId)))
        .for("update");
      const byLineage = new Map(currentTreatmentItems.map((t) => [t.lineageId, t]));
      const approvedLineages = new Set(approved.map((a) => a.lineageId));
      const treatmentItemIds: string[] = [];
      for (const item of approved) {
        const existing = byLineage.get(item.lineageId);
        if (existing && existing.clinicalStatus !== "cancelled") {
          await tx
            .update(treatmentItems)
            .set({
              budgetItemId: item.id,
              procedureName: item.procedureName,
              specialtyName: item.specialtyName,
              locationLabel: item.locationLabel,
              updatedAt: new Date(),
            })
            .where(eq(treatmentItems.id, existing.id));
          treatmentItemIds.push(existing.id);
        } else if (existing) {
          // Item cancelado clinicamente e reaprovado: volta como não realizado, histórico preservado.
          await tx
            .update(treatmentItems)
            .set({ budgetItemId: item.id, clinicalStatus: "not_started", cancelledAt: null, cancelledReason: null, updatedAt: new Date() })
            .where(eq(treatmentItems.id, existing.id));
          treatmentItemIds.push(existing.id);
        } else {
          const [ti] = await tx
            .insert(treatmentItems)
            .values({
              organizationId: ctx.orgId,
              treatmentId,
              patientId: budget.patientId,
              budgetItemId: item.id,
              lineageId: item.lineageId,
              procedureId: item.procedureId,
              procedureName: item.procedureName,
              specialtyName: item.specialtyName,
              locationLabel: item.locationLabel,
            })
            .returning({ id: treatmentItems.id });
          treatmentItemIds.push(ti!.id);
        }
      }
      for (const t of currentTreatmentItems) {
        if (approvedLineages.has(t.lineageId) || t.clinicalStatus === "cancelled") continue;
        if (t.clinicalStatus !== "not_started") {
          throw new BusinessRuleError(
            `"${t.procedureName}" (${t.locationLabel}) já foi iniciado. Registre o desfecho clínico antes de retirá-lo do orçamento.`,
          );
        }
        await tx
          .update(treatmentItems)
          .set({ clinicalStatus: "cancelled", cancelledAt: new Date(), cancelledBy: ctx.userId, cancelledReason: `Retirado na revisão ${rev.number}` })
          .where(eq(treatmentItems.id, t.id));
      }

      await audit(tx, ctx, {
        action: previous ? "budget.revision_approve" : "budget.approve",
        entityType: "budget",
        entityId: budget.id,
        summary: previous
          ? `Revisão ${rev.number} do orçamento nº ${budget.number} aprovada; diferença ${formatBRL(delta)}`
          : `Orçamento nº ${budget.number} aprovado (${approved.length}/${items.length} itens), total ${formatBRL(totals.totalCents)}`,
        changes: {
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          totalCents: totals.totalCents,
          deltaCents: previous ? delta : null,
          receivables: receivableIds.length,
          creditCents,
        },
      });
      return {
        agreementId,
        totalCents: totals.totalCents,
        receivableIds,
        treatmentItemIds,
        adjustmentCents: previous ? delta : 0,
        creditCents,
      } satisfies ApprovalResult;
    });
    return { ...result, replayed };
  });
}

const revisionSchema = z.object({ budgetId: zId, reason: z.string().trim().min(3, { message: "Informe o motivo da revisão" }).max(500) });

/** Revisão de orçamento aprovado: preserva a versão anterior, autor e motivo. */
export async function startRevision(ctx: Ctx, input: z.input<typeof revisionSchema>): Promise<{ revisionId: string; number: number }> {
  assertCan(ctx, "budgets.revise");
  const data = parseInput(revisionSchema, input);
  return ctx.db.transaction(async (tx) => {
    const budget = await loadBudgetRow(ctx, data.budgetId, tx, true);
    if (budget.status !== "approved" && budget.status !== "partially_approved") {
      throw new BusinessRuleError("Somente orçamentos aprovados passam por revisão; rascunhos são editados diretamente");
    }
    const current = await loadRevision(tx, ctx.orgId, budget.currentRevisionId!);
    if (current.status === "open") throw new BusinessRuleError("Já existe uma revisão em andamento");
    const [last] = await tx
      .select({ n: sql<number>`max(${budgetRevisions.number})::int` })
      .from(budgetRevisions)
      .where(eq(budgetRevisions.budgetId, budget.id));
    const number = (last?.n ?? 1) + 1;
    const [rev] = await tx
      .insert(budgetRevisions)
      .values({
        organizationId: ctx.orgId,
        budgetId: budget.id,
        number,
        reason: data.reason,
        previousRevisionId: current.id,
        createdBy: ctx.userId,
      })
      .returning({ id: budgetRevisions.id });
    const items = await loadItems(tx, ctx.orgId, current.id);
    for (const item of items) {
      const [copy] = await tx
        .insert(budgetItems)
        .values({
          organizationId: ctx.orgId,
          budgetId: budget.id,
          revisionId: rev!.id,
          lineageId: item.lineageId,
          procedureId: item.procedureId,
          specialtyId: item.specialtyId,
          procedureCode: item.procedureCode,
          procedureName: item.procedureName,
          specialtyName: item.specialtyName,
          billingUnit: item.billingUnit,
          locationScope: item.locationScope,
          locationLabel: item.locationLabel,
          locationSignature: locationSignature(item.locationScope, item.locations),
          quantity: item.quantity,
          referencePriceCents: item.referencePriceCents,
          unitPriceCents: item.unitPriceCents,
          subtotalCents: item.subtotalCents,
          approvalStatus: item.approvalStatus === "approved" ? "pending" : "rejected",
          duplicateJustification: item.duplicateJustification,
          notes: item.notes,
          sortOrder: item.sortOrder,
          createdBy: ctx.userId,
        })
        .returning({ id: budgetItems.id });
      if (item.locations.length > 0) {
        await tx.insert(budgetItemLocations).values(
          item.locations.map((l) => ({
            organizationId: ctx.orgId,
            itemId: copy!.id,
            kind: l.kind,
            tooth: l.kind === "tooth" ? l.tooth : null,
            arch: l.kind === "arch" ? l.arch : null,
            hemiarch: l.kind === "hemiarch" ? l.hemiarch : null,
          })),
        );
      }
    }
    await tx
      .update(budgets)
      .set({ currentRevisionId: rev!.id, version: sql`${budgets.version} + 1`, updatedAt: new Date() })
      .where(eq(budgets.id, budget.id));
    await audit(tx, ctx, {
      action: "budget.revision_start",
      entityType: "budget",
      entityId: budget.id,
      summary: `Revisão ${number} do orçamento nº ${budget.number} iniciada: ${data.reason}`,
    });
    return { revisionId: rev!.id, number };
  });
}

/** Descarta a revisão em andamento e volta à versão aprovada vigente. */
export async function discardRevision(ctx: Ctx, budgetId: string) {
  assertCan(ctx, "budgets.revise");
  return ctx.db.transaction(async (tx) => {
    const budget = await loadBudgetRow(ctx, budgetId, tx, true);
    const current = await loadRevision(tx, ctx.orgId, budget.currentRevisionId!);
    if (current.status !== "open" || !current.previousRevisionId) throw new BusinessRuleError("Não há revisão em andamento");
    await tx.update(budgetRevisions).set({ status: "discarded" }).where(eq(budgetRevisions.id, current.id));
    await tx
      .update(budgets)
      .set({ currentRevisionId: current.previousRevisionId, version: sql`${budgets.version} + 1`, updatedAt: new Date() })
      .where(eq(budgets.id, budget.id));
    await audit(tx, ctx, { action: "budget.revision_discard", entityType: "budget", entityId: budget.id, summary: `Revisão ${current.number} descartada` });
  });
}

/** Itens de uma versão específica, para comparação entre revisões. */
export async function revisionItems(ctx: Ctx, budgetId: string, revisionId: string) {
  assertCan(ctx, "budgets.view");
  const rev = await loadRevision(ctx.db, ctx.orgId, revisionId);
  if (rev.budgetId !== budgetId) throw new NotFoundError("Revisão do orçamento");
  return loadItems(ctx.db, ctx.orgId, revisionId);
}

export const LOCATION_KIND_VALUES = LOCATION_KINDS;
export { ne };
