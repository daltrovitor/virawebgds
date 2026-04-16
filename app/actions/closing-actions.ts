"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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

  // Fetch budgets (Orçamentos)
  // We include budgets created in this period OR updated to approved/paid in this period
  const { data: budgets } = await supabase
    .from("budgets")
    .select("total_amount, total_cost, status, created_at, updated_at")
    .eq("user_id", user.id)
    .or(`created_at.gte.${startDate},updated_at.gte.${startDate}`)
    .or(`created_at.lte.${endDate},updated_at.lte.${endDate}`)

  // Fetch appointments (Consultas Realizadas)
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, status")
    .eq("user_id", user.id)
    .gte("appointment_date", startDate)
    .lte("appointment_date", endDate)
    .in("status", ["completed", "attended"])

  let totalRevenue = 0
  payments?.forEach(p => totalRevenue += (Number(p.amount) - (Number(p.discount) || 0)))

  let totalExpenses = 0
  expenses?.forEach(e => totalExpenses += Number(e.amount))

  let totalBudgetsApproved = 0
  let totalBudgetsPending = 0
  budgets?.forEach(b => {
      // Logic: if it's approved or paid and was updated in this period, count it as part of this month's result
      // if it was created in this period and is still pending, count it as pending
      const wasUpdatedInPeriod = b.updated_at >= startDate && b.updated_at <= endDate
      const wasCreatedInPeriod = b.created_at >= startDate && b.created_at <= endDate
      
      if ((b.status === 'approved' || b.status === 'paid') && wasUpdatedInPeriod) {
          totalBudgetsApproved += Number(b.total_amount)
          // Sum budget costs to total expenses for accurate accounting profit
          totalExpenses += Number(b.total_cost || 0)
      } else if ((b.status === 'sent' || b.status === 'draft') && wasCreatedInPeriod) {
          totalBudgetsPending += Number(b.total_amount)
      }
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

  try {
    revalidatePath("/dashboard")
  } catch (e) {}

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
