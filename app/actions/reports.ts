"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type Report = {
  id: string
  user_id: string
  title: string
  description?: string
  report_type: "financial" | "appointments" | "patients" | "custom"
  date_range_start?: string
  date_range_end?: string
  data?: any
  created_at: string
  updated_at: string
}

export type CreateReportInput = {
  title: string
  description?: string
  report_type: "financial" | "appointments" | "patients" | "custom"
  date_range_start?: string
  date_range_end?: string
  data?: any
}

export async function getDashboardStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  // Get total appointments
  const { count: totalAppointments } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  // Get active patients
  const { count: activePatients } = await supabase
    .from("patients")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active")

  // Get completed appointments
  const { count: completedAppointments } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "completed")

  // Get active professionals
  const { count: totalProfessionals } = await supabase
    .from("professionals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active")

  // Calculate completion rate
  const completionRate =
    totalAppointments && totalAppointments > 0
      ? Math.round(((completedAppointments || 0) / totalAppointments) * 100)
      : 0

  return {
    totalAppointments: totalAppointments || 0,
    activePatients: activePatients || 0,
    totalProfessionals: totalProfessionals || 0,
    completionRate,
  }
}

export async function getAppointmentsByMonth() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  // Get appointments from the last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("appointment_date, status")
    .eq("user_id", user.id)
    .gte("appointment_date", sixMonthsAgo.toISOString().split("T")[0])
    .order("appointment_date", { ascending: true })

  if (error) {
    console.error("Error fetching appointments:", error)
    return []
  }

  // Initialize last 6 months
  const monthlyData: Record<string, { completed: number; cancelled: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    monthlyData[key] = { completed: 0, cancelled: 0 }
  }

  appointments?.forEach((apt) => {
    const date = new Date(apt.appointment_date)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })

    if (monthlyData[monthKey] !== undefined) {
      if (apt.status === "completed") monthlyData[monthKey].completed++
      if (apt.status === "cancelled") monthlyData[monthKey].cancelled++
    }
  })

  // Convert to array format for charts
  return Object.entries(monthlyData).map(([month, data]) => ({
    month: month.split(" ")[0].charAt(0).toUpperCase() + month.split(" ")[0].slice(1, 3),
    ...data,
  }))
}

export async function getPatientGrowth() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  // Get patients from the last 6 months
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: patients, error } = await supabase
    .from("patients")
    .select("created_at")
    .eq("user_id", user.id)
    .gte("created_at", sixMonthsAgo.toISOString())
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching patients:", error)
    return []
  }

  // Initialize last 6 months
  const monthlyData: Record<string, { newPatients: number; totalPatients: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    monthlyData[key] = { newPatients: 0, totalPatients: 0 }
  }

  let cumulativeTotal = 0
  patients?.forEach((patient) => {
    const date = new Date(patient.created_at)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })

    if (monthlyData[monthKey] !== undefined) {
      monthlyData[monthKey].newPatients++
    }
    cumulativeTotal++
  })

  // Calculate cumulative total per month
  let currentTotal = 0
  const sortedKeys = Object.keys(monthlyData)
  sortedKeys.forEach(key => {
    currentTotal += monthlyData[key].newPatients
    monthlyData[key].totalPatients = currentTotal
  })

  // Convert to array format for charts
  return Object.entries(monthlyData).map(([month, data]) => ({
    month: month.split(" ")[0].charAt(0).toUpperCase() + month.split(" ")[0].slice(1, 4), // up to 3 chars
    ...data,
  }))
}

export async function getFinancialStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  // Get total income from payments
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("user_id", user.id)
    .eq("status", "paid")

  const totalIncome = payments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

  // Get total expenses (Manual)
  const { data: expenses } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", user.id)

  const manualExpenses = expenses?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

  // Get Budget Costs
  const { data: budgets } = await supabase
    .from("budgets")
    .select("total_cost")
    .eq("user_id", user.id)
    .eq("status", "paid")

  const budgetCosts = budgets?.reduce((acc, curr) => acc + Number(curr.total_cost), 0) || 0

  const totalExpenses = manualExpenses + budgetCosts
  const netProfit = totalIncome - totalExpenses

  return {
    totalIncome,
    totalExpenses,
    manualExpenses,
    budgetCosts,
    netProfit,
  }
}

export async function getBudgetStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data: budgets } = await supabase
    .from("budgets")
    .select("status, total_amount")
    .eq("user_id", user.id)

  const stats = {
    total: budgets?.length || 0,
    approved: budgets?.filter(b => b.status === "approved" || b.status === "paid").length || 0,
    pending: budgets?.filter(b => b.status === "draft" || b.status === "sent").length || 0,
    totalValue: budgets?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0
  }

  return stats
}

export async function getServiceStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data: products } = await supabase
    .from("service_products")
    .select("name, base_price")
    .eq("user_id", user.id)

  return {
    totalServices: products?.length || 0,
    averagePrice: products && products.length > 0 
      ? products.reduce((acc, curr) => acc + Number(curr.base_price), 0) / products.length 
      : 0
  }
}

export async function getIncomeExpenseData() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const [payments, expenses, budgets] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, payment_date")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .gte("payment_date", sixMonthsAgo.toISOString()),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("user_id", user.id)
      .gte("expense_date", sixMonthsAgo.toISOString().split("T")[0]),
    supabase
      .from("budgets")
      .select("total_cost, updated_at")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .gte("updated_at", sixMonthsAgo.toISOString())
  ])

  // Initialize last 6 months
  const monthlyData: Record<string, { income: number; expenses: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    monthlyData[key] = { income: 0, expenses: 0 }
  }

  payments.data?.forEach(pay => {
    const date = new Date(pay.payment_date)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    if (monthlyData[monthKey] !== undefined) {
      monthlyData[monthKey].income += Number(pay.amount)
    }
  })

  expenses.data?.forEach(exp => {
    const date = new Date(exp.expense_date)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    if (monthlyData[monthKey] !== undefined) {
      monthlyData[monthKey].expenses += Number(exp.amount)
    }
  })

  budgets.data?.forEach(bg => {
    const date = new Date(bg.updated_at)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    if (monthlyData[monthKey] !== undefined) {
      monthlyData[monthKey].expenses += Number(bg.total_cost)
    }
  })

  return Object.entries(monthlyData).map(([month, data]) => ({
    month: month.split(" ")[0].charAt(0).toUpperCase() + month.split(" ")[0].slice(1, 3),
    ...data,
  }))
}

export async function getReports(): Promise<Report[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching reports:", error)
    throw new Error("Erro ao buscar relatórios")
  }

  return data || []
}

export async function createReport(input: CreateReportInput): Promise<Report> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      ...input,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating report:", error)
    throw new Error("Erro ao criar relatório")
  }

  revalidatePath("/dashboard")
  return data
}

export async function updateReport(id: string, input: Partial<CreateReportInput>): Promise<Report> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data, error } = await supabase
    .from("reports")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating report:", error)
    throw new Error("Erro ao atualizar relatório")
  }

  revalidatePath("/dashboard")
  return data
}

export async function deleteReport(id: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { error } = await supabase.from("reports").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    console.error("Error deleting report:", error)
    throw new Error("Erro ao deletar relatório")
  }

  revalidatePath("/dashboard")
}
