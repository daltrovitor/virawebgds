"use server"

import { createClient } from "@/lib/supabase-client"
import { cache } from "react"

export interface AttendanceRecord {
  id: string
  patientId: string
  sessionDate: Date
  status: "present" | "absent" | "late" | "cancelled"
  paymentId?: string
  notes?: string
}

export const getPatientAttendance = cache(async (patientId: string) => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const { data, error } = await supabase
    .from("attendance")
    .select(`
      id,
      session_date,
      status,
      payment_id,
      notes
    `)
    .eq("user_id", user.id)
    .eq("patient_id", patientId)
    .order("session_date", { ascending: false })

  if (error) {
    console.error("Error fetching attendance:", error)
    throw new Error("Falha ao buscar presenças")
  }

  return data.map((record: any) => ({
    id: record.id,
    patientId,
    sessionDate: new Date(record.session_date),
    status: record.status,
    paymentId: record.payment_id,
    notes: record.notes
  })) as AttendanceRecord[]
})

export const updateAttendance = async (
  patientId: string,
  sessionDate: Date,
  data: {
    status: "present" | "absent" | "late" | "cancelled"
    paymentId?: string
    notes?: string
  }
) => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  // Format the date to YYYY-MM-DD
  const formattedDate = sessionDate.toISOString().split("T")[0]

  // Check if there's already a record for this date
  const { data: existingRecord } = await supabase
    .from("attendance")
    .select("id")
    .eq("user_id", user.id)
    .eq("patient_id", patientId)
    .eq("session_date", formattedDate)
    .single()

  if (existingRecord) {
    // Update existing record
    const { error } = await supabase
      .from("attendance")
      .update({
        status: data.status,
        payment_id: data.paymentId,
        notes: data.notes,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingRecord.id)

    if (error) {
      console.error("Error updating attendance:", error)
      throw new Error("Falha ao atualizar presença")
    }
  } else {
    // Create new record
    const { error } = await supabase
      .from("attendance")
      .insert([
        {
          user_id: user.id,
          patient_id: patientId,
          session_date: formattedDate,
          status: data.status,
          payment_id: data.paymentId,
          notes: data.notes
        }
      ])

    if (error) {
      console.error("Error creating attendance:", error)
      throw new Error("Falha ao registrar presença")
    }
  }
}

export const getPatientAttendanceStats = cache(async (patientId: string) => {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const { data, error } = await supabase
    .from("attendance")
    .select(`
      status,
      session_date,
      payment_id
    `)
    .eq("user_id", user.id)
    .eq("patient_id", patientId)

  if (error) {
    console.error("Error fetching attendance stats:", error)
    throw new Error("Falha ao buscar estatísticas de presença")
  }

  const total = data.length
  const present = data.filter((r: any) => r.status === "present").length
  const absent = data.filter((r: any) => r.status === "absent").length
  const late = data.filter((r: any) => r.status === "late").length
  const cancelled = data.filter((r: any) => r.status === "cancelled").length
  const paid = data.filter((r: any) => r.payment_id).length

  return {
    total,
    present,
    absent,
    late,
    cancelled,
    paid,
    attendanceRate: total > 0 ? (present / total) * 100 : 0
  }
})
