"use server"

import { createClient } from "@/lib/supabase/server"

export interface VisitRecord {
  id: string
  patient_id: string
  visit_date: string
  payment_id: string | null
  notes?: string
}

export async function recordVisit(payload: {
  patient_id: string
  visit_date: string
  payment_id?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  try {
    const { data, error } = await supabase
      .from('visits')
      .insert([
        {
          patient_id: payload.patient_id,
          visit_date: payload.visit_date,
          payment_id: payload.payment_id || null,
          notes: payload.notes
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error("Error recording visit:", err)
    throw new Error("Failed to record visit")
  }
}

export async function getPatientVisits(patient_id: string, startDate?: string, endDate?: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  let query = supabase
    .from('visits')
    .select('*, payments(*)')
    .eq('patient_id', patient_id)
    .order('visit_date', { ascending: false })

  if (startDate) {
    query = query.gte('visit_date', startDate)
  }
  if (endDate) {
    query = query.lte('visit_date', endDate)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

export async function getVisitsSummary(patient_id: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  // Get total visits count
  const { count: totalVisits } = await supabase
    .from('visits')
    .select('*', { count: 'exact' })
    .eq('patient_id', patient_id)

  // Get latest visit
  const { data: latestVisit } = await supabase
    .from('visits')
    .select('*')
    .eq('patient_id', patient_id)
    .order('visit_date', { ascending: false })
    .limit(1)
    .single()

  return {
    totalVisits,
    latestVisit: latestVisit?.visit_date || null
  }
}
