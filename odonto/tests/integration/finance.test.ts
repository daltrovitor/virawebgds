import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbHandle } from "../../src/server/db/client";
import { accountMovements, bankTransactions, financialCategories, receivables, settlements } from "../../src/server/db/schema";
import { BusinessRuleError } from "../../src/server/errors";
import {
  confirmOfxImport,
  createEntryFromBankTransaction,
  previewOfxImport,
  reconcile,
  reconciliationWorkspace,
  settleFromBankTransaction,
  undoReconciliation,
} from "../../src/server/services/bank";
import { accountBalance, listAccounts, saveAccount } from "../../src/server/services/finance-setup";
import { listIntegrations, setIntegrationStatus } from "../../src/server/services/integrations";
import { systemCategoryId } from "../../src/server/services/organizations";
import { quickCreatePatient } from "../../src/server/services/patients";
import { cashByCategory, cashflow, overview, reconciliationReport } from "../../src/server/services/reports";
import {
  createPayable,
  createReceivable,
  createRecurrence,
  createTransfer,
  generateRecurringPayables,
  listCardReceivables,
  recordCardPayment,
  reverseSettlement,
  settleCardReceivable,
  settleTitles,
  suspendRecurrence,
} from "../../src/server/services/titles";
import { createClinic, createTestDb, key, type Clinic } from "./helpers";

let h: DbHandle;
let clinic: Clinic;
let bankId: string;
let cashId: string;
let clearingId: string;
let incomeCat: string;
let expenseCat: string;
let patientId: string;

function ofx(lines: { id?: string; date: string; amount: string; memo: string }[], balance = "0.00") {
  return new TextEncoder().encode(`OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261031
${lines
  .map((l) => `<STMTTRN><TRNTYPE>${l.amount.startsWith("-") ? "DEBIT" : "CREDIT"}<DTPOSTED>${l.date.replace(/-/g, "")}<TRNAMT>${l.amount}${l.id ? `<FITID>${l.id}` : ""}<MEMO>${l.memo}</STMTTRN>`)
  .join("\n")}
</BANKTRANLIST><LEDGERBAL><BALAMT>${balance}<DTASOF>20261031</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);
}

beforeAll(async () => {
  h = await createTestDb();
  clinic = await createClinic(h.db);
  const owner = await clinic.ctx("owner");
  bankId = (await saveAccount(owner, { name: "Banco Itaú Demo", kind: "bank", bankCode: "341", accountNumberMasked: "•••45-6", openingBalanceCents: 100_000, openingDate: "2026-09-30" })).id;
  cashId = (await saveAccount(owner, { name: "Caixa Demo", kind: "cash", openingBalanceCents: 20_000, openingDate: "2026-09-30" })).id;
  clearingId = (await saveAccount(owner, { name: "Recebíveis Cartão Demo", kind: "card_clearing", openingBalanceCents: 0, openingDate: "2026-09-30" })).id;
  incomeCat = (await systemCategoryId(h.db, clinic.orgId, "other_income"))!;
  expenseCat = (await systemCategoryId(h.db, clinic.orgId, "other_expense"))!;
  const p = await quickCreatePatient(owner, { fullName: "Paciente Financeiro", phone: "62966660001" });
  if (p.status !== "created") throw new Error("paciente");
  patientId = p.id;
});

afterAll(async () => {
  await h.sql.end();
});

async function receivable(amount: number, due = "2026-10-05") {
  const finance = await clinic.ctx("finance");
  return (await createReceivable(finance, { patientId, description: `Título ${amount}`, categoryId: incomeCat, competenceDate: due, dueDate: due, amountCents: amount })).id;
}

describe("importação OFX", () => {
  it("cenário 20: reimportar não duplica; transações idênticas sem identificador exigem tratamento", async () => {
    const finance = await clinic.ctx("finance");
    const file = ofx([
      { id: "F1", date: "2026-10-05", amount: "150.00", memo: "PIX RECEBIDO" },
      { id: "F2", date: "2026-10-06", amount: "-35.90", memo: "TARIFA" },
    ]);
    const p1 = await previewOfxImport(finance, { accountId: bankId, fileName: "out.ofx", bytes: file });
    expect(p1.counts).toMatchObject({ total: 2, new: 2, duplicate: 0 });
    expect(await confirmOfxImport(finance, { batchId: p1.batchId, acknowledgeWarnings: true })).toMatchObject({ inserted: 2 });
    const p2 = await previewOfxImport(finance, { accountId: bankId, fileName: "out.ofx", bytes: file });
    expect(p2.counts.duplicate).toBe(2);
    expect(p2.warnings.join()).toMatch(/já foi importado/);
    expect(await confirmOfxImport(finance, { batchId: p2.batchId, acknowledgeWarnings: true })).toMatchObject({ inserted: 0, skipped: 2 });
    // Reconfirmar o mesmo lote é inofensivo
    expect(await confirmOfxImport(finance, { batchId: p1.batchId })).toMatchObject({ alreadyConfirmed: true });

    // Sem FITID: duas transações reais idênticas
    const noId = ofx([
      { date: "2026-10-07", amount: "-12.00", memo: "ESTACIONAMENTO" },
      { date: "2026-10-07", amount: "-12.00", memo: "ESTACIONAMENTO" },
    ]);
    const p3 = await previewOfxImport(finance, { accountId: bankId, fileName: "semid.ofx", bytes: noId });
    expect(p3.lines.map((l) => l.classification)).toEqual(["identical_in_file", "identical_in_file"]);
    expect(await confirmOfxImport(finance, { batchId: p3.batchId, acknowledgeWarnings: true })).toMatchObject({ inserted: 2 });
    const p4 = await previewOfxImport(finance, { accountId: bankId, fileName: "semid.ofx", bytes: noId });
    expect(p4.lines.map((l) => l.classification)).toEqual(["probable_duplicate", "probable_duplicate"]);
    expect(await confirmOfxImport(finance, { batchId: p4.batchId, acknowledgeWarnings: true })).toMatchObject({ inserted: 0 });
    // Usuário confirma que uma delas é uma terceira transação real
    const p5 = await previewOfxImport(finance, { accountId: bankId, fileName: "semid.ofx", bytes: noId });
    expect(await confirmOfxImport(finance, { batchId: p5.batchId, forceLineIndexes: [0], acknowledgeWarnings: true })).toMatchObject({ inserted: 1 });
    const rows = await h.db.select().from(bankTransactions).where(and(eq(bankTransactions.accountId, bankId), eq(bankTransactions.description, "ESTACIONAMENTO")));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.ambiguous)).toBe(true);
  });
});

describe("conciliação", () => {
  it("cenário 21: conciliar com pagamento já registrado não cria segunda receita nem nova baixa", async () => {
    const finance = await clinic.ctx("finance");
    const titleId = await receivable(80_000, "2026-10-09");
    const s = await settleTitles(finance, { kind: "receivable", accountId: bankId, method: "pix", settledOn: "2026-10-09", allocations: [{ titleId, principalCents: 80_000 }] });
    const before = await h.db.select().from(settlements).where(eq(settlements.organizationId, clinic.orgId));
    const p = await previewOfxImport(finance, { accountId: bankId, fileName: "b.ofx", bytes: ofx([{ id: "R21", date: "2026-10-09", amount: "800.00", memo: "PIX PACIENTE FINANCEIRO" }]) });
    await confirmOfxImport(finance, { batchId: p.batchId, acknowledgeWarnings: true });
    const ws = await reconciliationWorkspace(finance, { accountId: bankId, from: "2026-10-01", to: "2026-10-31" });
    const line = ws.bank.find((b) => b.externalId === "R21")!;
    expect(line.suggestions[0]).toMatchObject({ movementId: s.movementId });
    expect(line.suggestions[0]!.reasons).toContain("Mesmo valor");
    await reconcile(finance, { accountId: bankId, allocations: [{ bankTransactionId: line.id, movementId: s.movementId!, amountCents: 80_000 }] });
    const after = await h.db.select().from(settlements).where(eq(settlements.organizationId, clinic.orgId));
    expect(after.length).toBe(before.length);
    const [t] = await h.db.select().from(receivables).where(eq(receivables.id, titleId));
    expect(t!.paidPrincipalCents).toBe(80_000);
    const [b] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.id, line.id));
    expect(b!.status).toBe("reconciled");
    // Dupla conciliação recusada
    await expect(reconcile(finance, { accountId: bankId, allocations: [{ bankTransactionId: line.id, movementId: s.movementId!, amountCents: 80_000 }] })).rejects.toBeInstanceOf(BusinessRuleError);
    // Estornar baixa conciliada exige desfazer a conciliação antes (ações separadas)
    await expect(reverseSettlement(finance, { settlementId: s.settlementId, reason: "teste" })).rejects.toThrow(/conciliação/);
    const recId = ws.allocations.length >= 0 ? (await reconciliationWorkspace(finance, { accountId: bankId, from: "2026-10-01", to: "2026-10-31", status: "all" })).allocations.find((a) => a.allocation.bankTransactionId === line.id)!.reconciliation.id : "";
    await undoReconciliation(finance, { reconciliationId: recId, reason: "Vínculo errado" });
    const [b2] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.id, line.id));
    expect(b2!.status).toBe("pending");
    const [t2] = await h.db.select().from(receivables).where(eq(receivables.id, titleId));
    expect(t2!.paidPrincipalCents).toBe(80_000); // desfazer vínculo não estorna baixa
  });

  it("cenário 22: valores agrupados e parciais respeitam saldo; excesso recusado, inclusive concorrente", async () => {
    const finance = await clinic.ctx("finance");
    const a = await receivable(100_000, "2026-10-12");
    const b = await receivable(50_000, "2026-10-12");
    const sa = await settleTitles(finance, { kind: "receivable", accountId: bankId, method: "pix", settledOn: "2026-10-12", allocations: [{ titleId: a, principalCents: 100_000 }] });
    const sb = await settleTitles(finance, { kind: "receivable", accountId: bankId, method: "pix", settledOn: "2026-10-12", allocations: [{ titleId: b, principalCents: 50_000 }] });
    const p = await previewOfxImport(finance, { accountId: bankId, fileName: "c.ofx", bytes: ofx([{ id: "G1", date: "2026-10-12", amount: "1500.00", memo: "DEPOSITO AGRUPADO" }]) });
    await confirmOfxImport(finance, { batchId: p.batchId, acknowledgeWarnings: true });
    const [bt] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.externalId, "G1"));
    await expect(
      reconcile(finance, { accountId: bankId, allocations: [{ bankTransactionId: bt!.id, movementId: sa.movementId!, amountCents: 100_001 }] }),
    ).rejects.toThrow(/excede/);
    // Parcial: primeiro só um dos lançamentos
    await reconcile(finance, { accountId: bankId, allocations: [{ bankTransactionId: bt!.id, movementId: sa.movementId!, amountCents: 100_000 }] });
    let [row] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.id, bt!.id));
    expect(row!.status).toBe("pending");
    expect(row!.reconciledCents).toBe(100_000);
    // Duas tentativas simultâneas de alocar o restante: só uma vence.
    const c = await receivable(50_000, "2026-10-12");
    const sc = await settleTitles(finance, { kind: "receivable", accountId: bankId, method: "pix", settledOn: "2026-10-12", allocations: [{ titleId: c, principalCents: 50_000 }] });
    const results = await Promise.allSettled([
      reconcile(finance, { accountId: bankId, allocations: [{ bankTransactionId: bt!.id, movementId: sb.movementId!, amountCents: 50_000 }] }),
      reconcile(finance, { accountId: bankId, allocations: [{ bankTransactionId: bt!.id, movementId: sc.movementId!, amountCents: 50_000 }] }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    [row] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.id, bt!.id));
    expect(row!.reconciledCents).toBe(150_000);
    expect(row!.status).toBe("reconciled");
  });

  it("baixa de título e lançamento novo a partir do extrato", async () => {
    const finance = await clinic.ctx("finance");
    const t = await receivable(25_000, "2026-10-15");
    const p = await previewOfxImport(finance, { accountId: bankId, fileName: "d.ofx", bytes: ofx([
      { id: "S1", date: "2026-10-15", amount: "250.00", memo: "PIX" },
      { id: "S2", date: "2026-10-15", amount: "-19.90", memo: "TARIFA MENSAL" },
    ]) });
    await confirmOfxImport(finance, { batchId: p.batchId, acknowledgeWarnings: true });
    const [s1] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.externalId, "S1"));
    const [s2] = await h.db.select().from(bankTransactions).where(eq(bankTransactions.externalId, "S2"));
    await settleFromBankTransaction(finance, { bankTransactionId: s1!.id, method: "pix", allocations: [{ titleId: t, principalCents: 25_000 }] });
    const [title] = await h.db.select().from(receivables).where(eq(receivables.id, t));
    expect(title!.status).toBe("paid");
    const feeCat = (await systemCategoryId(h.db, clinic.orgId, "bank_fees"))!;
    await createEntryFromBankTransaction(finance, { bankTransactionId: s2!.id, description: "Tarifa mensal", categoryId: feeCat });
    const both = await h.db.select().from(bankTransactions).where(eq(bankTransactions.batchId, p.batchId));
    expect(both.every((b) => b.status === "reconciled")).toBe(true);
  });
});

describe("contas, transferências, cartões e fluxo", () => {
  it("cenário 23: transferência entre contas próprias altera saldos e não é receita/despesa", async () => {
    const finance = await clinic.ctx("finance");
    const bankBefore = await accountBalance(h.db, clinic.orgId, bankId, "2026-10-20");
    const cashBefore = await accountBalance(h.db, clinic.orgId, cashId, "2026-10-20");
    const report0 = await cashByCategory(finance, "2026-10-20", "2026-10-20");
    await createTransfer(finance, { fromAccountId: cashId, toAccountId: bankId, amountCents: 15_000, occurredOn: "2026-10-20", description: "Depósito do caixa" });
    expect(await accountBalance(h.db, clinic.orgId, bankId, "2026-10-20")).toBe(bankBefore + 15_000);
    expect(await accountBalance(h.db, clinic.orgId, cashId, "2026-10-20")).toBe(cashBefore - 15_000);
    const report = await cashByCategory(finance, "2026-10-20", "2026-10-20");
    expect(report.totalIncome).toBe(report0.totalIncome);
    expect(report.totalExpense).toBe(report0.totalExpense);
  });

  it("cenário 24: cartão R$1.000, taxa R$30, líquido R$970 rastreável; liquidação não duplica receita", async () => {
    const finance = await clinic.ctx("finance");
    const t = await receivable(100_000, "2026-10-21");
    await expect(settleTitles(finance, { kind: "receivable", accountId: bankId, method: "credit", settledOn: "2026-10-21", allocations: [{ titleId: t, principalCents: 100_000 }] })).rejects.toThrow(/cartão/);
    const res = await recordCardPayment(finance, {
      clearingAccountId: clearingId,
      acquirer: "Operadora Demo",
      brand: "Visa",
      paymentType: "credit",
      installments: 1,
      transactionDate: "2026-10-21",
      feeCents: 3_000,
      settlementDays: 2,
      allocations: [{ titleId: t, principalCents: 100_000 }],
      idempotencyKey: key(),
    });
    expect(res.cardTransactionId).toBeTruthy();
    const [title] = await h.db.select().from(receivables).where(eq(receivables.id, t));
    expect(title!.status).toBe("paid");
    const bankBefore = await accountBalance(h.db, clinic.orgId, bankId, "2026-10-23");
    const [cr] = await listCardReceivables(finance);
    expect(cr!.receivable).toMatchObject({ grossCents: 100_000, feeCents: 3_000, netCents: 97_000, expectedDate: "2026-10-23" });
    await settleCardReceivable(finance, { cardReceivableId: cr!.receivable.id, bankAccountId: bankId, settledOn: "2026-10-23" });
    expect(await accountBalance(h.db, clinic.orgId, bankId, "2026-10-23")).toBe(bankBefore + 97_000);
    expect(await accountBalance(h.db, clinic.orgId, clearingId, "2026-10-23")).toBe(0);
    const report = await cashByCategory(finance, "2026-10-21", "2026-10-23");
    const income = report.income.find((l) => l.categoryId === incomeCat)!;
    expect(income.cents).toBe(100_000); // receita contada uma única vez
    const fees = report.expense.find((l) => l.name === "Taxas de cartão")!;
    expect(fees.cents).toBe(-3_000);
    await expect(settleCardReceivable(finance, { cardReceivableId: cr!.receivable.id, bankAccountId: bankId, settledOn: "2026-10-23" })).rejects.toThrow(/já liquidado/);
  });

  it("cenário 25: lançamentos explicam saldos; projeção usa saldo restante e não duplica pagos", async () => {
    const finance = await clinic.ctx("finance");
    const movs = await h.db.select().from(accountMovements).where(eq(accountMovements.accountId, bankId));
    const sum = movs.filter((m) => m.occurredOn <= "2026-10-31").reduce((s, m) => s + m.amountCents, 0);
    expect(await accountBalance(h.db, clinic.orgId, bankId, "2026-10-31")).toBe(100_000 + sum);
    // A listagem (subconsulta correlacionada) mostra o mesmo saldo e o painel também.
    const listed = await listAccounts(finance, { asOf: "2026-10-31" });
    expect(listed.find((a) => a.id === bankId)!.balanceCents).toBe(100_000 + sum);
    const ov = await overview(finance);
    expect(ov.finance!.accounts.find((a) => a.id === clearingId)!.balanceCents).toBe(await accountBalance(h.db, clinic.orgId, clearingId, ov.today));
    const recon = await reconciliationReport(finance);
    expect(recon.find((r) => r.accountId === bankId)!.pendingCount).toBeGreaterThan(0);

    const t = await receivable(40_000, "2099-01-10");
    await settleTitles(finance, { kind: "receivable", accountId: bankId, method: "pix", settledOn: "2026-10-01", allocations: [{ titleId: t, principalCents: 15_000 }] });
    const flow = await cashflow(finance, { from: "2099-01-09", to: "2099-01-10" });
    const d9 = flow.days[0]!;
    const d10 = flow.days[1]!;
    expect(d10.projectedIn).toBeGreaterThanOrEqual(25_000);
    const others = await h.db.select().from(receivables).where(and(eq(receivables.organizationId, clinic.orgId), eq(receivables.dueDate, "2099-01-10")));
    const expectedIn = others.reduce((s, r) => s + r.originalCents + r.adjustmentCents - r.paidPrincipalCents - r.discountGrantedCents, 0);
    expect(d10.projectedIn).toBe(expectedIn);
    expect(d10.projectedBalance - d9.projectedBalance).toBe(expectedIn);
  });

  it("contas a pagar parceladas com rateio e recorrência idempotente", async () => {
    const finance = await clinic.ctx("finance");
    const centers = await h.db.select().from(financialCategories).where(and(eq(financialCategories.organizationId, clinic.orgId), eq(financialCategories.type, "expense")));
    const created = await createPayable(finance, {
      description: "Compra de materiais",
      categoryId: expenseCat,
      competenceDate: "2026-10-01",
      firstDueDate: "2026-10-30",
      amountCents: 100_000,
      installments: 3,
      allocations: [
        { categoryId: centers[0]!.id, amountCents: 60_000 },
        { categoryId: centers[1]!.id, amountCents: 40_000 },
      ],
    });
    expect(created.ids).toHaveLength(3);
    await expect(createPayable(finance, { description: "x", categoryId: expenseCat, competenceDate: "2026-10-01", firstDueDate: "2026-10-30", amountCents: 1000, allocations: [{ categoryId: expenseCat, amountCents: 999 }] })).rejects.toThrow(/rateio/);
    const rec = await createRecurrence(finance, { description: "Aluguel", categoryId: expenseCat, amountCents: 300_000, dayOfMonth: 31, startDate: "2026-10-01" });
    const g1 = await generateRecurringPayables(finance, "2027-03-31");
    const g2 = await generateRecurringPayables(finance, "2027-03-31");
    expect(g1.created).toBe(6);
    expect(g2.created).toBe(0);
    await suspendRecurrence(finance, rec.id);
    expect((await generateRecurringPayables(finance, "2027-06-30")).created).toBe(0);
  });
});

describe("integrações", () => {
  it("cenário 26: sem credenciais aparece como não configurada e não pode ser ativada", async () => {
    const owner = await clinic.ctx("owner");
    const list = await listIntegrations(owner);
    expect(list.every((i) => i.status === "not_configured" && i.statusLabel === "Não configurada")).toBe(true);
    expect(list.every((i) => i.lastSyncAt === null)).toBe(true);
    await expect(setIntegrationStatus(owner, "open_finance", "active", "fornecedor-x")).rejects.toThrow(/credenciais/);
  });

  it("clínica de demonstração não ativa integração mesmo com credenciais no ambiente", async () => {
    const owner = await clinic.ctx("owner");
    const saved = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
    process.env.RESEND_API_KEY = "chave-sintetica-de-teste";
    process.env.EMAIL_FROM = "Teste <no-reply@exemplo.test>";
    try {
      await expect(setIntegrationStatus(owner, "email", "active", "resend")).rejects.toThrow(/demonstração/);
    } finally {
      if (saved.key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = saved.key;
      if (saved.from === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = saved.from;
    }
    expect((await listIntegrations(owner)).find((i) => i.kind === "email")?.status).toBe("not_configured");
  });
});
