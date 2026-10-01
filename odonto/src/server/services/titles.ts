import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { addDays, addMonthsPreservingDay, compareCivil, monthlySchedule, parseCivil, todayInTz, type CivilDate } from "@/domain/dates";
import { formatBRL, prorate, splitEvenly, sumCents } from "@/domain/money";
import { PAYMENT_METHODS, type PaymentMethod } from "@/domain/payment-plan";
import { searchKey } from "@/domain/text";
import { audit } from "../audit";
import { assertCan, assertCanAny, type Ctx } from "../context";
import type { Tx } from "../db/client";
import {
  accountMovements,
  cardReceivables,
  cardTransactions,
  costCenters,
  financialAccounts,
  financialAllocations,
  financialCategories,
  patients,
  payableRecurrences,
  payables,
  receivableAdjustments,
  receivables,
  settlementAllocations,
  settlements,
  suppliers,
  transfers,
} from "../db/schema";
import { BusinessRuleError, ConflictError, isUniqueViolation, NotFoundError, ValidationError } from "../errors";
import { parseInput, zCents, zCivilDate, zId, zOptionalText, zPositiveCents, zRequiredText } from "../validation";
import { getAccount } from "./finance-setup";
import { systemCategoryId } from "./organizations";

type TitleKind = "receivable" | "payable";
export type TitleStatus = "open" | "partial" | "paid" | "cancelled";

export const TITLE_STATUS_LABEL: Record<TitleStatus, string> = {
  open: "Em aberto",
  partial: "Parcial",
  paid: "Quitado",
  cancelled: "Cancelado",
};

export function titleBalance(t: { originalCents: number; adjustmentCents: number; paidPrincipalCents: number; discountGrantedCents: number }) {
  return t.originalCents + t.adjustmentCents - t.paidPrincipalCents - t.discountGrantedCents;
}

function statusFor(t: { originalCents: number; adjustmentCents: number; paidPrincipalCents: number; discountGrantedCents: number }, cancelled: boolean): TitleStatus {
  if (cancelled) return "cancelled";
  const balance = titleBalance(t);
  if (balance === 0) return t.paidPrincipalCents + t.discountGrantedCents > 0 ? "paid" : "cancelled";
  return t.paidPrincipalCents + t.discountGrantedCents > 0 ? "partial" : "open";
}

// ---------------------------------------------------------------------------
// Listagens
// ---------------------------------------------------------------------------

const listSchema = z.object({
  kind: z.enum(["receivable", "payable"]),
  status: z.enum(["open_all", "overdue", "paid", "cancelled", "all"]).default("open_all"),
  from: zCivilDate.nullish(),
  to: zCivilDate.nullish(),
  q: z.string().trim().max(120).default(""),
  patientId: zId.nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(200).default(30),
});

export async function listTitles(ctx: Ctx, input: z.input<typeof listSchema>) {
  assertCan(ctx, "finance.view");
  const data = parseInput(listSchema, input);
  const today = todayInTz(ctx.timezone);
  const isRec = data.kind === "receivable";
  const T = isRec ? receivables : payables;
  const filters: (SQL | undefined)[] = [eq(T.organizationId, ctx.orgId)];
  if (data.status === "open_all") filters.push(inArray(T.status, ["open", "partial"]));
  if (data.status === "overdue") filters.push(inArray(T.status, ["open", "partial"]), sql`${T.dueDate} < ${today}`);
  if (data.status === "paid") filters.push(eq(T.status, "paid"));
  if (data.status === "cancelled") filters.push(eq(T.status, "cancelled"));
  if (data.from) filters.push(gte(T.dueDate, data.from));
  if (data.to) filters.push(lte(T.dueDate, data.to));
  if (isRec && data.patientId) filters.push(eq(receivables.patientId, data.patientId));
  if (data.q) {
    const like = `%${data.q.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(
      isRec
        ? or(ilike(receivables.description, like), ilike(patients.searchKey, `%${searchKey(data.q)}%`))
        : or(ilike(payables.description, like), ilike(suppliers.name, like)),
    );
  }
  const where = and(...filters);
  if (isRec) {
    const base = ctx.db
      .select({ title: receivables, counterpart: patients.fullName, categoryName: financialCategories.name })
      .from(receivables)
      .leftJoin(patients, and(eq(patients.id, receivables.patientId), eq(patients.organizationId, receivables.organizationId)))
      .leftJoin(financialCategories, eq(financialCategories.id, receivables.categoryId))
      .where(where);
    const [total] = await ctx.db
      .select({ n: count() })
      .from(receivables)
      .leftJoin(patients, and(eq(patients.id, receivables.patientId), eq(patients.organizationId, receivables.organizationId)))
      .where(where);
    const rows = await base
      .orderBy(asc(receivables.dueDate), asc(receivables.createdAt))
      .limit(data.pageSize)
      .offset((data.page - 1) * data.pageSize);
    return {
      items: rows.map((r) => ({
        ...r.title,
        kind: "receivable" as const,
        counterpart: r.counterpart,
        categoryName: r.categoryName,
        balanceCents: titleBalance(r.title),
        overdue: ["open", "partial"].includes(r.title.status) && r.title.dueDate < today,
      })),
      total: total?.n ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  }
  const [total] = await ctx.db
    .select({ n: count() })
    .from(payables)
    .leftJoin(suppliers, and(eq(suppliers.id, payables.supplierId), eq(suppliers.organizationId, payables.organizationId)))
    .where(where);
  const rows = await ctx.db
    .select({ title: payables, counterpart: suppliers.name, categoryName: financialCategories.name })
    .from(payables)
    .leftJoin(suppliers, and(eq(suppliers.id, payables.supplierId), eq(suppliers.organizationId, payables.organizationId)))
    .leftJoin(financialCategories, eq(financialCategories.id, payables.categoryId))
    .where(where)
    .orderBy(asc(payables.dueDate), asc(payables.createdAt))
    .limit(data.pageSize)
    .offset((data.page - 1) * data.pageSize);
  return {
    items: rows.map((r) => ({
      ...r.title,
      kind: "payable" as const,
      counterpart: r.counterpart,
      categoryName: r.categoryName,
      balanceCents: titleBalance(r.title),
      overdue: ["open", "partial"].includes(r.title.status) && r.title.dueDate < today,
    })),
    total: total?.n ?? 0,
    page: data.page,
    pageSize: data.pageSize,
  };
}

export async function getTitle(ctx: Ctx, kind: TitleKind, id: string) {
  assertCan(ctx, "finance.view");
  const T = kind === "receivable" ? receivables : payables;
  const [title] = await ctx.db
    .select()
    .from(T)
    .where(and(eq(T.organizationId, ctx.orgId), eq(T.id, id)));
  if (!title) throw new NotFoundError("Título");
  const allocCol = kind === "receivable" ? settlementAllocations.receivableId : settlementAllocations.payableId;
  const history = await ctx.db
    .select({ allocation: settlementAllocations, settlement: settlements, accountName: financialAccounts.name })
    .from(settlementAllocations)
    .innerJoin(settlements, eq(settlements.id, settlementAllocations.settlementId))
    .innerJoin(financialAccounts, eq(financialAccounts.id, settlements.accountId))
    .where(and(eq(settlementAllocations.organizationId, ctx.orgId), eq(allocCol, id)))
    .orderBy(asc(settlements.settledOn), asc(settlements.createdAt));
  const adjustments =
    kind === "receivable"
      ? await ctx.db
          .select()
          .from(receivableAdjustments)
          .where(and(eq(receivableAdjustments.organizationId, ctx.orgId), eq(receivableAdjustments.receivableId, id)))
          .orderBy(asc(receivableAdjustments.createdAt))
      : [];
  const allocations = await ctx.db
    .select({ allocation: financialAllocations, categoryName: financialCategories.name, costCenterName: costCenters.name })
    .from(financialAllocations)
    .innerJoin(financialCategories, eq(financialCategories.id, financialAllocations.categoryId))
    .leftJoin(costCenters, eq(costCenters.id, financialAllocations.costCenterId))
    .where(
      and(
        eq(financialAllocations.organizationId, ctx.orgId),
        kind === "receivable" ? eq(financialAllocations.receivableId, id) : eq(financialAllocations.payableId, id),
      ),
    );
  return { title: { ...title, balanceCents: titleBalance(title) }, history, adjustments, allocations };
}

// ---------------------------------------------------------------------------
// Lançamentos avulsos a receber
// ---------------------------------------------------------------------------

const receivableSchema = z.object({
  patientId: zId.nullish().transform((v) => v ?? null),
  description: zRequiredText("Descrição", 300),
  categoryId: zId,
  costCenterId: zId.nullish().transform((v) => v ?? null),
  competenceDate: zCivilDate,
  dueDate: zCivilDate,
  amountCents: zPositiveCents,
  expectedMethod: z.enum(PAYMENT_METHODS).nullish().transform((v) => v ?? null),
  notes: zOptionalText(2000),
});

async function assertCategory(tx: Tx | Ctx["db"], orgId: string, categoryId: string, type: "income" | "expense") {
  const [cat] = await tx
    .select({ id: financialCategories.id, type: financialCategories.type })
    .from(financialCategories)
    .where(and(eq(financialCategories.organizationId, orgId), eq(financialCategories.id, categoryId)));
  if (!cat) throw new NotFoundError("Categoria");
  if (cat.type !== type) throw new ValidationError(type === "income" ? "Use uma categoria de receita" : "Use uma categoria de despesa");
}

export async function createReceivable(ctx: Ctx, input: z.input<typeof receivableSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(receivableSchema, input);
  await assertCategory(ctx.db, ctx.orgId, data.categoryId, "income");
  if (data.patientId) {
    const [p] = await ctx.db.select({ id: patients.id }).from(patients).where(and(eq(patients.organizationId, ctx.orgId), eq(patients.id, data.patientId)));
    if (!p) throw new NotFoundError("Paciente");
  }
  const [row] = await ctx.db
    .insert(receivables)
    .values({
      organizationId: ctx.orgId,
      patientId: data.patientId,
      kind: "manual",
      description: data.description,
      categoryId: data.categoryId,
      costCenterId: data.costCenterId,
      competenceDate: data.competenceDate,
      dueDate: data.dueDate,
      originalCents: data.amountCents,
      expectedMethod: data.expectedMethod,
      notes: data.notes,
      createdBy: ctx.userId,
    })
    .returning({ id: receivables.id });
  await audit(ctx.db, ctx, {
    action: "receivable.create",
    entityType: "receivable",
    entityId: row!.id,
    summary: `Lançamento avulso a receber: ${data.description} (${formatBRL(data.amountCents)})`,
  });
  return { id: row!.id };
}

const editDueSchema = z.object({
  kind: z.enum(["receivable", "payable"]),
  id: zId,
  dueDate: zCivilDate,
  expectedMethod: z.enum(PAYMENT_METHODS).nullish(),
});

export async function updateTitleDue(ctx: Ctx, input: z.input<typeof editDueSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(editDueSchema, input);
  const T = data.kind === "receivable" ? receivables : payables;
  const [before] = await ctx.db.select().from(T).where(and(eq(T.organizationId, ctx.orgId), eq(T.id, data.id)));
  if (!before) throw new NotFoundError("Título");
  if (before.status === "paid" || before.status === "cancelled") throw new BusinessRuleError("Título quitado ou cancelado não pode ser alterado");
  await ctx.db
    .update(T)
    .set({
      dueDate: data.dueDate,
      ...(data.kind === "receivable" && data.expectedMethod ? { expectedMethod: data.expectedMethod } : {}),
      updatedAt: new Date(),
      version: sql`${T.version} + 1`,
    })
    .where(and(eq(T.organizationId, ctx.orgId), eq(T.id, data.id)));
  await audit(ctx.db, ctx, {
    action: `${data.kind}.due_change`,
    entityType: data.kind,
    entityId: data.id,
    summary: `Vencimento alterado de ${before.dueDate} para ${data.dueDate}`,
  });
}

const cancelSchema = z.object({ kind: z.enum(["receivable", "payable"]), id: zId, reason: zRequiredText("Motivo", 300) });

/** Cancela título sem baixas. Títulos de orçamento aprovado só mudam por revisão. */
export async function cancelTitle(ctx: Ctx, input: z.input<typeof cancelSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(cancelSchema, input);
  await ctx.db.transaction(async (tx) => {
    const T = data.kind === "receivable" ? receivables : payables;
    const [title] = await tx.select().from(T).where(and(eq(T.organizationId, ctx.orgId), eq(T.id, data.id))).for("update");
    if (!title) throw new NotFoundError("Título");
    if (data.kind === "receivable" && (title as typeof receivables.$inferSelect).agreementId) {
      throw new BusinessRuleError("Título gerado por orçamento aprovado: ajuste por meio de revisão do orçamento");
    }
    if (title.paidPrincipalCents > 0 || title.discountGrantedCents > 0) {
      throw new BusinessRuleError("Título com baixas não pode ser cancelado; estorne as baixas primeiro");
    }
    if (title.status === "cancelled") return;
    await tx
      .update(T)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: data.reason, updatedAt: new Date(), version: sql`${T.version} + 1` })
      .where(eq(T.id, title.id));
    await audit(tx, ctx, { action: `${data.kind}.cancel`, entityType: data.kind, entityId: title.id, summary: `Título cancelado: ${data.reason}` });
  });
}

// ---------------------------------------------------------------------------
// Contas a pagar (parceladas e recorrentes) com rateio
// ---------------------------------------------------------------------------

const allocationInput = z.object({ categoryId: zId, costCenterId: zId.nullish().transform((v) => v ?? null), amountCents: zPositiveCents });

const payableSchema = z.object({
  supplierId: zId.nullish().transform((v) => v ?? null),
  description: zRequiredText("Descrição", 300),
  categoryId: zId,
  costCenterId: zId.nullish().transform((v) => v ?? null),
  competenceDate: zCivilDate,
  firstDueDate: zCivilDate,
  amountCents: zPositiveCents,
  installments: z.number().int().min(1).max(60).default(1),
  expectedAccountId: zId.nullish().transform((v) => v ?? null),
  documentNumber: zOptionalText(60),
  notes: zOptionalText(2000),
  /** Rateio opcional; quando informado, deve fechar exatamente o valor total. */
  allocations: z.array(allocationInput).max(20).default([]),
});

export async function createPayable(ctx: Ctx, input: z.input<typeof payableSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(payableSchema, input);
  await assertCategory(ctx.db, ctx.orgId, data.categoryId, "expense");
  for (const a of data.allocations) await assertCategory(ctx.db, ctx.orgId, a.categoryId, "expense");
  if (data.allocations.length > 0 && sumCents(data.allocations.map((a) => a.amountCents)) !== data.amountCents) {
    throw new ValidationError("O rateio deve fechar exatamente o valor do lançamento", { allocations: "Soma do rateio diferente do total" });
  }
  if (data.supplierId) {
    const [s] = await ctx.db.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.organizationId, ctx.orgId), eq(suppliers.id, data.supplierId)));
    if (!s) throw new NotFoundError("Fornecedor");
  }
  if (data.expectedAccountId) await getAccount(ctx.db, ctx.orgId, data.expectedAccountId);
  const amounts = splitEvenly(data.amountCents, data.installments);
  const dates = monthlySchedule(data.firstDueDate, data.installments);
  const groupId = data.installments > 1 ? crypto.randomUUID() : null;
  return ctx.db.transaction(async (tx) => {
    const ids: string[] = [];
    for (let i = 0; i < data.installments; i++) {
      const [row] = await tx
        .insert(payables)
        .values({
          organizationId: ctx.orgId,
          supplierId: data.supplierId,
          description: data.installments > 1 ? `${data.description} (${i + 1}/${data.installments})` : data.description,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId,
          competenceDate: data.competenceDate,
          dueDate: dates[i]!,
          originalCents: amounts[i]!,
          expectedAccountId: data.expectedAccountId,
          installmentGroupId: groupId,
          installmentNumber: data.installments > 1 ? i + 1 : null,
          installmentTotal: data.installments > 1 ? data.installments : null,
          documentNumber: data.documentNumber,
          notes: data.notes,
          createdBy: ctx.userId,
        })
        .returning({ id: payables.id });
      ids.push(row!.id);
      if (data.allocations.length > 0) {
        const shares = prorate(
          amounts[i]!,
          data.allocations.map((a) => a.amountCents),
        );
        await tx.insert(financialAllocations).values(
          data.allocations
            .map((a, k) => ({ organizationId: ctx.orgId, payableId: row!.id, categoryId: a.categoryId, costCenterId: a.costCenterId, amountCents: shares[k]! }))
            .filter((a) => a.amountCents > 0),
        );
      }
    }
    await audit(tx, ctx, {
      action: "payable.create",
      entityType: "payable",
      entityId: ids[0]!,
      summary: `Conta a pagar: ${data.description} (${formatBRL(data.amountCents)} em ${data.installments}x)`,
    });
    return { ids };
  });
}

const recurrenceSchema = z.object({
  supplierId: zId.nullish().transform((v) => v ?? null),
  description: zRequiredText("Descrição", 300),
  categoryId: zId,
  costCenterId: zId.nullish().transform((v) => v ?? null),
  amountCents: zPositiveCents,
  dayOfMonth: z.number().int().min(1).max(31),
  startDate: zCivilDate,
  endDate: zCivilDate.nullish().transform((v) => v ?? null),
  expectedAccountId: zId.nullish().transform((v) => v ?? null),
});

export async function createRecurrence(ctx: Ctx, input: z.input<typeof recurrenceSchema>) {
  assertCan(ctx, "finance.edit");
  const data = parseInput(recurrenceSchema, input);
  await assertCategory(ctx.db, ctx.orgId, data.categoryId, "expense");
  if (data.endDate && compareCivil(data.endDate, data.startDate) < 0) throw new ValidationError("Data final anterior à inicial");
  const [row] = await ctx.db
    .insert(payableRecurrences)
    .values({ organizationId: ctx.orgId, ...data, createdBy: ctx.userId })
    .returning({ id: payableRecurrences.id });
  await audit(ctx.db, ctx, { action: "recurrence.create", entityType: "payable_recurrence", entityId: row!.id, summary: `Despesa recorrente: ${data.description}` });
  return { id: row!.id };
}

export async function listRecurrences(ctx: Ctx) {
  assertCan(ctx, "finance.view");
  return ctx.db
    .select({ recurrence: payableRecurrences, supplierName: suppliers.name, categoryName: financialCategories.name })
    .from(payableRecurrences)
    .leftJoin(suppliers, eq(suppliers.id, payableRecurrences.supplierId))
    .leftJoin(financialCategories, eq(financialCategories.id, payableRecurrences.categoryId))
    .where(eq(payableRecurrences.organizationId, ctx.orgId))
    .orderBy(asc(payableRecurrences.description));
}

/**
 * Gera ocorrências até `until` de forma idempotente: a chave (recorrência, mês)
 * é única, então repetir a geração não duplica contas.
 */
export async function generateRecurringPayables(ctx: Ctx, until: CivilDate): Promise<{ created: number }> {
  assertCan(ctx, "finance.edit");
  const recs = await ctx.db
    .select()
    .from(payableRecurrences)
    .where(and(eq(payableRecurrences.organizationId, ctx.orgId), isNull(payableRecurrences.suspendedAt)));
  let created = 0;
  for (const r of recs) {
    const start = parseCivil(r.startDate);
    for (let i = 0; ; i++) {
      const due = addMonthsPreservingDay(`${String(start.y).padStart(4, "0")}-${String(start.m).padStart(2, "0")}-01`, i, r.dayOfMonth);
      if (compareCivil(due, until) > 0) break;
      if (r.endDate && compareCivil(due, r.endDate) > 0) break;
      if (compareCivil(due, r.startDate) < 0) continue;
      const period = due.slice(0, 7);
      const inserted = await ctx.db
        .insert(payables)
        .values({
          organizationId: ctx.orgId,
          supplierId: r.supplierId,
          description: `${r.description} (${period.slice(5)}/${period.slice(0, 4)})`,
          categoryId: r.categoryId,
          costCenterId: r.costCenterId,
          competenceDate: due,
          dueDate: due,
          originalCents: r.amountCents,
          expectedAccountId: r.expectedAccountId,
          recurrenceId: r.id,
          recurrencePeriod: period,
          createdBy: ctx.userId,
        })
        .onConflictDoNothing()
        .returning({ id: payables.id });
      created += inserted.length;
    }
  }
  if (created > 0) await audit(ctx.db, ctx, { action: "recurrence.generate", entityType: "payable_recurrence", summary: `${created} ocorrência(s) gerada(s) até ${until}` });
  return { created };
}

/** Suspende a recorrência e cancela ocorrências futuras ainda sem baixa. */
export async function suspendRecurrence(ctx: Ctx, recurrenceId: string) {
  assertCan(ctx, "finance.edit");
  const today = todayInTz(ctx.timezone);
  await ctx.db.transaction(async (tx) => {
    const [r] = await tx
      .update(payableRecurrences)
      .set({ suspendedAt: new Date() })
      .where(and(eq(payableRecurrences.organizationId, ctx.orgId), eq(payableRecurrences.id, recurrenceId)))
      .returning({ id: payableRecurrences.id, description: payableRecurrences.description });
    if (!r) throw new NotFoundError("Recorrência");
    const cancelled = await tx
      .update(payables)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "Recorrência suspensa", updatedAt: new Date() })
      .where(
        and(
          eq(payables.organizationId, ctx.orgId),
          eq(payables.recurrenceId, recurrenceId),
          eq(payables.status, "open"),
          eq(payables.paidPrincipalCents, 0),
          sql`${payables.dueDate} > ${today}`,
        ),
      )
      .returning({ id: payables.id });
    await audit(tx, ctx, {
      action: "recurrence.suspend",
      entityType: "payable_recurrence",
      entityId: recurrenceId,
      summary: `Recorrência "${r.description}" suspensa; ${cancelled.length} ocorrência(s) futura(s) cancelada(s)`,
    });
  });
}

// ---------------------------------------------------------------------------
// Baixas (liquidações) e estornos
// ---------------------------------------------------------------------------

const settleAllocationSchema = z.object({
  titleId: zId,
  principalCents: zCents.default(0),
  interestCents: zCents.default(0),
  fineCents: zCents.default(0),
  discountCents: zCents.default(0),
});

const settleSchema = z.object({
  kind: z.enum(["receivable", "payable"]),
  accountId: zId,
  method: z.enum(PAYMENT_METHODS),
  methodNote: zOptionalText(120),
  settledOn: zCivilDate,
  allocations: z.array(settleAllocationSchema).min(1).max(100),
  notes: zOptionalText(1000),
  idempotencyKey: z.string().min(8).max(100).nullish(),
  bankTransactionId: zId.nullish(),
});

export type SettleInput = z.input<typeof settleSchema>;

/** Uso interno (também pela conciliação e pelo fluxo de cartão), dentro de uma transação existente. */
export async function settleWithinTx(
  tx: Tx,
  ctx: Ctx,
  input: SettleInput,
  opts: { allowCardMethod?: boolean } = {},
): Promise<{ settlementId: string; movementId: string | null; amountCents: number }> {
  const data = parseInput(settleSchema, input);
  if ((data.method === "credit" || data.method === "debit") && data.kind === "receivable" && !opts.allowCardMethod) {
    throw new BusinessRuleError("Pagamentos com cartão usam o registro de transação de cartão (bruto, taxa e líquido)");
  }
  if (data.method === "other" && !data.methodNote) throw new ValidationError('Identifique a forma de pagamento "outra"');
  if (data.idempotencyKey) {
    const [existing] = await tx
      .select({ id: settlements.id, amountCents: settlements.amountCents })
      .from(settlements)
      .where(and(eq(settlements.organizationId, ctx.orgId), eq(settlements.idempotencyKey, data.idempotencyKey)));
    if (existing) {
      const [mov] = await tx.select({ id: accountMovements.id }).from(accountMovements).where(eq(accountMovements.settlementId, existing.id));
      return { settlementId: existing.id, movementId: mov?.id ?? null, amountCents: existing.amountCents };
    }
  }
  const account = await getAccount(tx, ctx.orgId, data.accountId);
  if (!account.active) throw new BusinessRuleError("Conta financeira inativa");
  if (account.kind === "card_clearing" && !opts.allowCardMethod) {
    throw new BusinessRuleError("A conta de recebíveis de cartão só recebe lançamentos do fluxo de cartão");
  }
  const isRec = data.kind === "receivable";
  const T = isRec ? receivables : payables;
  const ids = [...new Set(data.allocations.map((a) => a.titleId))].sort();
  if (ids.length !== data.allocations.length) throw new ValidationError("Título repetido na baixa");
  // Bloqueio em ordem determinística evita deadlock entre baixas concorrentes.
  const titles = await tx
    .select()
    .from(T)
    .where(and(eq(T.organizationId, ctx.orgId), inArray(T.id, ids)))
    .orderBy(asc(T.id))
    .for("update");
  if (titles.length !== ids.length) throw new NotFoundError("Título");
  let amount = 0;
  for (const a of data.allocations) {
    const t = titles.find((x) => x.id === a.titleId)!;
    if (t.status === "cancelled" || t.status === "paid") throw new BusinessRuleError(`"${t.description}" já está ${t.status === "paid" ? "quitado" : "cancelado"}`);
    if (a.principalCents + a.interestCents + a.fineCents + a.discountCents === 0) throw new ValidationError("Informe o valor da baixa");
    const balance = titleBalance(t);
    if (a.principalCents + a.discountCents > balance) {
      throw new BusinessRuleError(`Baixa de "${t.description}" excede o saldo em aberto (${formatBRL(balance)})`);
    }
    amount += a.principalCents + a.interestCents + a.fineCents;
  }
  let settlementId: string;
  try {
    const [s] = await tx
      .insert(settlements)
      .values({
        organizationId: ctx.orgId,
        direction: isRec ? "in" : "out",
        accountId: account.id,
        method: data.method,
        methodNote: data.methodNote,
        settledOn: data.settledOn,
        amountCents: amount,
        bankTransactionId: data.bankTransactionId ?? null,
        notes: data.notes,
        idempotencyKey: data.idempotencyKey ?? null,
        createdBy: ctx.userId,
      })
      .returning({ id: settlements.id });
    settlementId = s!.id;
  } catch (err) {
    if (isUniqueViolation(err, "settlements_idem_uq")) throw new ConflictError("Esta baixa já foi registrada");
    throw err;
  }
  for (const a of data.allocations) {
    const t = titles.find((x) => x.id === a.titleId)!;
    await tx.insert(settlementAllocations).values({
      organizationId: ctx.orgId,
      settlementId,
      receivableId: isRec ? t.id : null,
      payableId: isRec ? null : t.id,
      principalCents: a.principalCents,
      interestCents: a.interestCents,
      fineCents: a.fineCents,
      discountCents: a.discountCents,
    });
    const next = {
      originalCents: t.originalCents,
      adjustmentCents: t.adjustmentCents,
      paidPrincipalCents: t.paidPrincipalCents + a.principalCents,
      discountGrantedCents: t.discountGrantedCents + a.discountCents,
    };
    const extra = isRec
      ? {
          interestReceivedCents: sql`${receivables.interestReceivedCents} + ${a.interestCents}`,
          fineReceivedCents: sql`${receivables.fineReceivedCents} + ${a.fineCents}`,
        }
      : {
          interestPaidCents: sql`${payables.interestPaidCents} + ${a.interestCents}`,
          finePaidCents: sql`${payables.finePaidCents} + ${a.fineCents}`,
        };
    // A restrição *_balance_ck no banco recusa qualquer baixa acima do saldo, mesmo concorrente.
    await tx
      .update(T)
      .set({
        paidPrincipalCents: sql`${T.paidPrincipalCents} + ${a.principalCents}`,
        discountGrantedCents: sql`${T.discountGrantedCents} + ${a.discountCents}`,
        ...extra,
        status: statusFor(next, false),
        updatedAt: new Date(),
        version: sql`${T.version} + 1`,
      } as never)
      .where(eq(T.id, t.id));
  }
  let movementId: string | null = null;
  if (amount > 0) {
    const single = titles.length === 1 ? titles[0]! : null;
    // Nome do paciente na descrição ajuda a casar com o extrato bancário.
    const singlePatientId = isRec && single ? (single as typeof receivables.$inferSelect).patientId : null;
    const [payer] = singlePatientId ? await tx.select({ name: patients.fullName }).from(patients).where(eq(patients.id, singlePatientId)) : [];
    const [m] = await tx
      .insert(accountMovements)
      .values({
        organizationId: ctx.orgId,
        accountId: account.id,
        occurredOn: data.settledOn,
        amountCents: isRec ? amount : -amount,
        kind: "settlement",
        settlementId,
        categoryId: single?.categoryId ?? null,
        description: single ? (payer ? `${single.description} — ${payer.name}` : single.description) : `${isRec ? "Recebimento" : "Pagamento"} de ${titles.length} títulos`,
        createdBy: ctx.userId,
      })
      .returning({ id: accountMovements.id });
    movementId = m!.id;
  }
  await audit(tx, ctx, {
    action: isRec ? "receivable.settle" : "payable.settle",
    entityType: "settlement",
    entityId: settlementId,
    summary: `${isRec ? "Recebimento" : "Pagamento"} de ${formatBRL(amount)} em ${account.name}`,
    changes: { titles: ids, amountCents: amount, method: data.method, settledOn: data.settledOn },
  });
  return { settlementId, movementId, amountCents: amount };
}

export async function settleTitles(ctx: Ctx, input: SettleInput) {
  assertCan(ctx, "finance.settle");
  return ctx.db.transaction((tx) => settleWithinTx(tx, ctx, input));
}

const reverseSchema = z.object({ settlementId: zId, reason: zRequiredText("Motivo do estorno", 300) });

/** Estorno cria movimento reverso e reabre o saldo; nunca apaga a baixa original. */
export async function reverseSettlement(ctx: Ctx, input: z.input<typeof reverseSchema>) {
  assertCan(ctx, "finance.reverse");
  const data = parseInput(reverseSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(settlements)
      .where(and(eq(settlements.organizationId, ctx.orgId), eq(settlements.id, data.settlementId)))
      .for("update");
    if (!s) throw new NotFoundError("Baixa");
    if (s.status === "reversed") throw new BusinessRuleError("Esta baixa já foi estornada");
    const movements = await tx
      .select()
      .from(accountMovements)
      .where(and(eq(accountMovements.organizationId, ctx.orgId), eq(accountMovements.settlementId, s.id), isNull(accountMovements.reversesMovementId)))
      .for("update");
    if (movements.some((m) => m.reconciledCents !== 0)) {
      throw new BusinessRuleError("Baixa conciliada com o extrato: desfaça a conciliação antes de estornar");
    }
    const [card] = await tx.select().from(cardTransactions).where(eq(cardTransactions.settlementId, s.id));
    if (card) {
      const settledCard = await tx
        .select({ id: cardReceivables.id })
        .from(cardReceivables)
        .where(and(eq(cardReceivables.cardTransactionId, card.id), inArray(cardReceivables.status, ["settled", "anticipated"])));
      if (settledCard.length > 0) throw new BusinessRuleError("A operadora já liquidou parte desta transação; trate a diferença com a operadora antes do estorno");
      await tx
        .update(cardReceivables)
        .set({ status: "cancelled" })
        .where(and(eq(cardReceivables.cardTransactionId, card.id), eq(cardReceivables.status, "pending")));
    }
    const allocations = await tx.select().from(settlementAllocations).where(eq(settlementAllocations.settlementId, s.id));
    for (const a of allocations) {
      const isRec = a.receivableId !== null;
      const T = isRec ? receivables : payables;
      const titleId = (a.receivableId ?? a.payableId)!;
      const [t] = await tx.select().from(T).where(eq(T.id, titleId)).for("update");
      const next = {
        originalCents: t!.originalCents,
        adjustmentCents: t!.adjustmentCents,
        paidPrincipalCents: t!.paidPrincipalCents - a.principalCents,
        discountGrantedCents: t!.discountGrantedCents - a.discountCents,
      };
      const extra = isRec
        ? {
            interestReceivedCents: sql`${receivables.interestReceivedCents} - ${a.interestCents}`,
            fineReceivedCents: sql`${receivables.fineReceivedCents} - ${a.fineCents}`,
          }
        : {
            interestPaidCents: sql`${payables.interestPaidCents} - ${a.interestCents}`,
            finePaidCents: sql`${payables.finePaidCents} - ${a.fineCents}`,
          };
      await tx
        .update(T)
        .set({
          paidPrincipalCents: next.paidPrincipalCents,
          discountGrantedCents: next.discountGrantedCents,
          ...extra,
          status: statusFor(next, false),
          updatedAt: new Date(),
          version: sql`${T.version} + 1`,
        } as never)
        .where(eq(T.id, titleId));
    }
    for (const m of movements) {
      await tx.insert(accountMovements).values({
        organizationId: ctx.orgId,
        accountId: m.accountId,
        occurredOn: todayInTz(ctx.timezone),
        amountCents: -m.amountCents,
        kind: "settlement_reversal",
        settlementId: s.id,
        reversesMovementId: m.id,
        categoryId: m.categoryId,
        description: `Estorno: ${m.description}`,
        createdBy: ctx.userId,
      });
    }
    await tx
      .update(settlements)
      .set({ status: "reversed", reversedAt: new Date(), reversedBy: ctx.userId, reversalReason: data.reason })
      .where(eq(settlements.id, s.id));
    await audit(tx, ctx, {
      action: "settlement.reverse",
      entityType: "settlement",
      entityId: s.id,
      summary: `Estorno de ${formatBRL(s.amountCents)}: ${data.reason}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Transferências entre contas próprias (não são receita nem despesa)
// ---------------------------------------------------------------------------

const transferSchema = z.object({
  fromAccountId: zId,
  toAccountId: zId,
  amountCents: zPositiveCents,
  occurredOn: zCivilDate,
  description: zOptionalText(300),
});

export async function createTransfer(ctx: Ctx, input: z.input<typeof transferSchema>) {
  assertCan(ctx, "finance.settle");
  const data = parseInput(transferSchema, input);
  if (data.fromAccountId === data.toAccountId) throw new ValidationError("Escolha contas diferentes");
  return ctx.db.transaction(async (tx) => {
    const from = await getAccount(tx, ctx.orgId, data.fromAccountId);
    const to = await getAccount(tx, ctx.orgId, data.toAccountId);
    const [t] = await tx
      .insert(transfers)
      .values({ organizationId: ctx.orgId, ...data, createdBy: ctx.userId })
      .returning({ id: transfers.id });
    const desc = data.description ?? `Transferência ${from.name} → ${to.name}`;
    await tx.insert(accountMovements).values([
      { organizationId: ctx.orgId, accountId: from.id, occurredOn: data.occurredOn, amountCents: -data.amountCents, kind: "transfer_out", transferId: t!.id, description: desc, createdBy: ctx.userId },
      { organizationId: ctx.orgId, accountId: to.id, occurredOn: data.occurredOn, amountCents: data.amountCents, kind: "transfer_in", transferId: t!.id, description: desc, createdBy: ctx.userId },
    ]);
    await audit(tx, ctx, { action: "transfer.create", entityType: "transfer", entityId: t!.id, summary: `${desc}: ${formatBRL(data.amountCents)}` });
    return { id: t!.id };
  });
}

export async function reverseTransfer(ctx: Ctx, transferId: string, reason: string) {
  assertCan(ctx, "finance.reverse");
  return ctx.db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(transfers)
      .where(and(eq(transfers.organizationId, ctx.orgId), eq(transfers.id, transferId)))
      .for("update");
    if (!t) throw new NotFoundError("Transferência");
    if (t.status === "reversed") throw new BusinessRuleError("Transferência já estornada");
    const movs = await tx
      .select()
      .from(accountMovements)
      .where(and(eq(accountMovements.transferId, t.id), isNull(accountMovements.reversesMovementId)))
      .for("update");
    if (movs.some((m) => m.reconciledCents !== 0)) throw new BusinessRuleError("Desfaça a conciliação antes de estornar a transferência");
    for (const m of movs) {
      await tx.insert(accountMovements).values({
        organizationId: ctx.orgId,
        accountId: m.accountId,
        occurredOn: todayInTz(ctx.timezone),
        amountCents: -m.amountCents,
        kind: "transfer_reversal",
        transferId: t.id,
        reversesMovementId: m.id,
        description: `Estorno: ${m.description}`,
        createdBy: ctx.userId,
      });
    }
    await tx.update(transfers).set({ status: "reversed", reversedAt: new Date(), reversedBy: ctx.userId }).where(eq(transfers.id, t.id));
    await audit(tx, ctx, { action: "transfer.reverse", entityType: "transfer", entityId: t.id, summary: `Transferência estornada: ${reason}` });
  });
}

// ---------------------------------------------------------------------------
// Cartões: quitação do paciente separada da liquidação pela operadora
// ---------------------------------------------------------------------------

const cardPaymentSchema = z.object({
  clearingAccountId: zId,
  acquirer: zRequiredText("Operadora", 80),
  brand: zOptionalText(40),
  paymentType: z.enum(["debit", "credit"]),
  installments: z.number().int().min(1).max(24).default(1),
  transactionDate: zCivilDate,
  feeCents: zCents,
  settlementDays: z.number().int().min(0).max(120).default(30),
  authorizationCode: zOptionalText(40),
  nsu: zOptionalText(40),
  allocations: z.array(settleAllocationSchema).min(1).max(50),
  idempotencyKey: z.string().min(8).max(100).nullish(),
});

/**
 * Registra a venda no cartão: o título do paciente é quitado (receita conta uma
 * vez, na conta de recebíveis da operadora) e nascem os recebíveis a liquidar.
 * O banco só é movimentado quando a operadora efetivamente paga.
 */
export async function recordCardPayment(ctx: Ctx, input: z.input<typeof cardPaymentSchema>) {
  assertCan(ctx, "finance.settle");
  const data = parseInput(cardPaymentSchema, input);
  return ctx.db.transaction(async (tx) => {
    const clearing = await getAccount(tx, ctx.orgId, data.clearingAccountId);
    if (clearing.kind !== "card_clearing") throw new ValidationError("Escolha uma conta do tipo recebíveis de cartão");
    if (data.idempotencyKey) {
      const [existing] = await tx
        .select({ id: settlements.id })
        .from(settlements)
        .where(and(eq(settlements.organizationId, ctx.orgId), eq(settlements.idempotencyKey, data.idempotencyKey)));
      if (existing) {
        const [card] = await tx.select({ id: cardTransactions.id }).from(cardTransactions).where(eq(cardTransactions.settlementId, existing.id));
        return { settlementId: existing.id, cardTransactionId: card?.id ?? null };
      }
    }
    const settled = await settleWithinTx(
      tx,
      ctx,
      {
        kind: "receivable",
        accountId: clearing.id,
        method: data.paymentType,
        settledOn: data.transactionDate,
        allocations: data.allocations,
        idempotencyKey: data.idempotencyKey,
        notes: `Cartão ${data.acquirer}${data.brand ? ` ${data.brand}` : ""} ${data.installments}x`,
      },
      { allowCardMethod: true },
    );
    const gross = settled.amountCents;
    if (gross <= 0) throw new ValidationError("Valor da transação de cartão deve ser positivo");
    if (data.feeCents > gross) throw new ValidationError("Taxa maior que o valor bruto");
    const [card] = await tx
      .insert(cardTransactions)
      .values({
        organizationId: ctx.orgId,
        settlementId: settled.settlementId,
        clearingAccountId: clearing.id,
        acquirer: data.acquirer,
        brand: data.brand,
        paymentType: data.paymentType,
        installments: data.installments,
        grossCents: gross,
        feeCents: data.feeCents,
        netCents: gross - data.feeCents,
        authorizationCode: data.authorizationCode,
        nsu: data.nsu,
        transactionDate: data.transactionDate,
      })
      .returning({ id: cardTransactions.id });
    const grossParts = splitEvenly(gross, data.installments);
    const feeParts = prorate(data.feeCents, grossParts);
    await tx.insert(cardReceivables).values(
      grossParts.map((g, i) => ({
        organizationId: ctx.orgId,
        cardTransactionId: card!.id,
        installmentNumber: i + 1,
        // Convenção das operadoras: D+N para a 1ª e +30 dias por parcela seguinte.
        expectedDate: addDays(data.transactionDate, data.settlementDays + 30 * i),
        grossCents: g,
        feeCents: feeParts[i]!,
        netCents: g - feeParts[i]!,
      })),
    );
    await audit(tx, ctx, {
      action: "card.record",
      entityType: "card_transaction",
      entityId: card!.id,
      summary: `Cartão ${data.paymentType === "credit" ? "crédito" : "débito"} ${data.installments}x: bruto ${formatBRL(gross)}, taxa ${formatBRL(data.feeCents)}`,
    });
    return { settlementId: settled.settlementId, cardTransactionId: card!.id };
  });
}

export async function listCardReceivables(ctx: Ctx, opts: { status?: "pending" | "all" } = {}) {
  assertCan(ctx, "finance.view");
  return ctx.db
    .select({ receivable: cardReceivables, tx: cardTransactions })
    .from(cardReceivables)
    .innerJoin(cardTransactions, eq(cardTransactions.id, cardReceivables.cardTransactionId))
    .where(and(eq(cardReceivables.organizationId, ctx.orgId), opts.status === "all" ? undefined : eq(cardReceivables.status, "pending")))
    .orderBy(asc(cardReceivables.expectedDate));
}

const cardSettleSchema = z.object({
  cardReceivableId: zId,
  bankAccountId: zId,
  settledOn: zCivilDate,
  anticipationFeeCents: zCents.default(0),
});

/** Liquidação pela operadora: transfere o líquido ao banco e registra taxas como despesa. */
export async function settleCardReceivable(ctx: Ctx, input: z.input<typeof cardSettleSchema>) {
  assertCan(ctx, "finance.settle");
  const data = parseInput(cardSettleSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .select({ r: cardReceivables, t: cardTransactions })
      .from(cardReceivables)
      .innerJoin(cardTransactions, eq(cardTransactions.id, cardReceivables.cardTransactionId))
      .where(and(eq(cardReceivables.organizationId, ctx.orgId), eq(cardReceivables.id, data.cardReceivableId)))
      .for("update");
    if (!row) throw new NotFoundError("Recebível de cartão");
    if (row.r.status !== "pending") throw new BusinessRuleError("Recebível já liquidado ou cancelado");
    const bank = await getAccount(tx, ctx.orgId, data.bankAccountId);
    if (bank.kind === "card_clearing") throw new ValidationError("Escolha a conta bancária que recebeu o valor");
    if (data.anticipationFeeCents > row.r.netCents) throw new ValidationError("Encargo de antecipação maior que o líquido");
    const toBank = row.r.netCents - data.anticipationFeeCents;
    const anticipated = compareCivil(data.settledOn, row.r.expectedDate) < 0 && data.anticipationFeeCents > 0;
    const feeCat = await systemCategoryId(tx, ctx.orgId, "card_fees");
    const antCat = await systemCategoryId(tx, ctx.orgId, "card_anticipation");
    const label = `Cartão ${row.t.acquirer} parcela ${row.r.installmentNumber}/${row.t.installments}`;
    const movs: (typeof accountMovements.$inferInsert)[] = [];
    if (toBank > 0) {
      movs.push(
        { organizationId: ctx.orgId, accountId: row.t.clearingAccountId, occurredOn: data.settledOn, amountCents: -toBank, kind: "card_settlement_out", cardReceivableId: row.r.id, description: `${label} — repasse`, createdBy: ctx.userId },
        { organizationId: ctx.orgId, accountId: bank.id, occurredOn: data.settledOn, amountCents: toBank, kind: "card_settlement_in", cardReceivableId: row.r.id, description: `${label} — repasse`, createdBy: ctx.userId },
      );
    }
    if (row.r.feeCents > 0) {
      movs.push({ organizationId: ctx.orgId, accountId: row.t.clearingAccountId, occurredOn: data.settledOn, amountCents: -row.r.feeCents, kind: "card_fee", cardReceivableId: row.r.id, categoryId: feeCat, description: `${label} — taxa`, createdBy: ctx.userId });
    }
    if (data.anticipationFeeCents > 0) {
      movs.push({ organizationId: ctx.orgId, accountId: row.t.clearingAccountId, occurredOn: data.settledOn, amountCents: -data.anticipationFeeCents, kind: "card_anticipation_fee", cardReceivableId: row.r.id, categoryId: antCat, description: `${label} — encargo de antecipação`, createdBy: ctx.userId });
    }
    if (movs.length > 0) await tx.insert(accountMovements).values(movs);
    await tx
      .update(cardReceivables)
      .set({
        status: anticipated ? "anticipated" : "settled",
        settledOn: data.settledOn,
        bankAccountId: bank.id,
        anticipationFeeCents: data.anticipationFeeCents,
        settledBy: ctx.userId,
        settledAt: new Date(),
      })
      .where(eq(cardReceivables.id, row.r.id));
    await audit(tx, ctx, {
      action: "card.settle",
      entityType: "card_receivable",
      entityId: row.r.id,
      summary: `${label}: ${formatBRL(toBank)} em ${bank.name}`,
      changes: { grossCents: row.r.grossCents, feeCents: row.r.feeCents, anticipationFeeCents: data.anticipationFeeCents },
    });
  });
}

// ---------------------------------------------------------------------------
// Extrato interno de uma conta
// ---------------------------------------------------------------------------

export async function listMovements(ctx: Ctx, opts: { accountId?: string; from: CivilDate; to: CivilDate }) {
  assertCanAny(ctx, "finance.view");
  return ctx.db
    .select({ movement: accountMovements, accountName: financialAccounts.name, categoryName: financialCategories.name })
    .from(accountMovements)
    .innerJoin(financialAccounts, eq(financialAccounts.id, accountMovements.accountId))
    .leftJoin(financialCategories, eq(financialCategories.id, accountMovements.categoryId))
    .where(
      and(
        eq(accountMovements.organizationId, ctx.orgId),
        opts.accountId ? eq(accountMovements.accountId, opts.accountId) : undefined,
        gte(accountMovements.occurredOn, opts.from),
        lte(accountMovements.occurredOn, opts.to),
      ),
    )
    .orderBy(desc(accountMovements.occurredOn), desc(accountMovements.createdAt));
}

export type { PaymentMethod };

/** Resumo financeiro do paciente (somente com permissão financeira). */
export async function patientFinancialSummary(ctx: Ctx, patientId: string) {
  assertCan(ctx, "finance.view");
  const today = todayInTz(ctx.timezone);
  const rows = await ctx.db
    .select()
    .from(receivables)
    .where(and(eq(receivables.organizationId, ctx.orgId), eq(receivables.patientId, patientId)))
    .orderBy(asc(receivables.dueDate), asc(receivables.createdAt));
  const open = rows.filter((r) => r.status === "open" || r.status === "partial");
  const received = await ctx.db
    .select({ v: sql<string>`coalesce(sum(${settlementAllocations.principalCents} + ${settlementAllocations.interestCents} + ${settlementAllocations.fineCents}), 0)` })
    .from(settlementAllocations)
    .innerJoin(settlements, eq(settlements.id, settlementAllocations.settlementId))
    .innerJoin(receivables, eq(receivables.id, settlementAllocations.receivableId))
    .where(and(eq(settlementAllocations.organizationId, ctx.orgId), eq(receivables.patientId, patientId), eq(settlements.status, "active")));
  return {
    titles: rows.map((r) => ({ ...r, balanceCents: titleBalance(r), overdue: (r.status === "open" || r.status === "partial") && r.dueDate < today })),
    openCents: open.reduce((s, r) => s + titleBalance(r), 0),
    overdueCents: open.filter((r) => r.dueDate < today).reduce((s, r) => s + titleBalance(r), 0),
    receivedCents: Number(received[0]?.v ?? 0),
    nextDue: open[0] ? { dueDate: open[0].dueDate, balanceCents: titleBalance(open[0]) } : null,
  };
}

export async function listSettlementsForTitles(ctx: Ctx, titleIds: string[]) {
  assertCan(ctx, "finance.view");
  if (titleIds.length === 0) return [];
  return ctx.db
    .select({ allocation: settlementAllocations, settlement: settlements, accountName: financialAccounts.name })
    .from(settlementAllocations)
    .innerJoin(settlements, eq(settlements.id, settlementAllocations.settlementId))
    .innerJoin(financialAccounts, eq(financialAccounts.id, settlements.accountId))
    .where(and(eq(settlementAllocations.organizationId, ctx.orgId), inArray(settlementAllocations.receivableId, titleIds)))
    .orderBy(desc(settlements.settledOn));
}
