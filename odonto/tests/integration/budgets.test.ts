import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { monthlySchedule } from "../../src/domain/dates";
import type { DbHandle } from "../../src/server/db/client";
import { auditLogs, priceTableItems, receivables, treatmentItems } from "../../src/server/db/schema";
import { BusinessRuleError, ConflictError, ValidationError } from "../../src/server/errors";
import {
  addItems,
  approveBudget,
  createBudget,
  DuplicateItemError,
  getBudget,
  startRevision,
  updateItem,
  removeItem,
} from "../../src/server/services/budgets";
import { setPrice } from "../../src/server/services/catalog";
import { saveAccount } from "../../src/server/services/finance-setup";
import { quickCreatePatient } from "../../src/server/services/patients";
import { listTitles, reverseSettlement, settleTitles } from "../../src/server/services/titles";
import { createCatalog, createClinic, createTestDb, key, type CatalogFixture, type Clinic } from "./helpers";

let h: DbHandle;
let clinic: Clinic;
let cat: CatalogFixture;
let patientId: string;
let bankAccountId: string;

beforeAll(async () => {
  h = await createTestDb();
  clinic = await createClinic(h.db);
  cat = await createCatalog(clinic);
  const ctx = await clinic.ctx("owner");
  const p = await quickCreatePatient(ctx, { fullName: "Paciente Sintético Um", phone: "62999990001" });
  if (p.status !== "created") throw new Error("paciente");
  patientId = p.id;
  bankAccountId = (await saveAccount(ctx, { name: "Banco Demo", kind: "bank", openingBalanceCents: 0, openingDate: "2026-01-01" })).id;
});

afterAll(async () => {
  await h.sql.end();
});

async function newBudget() {
  const ctx = await clinic.ctx("owner");
  return createBudget(ctx, { patientId, budgetDate: "2026-10-01" });
}

describe("orçamento e tabela de preços", () => {
  it("cenários 3 e 4: preço editado no item não altera a tabela; tabela atualizada não recalcula o salvo", async () => {
    const ctx = await clinic.ctx("dentist");
    const b = await newBudget();
    const { itemIds } = await addItems(ctx, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [11] } });
    await updateItem(ctx, { itemId: itemIds[0]!, unitPriceCents: 55_000 });
    const [tablePrice] = await h.db
      .select()
      .from(priceTableItems)
      .where(and(eq(priceTableItems.priceTableId, cat.priceTableId), eq(priceTableItems.procedureId, cat.crown)));
    expect(tablePrice!.priceCents).toBe(60_000);

    const owner = await clinic.ctx("owner");
    await setPrice(owner, { priceTableId: cat.priceTableId, procedureId: cat.crown, priceCents: 70_000 });
    const detail = await getBudget(ctx, b.id);
    expect(detail.items[0]).toMatchObject({ unitPriceCents: 55_000, referencePriceCents: 60_000, procedureName: "Coroa metalocerâmica", specialtyName: "Prótese" });
    // Nova inclusão usa o preço vigente.
    await addItems(ctx, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [21] } });
    const after = await getBudget(ctx, b.id);
    expect(after.items[1]!.unitPriceCents).toBe(70_000);
    await setPrice(owner, { priceTableId: cat.priceTableId, procedureId: cat.crown, priceCents: 60_000 });
    // Auditoria do preço
    const logs = await h.db.select().from(auditLogs).where(and(eq(auditLogs.organizationId, clinic.orgId), eq(auditLogs.action, "price.set")));
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it("cenário 5: Prótese e Dentística no mesmo dente + itens em dentes distintos; duplicata exige justificativa", async () => {
    const ctx = await clinic.ctx("dentist");
    const b = await newBudget();
    await addItems(ctx, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [16] } });
    await addItems(ctx, { budgetId: b.id, procedureId: cat.resin, selection: { kind: "teeth", teeth: [16, 26, 36] } });
    await expect(addItems(ctx, { budgetId: b.id, procedureId: cat.resin, selection: { kind: "teeth", teeth: [26] } })).rejects.toBeInstanceOf(DuplicateItemError);
    await addItems(ctx, { budgetId: b.id, procedureId: cat.resin, selection: { kind: "teeth", teeth: [26] }, duplicateJustification: "Duas faces em sessões distintas" });
    const d = await getBudget(ctx, b.id);
    expect(d.items.filter((i) => i.locations.some((l) => l.kind === "tooth" && l.tooth === 16)).map((i) => i.specialtyName).sort()).toEqual(["Dentística", "Prótese"]);
    expect(d.items).toHaveLength(5);
    expect(d.subtotalCents).toBe(60_000 + 4 * 25_000);
  });

  it("cenário 6: por dente R$600 ×2 = R$1.200; global ambas arcadas R$300; por arcada ambas R$600; sem preço exige valor", async () => {
    const ctx = await clinic.ctx("dentist");
    const b = await newBudget();
    const a = await addItems(ctx, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [14, 15] } });
    expect(a.totalCents).toBe(120_000);
    const g = await addItems(ctx, { budgetId: b.id, procedureId: cat.whitening, selection: { kind: "arches", arches: ["upper", "lower"] } });
    expect(g.totalCents).toBe(30_000);
    const s = await addItems(ctx, { budgetId: b.id, procedureId: cat.splint, selection: { kind: "arches", arches: ["upper", "lower"] } });
    expect(s.totalCents).toBe(60_000);
    expect(s.itemIds).toHaveLength(2);
    await expect(addItems(ctx, { budgetId: b.id, procedureId: cat.consult, selection: { kind: "none" } })).rejects.toBeInstanceOf(ValidationError);
    const free = await addItems(ctx, { budgetId: b.id, procedureId: cat.consult, selection: { kind: "none" }, unitPriceCents: 0 });
    expect(free.totalCents).toBe(0);
    await expect(addItems(ctx, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "arches", arches: ["upper"] } })).rejects.toBeInstanceOf(ValidationError);
    await removeItem(ctx, free.itemIds[0]!);
    expect((await getBudget(ctx, b.id)).subtotalCents).toBe(210_000);
  });
});

describe("aprovação, títulos e tratamento", () => {
  it("cenários 7 e 8: aprovação parcial gera tratamento e títulos só do aceito; desconto 10%, entrada e 4 parcelas", async () => {
    const dentist = await clinic.ctx("dentist");
    const b = await newBudget();
    // R$ 10.000 aprovados: 10 coroas de R$ 1.000
    const ctxOwner = await clinic.ctx("owner");
    const crowns = await addItems(dentist, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [11, 12, 13, 14, 15, 21, 22, 23, 24, 25] }, unitPriceCents: 100_000 });
    const rejected = await addItems(dentist, { budgetId: b.id, procedureId: cat.whitening, selection: { kind: "none" } });
    const detail = await getBudget(ctxOwner, b.id);
    const dueDates = monthlySchedule("2026-11-10", 4);
    await expect(
      approveBudget(dentist, {
        budgetId: b.id,
        expectedVersion: detail.budget.version,
        idempotencyKey: key(),
        approvedItemIds: crowns.itemIds,
        discount: { type: "none" },
        plan: { downPayment: null, installments: [{ amountCents: 1_000_000, dueDate: "2026-11-10", method: "pix" }] },
      }),
    ).rejects.toThrow(/permissão/);
    const result = await approveBudget(ctxOwner, {
      budgetId: b.id,
      expectedVersion: detail.budget.version,
      idempotencyKey: key(),
      approvedItemIds: crowns.itemIds,
      discount: { type: "percent", basisPoints: 1000 },
      plan: {
        downPayment: { amountCents: 100_000, dueDate: "2026-10-01", method: "pix" },
        installments: dueDates.map((dueDate) => ({ amountCents: 200_000, dueDate, method: "credit" as const })),
      },
    });
    expect(result.totalCents).toBe(900_000);
    expect(result.receivableIds).toHaveLength(5);
    expect(result.treatmentItemIds).toHaveLength(10);
    const titles = await h.db.select().from(receivables).where(eq(receivables.budgetId, b.id));
    expect(titles.reduce((s, t) => s + t.originalCents, 0)).toBe(900_000);
    expect(titles.every((t) => t.paidPrincipalCents === 0)).toBe(true);
    const after = await getBudget(ctxOwner, b.id);
    expect(after.budget.status).toBe("partially_approved");
    expect(after.items.find((i) => i.id === rejected.itemIds[0])!.approvalStatus).toBe("rejected");
    const tItems = await h.db.select().from(treatmentItems).where(eq(treatmentItems.patientId, patientId));
    expect(tItems.filter((t) => crowns.itemIds.includes(t.budgetItemId))).toHaveLength(10);
    expect(tItems.some((t) => t.budgetItemId === rejected.itemIds[0])).toBe(false);
  });

  it("cenário 11: duplo clique ou repetição não duplica parcelas nem itens de tratamento", async () => {
    const owner = await clinic.ctx("owner");
    const b = await newBudget();
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.resin, selection: { kind: "teeth", teeth: [31, 32] } });
    const d = await getBudget(owner, b.id);
    const k = key();
    const input = {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: k,
      approvedItemIds: items.itemIds,
      discount: { type: "none" as const },
      plan: { downPayment: null, installments: [{ amountCents: 50_000, dueDate: "2026-11-01", method: "boleto" as const }] },
    };
    const results = await Promise.allSettled([approveBudget(owner, input), approveBudget(owner, input), approveBudget(owner, input)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBe(3);
    const ids = new Set(ok.map((r) => (r as PromiseFulfilledResult<{ agreementId: string }>).value.agreementId));
    expect(ids.size).toBe(1);
    const titles = await h.db.select().from(receivables).where(eq(receivables.budgetId, b.id));
    expect(titles).toHaveLength(1);
    const tItems = await h.db.select().from(treatmentItems).where(eq(treatmentItems.patientId, patientId));
    expect(tItems.filter((t) => items.itemIds.includes(t.budgetItemId))).toHaveLength(2);
    // Nova chave para a mesma versão também não duplica: a versão já foi aprovada.
    await expect(approveBudget(owner, { ...input, idempotencyKey: key() })).rejects.toBeInstanceOf(ConflictError);
  });

  it("total zero aprova sem gerar títulos vazios", async () => {
    const owner = await clinic.ctx("owner");
    const b = await newBudget();
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.consult, selection: { kind: "none" }, unitPriceCents: 0 });
    const d = await getBudget(owner, b.id);
    const r = await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: key(),
      approvedItemIds: items.itemIds,
      discount: { type: "none" },
      plan: { downPayment: null, installments: [] },
    });
    expect(r.totalCents).toBe(0);
    expect(r.receivableIds).toHaveLength(0);
  });
});

describe("recebimentos, estornos e revisão", () => {
  let budgetId: string;
  let receivableId: string;

  it("cenário 12: R$300 de parcela de R$1.000 deixa R$700; segundo recebimento e estorno mantêm valores e auditoria", async () => {
    const owner = await clinic.ctx("owner");
    const finance = await clinic.ctx("finance");
    const b = await newBudget();
    budgetId = b.id;
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [46, 47] }, unitPriceCents: 100_000 });
    const d = await getBudget(owner, b.id);
    await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: key(),
      approvedItemIds: items.itemIds,
      discount: { type: "none" },
      plan: {
        downPayment: null,
        installments: [
          { amountCents: 100_000, dueDate: "2026-11-05", method: "pix" },
          { amountCents: 100_000, dueDate: "2026-12-05", method: "pix" },
        ],
      },
    });
    const [first] = await h.db.select().from(receivables).where(and(eq(receivables.budgetId, b.id), eq(receivables.installmentNumber, 1)));
    receivableId = first!.id;
    const s1 = await settleTitles(finance, { kind: "receivable", accountId: bankAccountId, method: "pix", settledOn: "2026-11-05", allocations: [{ titleId: receivableId, principalCents: 30_000 }], idempotencyKey: key() });
    let [r] = await h.db.select().from(receivables).where(eq(receivables.id, receivableId));
    expect(r!.originalCents + r!.adjustmentCents - r!.paidPrincipalCents - r!.discountGrantedCents).toBe(70_000);
    expect(r!.status).toBe("partial");
    const s2 = await settleTitles(finance, { kind: "receivable", accountId: bankAccountId, method: "cash", settledOn: "2026-11-06", allocations: [{ titleId: receivableId, principalCents: 20_000, interestCents: 150 }] });
    [r] = await h.db.select().from(receivables).where(eq(receivables.id, receivableId));
    expect(r!.paidPrincipalCents).toBe(50_000);
    expect(r!.interestReceivedCents).toBe(150);
    // Baixa acima do saldo é recusada.
    await expect(settleTitles(finance, { kind: "receivable", accountId: bankAccountId, method: "pix", settledOn: "2026-11-07", allocations: [{ titleId: receivableId, principalCents: 50_001 }] })).rejects.toBeInstanceOf(BusinessRuleError);
    await reverseSettlement(finance, { settlementId: s2.settlementId, reason: "Valor lançado em duplicidade" });
    [r] = await h.db.select().from(receivables).where(eq(receivables.id, receivableId));
    expect(r!.paidPrincipalCents).toBe(30_000);
    expect(r!.interestReceivedCents).toBe(0);
    expect(r!.status).toBe("partial");
    await expect(reverseSettlement(finance, { settlementId: s2.settlementId, reason: "de novo" })).rejects.toBeInstanceOf(BusinessRuleError);
    const logs = await h.db.select().from(auditLogs).where(and(eq(auditLogs.organizationId, clinic.orgId), eq(auditLogs.entityId, s1.settlementId)));
    expect(logs.map((l) => l.action)).toContain("receivable.settle");
    // Pagamento não conclui tratamento.
    const tItems = await h.db.select().from(treatmentItems).where(eq(treatmentItems.patientId, patientId));
    expect(tItems.filter((t) => items.itemIds.includes(t.budgetItemId)).every((t) => t.clinicalStatus === "not_started")).toBe(true);
  });

  it("cenário 13: revisão de orçamento parcialmente pago preserva pagamentos e calcula ajuste explícito", async () => {
    const owner = await clinic.ctx("owner");
    const { number } = await startRevision(owner, { budgetId, reason: "Paciente optou por um dente a menos" });
    expect(number).toBe(2);
    const rev = await getBudget(owner, budgetId);
    expect(rev.revisionInProgress).toBe(true);
    const keep = rev.items.find((i) => i.locationLabel === "Dente 46")!;
    const drop = rev.items.find((i) => i.locationLabel === "Dente 47")!;
    // Para menor: R$ 2.000 → R$ 1.000 (pagos R$ 300).
    const res = await approveBudget(owner, {
      budgetId,
      expectedVersion: rev.budget.version,
      idempotencyKey: key(),
      approvedItemIds: [keep.id],
      discount: { type: "none" },
      plan: { downPayment: null, installments: [] },
    });
    expect(res.adjustmentCents).toBe(-100_000);
    expect(res.creditCents).toBe(0);
    const titles = await h.db.select().from(receivables).where(eq(receivables.budgetId, budgetId));
    const paid = titles.reduce((s, t) => s + t.paidPrincipalCents, 0);
    const open = titles.reduce((s, t) => s + (t.originalCents + t.adjustmentCents - t.paidPrincipalCents - t.discountGrantedCents), 0);
    expect(paid).toBe(30_000);
    expect(paid + open).toBe(100_000);
    const tItems = await h.db.select().from(treatmentItems).where(eq(treatmentItems.patientId, patientId));
    expect(tItems.find((t) => t.lineageId === drop.lineageId)!.clinicalStatus).toBe("cancelled");
    expect(tItems.find((t) => t.lineageId === keep.lineageId)!.clinicalStatus).toBe("not_started");
    // Revisão para maior com plano só da diferença.
    await startRevision(owner, { budgetId, reason: "Inclusão de restauração" });
    const r3 = await getBudget(owner, budgetId);
    await addItems(owner, { budgetId, procedureId: cat.resin, selection: { kind: "teeth", teeth: [45] } });
    const r3b = await getBudget(owner, budgetId);
    await expect(
      approveBudget(owner, {
        budgetId,
        expectedVersion: r3.budget.version,
        idempotencyKey: key(),
        approvedItemIds: r3b.items.filter((i) => i.approvalStatus !== "rejected").map((i) => i.id),
        discount: { type: "none" },
        plan: { downPayment: null, installments: [{ amountCents: 25_000, dueDate: "2027-01-05", method: "pix" }] },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    const up = await approveBudget(owner, {
      budgetId,
      expectedVersion: r3b.budget.version,
      idempotencyKey: key(),
      approvedItemIds: r3b.items.filter((i) => i.approvalStatus !== "rejected").map((i) => i.id),
      discount: { type: "none" },
      plan: { downPayment: null, installments: [{ amountCents: 25_000, dueDate: "2027-01-05", method: "pix" }] },
    });
    expect(up.adjustmentCents).toBe(25_000);
    const all = await h.db.select().from(receivables).where(eq(receivables.budgetId, budgetId));
    const total = all.reduce((s, t) => s + t.originalCents + t.adjustmentCents, 0);
    expect(total).toBe(125_000);
    expect(all.reduce((s, t) => s + t.paidPrincipalCents, 0)).toBe(30_000);
  });

  it("revisão abaixo do já pago gera crédito pendente de decisão, sem apagar pagamentos", async () => {
    const owner = await clinic.ctx("owner");
    const finance = await clinic.ctx("finance");
    const b = await newBudget();
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.resin, selection: { kind: "teeth", teeth: [33, 34] } });
    const d = await getBudget(owner, b.id);
    await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: key(),
      approvedItemIds: items.itemIds,
      discount: { type: "none" },
      plan: { downPayment: null, installments: [{ amountCents: 50_000, dueDate: "2026-10-10", method: "pix" }] },
    });
    const [t] = await h.db.select().from(receivables).where(eq(receivables.budgetId, b.id));
    await settleTitles(finance, { kind: "receivable", accountId: bankAccountId, method: "pix", settledOn: "2026-10-10", allocations: [{ titleId: t!.id, principalCents: 50_000 }] });
    await startRevision(owner, { budgetId: b.id, reason: "Um dente removido" });
    const rev = await getBudget(owner, b.id);
    const res = await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: rev.budget.version,
      idempotencyKey: key(),
      approvedItemIds: [rev.items[0]!.id],
      discount: { type: "none" },
      plan: { downPayment: null, installments: [] },
    });
    expect(res.creditCents).toBe(25_000);
    const [after] = await h.db.select().from(receivables).where(eq(receivables.id, t!.id));
    expect(after!.paidPrincipalCents).toBe(50_000);
    expect(after!.status).toBe("paid");
  });
});

describe("permissões financeiras", () => {
  it("cenário 2: profissional sem permissão financeira não obtém valores pela API", async () => {
    const dentist = await clinic.ctx("dentist");
    await expect(listTitles(dentist, { kind: "receivable" })).rejects.toThrow(/permissão/);
    const owner = await clinic.ctx("owner");
    const b = await newBudget();
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.resin, selection: { kind: "teeth", teeth: [41] } });
    const d = await getBudget(owner, b.id);
    await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: key(),
      approvedItemIds: items.itemIds,
      discount: { type: "none" },
      plan: { downPayment: null, installments: [{ amountCents: 25_000, dueDate: "2026-11-01", method: "pix" }] },
    });
    const view = await getBudget(dentist, b.id);
    expect(view.showFinance).toBe(false);
    expect(view.receivables).toEqual([]);
    expect(view.activeAgreement).toMatchObject({ hidden: true });
    const reception = await clinic.ctx("reception");
    await expect(settleTitles(reception, { kind: "receivable", accountId: bankAccountId, method: "pix", settledOn: "2026-11-01", allocations: [{ titleId: "00000000-0000-4000-8000-000000000000", principalCents: 1 }] })).rejects.toThrow(/permissão/);
  });
});
