"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Session {
  id: string
  patient_id: string
  date: string
  paid: boolean
  amount: number
  payment_id: string | null
}

export interface FinancialMetrics {
  date: string
  income: number
  expenses: number
  defaultRate: number
}

export async function getPatientSessions(patientId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const { data, error } = await supabase
    .from("financial_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("patient_id", patientId)
    .order("date", { ascending: false })

  if (error) {
    console.error("Error fetching patient sessions:", error)
    throw error
  }

  return data as Session[]
}

export async function updateSession(
  sessionId: string,
  updates: {
    paid?: boolean
    amount?: number
    payment_id?: string | null
  }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const { error } = await supabase
    .from("financial_sessions")
    .update(updates)
    .eq("id", sessionId)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error updating session:", error)
    throw error
  }

  revalidatePath("/dashboard/financial")
}

export async function getFinancialMetrics(period: "week" | "month" | "quarter" | "year") {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const now = new Date()
  const startDate = new Date()

  switch (period) {
    case "week":
      startDate.setDate(now.getDate() - 7)
      break
    case "month":
      startDate.setMonth(now.getMonth() - 1)
      break
    case "quarter":
      startDate.setMonth(now.getMonth() - 3)
      break
    case "year":
      startDate.setFullYear(now.getFullYear() - 1)
      break
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount,discount,status,payment_date")
    .eq("user_id", user.id)
    .gte("payment_date", startDate.toISOString())
    .lte("payment_date", now.toISOString())

  if (paymentsError) {
    console.error("Error fetching payments:", paymentsError)
    throw paymentsError
  }

  // Agrupar pagamentos por dia
  const metrics = new Map<string, FinancialMetrics>()
  for (const payment of payments) {
    const date = payment.payment_date.split("T")[0]
    const current = metrics.get(date) || {
      date,
      income: 0,
      expenses: 0,
      defaultRate: 0,
    }

    if (payment.status === "paid") {
      current.income += Number(payment.amount) - (Number(payment.discount) || 0)
    } else if (payment.status === "overdue") {
      current.defaultRate += Number(payment.amount) - (Number(payment.discount) || 0)
    }

    metrics.set(date, current)
  }

  // Converter para array e ordenar por data
  return Array.from(metrics.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export async function exportFinancialData(period: "week" | "month" | "quarter" | "year") {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const now = new Date()
  const startDate = new Date()

  switch (period) {
    case "week":
      startDate.setDate(now.getDate() - 7)
      break
    case "month":
      startDate.setMonth(now.getMonth() - 1)
      break
    case "quarter":
      startDate.setMonth(now.getMonth() - 3)
      break
    case "year":
      startDate.setFullYear(now.getFullYear() - 1)
      break
  }

  const { data: payments, error } = await supabase
    .from("payments")
    .select(`
      amount,
      discount,
      status,
      payment_date,
      due_date,
      notes,
      patients (name)
    `)
    .eq("user_id", user.id)
    .gte("payment_date", startDate.toISOString())
    .lte("payment_date", now.toISOString())

  if (error) {
    console.error("Error fetching payments for export:", error)
    throw error
  }

  // Formatar dados para exportação
  return payments.map((p: any) => ({
    data_pagamento: p.payment_date ? new Date(p.payment_date).toLocaleDateString("pt-BR") : "-",
    cliente: p.patients?.name || "-",
    valor: Number(p.amount).toFixed(2),
    desconto: Number(p.discount || 0).toFixed(2),
    status: p.status === "paid" ? "Pago" :
      p.status === "pending" ? "Pendente" :
        p.status === "overdue" ? "Atrasado" :
          p.status === "refunded" ? "Reembolsado" : "-",
    vencimento: p.due_date ? new Date(p.due_date).toLocaleDateString("pt-BR") : "-",
    observacoes: p.notes || "-"
  }))
}
