"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface UserSettings {
  id: string
  email: string
  full_name: string | null
  clinic_name: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "Usuário não autenticado"
    throw new Error(msg)
  }

  const { data, error } = await supabase.from("users").select("*").eq("id", user.id).single()

  if (error) {
    console.error("Erro ao buscar configurações:", error)
    throw new Error(error.message || "Erro ao buscar configurações")
  }

  return data as UserSettings
}

export async function updateUserProfile(profileData: {
  full_name?: string
  phone?: string
}): Promise<UserSettings> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "Usuário não autenticado"
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      ...profileData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Erro ao atualizar perfil:", error)
    throw new Error(error.message || "Falha ao atualizar perfil")
  }

  revalidatePath("/dashboard")
  return data as UserSettings
}

export async function updateClinicInfo(clinicData: {
  clinic_name?: string
}): Promise<UserSettings> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "Usuário não autenticado"
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      ...clinicData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Erro ao atualizar informações da clínica:", error)
    throw new Error(error.message || "Falha ao atualizar informações da clínica")
  }

  revalidatePath("/dashboard")
  return data as UserSettings
}

export async function updateEmail(newEmail: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "Usuário não autenticado"
    throw new Error(msg)
  }

  const { error } = await supabase.auth.updateUser({
    email: newEmail,
  })

  if (error) {
    console.error("Erro ao atualizar email:", error)
    return { success: false, message: error.message || "Erro ao atualizar email" }
  }

  return { success: true, message: "Email de confirmação enviado para o novo endereço" }
}

export async function updatePassword(newPassword: string): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "Usuário não autenticado"
    throw new Error(msg)
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    console.error("Erro ao atualizar senha:", error)
    return { success: false, message: error.message || "Erro ao atualizar senha" }
  }

  return { success: true, message: "Senha atualizada com sucesso" }
}
