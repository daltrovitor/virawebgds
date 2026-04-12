"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase-client"

interface Professional {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  crm: string | null
  specialty: string | null
  work_days: string | null
  notes: string | null
  status: "active" | "inactive"
  created_at: string
  updated_at: string
}

export function useProfessionals(userId: string | null) {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchProfessionals = async () => {
      try {
        const { data, error } = await supabase
          .from("professionals")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })

        if (error) throw error
        setProfessionals(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch professionals")
      } finally {
        setLoading(false)
      }
    }

    fetchProfessionals()

    const subscription = supabase
      .channel(`professionals:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "professionals",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setProfessionals((prev) => [payload.new as Professional, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setProfessionals((prev) =>
              prev.map((prof) => (prof.id === payload.new.id ? (payload.new as Professional) : prof)),
            )
          } else if (payload.eventType === "DELETE") {
            setProfessionals((prev) => prev.filter((prof) => prof.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, supabase])

  const createProfessional = async (
    professionalData: Omit<Professional, "id" | "user_id" | "created_at" | "updated_at">,
  ) => {
    try {
      const { data, error } = await supabase
        .from("professionals")
        .insert({
          user_id: userId,
          ...professionalData,
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create professional"
      setError(message)
      throw err
    }
  }

  const updateProfessional = async (professionalId: string, updates: Partial<Professional>) => {
    try {
      const { data, error } = await supabase
        .from("professionals")
        .update(updates)
        .eq("id", professionalId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update professional"
      setError(message)
      throw err
    }
  }

  const deleteProfessional = async (professionalId: string) => {
    try {
      const { error } = await supabase.from("professionals").delete().eq("id", professionalId)

      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete professional"
      setError(message)
      throw err
    }
  }

  return {
    professionals,
    loading,
    error,
    createProfessional,
    updateProfessional,
    deleteProfessional,
  }
}
