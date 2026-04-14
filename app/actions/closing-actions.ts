"use server"

import { createClient } from "@/lib/supabase/server"

export async function getClosingData(month: number, year: number) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  // Generate date range
  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

  // Fetch payments (Receitas)
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, discount, status")
    .eq("user_id", user.id)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .eq("status", "paid")

  // Fetch expenses (Custos)
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", user.id)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)

  // Fetch budgets (Orçamentos) - to show potential revenue
  const { data: budgets } = await supabase
    .from("budgets")
    .select("total_amount, status")
    .eq("user_id", user.id)
    .gte("created_at", startDate)
    .lte("created_at", endDate)

  // Fetch appointments (Consultas Realizadas)
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", ["completed", "attended"])

  let totalRevenue = 0
  payments?.forEach(p => totalRevenue += (Number(p.amount) - (Number(p.discount) || 0)))

  let totalExpenses = 0
  expenses?.forEach(e => totalExpenses += Number(e.amount))

  let totalBudgetsApproved = 0
  let totalBudgetsPending = 0
  budgets?.forEach(b => {
      if (b.status === 'approved' || b.status === 'paid') totalBudgetsApproved += Number(b.total_amount)
      else if (b.status === 'sent' || b.status === 'draft') totalBudgetsPending += Number(b.total_amount)
  })

  return {
    success: true,
    data: {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalBudgetsApproved,
      totalBudgetsPending,
      completedAppointments: appointments?.length || 0
    }
  }
}

export async function addExpense(payload: { amount: number, category: string, description: string, date: string }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { error } = await supabase.from('expenses').insert([{
    user_id: user.id,
    amount: payload.amount,
    category: payload.category,
    description: payload.description,
    expense_date: payload.date
  }])

  if (error) {
     console.error("Failed to insert expense:", error)
     return { success: false, error: "Failed to record expense" }
  }

  return { success: true }
}

export async function fetchExpenses(month: number, year: number) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const startDate = new Date(year, month - 1, 1).toISOString()
  const endDate = new Date(year, month, 0, 23, 59, 59).toISOString()

  const { data, error } = await supabase
    .from("expenses")
    .select("id, amount, category, description, expense_date")
    .eq("user_id", user.id)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate)
    .order("expense_date", { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}
