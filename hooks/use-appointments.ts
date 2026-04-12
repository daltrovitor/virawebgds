"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"

interface Appointment {
  id: string
  user_id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: "scheduled" | "completed" | "cancelled"
  notes: string | null
  created_at: string
  updated_at: string
}

export function useAppointments(userId: string | null) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchAppointments = async () => {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select("*")
          .eq("user_id", userId)
          .order("appointment_date", { ascending: false })

        if (error) throw error
        setAppointments(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch appointments")
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()

    // Subscribe to real-time changes
    const subscription = supabase
      .channel(`appointments:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAppointments((prev) => [payload.new as Appointment, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setAppointments((prev) =>
              prev.map((apt) => (apt.id === payload.new.id ? (payload.new as Appointment) : apt)),
            )
          } else if (payload.eventType === "DELETE") {
            setAppointments((prev) => prev.filter((apt) => apt.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, supabase])

  const createAppointment = async (
    patientId: string,
    professionalId: string,
    appointmentDate: string,
    appointmentTime: string,
    notes?: string,
  ) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          user_id: userId,
          patient_id: patientId,
          professional_id: professionalId,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          duration_minutes: 30,
          status: "scheduled",
          notes: notes || null,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create appointment"
      setError(message)
      throw err
    }
  }

  const updateAppointment = async (appointmentId: string, updates: Partial<Appointment>) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .update(updates)
        .eq("id", appointmentId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update appointment"
      setError(message)
      throw err
    }
  }

  const deleteAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase.from("appointments").delete().eq("id", appointmentId)

      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete appointment"
      setError(message)
      throw err
    }
  }

  return {
    appointments,
    loading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  }
}
