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

  // Calculate completion rate
  const completionRate =
    totalAppointments && totalAppointments > 0
      ? Math.round(((completedAppointments || 0) / totalAppointments) * 100)
      : 0

  return {
    totalAppointments: totalAppointments || 0,
    activePatients: activePatients || 0,
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

  // Group by month
  const monthlyData: Record<string, { appointments: number; completed: number; cancelled: number }> = {}

  appointments?.forEach((apt) => {
    const date = new Date(apt.appointment_date)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { appointments: 0, completed: 0, cancelled: 0 }
    }

    monthlyData[monthKey].appointments++
    if (apt.status === "completed") monthlyData[monthKey].completed++
    if (apt.status === "cancelled") monthlyData[monthKey].cancelled++
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

  // Group by month
  const monthlyData: Record<string, { newPatients: number; totalPatients: number }> = {}
  let cumulativeTotal = 0

  patients?.forEach((patient) => {
    const date = new Date(patient.created_at)
    const monthKey = date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { newPatients: 0, totalPatients: 0 }
    }

    monthlyData[monthKey].newPatients++
    cumulativeTotal++
    monthlyData[monthKey].totalPatients = cumulativeTotal
  })

  // Convert to array format for charts
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
