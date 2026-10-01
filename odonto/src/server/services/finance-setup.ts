import { and, asc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { todayInTz } from "@/domain/dates";
import { audit } from "../audit";
import { assertCan, assertCanAny, type Ctx } from "../context";
import type { DbOrTx } from "../db/client";
import { accountMovements, cardFeeRules, costCenters, financialAccounts, financialCategories, suppliers } from "../db/schema";
import { q } from "../db/sql";
import { BusinessRuleError, NotFoundError } from "../errors";
import { parseInput, zCents, zCivilDate, zId, zOptionalText, zRequiredText } from "../validation";

// ---------------------------------------------------------------------------
// Contas financeiras
// ---------------------------------------------------------------------------

export const ACCOUNT_KIND_LABEL = {
  bank: "Conta bancária",
  cash: "Caixa",
  card_clearing: "Recebíveis de cartão (operadora)",
  other: "Outra",
} as const;

export async function listAccounts(ctx: Ctx, opts: { includeInactive?: boolean; asOf?: string } = {}) {
  assertCanAny(ctx, "finance.view", "finance.settle");
  const asOf = opts.asOf ?? todayInTz(ctx.timezone);
  const rows = await ctx.db
    .select({
      account: financialAccounts,
      movementsCents: sql<string>`coalesce((select sum(${q(accountMovements.amountCents)}) from ${accountMovements}
        where ${q(accountMovements.accountId)} = ${q(financialAccounts.id)} and ${q(accountMovements.occurredOn)} <= ${asOf}), 0)`,
      unreconciledCount: sql<number>`(select count(*)::int from ${accountMovements}
        where ${q(accountMovements.accountId)} = ${q(financialAccounts.id)} and ${q(accountMovements.reconciledCents)} <> ${q(accountMovements.amountCents)})`,
    })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.organizationId, ctx.orgId), opts.includeInactive ? undefined : eq(financialAccounts.active, true)))
    .orderBy(asc(financialAccounts.kind), asc(financialAccounts.name));
  return rows.map((r) => ({
    ...r.account,
    balanceCents: r.account.openingDate <= asOf ? r.account.openingBalanceCents + Number(r.movementsCents) : Number(r.movementsCents),
    unreconciledCount: r.unreconciledCount,
  }));
}

export async function getAccount(db: DbOrTx, orgId: string, accountId: string) {
  const [row] = await db
    .select()
    .from(financialAccounts)
    .where(and(eq(financialAccounts.organizationId, orgId), eq(financialAccounts.id, accountId)));
  if (!row) throw new NotFoundError("Conta financeira");
  return row;
}

/** Saldo realizado de uma conta em uma data: inicial + movimentos efetivos (inclui transferências). */
export async function accountBalance(db: DbOrTx, orgId: string, accountId: string, asOf: string): Promise<number> {
  const account = await getAccount(db, orgId, accountId);
  const [row] = await db
    .select({ s: sql<string>`coalesce(sum(${accountMovements.amountCents}), 0)` })
    .from(accountMovements)
    .where(and(eq(accountMovements.organizationId, orgId), eq(accountMovements.accountId, accountId), lte(accountMovements.occurredOn, asOf)));
  return (account.openingDate <= asOf ? account.openingBalanceCents : 0) + Number(row?.s ?? 0);
}

const accountSchema = z.object({
  id: zId.nullish(),
  name: zRequiredText("Nome da conta", 120),
  kind: z.enum(["bank", "cash", "card_clearing", "other"]),
  bankName: zOptionalText(120),
  bankCode: zOptionalText(10),
  branch: zOptionalText(20),
  accountNumberMasked: zOptionalText(30),
  openingBalanceCents: z.number().int(),
  openingDate: zCivilDate,
  active: z.boolean().default(true),
});

export async function saveAccount(ctx: Ctx, input: z.input<typeof accountSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(accountSchema, input);
  return ctx.db.transaction(async (tx) => {
    if (data.id) {
      const before = await getAccount(tx, ctx.orgId, data.id);
      const [mov] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(accountMovements)
        .where(and(eq(accountMovements.organizationId, ctx.orgId), eq(accountMovements.accountId, data.id)));
      if ((mov?.n ?? 0) > 0 && (before.openingBalanceCents !== data.openingBalanceCents || before.openingDate !== data.openingDate || before.kind !== data.kind)) {
        throw new BusinessRuleError("Conta com movimentações: saldo inicial, data de referência e tipo não podem mudar. Registre um ajuste.");
      }
      await tx
        .update(financialAccounts)
        .set({ ...data, id: undefined })
        .where(and(eq(financialAccounts.organizationId, ctx.orgId), eq(financialAccounts.id, data.id)));
      await audit(tx, ctx, { action: "account.update", entityType: "financial_account", entityId: data.id, summary: `Conta atualizada: ${data.name}` });
      return { id: data.id };
    }
    const [row] = await tx
      .insert(financialAccounts)
      .values({ organizationId: ctx.orgId, ...data, id: undefined })
      .returning({ id: financialAccounts.id });
    await audit(tx, ctx, {
      action: "account.create",
      entityType: "financial_account",
      entityId: row!.id,
      summary: `Conta criada: ${data.name}`,
      changes: { openingBalanceCents: data.openingBalanceCents, openingDate: data.openingDate },
    });
    return { id: row!.id };
  });
}

// ---------------------------------------------------------------------------
// Categorias, centros de custo e fornecedores
// ---------------------------------------------------------------------------

export async function listCategories(ctx: Ctx, type?: "income" | "expense") {
  return ctx.db
    .select()
    .from(financialCategories)
    .where(and(eq(financialCategories.organizationId, ctx.orgId), type ? eq(financialCategories.type, type) : undefined))
    .orderBy(asc(financialCategories.type), asc(financialCategories.name));
}

const categorySchema = z.object({
  id: zId.nullish(),
  name: zRequiredText("Nome da categoria", 120),
  type: z.enum(["income", "expense"]),
  active: z.boolean().default(true),
});

export async function saveCategory(ctx: Ctx, input: z.input<typeof categorySchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(categorySchema, input);
  if (data.id) {
    const [row] = await ctx.db
      .update(financialCategories)
      .set({ name: data.name, active: data.active })
      .where(and(eq(financialCategories.organizationId, ctx.orgId), eq(financialCategories.id, data.id)))
      .returning({ id: financialCategories.id });
    if (!row) throw new NotFoundError("Categoria");
    return { id: row.id };
  }
  const [row] = await ctx.db
    .insert(financialCategories)
    .values({ organizationId: ctx.orgId, name: data.name, type: data.type, active: data.active })
    .returning({ id: financialCategories.id });
  return { id: row!.id };
}

export async function listCostCenters(ctx: Ctx) {
  return ctx.db.select().from(costCenters).where(eq(costCenters.organizationId, ctx.orgId)).orderBy(asc(costCenters.name));
}

const costCenterSchema = z.object({ id: zId.nullish(), name: zRequiredText("Nome", 120), active: z.boolean().default(true) });

export async function saveCostCenter(ctx: Ctx, input: z.input<typeof costCenterSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(costCenterSchema, input);
  if (data.id) {
    const [row] = await ctx.db
      .update(costCenters)
      .set({ name: data.name, active: data.active })
      .where(and(eq(costCenters.organizationId, ctx.orgId), eq(costCenters.id, data.id)))
      .returning({ id: costCenters.id });
    if (!row) throw new NotFoundError("Centro de custo");
    return { id: row.id };
  }
  const [row] = await ctx.db.insert(costCenters).values({ organizationId: ctx.orgId, name: data.name, active: data.active }).returning({ id: costCenters.id });
  return { id: row!.id };
}

export async function listSuppliers(ctx: Ctx) {
  assertCanAny(ctx, "finance.view", "finance.edit");
  return ctx.db.select().from(suppliers).where(eq(suppliers.organizationId, ctx.orgId)).orderBy(asc(suppliers.name));
}

const supplierSchema = z.object({
  id: zId.nullish(),
  name: zRequiredText("Nome do fornecedor", 200),
  document: zOptionalText(20),
  phone: zOptionalText(20),
  email: zOptionalText(200),
  notes: zOptionalText(1000),
  active: z.boolean().default(true),
});

export async function saveSupplier(ctx: Ctx, input: z.input<typeof supplierSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(supplierSchema, input);
  const values = { name: data.name, document: data.document, phone: data.phone, email: data.email, notes: data.notes, active: data.active };
  if (data.id) {
    const [row] = await ctx.db
      .update(suppliers)
      .set(values)
      .where(and(eq(suppliers.organizationId, ctx.orgId), eq(suppliers.id, data.id)))
      .returning({ id: suppliers.id });
    if (!row) throw new NotFoundError("Fornecedor");
    return { id: row.id };
  }
  const [row] = await ctx.db.insert(suppliers).values({ organizationId: ctx.orgId, ...values }).returning({ id: suppliers.id });
  return { id: row!.id };
}

// ---------------------------------------------------------------------------
// Regras de taxa de cartão (sugestão; o valor real é confirmado na transação)
// ---------------------------------------------------------------------------

export async function listCardFeeRules(ctx: Ctx) {
  assertCan(ctx, "finance.view");
  return ctx.db.select().from(cardFeeRules).where(eq(cardFeeRules.organizationId, ctx.orgId)).orderBy(asc(cardFeeRules.acquirer), asc(cardFeeRules.paymentType));
}

const feeRuleSchema = z.object({
  id: zId.nullish(),
  acquirer: zRequiredText("Operadora", 80),
  brand: zOptionalText(40),
  paymentType: z.enum(["debit", "credit"]),
  installmentsFrom: z.number().int().min(1).max(24),
  installmentsTo: z.number().int().min(1).max(24),
  feeBasisPoints: z.number().int().min(0).max(5000),
  fixedFeeCents: zCents.default(0),
  settlementDays: z.number().int().min(0).max(120),
  active: z.boolean().default(true),
});

export async function saveCardFeeRule(ctx: Ctx, input: z.input<typeof feeRuleSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(feeRuleSchema, input);
  if (data.installmentsTo < data.installmentsFrom) throw new BusinessRuleError("Faixa de parcelas inválida");
  const values = { ...data, id: undefined };
  if (data.id) {
    await ctx.db.update(cardFeeRules).set(values).where(and(eq(cardFeeRules.organizationId, ctx.orgId), eq(cardFeeRules.id, data.id)));
    return { id: data.id };
  }
  const [row] = await ctx.db.insert(cardFeeRules).values({ organizationId: ctx.orgId, ...values }).returning({ id: cardFeeRules.id });
  return { id: row!.id };
}
