// ============================================================
// Budget & Price Table – Pure calculation functions
// No side-effects, no DB calls – fully testable
// ============================================================

import type { BudgetItemDraft } from './budget-types'

export interface CalculatedItem {
  subtotal: number
  tax_amount: number
  total: number
  cost_total: number
}

export interface CalculatedBudget {
  subtotal: number
  total_tax: number
  total_amount: number
  total_cost: number
  net_revenue: number
  installment_value: number
}

/**
 * Calculate line-item totals for a single budget item
 */
export function calculateItemTotals(item: BudgetItemDraft): CalculatedItem {
  const subtotal = round(item.quantity * item.unit_price)
  const tax_amount = round(subtotal * (item.tax_percent / 100))
  const total = round(subtotal + tax_amount)
  const cost_total = round(item.quantity * item.cost_per_unit)
  return { subtotal, tax_amount, total, cost_total }
}

/**
 * Calculate full budget totals from a list of draft items
 */
export function calculateBudgetTotals(
  items: BudgetItemDraft[],
  downPayment: number = 0,
  installmentCount: number = 1,
): CalculatedBudget {
  let subtotal = 0
  let total_tax = 0
  let total_amount = 0
  let total_cost = 0

  for (const item of items) {
    const calc = calculateItemTotals(item)
    subtotal += calc.subtotal
    total_tax += calc.tax_amount
    total_amount += calc.total
    total_cost += calc.cost_total
  }

  subtotal = round(subtotal)
  total_tax = round(total_tax)
  total_amount = round(total_amount)
  total_cost = round(total_cost)

  const net_revenue = round(total_amount - total_cost)

  // Installment value = (total - down payment) / number of installments
  const remaining = Math.max(0, total_amount - downPayment)
  const installment_value = installmentCount > 0
    ? round(remaining / installmentCount)
    : 0

  return {
    subtotal,
    total_tax,
    total_amount,
    total_cost,
    net_revenue,
    installment_value,
  }
}

/**
 * Suggest payment plans based on budget total
 */
export function suggestPaymentPlans(totalAmount: number) {
  const plans = []

  if (totalAmount <= 500) {
    plans.push({ label: 'À vista', downPayment: totalAmount, installments: 1, interval: 'monthly' as const })
    plans.push({ label: '2x sem entrada', downPayment: 0, installments: 2, interval: 'monthly' as const })
  } else if (totalAmount <= 2000) {
    plans.push({ label: 'À vista', downPayment: totalAmount, installments: 1, interval: 'monthly' as const })
    plans.push({ label: '50% entrada + 2x', downPayment: round(totalAmount * 0.5), installments: 2, interval: 'monthly' as const })
    plans.push({ label: '30% entrada + 3x', downPayment: round(totalAmount * 0.3), installments: 3, interval: 'monthly' as const })
    plans.push({ label: '6x sem entrada', downPayment: 0, installments: 6, interval: 'monthly' as const })
  } else {
    plans.push({ label: 'À vista', downPayment: totalAmount, installments: 1, interval: 'monthly' as const })
    plans.push({ label: '50% entrada + 3x', downPayment: round(totalAmount * 0.5), installments: 3, interval: 'monthly' as const })
    plans.push({ label: '30% entrada + 6x', downPayment: round(totalAmount * 0.3), installments: 6, interval: 'monthly' as const })
    plans.push({ label: '10x sem entrada', downPayment: 0, installments: 10, interval: 'monthly' as const })
    plans.push({ label: '12x sem entrada', downPayment: 0, installments: 12, interval: 'monthly' as const })
  }

  return plans
}

// Utility: round to 2 decimal places
function round(n: number): number {
  return Math.round(n * 100) / 100
}
