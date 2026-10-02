// Hello World
/**
 * Plano de pagamento de orçamentos (funções puras, sem I/O).
 * Espelha o fluxo "Configure → Calcular/Gravar" do contas a receber odontológico:
 * desconto (% ou R$), entrada, quantidade de parcelas, início do pagamento e forma de pagamento.
 */

import type { BudgetPaymentMethod } from "./budget-types"

export type PlanPaymentMethod = BudgetPaymentMethod["method"]

export interface PaymentPlanInput {
  /** Soma bruta dos procedimentos (R$). */
  gross: number
  discount: { mode: "percent" | "amount"; value: number }
  /** Valor de entrada (R$), pago na data de início. */
  downPayment: number
  /** Parcelas após a entrada (0 = à vista, somente entrada ou pagamento único). */
  installments: number
  /** Data ISO (yyyy-mm-dd) da entrada ou da primeira parcela. */
  firstDueDate: string
  method: PlanPaymentMethod
}

export interface PlannedInstallment {
  /** 0 = entrada. */
  number: number
  label: string
  dueDate: string
  amount: number
  method: PlanPaymentMethod
}

export interface PaymentPlan {
  gross: number
  discountAmount: number
  net: number
  downPayment: number
  installmentValue: number
  schedule: PlannedInstallment[]
}

const toCents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100)
const fromCents = (cents: number) => cents / 100

/** Soma meses preservando o dia original e limitando ao último dia do mês (30/01 → 28/02 → 30/03). */
export function addMonthsClamped(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number)
  if (!y || !m || !d) throw new Error(`Data inválida: ${isoDate}`)
  const targetMonthIndex = m - 1 + months
  const year = y + Math.floor(targetMonthIndex / 12)
  const monthIndex = ((targetMonthIndex % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function computeDiscount(gross: number, discount: PaymentPlanInput["discount"]): number {
  const grossCents = toCents(gross)
  const value = Math.max(0, discount.value || 0)
  const cents = discount.mode === "percent" ? Math.round((grossCents * Math.min(value, 100)) / 100) : toCents(value)
  return fromCents(Math.min(cents, grossCents))
}

/**
 * Gera o cronograma. Distribui centavos de forma exata: as primeiras parcelas recebem o centavo
 * excedente, então a soma do cronograma é sempre igual ao valor líquido.
 */
export function buildPaymentPlan(input: PaymentPlanInput): PaymentPlan {
  const grossCents = Math.max(0, toCents(input.gross))
  const discountCents = toCents(computeDiscount(input.gross, input.discount))
  const netCents = grossCents - discountCents
  const downCents = Math.min(Math.max(0, toCents(input.downPayment)), netCents)
  const count = Math.max(0, Math.floor(input.installments || 0))
  const remainingCents = netCents - downCents

  const schedule: PlannedInstallment[] = []
  const hasEntry = downCents > 0

  if (hasEntry) {
    schedule.push({ number: 0, label: "Entrada", dueDate: input.firstDueDate, amount: fromCents(downCents), method: input.method })
  }

  if (count > 0 && remainingCents > 0) {
    const base = Math.floor(remainingCents / count)
    const remainder = remainingCents - base * count
    for (let i = 0; i < count; i++) {
      const cents = base + (i < remainder ? 1 : 0)
      // Com entrada, a 1ª parcela vence um mês depois; sem entrada, vence na data de início.
      const monthOffset = hasEntry ? i + 1 : i
      schedule.push({
        number: i + 1,
        label: `${i + 1}/${count}`,
        dueDate: addMonthsClamped(input.firstDueDate, monthOffset),
        amount: fromCents(cents),
        method: input.method,
      })
    }
  } else if (remainingCents > 0) {
    // Sem parcelas informadas: saldo em pagamento único.
    schedule.push({ number: 1, label: "1/1", dueDate: input.firstDueDate, amount: fromCents(remainingCents), method: input.method })
  }

  return {
    gross: fromCents(grossCents),
    discountAmount: fromCents(discountCents),
    net: fromCents(netCents),
    downPayment: fromCents(downCents),
    installmentValue: count > 0 ? fromCents(Math.floor(remainingCents / count)) : fromCents(remainingCents),
    schedule,
  }
}

/** Ajuste manual de uma parcela: o saldo é redistribuído nas parcelas seguintes (comportamento de planilha). */
export function rebalanceSchedule(schedule: PlannedInstallment[], index: number, newAmount: number, net: number): PlannedInstallment[] {
  const next = schedule.map((item) => ({ ...item }))
  if (!next[index]) return next
  next[index].amount = fromCents(Math.max(0, toCents(newAmount)))
  const fixedCents = next.slice(0, index + 1).reduce((sum, item) => sum + toCents(item.amount), 0)
  const tail = next.slice(index + 1)
  if (tail.length === 0) return next
  const remaining = Math.max(0, toCents(net) - fixedCents)
  const base = Math.floor(remaining / tail.length)
  const remainder = remaining - base * tail.length
  tail.forEach((item, i) => {
    item.amount = fromCents(base + (i < remainder ? 1 : 0))
  })
  return next
}

export function scheduleTotal(schedule: PlannedInstallment[]): number {
  return fromCents(schedule.reduce((sum, item) => sum + toCents(item.amount), 0))
}

/** Valores aceitos pela coluna `payments.method` (migração 050). */
export function toPaymentsMethod(method: PlanPaymentMethod): "cash" | "credit" | "debit" | "pix" | "transfer" | null {
  switch (method) {
    case "cash": return "cash"
    case "credit_card": return "credit"
    case "debit_card": return "debit"
    case "pix": return "pix"
    case "transfer": return "transfer"
    default: return null
  }
}

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—"
  const [y, m, d] = iso.slice(0, 10).split("-")
  return y && m && d ? `${d}/${m}/${y}` : iso
}

export function todayISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}
