// ============================================================
// Budget & Price Table – Shared TypeScript interfaces
// ============================================================

// ── Price Table ─────────────────────────────────────────────

export interface ServiceCategory {
  id: string
  user_id: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  created_at: string
  updated_at: string
}

export interface ServiceProduct {
  id: string
  user_id: string
  category_id: string
  name: string
  description?: string | null
  base_price: number
  cost?: number | null
  duration_minutes?: number | null
  tax_percent: number // e.g. 6.5 means 6.5%
  active: boolean
  created_at: string
  updated_at: string
  // Joined
  category?: ServiceCategory | null
}

// ── Budget / Orçamento ──────────────────────────────────────

export interface BudgetItem {
  id: string
  budget_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_per_unit: number
  tax_percent: number
  subtotal: number        // quantity * unit_price
  tax_amount: number      // subtotal * (tax_percent / 100)
  total: number           // subtotal + tax_amount
  created_at: string
  // Joined
  product?: ServiceProduct | null
}

export interface BudgetPaymentMethod {
  id: string
  budget_id: string
  method: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'transfer' | 'boleto'
  amount: number
  created_at: string
}

export type BudgetStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'paid'
export type InstallmentInterval = 'weekly' | 'biweekly' | 'monthly'

export interface Budget {
  id: string
  user_id: string
  patient_id: string
  patient_name?: string
  status: BudgetStatus
  notes?: string | null
  valid_until?: string | null
  // Payment plan
  down_payment: number
  installment_count: number
  installment_interval: InstallmentInterval
  installment_value: number
  // Calculated totals (stored for fast reads)
  subtotal: number
  total_tax: number
  total_amount: number
  total_cost: number
  net_revenue: number      // total_amount - total_cost
  created_at: string
  updated_at: string
  // Joined
  items?: BudgetItem[]
  payment_methods?: BudgetPaymentMethod[]
  patient?: { id: string; name: string } | null
}

// ── Form helpers ────────────────────────────────────────────

export interface BudgetItemDraft {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_per_unit: number
  tax_percent: number
}

export interface BudgetDraft {
  patient_id: string
  patient_name: string
  items: BudgetItemDraft[]
  notes: string
  valid_until: string
  down_payment: number
  installment_count: number
  installment_interval: InstallmentInterval
  payment_methods: { method: BudgetPaymentMethod['method']; amount: number }[]
}

export const PAYMENT_METHOD_LABELS: Record<BudgetPaymentMethod['method'], string> = {
  pix: 'Pix',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  transfer: 'Transferência',
  boleto: 'Boleto',
}

export const INSTALLMENT_INTERVAL_LABELS: Record<InstallmentInterval, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
}

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  expired: 'Expirado',
  paid: 'Pago',
}

export const BUDGET_STATUS_COLORS: Record<BudgetStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700 ring-1 ring-green-400',
}

export const CATEGORY_COLORS = [
  '#3396d3', '#ffd400', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4',
  '#84cc16', '#f97316', '#6366f1', '#14b8a6',
]
