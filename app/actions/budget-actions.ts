"use server"

import { createClient } from "@/lib/supabase/server"
import { calculateItemTotals, calculateBudgetTotals } from "@/lib/budget-calculations"
import type {
  Budget,
  BudgetItem,
  BudgetPaymentMethod,
  BudgetStatus,
  BudgetItemDraft,
  InstallmentInterval,
} from "@/lib/budget-types"
import { recordPayment } from "./financial-actions"

// ============================================================
// BUDGETS (Orçamentos)
// ============================================================

export async function getBudgets(): Promise<Budget[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      patient:patients(id, name),
      items:budget_items(*),
      payment_methods:budget_payment_methods(*)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching budgets:", error)
    return []
  }
  return (data || []) as unknown as Budget[]
}

export async function getBudgetById(id: string): Promise<Budget | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      patient:patients(id, name),
      items:budget_items(*),
      payment_methods:budget_payment_methods(*)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) {
    console.error("Error fetching budget:", error)
    return null
  }
  return data as unknown as Budget
}

export async function getBudgetsByPatient(patientId: string): Promise<Budget[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      patient:patients(id, name),
      items:budget_items(*)
    `)
    .eq("user_id", user.id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching budgets for patient:", error)
    return []
  }
  return (data || []) as unknown as Budget[]
}

export async function createBudget(payload: {
  patient_id: string
  items: BudgetItemDraft[]
  notes?: string
  valid_until?: string
  down_payment: number
  installment_count: number
  installment_interval: InstallmentInterval
  payment_methods: { method: BudgetPaymentMethod['method']; amount: number }[]
  status?: BudgetStatus
}): Promise<{ success: boolean; data?: Budget; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  // Calculate totals
  const totals = calculateBudgetTotals(
    payload.items,
    payload.down_payment,
    payload.installment_count,
  )

  // Insert budget
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({
      user_id: user.id,
      patient_id: payload.patient_id,
      status: payload.status || "draft",
      notes: payload.notes || null,
      valid_until: payload.valid_until || null,
      down_payment: payload.down_payment,
      installment_count: payload.installment_count,
      installment_interval: payload.installment_interval,
      installment_value: totals.installment_value,
      subtotal: totals.subtotal,
      total_tax: totals.total_tax,
      total_amount: totals.total_amount,
      total_cost: totals.total_cost,
      net_revenue: totals.net_revenue,
    })
    .select()
    .single()

  if (budgetError) {
    console.error("Error creating budget:", budgetError)
    return { success: false, error: budgetError.message }
  }

  // Insert items
  const itemRows = payload.items.map((item) => {
    const calc = calculateItemTotals(item)
    return {
      budget_id: budget.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_per_unit: item.cost_per_unit,
      tax_percent: item.tax_percent,
      subtotal: calc.subtotal,
      tax_amount: calc.tax_amount,
      total: calc.total,
    }
  })

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabase
      .from("budget_items")
      .insert(itemRows)

    if (itemsError) {
      console.error("Error inserting budget items:", itemsError)
      // Clean up
      await supabase.from("budgets").delete().eq("id", budget.id)
      return { success: false, error: itemsError.message }
    }
  }

  // Insert payment methods
  if (payload.payment_methods.length > 0) {
    const pmRows = payload.payment_methods.map((pm) => ({
      budget_id: budget.id,
      method: pm.method,
      amount: pm.amount,
    }))
    const { error: pmError } = await supabase
      .from("budget_payment_methods")
      .insert(pmRows)

    if (pmError) {
      console.error("Error inserting payment methods:", pmError)
      // Non-fatal – budget was still created
    }
  }

  return { success: true, data: budget as unknown as Budget }
}

export async function updateBudgetStatus(
  id: string,
  status: BudgetStatus,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { data: budget, error: fetchError } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .single()
    
  if (fetchError || !budget) {
    return { success: false, error: "Orçamento não encontrado" }
  }

  const { error } = await supabase
    .from("budgets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error updating budget status:", error)
    return { success: false, error: error.message }
  }

  // Automatic Financial Integration
  if (status === 'paid' && budget.status !== 'paid') {
    try {
      await recordPayment({
         patient_id: budget.patient_id,
         amount: budget.total_amount || 0,
         status: "paid",
         notes: `Pagamento automático de Orçamento (Aprovado e Pago)`,
         payment_date: new Date().toISOString()
      });
    } catch (paymentErr) {
       console.error("Error creating integrated payment for budget:", paymentErr)
    }
  }

  return { success: true }
}

export async function duplicateBudget(id: string): Promise<{ success: boolean; data?: Budget; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const original = await getBudgetById(id)
  if (!original) return { success: false, error: "Budget not found" }

  // Rebuild items as drafts
  const itemDrafts: BudgetItemDraft[] = (original.items || []).map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    cost_per_unit: item.cost_per_unit,
    tax_percent: item.tax_percent,
  }))

  const pmDrafts = (original.payment_methods || []).map((pm) => ({
    method: pm.method,
    amount: pm.amount,
  }))

  return createBudget({
    patient_id: original.patient_id,
    items: itemDrafts,
    notes: original.notes || "",
    valid_until: "",
    down_payment: original.down_payment,
    installment_count: original.installment_count,
    installment_interval: original.installment_interval,
    payment_methods: pmDrafts,
    status: "draft",
  })
}

export async function deleteBudget(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  // Delete items and payment methods first 
  await supabase.from("budget_items").delete().eq("budget_id", id)
  await supabase.from("budget_payment_methods").delete().eq("budget_id", id)

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error deleting budget:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getBudgetDashboardStats() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return {
    totalBudgets: 0,
    totalRevenue: 0,
    netRevenue: 0,
    conversionRate: 0,
    approvedCount: 0,
  }

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("id, status, total_amount, total_cost, net_revenue")
    .eq("user_id", user.id)

  if (error) {
    console.error("Error fetching budget stats:", error)
    return {
      totalBudgets: 0,
      totalRevenue: 0,
      netRevenue: 0,
      conversionRate: 0,
      approvedCount: 0,
    }
  }

  const all = budgets || []
  const totalBudgets = all.length
  const approved = all.filter((b) => b.status === "approved")
  const approvedCount = approved.length
  const totalRevenue = approved.reduce((sum, b) => sum + (b.total_amount || 0), 0)
  const netRevenue = approved.reduce((sum, b) => sum + (b.net_revenue || 0), 0)
  const sentOrApproved = all.filter((b) => b.status === "sent" || b.status === "approved").length
  const conversionRate = sentOrApproved > 0
    ? Math.round((approvedCount / sentOrApproved) * 100)
    : 0

  return {
    totalBudgets,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    conversionRate,
    approvedCount,
  }
}
