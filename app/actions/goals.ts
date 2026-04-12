"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface Goal {
  id: string
  user_id: string
  title: string
  description?: string
  target_value?: number
  current_value: number
  unit?: string
  deadline?: string
  status: "em_progresso" | "concluida" | "cancelada"
  category?: string
  created_at: string
  updated_at: string
}

export async function getGoals() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching goals:", error)
    throw new Error("Erro ao buscar metas")
  }

  return data as Goal[]
}

export async function createGoal(goalData: {
  title: string
  description?: string
  target_value?: number
  current_value?: number
  unit?: string
  deadline?: string
  category?: string
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      ...goalData,
      status: "em_progresso",
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating goal:", error)
    throw new Error("Erro ao criar meta")
  }

  revalidatePath("/dashboard")
  return data as Goal
}

export async function updateGoal(
  goalId: string,
  updates: Partial<Omit<Goal, "id" | "user_id" | "created_at" | "updated_at">>,
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { data, error } = await supabase
    .from("goals")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", goalId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating goal:", error)
    throw new Error("Erro ao atualizar meta")
  }

  revalidatePath("/dashboard")
  return data as Goal
}

export async function deleteGoal(goalId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Não autenticado")
  }

  const { error } = await supabase.from("goals").delete().eq("id", goalId).eq("user_id", user.id)

  if (error) {
    console.error("Error deleting goal:", error)
    throw new Error("Erro ao deletar meta")
  }

  revalidatePath("/dashboard")
}
