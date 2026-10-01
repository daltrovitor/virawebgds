import { describe, expect, it } from "vitest";
import { addMonthsPreservingDay, monthlySchedule } from "@/domain/dates";
import {
  centsToInput,
  computeDiscount,
  formatBRL,
  parseBRL,
  parsePercentToBasisPoints,
  prorate,
  splitEvenly,
  sumCents,
} from "@/domain/money";
import { buildDefaultPlan, computeAgreementTotals, validatePlan } from "@/domain/payment-plan";

describe("dinheiro em centavos", () => {
  it("cenário 9: R$ 100 em três parcelas fecha exatamente R$ 100 (centavos nas primeiras)", () => {
    const parts = splitEvenly(10_000, 3);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(sumCents(parts)).toBe(10_000);
  });

  it("rateio proporcional determinístico fecha o total", () => {
    const shares = prorate(1000, [60000, 30000, 10000]);
    expect(shares).toEqual([600, 300, 100]);
    const odd = prorate(100, [1, 1, 1]);
    expect(sumCents(odd)).toBe(100);
    expect(odd).toEqual([34, 33, 33]);
    const tricky = prorate(1, [33333, 33333, 33334]);
    expect(sumCents(tricky)).toBe(1);
    expect(tricky).toEqual([0, 0, 1]);
  });

  it("desconto em reais ou percentual, nunca acima do subtotal", () => {
    expect(computeDiscount(1_000_000, { type: "percent", basisPoints: 1000 })).toBe(100_000);
    expect(computeDiscount(999, { type: "percent", basisPoints: 1050 })).toBe(105); // 104,895 → 105
    expect(computeDiscount(5000, { type: "amount", cents: 500 })).toBe(500);
    expect(() => computeDiscount(5000, { type: "amount", cents: 5001 })).toThrow(/exceder/);
    expect(() => computeDiscount(5000, { type: "amount", cents: -1 })).toThrow();
    expect(() => computeDiscount(5000, { type: "percent", basisPoints: 10001 })).toThrow();
  });

  it("interpreta e formata valores pt-BR", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("R$ 10,5")).toBe(1050);
    expect(parseBRL("1234.56")).toBe(123456);
    expect(parseBRL("1.234")).toBe(123400);
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("")).toBeNull();
    expect(centsToInput(123456)).toBe("1.234,56");
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatBRL(-5).replace(/\s/g, " ").replace(String.fromCharCode(0x2060), "")).toBe("-R$ 0,05");
    expect(parsePercentToBasisPoints("7,5")).toBe(750);
    expect(parsePercentToBasisPoints("101")).toBeNull();
  });
});

describe("plano de pagamento", () => {
  it("cenário 8: R$ 10.000, 10% de desconto, entrada R$ 1.000, 4 × R$ 2.000", () => {
    const totals = computeAgreementTotals([600_000, 400_000], { type: "percent", basisPoints: 1000 });
    expect(totals).toMatchObject({ subtotalCents: 1_000_000, discountCents: 100_000, totalCents: 900_000 });
    expect(sumCents(totals.itemDiscounts)).toBe(100_000);
    const plan = buildDefaultPlan({
      totalCents: totals.totalCents,
      downPaymentCents: 100_000,
      downPaymentDate: "2026-10-01",
      downPaymentMethod: "pix",
      installmentsCount: 4,
      firstDueDate: "2026-11-10",
      installmentMethod: "credit",
    });
    expect(plan.installments.map((i) => i.amountCents)).toEqual([200_000, 200_000, 200_000, 200_000]);
    expect(plan.downPayment?.method).toBe("pix");
    expect(plan.installments[0]?.method).toBe("credit");
    expect(validatePlan(plan, 900_000)).toEqual([]);
    expect(sumCents([plan.downPayment!.amountCents, ...plan.installments.map((i) => i.amountCents)])).toBe(900_000);
  });

  it("cenário 10: dia-base 30 passa por 28/02/2027 e retorna a 30/03/2027", () => {
    expect(monthlySchedule("2027-01-30", 3)).toEqual(["2027-01-30", "2027-02-28", "2027-03-30"]);
    expect(addMonthsPreservingDay("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsPreservingDay("2027-01-31", 2)).toBe("2027-03-31");
    expect(addMonthsPreservingDay("2028-01-30", 1)).toBe("2028-02-29");
    expect(addMonthsPreservingDay("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("recusa plano cuja soma não fecha o total e entrada maior que o total", () => {
    const plan = {
      downPayment: { amountCents: 1000, dueDate: "2026-10-01", method: "pix" as const },
      installments: [{ amountCents: 500, dueDate: "2026-11-01", method: "boleto" as const }],
    };
    expect(validatePlan(plan, 2000).join()).toMatch(/somam/);
    expect(() =>
      buildDefaultPlan({
        totalCents: 1000,
        downPaymentCents: 2000,
        downPaymentDate: "2026-10-01",
        downPaymentMethod: "pix",
        installmentsCount: 1,
        firstDueDate: "2026-11-01",
        installmentMethod: "pix",
      }),
    ).toThrow(/exceder/);
  });

  it("total zero não gera títulos", () => {
    const plan = buildDefaultPlan({
      totalCents: 0,
      downPaymentCents: 0,
      downPaymentDate: null,
      downPaymentMethod: "pix",
      installmentsCount: 1,
      firstDueDate: null,
      installmentMethod: "pix",
    });
    expect(plan).toEqual({ downPayment: null, installments: [] });
    expect(validatePlan(plan, 0)).toEqual([]);
  });

  it("forma 'outra' exige identificação", () => {
    const plan = { downPayment: null, installments: [{ amountCents: 100, dueDate: "2026-11-01", method: "other" as const }] };
    expect(validatePlan(plan, 100).join()).toMatch(/identifique/);
  });
});
