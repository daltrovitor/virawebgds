"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"

interface Patient {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  cpf: string | null
  date_of_birth: string | null
  address: string | null
  notes: string | null
  status: "active" | "inactive"
  created_at: string
  updated_at: string
}

export function usePatients(userId: string | null) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchPatients = async () => {
      try {
        const { data, error } = await supabase
          .from("patients")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        if (error) throw error
        setPatients(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch patients")
      } finally {
        setLoading(false)
      }
    }

    fetchPatients()

    const subscription = supabase
      .channel(`patients:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPatients((prev) => [payload.new as Patient, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setPatients((prev) =>
              prev.map((patient) => (patient.id === payload.new.id ? (payload.new as Patient) : patient)),
            )
          } else if (payload.eventType === "DELETE") {
            setPatients((prev) => prev.filter((patient) => patient.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, supabase])

  const createPatient = async (patientData: Omit<Patient, "id" | "user_id" | "created_at" | "updated_at">) => {
    try {
      const { data, error } = await supabase
        .from("patients")
        .insert({
          user_id: userId,
          ...patientData,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create patient"
      setError(message)
      throw err
    }
  }

  const updatePatient = async (patientId: string, updates: Partial<Patient>) => {
    try {
      const { data, error } = await supabase.from("patients").update(updates).eq("id", patientId).select().single()

      if (error) throw error
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update patient"
      setError(message)
      throw err
    }
  }

  const deletePatient = async (patientId: string) => {
    try {
      const { error } = await supabase.from("patients").delete().eq("id", patientId)

      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete patient"
      setError(message)
      throw err
    }
  }

  return {
    patients,
    loading,
    error,
    createPatient,
    updatePatient,
    deletePatient,
  }
}
