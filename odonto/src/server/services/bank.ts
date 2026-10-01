import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { addDays, compareCivil, type CivilDate } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { decodeOfx, maskAccount, OfxParseError, parseOfx, transactionFingerprint } from "@/domain/ofx";
import { suggestMatches, validateAllocations, type MatchSuggestion } from "@/domain/reconciliation";
import { audit } from "../audit";
import { assertCan, type Ctx } from "../context";
import type { Tx } from "../db/client";
import {
  accountMovements,
  bankImportBatches,
  bankTransactions,
  financialAccounts,
  reconciliationAllocations,
  reconciliations,
  settlements,
} from "../db/schema";
import { BusinessRuleError, NotFoundError, ValidationError } from "../errors";
import { parseInput, zCivilDate, zId, zOptionalText, zRequiredText } from "../validation";
import { accountBalance, getAccount } from "./finance-setup";
import { createReceivable, settleWithinTx, type SettleInput } from "./titles";
import { payables } from "../db/schema";

// ---------------------------------------------------------------------------
// Importação OFX
// ---------------------------------------------------------------------------

export type PreviewClass = "new" | "duplicate_external_id" | "probable_duplicate" | "identical_in_file";

export interface PreviewLine {
  index: number;
  externalId: string | null;
  postedOn: CivilDate;
  amountCents: number;
  description: string;
  memo: string | null;
  trnType: string | null;
  checkNumber: string | null;
  fingerprint: string;
  occurrenceIndex: number;
  classification: PreviewClass;
  note: string | null;
}

const MAX_OFX_BYTES = 5 * 1024 * 1024;

export async function previewOfxImport(ctx: Ctx, input: { accountId: string; fileName: string; bytes: Uint8Array }) {
  assertCan(ctx, "finance.reconcile");
  if (input.bytes.byteLength === 0) throw new ValidationError("Arquivo vazio");
  if (input.bytes.byteLength > MAX_OFX_BYTES) throw new ValidationError("Arquivo OFX acima de 5 MB");
  const account = await getAccount(ctx.db, ctx.orgId, input.accountId);
  if (account.kind === "card_clearing") throw new ValidationError("Extratos bancários são importados em contas bancárias ou caixa");
  let statement;
  try {
    statement = parseOfx(decodeOfx(input.bytes));
  } catch (err) {
    if (err instanceof OfxParseError) throw new ValidationError(`Não foi possível ler o OFX: ${err.message}`);
    throw err;
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  if (statement.currency && statement.currency.toUpperCase() !== "BRL") errors.push(`Moeda do extrato (${statement.currency}) diferente de BRL`);
  if (statement.transactions.length === 0) errors.push("O arquivo não contém transações");
  const fileAcct = statement.accountId?.replace(/\D/g, "") ?? "";
  const known = account.accountNumberMasked?.replace(/\D/g, "") ?? "";
  if (fileAcct && known && !fileAcct.endsWith(known.slice(-4))) {
    warnings.push(`A conta do arquivo (${maskAccount(statement.accountId)}) parece diferente da conta selecionada (${account.accountNumberMasked})`);
  }
  if (statement.bankId && account.bankCode && statement.bankId.replace(/^0+/, "") !== account.bankCode.replace(/^0+/, "")) {
    warnings.push(`Banco do arquivo (${statement.bankId}) diferente do banco da conta (${account.bankCode})`);
  }
  for (const t of statement.transactions) {
    if (statement.periodStart && compareCivil(t.postedOn, statement.periodStart) < 0) {
      warnings.push("Há transações com data anterior ao início do período informado no arquivo");
      break;
    }
  }
  const sha = createHash("sha256").update(input.bytes).digest("hex");
  const [sameFile] = await ctx.db
    .select({ id: bankImportBatches.id })
    .from(bankImportBatches)
    .where(and(eq(bankImportBatches.organizationId, ctx.orgId), eq(bankImportBatches.accountId, account.id), eq(bankImportBatches.fileSha256, sha), eq(bankImportBatches.status, "confirmed")));
  if (sameFile) warnings.push("Este mesmo arquivo já foi importado nesta conta; apenas movimentações novas serão incluídas");

  // Classificação de duplicidade
  const accountKey = account.id;
  const externalIds = statement.transactions.map((t) => t.externalId).filter((v): v is string => Boolean(v));
  const existingExternal = externalIds.length
    ? await ctx.db
        .select({ externalId: bankTransactions.externalId })
        .from(bankTransactions)
        .where(and(eq(bankTransactions.accountId, account.id), inArray(bankTransactions.externalId, externalIds)))
    : [];
  const externalSet = new Set(existingExternal.map((e) => e.externalId));
  const fingerprints = statement.transactions.map((t) => transactionFingerprint(accountKey, t));
  const existingFp = fingerprints.length
    ? await ctx.db
        .select({ fingerprint: bankTransactions.fingerprint, n: sql<number>`count(*)::int` })
        .from(bankTransactions)
        .where(and(eq(bankTransactions.accountId, account.id), sql`${bankTransactions.externalId} is null`, inArray(bankTransactions.fingerprint, fingerprints)))
        .groupBy(bankTransactions.fingerprint)
    : [];
  const existingCount = new Map(existingFp.map((e) => [e.fingerprint, e.n]));
  const fileCount = new Map<string, number>();
  for (const fp of fingerprints) fileCount.set(fp, (fileCount.get(fp) ?? 0) + 1);
  const seenInFile = new Map<string, number>();
  const seenExternal = new Set<string>();
  const lines: PreviewLine[] = statement.transactions.map((t, index) => {
    const fp = fingerprints[index]!;
    const occ = seenInFile.get(fp) ?? 0;
    seenInFile.set(fp, occ + 1);
    let classification: PreviewClass = "new";
    let note: string | null = null;
    if (t.externalId) {
      if (externalSet.has(t.externalId) || seenExternal.has(t.externalId)) {
        classification = "duplicate_external_id";
        note = "Identificador do banco já importado";
      }
      seenExternal.add(t.externalId);
    } else if (occ < (existingCount.get(fp) ?? 0)) {
      classification = "probable_duplicate";
      note = "Sem identificador do banco: igual a uma movimentação já importada";
    } else if ((fileCount.get(fp) ?? 0) > 1) {
      classification = "identical_in_file";
      note = "Movimentações idênticas no arquivo, sem identificador do banco: confira se são reais";
    }
    return {
      index,
      externalId: t.externalId,
      postedOn: t.postedOn,
      amountCents: t.amountCents,
      description: [t.name, t.memo].filter(Boolean).join(" — ") || t.trnType || "Movimentação",
      memo: t.memo,
      trnType: t.trnType,
      checkNumber: t.checkNumber,
      fingerprint: fp,
      occurrenceIndex: occ,
      classification,
      note,
    };
  });
  const counts = {
    total: lines.length,
    new: lines.filter((l) => l.classification === "new" || l.classification === "identical_in_file").length,
    duplicate: lines.filter((l) => l.classification === "duplicate_external_id" || l.classification === "probable_duplicate").length,
    ambiguous: lines.filter((l) => l.classification === "identical_in_file" || l.classification === "probable_duplicate").length,
  };
  const [batch] = await ctx.db
    .insert(bankImportBatches)
    .values({
      organizationId: ctx.orgId,
      accountId: account.id,
      fileName: input.fileName.slice(0, 200),
      fileSha256: sha,
      bankId: statement.bankId,
      accountRefMasked: maskAccount(statement.accountId),
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      ledgerBalanceCents: statement.ledgerBalanceCents,
      ledgerBalanceDate: statement.ledgerBalanceDate,
      totalCount: counts.total,
      newCount: counts.new,
      duplicateCount: counts.duplicate,
      ambiguousCount: counts.ambiguous,
      preview: { lines, errors },
      warnings,
      createdBy: ctx.userId,
    })
    .returning({ id: bankImportBatches.id });
  return { batchId: batch!.id, lines, errors, warnings, counts, statement: { ...statement, transactions: undefined } };
}

export async function getImportBatch(ctx: Ctx, batchId: string) {
  assertCan(ctx, "finance.reconcile");
  const [batch] = await ctx.db
    .select()
    .from(bankImportBatches)
    .where(and(eq(bankImportBatches.organizationId, ctx.orgId), eq(bankImportBatches.id, batchId)));
  if (!batch) throw new NotFoundError("Importação");
  const preview = (batch.preview ?? { lines: [], errors: [] }) as { lines: PreviewLine[]; errors: string[] };
  return { batch, lines: preview.lines, errors: preview.errors, warnings: batch.warnings ?? [] };
}

const confirmSchema = z.object({
  batchId: zId,
  /** Linhas "provável duplicata" que o usuário confirmou serem movimentações reais distintas. */
  forceLineIndexes: z.array(z.number().int().min(0)).default([]),
  acknowledgeWarnings: z.boolean().default(false),
});

/** Confirma a importação. Cria extrato (não receitas). Reconfirmar é inofensivo. */
export async function confirmOfxImport(ctx: Ctx, input: z.input<typeof confirmSchema>) {
  assertCan(ctx, "finance.reconcile");
  const data = parseInput(confirmSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [batch] = await tx
      .select()
      .from(bankImportBatches)
      .where(and(eq(bankImportBatches.organizationId, ctx.orgId), eq(bankImportBatches.id, data.batchId)))
      .for("update");
    if (!batch) throw new NotFoundError("Importação");
    if (batch.status === "confirmed") return { inserted: 0, skipped: batch.totalCount, alreadyConfirmed: true };
    if (batch.status !== "preview") throw new BusinessRuleError("Importação descartada");
    const preview = batch.preview as { lines: PreviewLine[]; errors: string[] };
    if (preview.errors.length > 0) throw new BusinessRuleError(`Corrija os erros do arquivo: ${preview.errors.join("; ")}`);
    if ((batch.warnings?.length ?? 0) > 0 && !data.acknowledgeWarnings) {
      throw new BusinessRuleError("Confirme que revisou os avisos da importação");
    }
    const force = new Set(data.forceLineIndexes);
    let inserted = 0;
    let skipped = 0;
    // Serializa importações da mesma conta para numerar ocorrências sem colisão.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`bank-import:${batch.accountId}`}))`);
    for (const line of preview.lines) {
      if (line.classification === "duplicate_external_id") {
        skipped++;
        continue;
      }
      let occurrence = line.occurrenceIndex;
      if (line.classification === "probable_duplicate") {
        if (!force.has(line.index)) {
          skipped++;
          continue;
        }
        const [mx] = await tx
          .select({ m: sql<number>`coalesce(max(${bankTransactions.occurrenceIndex}) + 1, 0)::int` })
          .from(bankTransactions)
          .where(and(eq(bankTransactions.accountId, batch.accountId), eq(bankTransactions.fingerprint, line.fingerprint), sql`${bankTransactions.externalId} is null`));
        occurrence = mx?.m ?? 0;
      }
      const rows = await tx
        .insert(bankTransactions)
        .values({
          organizationId: ctx.orgId,
          accountId: batch.accountId,
          batchId: batch.id,
          externalId: line.externalId,
          fingerprint: line.fingerprint,
          occurrenceIndex: line.externalId ? 0 : occurrence,
          postedOn: line.postedOn,
          amountCents: line.amountCents,
          description: line.description.slice(0, 500),
          memo: line.memo,
          trnType: line.trnType,
          checkNumber: line.checkNumber,
          ambiguous: line.classification !== "new",
        })
        .onConflictDoNothing()
        .returning({ id: bankTransactions.id });
      if (rows.length > 0) inserted++;
      else skipped++;
    }
    await tx
      .update(bankImportBatches)
      .set({ status: "confirmed", confirmedAt: new Date(), confirmedBy: ctx.userId, newCount: inserted, duplicateCount: skipped })
      .where(eq(bankImportBatches.id, batch.id));
    await audit(tx, ctx, {
      action: "bank_import.confirm",
      entityType: "bank_import_batch",
      entityId: batch.id,
      summary: `Extrato importado: ${inserted} nova(s), ${skipped} ignorada(s) por duplicidade`,
    });
    return { inserted, skipped, alreadyConfirmed: false };
  });
}

export async function discardOfxImport(ctx: Ctx, batchId: string) {
  assertCan(ctx, "finance.reconcile");
  await ctx.db
    .update(bankImportBatches)
    .set({ status: "discarded" })
    .where(and(eq(bankImportBatches.organizationId, ctx.orgId), eq(bankImportBatches.id, batchId), eq(bankImportBatches.status, "preview")));
}

export async function listImportBatches(ctx: Ctx, accountId?: string) {
  assertCan(ctx, "finance.reconcile");
  return ctx.db
    .select({ batch: bankImportBatches, accountName: financialAccounts.name })
    .from(bankImportBatches)
    .innerJoin(financialAccounts, eq(financialAccounts.id, bankImportBatches.accountId))
    .where(and(eq(bankImportBatches.organizationId, ctx.orgId), accountId ? eq(bankImportBatches.accountId, accountId) : undefined))
    .orderBy(desc(bankImportBatches.createdAt))
    .limit(50);
}

// ---------------------------------------------------------------------------
// Conciliação
// ---------------------------------------------------------------------------

const workspaceSchema = z.object({
  accountId: zId,
  from: zCivilDate,
  to: zCivilDate,
  status: z.enum(["pending", "reconciled", "ignored", "all"]).default("pending"),
});

export async function reconciliationWorkspace(ctx: Ctx, input: z.input<typeof workspaceSchema>) {
  assertCan(ctx, "finance.reconcile");
  const data = parseInput(workspaceSchema, input);
  const account = await getAccount(ctx.db, ctx.orgId, data.accountId);
  const bankRows = await ctx.db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.organizationId, ctx.orgId),
        eq(bankTransactions.accountId, account.id),
        gte(bankTransactions.postedOn, data.from),
        lte(bankTransactions.postedOn, data.to),
        data.status === "all" ? undefined : eq(bankTransactions.status, data.status),
      ),
    )
    .orderBy(asc(bankTransactions.postedOn), asc(bankTransactions.createdAt));
  // Lançamentos internos com folga de 10 dias para sugestões.
  const movementRows = await ctx.db
    .select()
    .from(accountMovements)
    .where(
      and(
        eq(accountMovements.organizationId, ctx.orgId),
        eq(accountMovements.accountId, account.id),
        gte(accountMovements.occurredOn, addDays(data.from, -10)),
        lte(accountMovements.occurredOn, addDays(data.to, 10)),
      ),
    )
    .orderBy(asc(accountMovements.occurredOn), asc(accountMovements.createdAt));
  const openMovements = movementRows.filter((m) => m.reconciledCents !== m.amountCents);
  const candidates = openMovements.map((m) => ({
    id: m.id,
    occurredOn: m.occurredOn,
    openAmountCents: m.amountCents - m.reconciledCents,
    description: m.description,
  }));
  const bank = bankRows.map((b) => {
    const open = b.amountCents - b.reconciledCents;
    const suggestions: MatchSuggestion[] =
      b.status === "pending" && open !== 0 ? suggestMatches({ id: b.id, postedOn: b.postedOn, openAmountCents: open, description: b.description }, candidates, 3) : [];
    return { ...b, openAmountCents: open, suggestions };
  });
  const allocs = bankRows.length
    ? await ctx.db
        .select({ allocation: reconciliationAllocations, reconciliation: reconciliations })
        .from(reconciliationAllocations)
        .innerJoin(reconciliations, eq(reconciliations.id, reconciliationAllocations.reconciliationId))
        .where(
          and(
            eq(reconciliationAllocations.organizationId, ctx.orgId),
            inArray(
              reconciliationAllocations.bankTransactionId,
              bankRows.map((b) => b.id),
            ),
          ),
        )
    : [];
  // Saldo bancário conhecido: último saldo informado em extrato confirmado (nunca inventado).
  const [lastBatch] = await ctx.db
    .select({ ledgerBalanceCents: bankImportBatches.ledgerBalanceCents, ledgerBalanceDate: bankImportBatches.ledgerBalanceDate })
    .from(bankImportBatches)
    .where(
      and(
        eq(bankImportBatches.organizationId, ctx.orgId),
        eq(bankImportBatches.accountId, account.id),
        eq(bankImportBatches.status, "confirmed"),
        sql`${bankImportBatches.ledgerBalanceCents} is not null`,
      ),
    )
    .orderBy(desc(bankImportBatches.ledgerBalanceDate))
    .limit(1);
  const bankKnown = lastBatch?.ledgerBalanceDate
    ? {
        date: lastBatch.ledgerBalanceDate,
        bankBalanceCents: lastBatch.ledgerBalanceCents!,
        internalBalanceCents: await accountBalance(ctx.db, ctx.orgId, account.id, lastBatch.ledgerBalanceDate),
      }
    : null;
  return {
    account,
    bank,
    movements: movementRows.map((m) => ({ ...m, openAmountCents: m.amountCents - m.reconciledCents })),
    allocations: allocs,
    bankKnown,
    counts: {
      pending: bankRows.filter((b) => b.status === "pending").length,
      unreconciledMovements: openMovements.length,
    },
  };
}

const allocationSchema = z.object({
  bankTransactionId: zId,
  movementId: zId,
  amountCents: z.number().int().refine((v) => v !== 0, { message: "Valor da alocação inválido" }),
});

const reconcileSchema = z.object({
  accountId: zId,
  allocations: z.array(allocationSchema).min(1).max(100),
  note: zOptionalText(500),
});

/** Vincula extrato ↔ lançamentos já existentes. Não cria receita nem nova baixa. */
export async function reconcileWithinTx(tx: Tx, ctx: Ctx, input: z.input<typeof reconcileSchema>) {
  const data = parseInput(reconcileSchema, input);
  const bankIds = [...new Set(data.allocations.map((a) => a.bankTransactionId))].sort();
  const movIds = [...new Set(data.allocations.map((a) => a.movementId))].sort();
  const bankRows = await tx
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, ctx.orgId), inArray(bankTransactions.id, bankIds)))
    .orderBy(asc(bankTransactions.id))
    .for("update");
  const movRows = await tx
    .select()
    .from(accountMovements)
    .where(and(eq(accountMovements.organizationId, ctx.orgId), inArray(accountMovements.id, movIds)))
    .orderBy(asc(accountMovements.id))
    .for("update");
  if (bankRows.length !== bankIds.length) throw new NotFoundError("Movimentação bancária");
  if (movRows.length !== movIds.length) throw new NotFoundError("Lançamento interno");
  if ([...bankRows, ...movRows].some((r) => r.accountId !== data.accountId)) {
    throw new ValidationError("Extrato e lançamentos precisam ser da mesma conta");
  }
  if (bankRows.some((b) => b.status === "ignored")) throw new BusinessRuleError("Movimentação ignorada: reative-a antes de conciliar");
  const errors = validateAllocations(
    new Map(bankRows.map((b) => [b.id, b.amountCents - b.reconciledCents])),
    new Map(movRows.map((m) => [m.id, m.amountCents - m.reconciledCents])),
    data.allocations,
  );
  if (errors.length > 0) throw new BusinessRuleError(errors.join("; "));
  const [rec] = await tx
    .insert(reconciliations)
    .values({ organizationId: ctx.orgId, accountId: data.accountId, note: data.note, createdBy: ctx.userId })
    .returning({ id: reconciliations.id });
  await tx.insert(reconciliationAllocations).values(data.allocations.map((a) => ({ organizationId: ctx.orgId, reconciliationId: rec!.id, ...a })));
  for (const b of bankRows) {
    const add = data.allocations.filter((a) => a.bankTransactionId === b.id).reduce((s, a) => s + a.amountCents, 0);
    const reconciled = b.reconciledCents + add;
    // Restrição bank_tx_reconciled_ck recusa excesso mesmo sob concorrência.
    await tx
      .update(bankTransactions)
      .set({ reconciledCents: reconciled, status: reconciled === b.amountCents ? "reconciled" : "pending" })
      .where(eq(bankTransactions.id, b.id));
  }
  for (const m of movRows) {
    const add = data.allocations.filter((a) => a.movementId === m.id).reduce((s, a) => s + a.amountCents, 0);
    await tx.update(accountMovements).set({ reconciledCents: m.reconciledCents + add }).where(eq(accountMovements.id, m.id));
  }
  await audit(tx, ctx, {
    action: "reconciliation.create",
    entityType: "reconciliation",
    entityId: rec!.id,
    summary: `Conciliação de ${bankIds.length} movimentação(ões) bancária(s) com ${movIds.length} lançamento(s)`,
    changes: { allocations: data.allocations.length },
  });
  return { reconciliationId: rec!.id };
}

export async function reconcile(ctx: Ctx, input: z.input<typeof reconcileSchema>) {
  assertCan(ctx, "finance.reconcile");
  return ctx.db.transaction((tx) => reconcileWithinTx(tx, ctx, input));
}

const undoSchema = z.object({ reconciliationId: zId, reason: zRequiredText("Motivo", 300) });

/** Remove o vínculo preservando a trilha. Não estorna a baixa (ação separada). */
export async function undoReconciliation(ctx: Ctx, input: z.input<typeof undoSchema>) {
  assertCan(ctx, "finance.reconcile");
  const data = parseInput(undoSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [rec] = await tx
      .select()
      .from(reconciliations)
      .where(and(eq(reconciliations.organizationId, ctx.orgId), eq(reconciliations.id, data.reconciliationId)))
      .for("update");
    if (!rec) throw new NotFoundError("Conciliação");
    if (rec.status === "undone") throw new BusinessRuleError("Conciliação já desfeita");
    const allocs = await tx.select().from(reconciliationAllocations).where(eq(reconciliationAllocations.reconciliationId, rec.id));
    const bankIds = [...new Set(allocs.map((a) => a.bankTransactionId))].sort();
    const movIds = [...new Set(allocs.map((a) => a.movementId))].sort();
    const bankRows = await tx.select().from(bankTransactions).where(inArray(bankTransactions.id, bankIds)).orderBy(asc(bankTransactions.id)).for("update");
    const movRows = await tx.select().from(accountMovements).where(inArray(accountMovements.id, movIds)).orderBy(asc(accountMovements.id)).for("update");
    for (const b of bankRows) {
      const sub = allocs.filter((a) => a.bankTransactionId === b.id).reduce((s, a) => s + a.amountCents, 0);
      await tx.update(bankTransactions).set({ reconciledCents: b.reconciledCents - sub, status: "pending" }).where(eq(bankTransactions.id, b.id));
    }
    for (const m of movRows) {
      const sub = allocs.filter((a) => a.movementId === m.id).reduce((s, a) => s + a.amountCents, 0);
      await tx.update(accountMovements).set({ reconciledCents: m.reconciledCents - sub }).where(eq(accountMovements.id, m.id));
    }
    await tx
      .update(reconciliations)
      .set({ status: "undone", undoneAt: new Date(), undoneBy: ctx.userId, undoReason: data.reason })
      .where(eq(reconciliations.id, rec.id));
    await audit(tx, ctx, { action: "reconciliation.undo", entityType: "reconciliation", entityId: rec.id, summary: `Conciliação desfeita: ${data.reason}` });
  });
}

/** Desfaz a conciliação ativa que envolve uma movimentação bancária. */
export async function activeReconciliationsFor(ctx: Ctx, bankTransactionId: string) {
  return ctx.db
    .selectDistinct({ id: reconciliations.id })
    .from(reconciliations)
    .innerJoin(reconciliationAllocations, eq(reconciliationAllocations.reconciliationId, reconciliations.id))
    .where(and(eq(reconciliations.organizationId, ctx.orgId), eq(reconciliations.status, "active"), eq(reconciliationAllocations.bankTransactionId, bankTransactionId)));
}

const ignoreSchema = z.object({ bankTransactionId: zId, reason: zRequiredText("Justificativa", 300) });

/** Ignorar não apaga o extrato nem elimina a divergência de saldo. */
export async function ignoreBankTransaction(ctx: Ctx, input: z.input<typeof ignoreSchema>) {
  assertCan(ctx, "finance.reconcile");
  const data = parseInput(ignoreSchema, input);
  const [row] = await ctx.db
    .update(bankTransactions)
    .set({ status: "ignored", ignoreReason: data.reason, ignoredBy: ctx.userId, ignoredAt: new Date() })
    .where(
      and(
        eq(bankTransactions.organizationId, ctx.orgId),
        eq(bankTransactions.id, data.bankTransactionId),
        eq(bankTransactions.status, "pending"),
        eq(bankTransactions.reconciledCents, 0),
      ),
    )
    .returning({ id: bankTransactions.id });
  if (!row) throw new BusinessRuleError("Somente movimentações pendentes e sem vínculo podem ser ignoradas");
  await audit(ctx.db, ctx, { action: "bank_tx.ignore", entityType: "bank_transaction", entityId: row.id, summary: `Movimentação ignorada: ${data.reason}` });
}

export async function unignoreBankTransaction(ctx: Ctx, bankTransactionId: string) {
  assertCan(ctx, "finance.reconcile");
  await ctx.db
    .update(bankTransactions)
    .set({ status: "pending", ignoreReason: null, ignoredBy: null, ignoredAt: null })
    .where(and(eq(bankTransactions.organizationId, ctx.orgId), eq(bankTransactions.id, bankTransactionId), eq(bankTransactions.status, "ignored")));
  await audit(ctx.db, ctx, { action: "bank_tx.unignore", entityType: "bank_transaction", entityId: bankTransactionId, summary: "Movimentação reativada para conciliação" });
}

async function loadBankTx(tx: Tx, ctx: Ctx, id: string) {
  const [b] = await tx
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, ctx.orgId), eq(bankTransactions.id, id)))
    .for("update");
  if (!b) throw new NotFoundError("Movimentação bancária");
  if (b.status !== "pending") throw new BusinessRuleError("Movimentação já conciliada ou ignorada");
  return b;
}

const settleFromBankSchema = z.object({
  bankTransactionId: zId,
  method: z.enum(["pix", "cash", "boleto", "transfer", "other"]),
  methodNote: zOptionalText(120),
  allocations: z
    .array(
      z.object({
        titleId: zId,
        principalCents: z.number().int().min(0),
        interestCents: z.number().int().min(0).default(0),
        fineCents: z.number().int().min(0).default(0),
        discountCents: z.number().int().min(0).default(0),
      }),
    )
    .min(1),
});

/** Dá baixa em títulos em aberto a partir do extrato (com confirmação na interface) e concilia. */
export async function settleFromBankTransaction(ctx: Ctx, input: z.input<typeof settleFromBankSchema>) {
  assertCan(ctx, "finance.reconcile");
  assertCan(ctx, "finance.settle");
  const data = parseInput(settleFromBankSchema, input);
  return ctx.db.transaction(async (tx) => {
    const b = await loadBankTx(tx, ctx, data.bankTransactionId);
    const kind = b.amountCents > 0 ? "receivable" : "payable";
    const settleInput: SettleInput = {
      kind,
      accountId: b.accountId,
      method: data.method,
      methodNote: data.methodNote,
      settledOn: b.postedOn,
      allocations: data.allocations,
      bankTransactionId: b.id,
      notes: `Baixa a partir do extrato: ${b.description}`,
    };
    const settled = await settleWithinTx(tx, ctx, settleInput);
    if (!settled.movementId) throw new BusinessRuleError("Baixa sem movimentação financeira não pode ser conciliada");
    const open = b.amountCents - b.reconciledCents;
    const movementAmount = kind === "receivable" ? settled.amountCents : -settled.amountCents;
    if (Math.abs(movementAmount) > Math.abs(open)) {
      throw new BusinessRuleError(`Valor baixado (${formatBRL(settled.amountCents)}) maior que o valor em aberto do extrato (${formatBRL(Math.abs(open))})`);
    }
    const rec = await reconcileWithinTx(tx, ctx, {
      accountId: b.accountId,
      allocations: [{ bankTransactionId: b.id, movementId: settled.movementId, amountCents: movementAmount }],
      note: "Baixa criada a partir do extrato",
    });
    return { settlementId: settled.settlementId, reconciliationId: rec.reconciliationId };
  });
}

const entryFromBankSchema = z.object({
  bankTransactionId: zId,
  description: zRequiredText("Descrição", 300),
  categoryId: zId,
  costCenterId: zId.nullish().transform((v) => v ?? null),
  supplierId: zId.nullish().transform((v) => v ?? null),
  patientId: zId.nullish().transform((v) => v ?? null),
});

/** Sem registro correspondente: cria lançamento revisado, baixa e concilia. */
export async function createEntryFromBankTransaction(ctx: Ctx, input: z.input<typeof entryFromBankSchema>) {
  assertCan(ctx, "finance.reconcile");
  assertCan(ctx, "finance.edit");
  const data = parseInput(entryFromBankSchema, input);
  return ctx.db.transaction(async (tx) => {
    const b = await loadBankTx(tx, ctx, data.bankTransactionId);
    const open = b.amountCents - b.reconciledCents;
    const amount = Math.abs(open);
    let titleId: string;
    if (open > 0) {
      const created = await createReceivableTx(tx, ctx, { ...data, amountCents: amount, date: b.postedOn });
      titleId = created;
    } else {
      const [p] = await tx
        .insert(payables)
        .values({
          organizationId: ctx.orgId,
          supplierId: data.supplierId,
          description: data.description,
          categoryId: data.categoryId,
          costCenterId: data.costCenterId,
          competenceDate: b.postedOn,
          dueDate: b.postedOn,
          originalCents: amount,
          expectedAccountId: b.accountId,
          notes: "Criado a partir do extrato bancário",
          createdBy: ctx.userId,
        })
        .returning({ id: payables.id });
      titleId = p!.id;
    }
    const settled = await settleWithinTx(tx, ctx, {
      kind: open > 0 ? "receivable" : "payable",
      accountId: b.accountId,
      method: "transfer",
      settledOn: b.postedOn,
      allocations: [{ titleId, principalCents: amount }],
      bankTransactionId: b.id,
      notes: "Lançamento criado a partir do extrato",
    });
    const rec = await reconcileWithinTx(tx, ctx, {
      accountId: b.accountId,
      allocations: [{ bankTransactionId: b.id, movementId: settled.movementId!, amountCents: open }],
      note: "Lançamento criado a partir do extrato",
    });
    return { titleId, settlementId: settled.settlementId, reconciliationId: rec.reconciliationId };
  });
}

async function createReceivableTx(
  tx: Tx,
  ctx: Ctx,
  data: { description: string; categoryId: string; costCenterId: string | null; patientId: string | null; amountCents: number; date: string },
): Promise<string> {
  // Reaproveita validações do serviço de títulos usando a mesma transação.
  const txCtx = { ...ctx, db: tx as unknown as Ctx["db"] };
  const { id } = await createReceivable(txCtx, {
    patientId: data.patientId,
    description: data.description,
    categoryId: data.categoryId,
    costCenterId: data.costCenterId,
    competenceDate: data.date,
    dueDate: data.date,
    amountCents: data.amountCents,
    notes: "Criado a partir do extrato bancário",
  });
  return id;
}

/** Títulos em aberto para baixa a partir do extrato (mesmo sentido do valor). */
export async function openTitlesForBankTransaction(ctx: Ctx, bankTransactionId: string) {
  assertCan(ctx, "finance.reconcile");
  const [b] = await ctx.db
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.organizationId, ctx.orgId), eq(bankTransactions.id, bankTransactionId)));
  if (!b) throw new NotFoundError("Movimentação bancária");
  return { bankTransaction: b, kind: b.amountCents > 0 ? ("receivable" as const) : ("payable" as const) };
}

export { ne, or, settlements };
