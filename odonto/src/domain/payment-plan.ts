import { isValidCivil, monthlySchedule, type CivilDate } from "./dates";
import { computeDiscount, formatBRL, prorate, splitEvenly, sumCents, type Cents, type DiscountInput } from "./money";

export const PAYMENT_METHODS = ["pix", "cash", "debit", "credit", "boleto", "transfer", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  boleto: "Boleto",
  transfer: "Transferência",
  other: "Outra",
};

export interface PlanLine {
  amountCents: Cents;
  dueDate: CivilDate;
  method: PaymentMethod;
  /** Obrigatório quando method = "other". */
  methodNote?: string | null;
}

export interface PaymentPlan {
  downPayment: PlanLine | null;
  installments: PlanLine[];
}

export interface AgreementTotals {
  subtotalCents: Cents;
  discountCents: Cents;
  totalCents: Cents;
  /** Desconto global rateado por item (mesma ordem dos itens), soma = desconto. */
  itemDiscounts: Cents[];
}

/**
 * subtotal = soma dos itens aceitos; desconto = reais OU percentual sobre o
 * subtotal; total = subtotal − desconto. O rateio por item usa maiores restos.
 */
export function computeAgreementTotals(itemSubtotals: readonly Cents[], discount: DiscountInput): AgreementTotals {
  const subtotalCents = sumCents(itemSubtotals);
  const discountCents = computeDiscount(subtotalCents, discount);
  return {
    subtotalCents,
    discountCents,
    totalCents: subtotalCents - discountCents,
    itemDiscounts: prorate(discountCents, itemSubtotals),
  };
}

export interface DefaultPlanInput {
  totalCents: Cents;
  downPaymentCents: Cents;
  downPaymentDate: CivilDate | null;
  downPaymentMethod: PaymentMethod;
  installmentsCount: number;
  firstDueDate: CivilDate | null;
  installmentMethod: PaymentMethod;
}

export class PlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanError";
  }
}

/** Gera a proposta inicial de entrada + parcelas, editável depois linha a linha. */
export function buildDefaultPlan(input: DefaultPlanInput): PaymentPlan {
  const { totalCents, downPaymentCents } = input;
  if (downPaymentCents < 0) throw new PlanError("Entrada não pode ser negativa");
  if (downPaymentCents > totalCents) throw new PlanError("Entrada não pode exceder o total negociado");
  const remaining = totalCents - downPaymentCents;
  let downPayment: PlanLine | null = null;
  if (downPaymentCents > 0) {
    if (!input.downPaymentDate) throw new PlanError("Informe a data da entrada");
    downPayment = { amountCents: downPaymentCents, dueDate: input.downPaymentDate, method: input.downPaymentMethod };
  }
  if (remaining === 0) return { downPayment, installments: [] };
  if (!Number.isInteger(input.installmentsCount) || input.installmentsCount < 1 || input.installmentsCount > 120) {
    throw new PlanError("Quantidade de parcelas deve estar entre 1 e 120");
  }
  if (!input.firstDueDate) throw new PlanError("Informe o primeiro vencimento");
  const amounts = splitEvenly(remaining, input.installmentsCount);
  const dates = monthlySchedule(input.firstDueDate, input.installmentsCount);
  return {
    downPayment,
    installments: amounts.map((amountCents, i) => ({
      amountCents,
      dueDate: dates[i]!,
      method: input.installmentMethod,
    })),
  };
}

/** Validação do plano editado: entrada + parcelas = total negociado, sem valores vazios. */
export function validatePlan(plan: PaymentPlan, totalCents: Cents): string[] {
  const errors: string[] = [];
  const lines = [...(plan.downPayment ? [plan.downPayment] : []), ...plan.installments];
  if (totalCents === 0) {
    if (lines.length > 0) errors.push("Total zero não gera títulos; remova entrada e parcelas");
    return errors;
  }
  if (plan.downPayment && plan.downPayment.amountCents > totalCents) {
    errors.push("Entrada não pode exceder o total negociado");
  }
  lines.forEach((line, i) => {
    const label = plan.downPayment && i === 0 ? "Entrada" : `Parcela ${plan.downPayment ? i : i + 1}`;
    if (!Number.isSafeInteger(line.amountCents) || line.amountCents <= 0) errors.push(`${label}: valor deve ser positivo`);
    if (!isValidCivil(line.dueDate)) errors.push(`${label}: vencimento inválido`);
    if (!PAYMENT_METHODS.includes(line.method)) errors.push(`${label}: forma de pagamento inválida`);
    if (line.method === "other" && !line.methodNote?.trim()) errors.push(`${label}: identifique a forma "outra"`);
  });
  if (lines.length === 0) errors.push("Informe entrada e/ou parcelas");
  const sum = sumCents(lines.map((l) => (Number.isSafeInteger(l.amountCents) ? l.amountCents : 0)));
  if (sum !== totalCents) {
    errors.push(`Entrada + parcelas somam ${formatBRL(sum)}; o total negociado é ${formatBRL(totalCents)}`);
  }
  return errors;
}
