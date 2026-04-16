"use server"

import { createClient } from "@/lib/supabase/server"
import { createNotification } from "./notifications"
import { getUserSubscription } from "./subscription"
import { checkLimit } from "@/lib/usage-stats"
import { updateGoalsForAction } from "./update-goals"

export interface Patient {
  id: string
  user_id: string
  name: string
  email: string
  phone: string
  cpf: string | null
  date_of_birth: string | null
  birthday: string | null
  address: string | null
  notes: string | null
  profile_photo_url: string | null
  patient_files: any[] | null
  status: "active" | "inactive"
  payment_status: string | null
  last_payment_date: string | null
  payment_due_date: string | null
  created_at: string
  updated_at: string
}

export async function getPatients() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return []
    }

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error(" Error fetching patients:", error)
      throw new Error("Falha ao carregar clientes.")
    }

    return data as Patient[]
  } catch (err) {
    console.error("Critical error in getPatients:", err)
    throw err // For internal usage it might be okay to throw if caught by parent, but let's be safe
  }
}

export async function getPatientById(patientId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", patientId)
    .eq("user_id", user.id)
    .single()

  if (error) {
    console.error("Error fetching patient:", error)
    throw new Error("Failed to fetch patient")
  }

  return data as Patient
}

export async function createPatient(patientData: {
  name: string
  email: string
  phone: string
  cpf?: string
  date_of_birth?: string
  birthday?: string
  address?: string
  notes?: string
  profile_photo_url?: string
}) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "Usuário não autenticado." }
    }

    const subscription = await getUserSubscription()
    const planType = (subscription?.plan_type?.toLowerCase() as any) || "basic"

    const limitCheck = await checkLimit(planType, "patients")

    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message || "Limite de clientes atingido." }
    }

    // normalize payload: don't insert empty cpf to avoid unique/constraint issues
    const insertPayload: any = {
      user_id: user.id,
      name: patientData.name,
      email: patientData.email || null,
      phone: patientData.phone || null,
      date_of_birth: patientData.date_of_birth || null,
      address: patientData.address || null,
      notes: patientData.notes || null,
      profile_photo_url: patientData.profile_photo_url || null,
      status: "active",
      payment_status: "pending",
    }

    // Only include cpf if it has a value - don't send null to avoid UNIQUE constraint issues
    if (patientData.cpf && patientData.cpf.trim() !== "") {
      insertPayload.cpf = patientData.cpf.trim()
    }

    const { data, error } = await supabase.from("patients").insert(insertPayload).select().single()

    if (error) {
      console.error(" Error creating patient:", error)
      const parts = [error.message, (error as any).details, (error as any).hint, (error as any).code]
        .filter(Boolean)
        .map(String)
      const fullMessage = parts.join(" | ") || "Failed to create patient"

      if (/Could not find the 'birthday' column|PGRST204/i.test(fullMessage)) {
        return { success: false, error: "Erro ao criar cliente: problema no servidor relacionado ao campo de aniversário." }
      }

      // Check if the error is specifically related to CPF
      if (/\bcpf\b/i.test(fullMessage)) {
        if (patientData.cpf && patientData.cpf.trim() !== "") {
          return { success: false, error: "Este CPF já está cadastrado para outro cliente." }
        }
      }

      // Check for duplicate/unique violations (but not generic constraint errors)
      if (/duplicate|unique.*violation|already exists/i.test(fullMessage)) {
        return { success: false, error: "Erro ao criar cliente: um dos dados informados já está cadastrado." }
      }

      // Check for payment_status constraint
      if (/payment_status/i.test(fullMessage)) {
        return { success: false, error: "Erro ao criar cliente: problema com o status de pagamento." }
      }

      return { success: false, error: fullMessage }
    }

    await createNotification("Cliente Adicionado", `${patientData.name} foi adicionado com sucesso.`, user.id)
    await updateGoalsForAction({ type: "patient" })

    return { success: true, data: data as Patient }
  } catch (err) {
    console.error("Critical error in createPatient action:", err)
    return { success: false, error: err instanceof Error ? err.message : "Erro interno no servidor." }
  }
}

export async function updatePatient(
  patientId: string,
  patientData: {
    name: string
    email: string
    phone: string
    cpf?: string
    date_of_birth?: string
    birthday?: string
    address?: string
    notes?: string
    profile_photo_url?: string
  },
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: "Usuário não autenticado." }
    }

    // normalize payload: convert empty strings to null for date and optional fields
    const updatePayload: any = {
      name: patientData.name,
      email: patientData.email || null,
      phone: patientData.phone || null,
      date_of_birth: patientData.date_of_birth && patientData.date_of_birth.trim() !== "" ? patientData.date_of_birth : null,
      birthday: patientData.birthday && patientData.birthday.trim() !== "" ? patientData.birthday : null,
      address: patientData.address || null,
      notes: patientData.notes || null,
      profile_photo_url: patientData.profile_photo_url || null,
      updated_at: new Date().toISOString(),
    }

    // Only include cpf if provided and not empty
    if (patientData.cpf && patientData.cpf.trim() !== "") {
      updatePayload.cpf = patientData.cpf.trim()
    } else {
      updatePayload.cpf = null
    }

    const { data, error } = await supabase.from("patients").update(updatePayload).eq("id", patientId).eq("user_id", user.id).select().single()

    if (error) {
      console.error(" Error updating patient:", error)
      return { success: false, error: "Falha ao atualizar cliente: " + error.message }
    }

    await createNotification("Cliente Atualizado", `${patientData.name} foi atualizado com sucesso.`, user.id)

    return { success: true, data: data as Patient }
  } catch (err) {
    console.error("Critical error in updatePatient:", err)
    return { success: false, error: "Erro interno no servidor." }
  }
}

export async function updatePatientNotes(patientId: string, notes: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("patients")
    .update({
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating patient notes:", error)
    throw new Error("Failed to update patient notes")
  }

  return data as Patient
}

export async function updatePatientPhoto(patientId: string, photoUrl: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("patients")
    .update({
      profile_photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating patient photo:", error)
    throw new Error("Failed to update patient photo")
  }

  return data as Patient
}

export async function updatePatientFiles(patientId: string, files: any[]) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("patients")
    .update({
      patient_files: files,
      updated_at: new Date().toISOString(),
    })
    .eq("id", patientId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating patient files:", error)
    throw new Error("Failed to update patient files")
  }

  return data as Patient
}

export async function deletePatient(patientId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase.from("patients").delete().eq("id", patientId).eq("user_id", user.id)

  if (error) {
    console.error(" Error deleting patient:", error)
    throw new Error("Failed to delete patient")
  }

  await createNotification("cliente Removido", "cliente foi removido com sucesso.", user.id)

  return { success: true }
}

export async function updatePatientStatus(patientId: string, status: "active" | "inactive") {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase
    .from("patients")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", patientId)
    .eq("user_id", user.id)

  if (error) {
    console.error(" Error updating patient status:", error)
    throw new Error("Failed to update patient status")
  }

  return { success: true }
}

export async function checkOverduePayments() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return []
  }

  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("patients")
    .select("*")
    .eq("user_id", user.id)
    .eq("payment_status", "overdue")
    .lt("payment_due_date", today)

  if (error) {
    console.error(" Error checking overdue payments:", error)
    return []
  }

  // Create notifications for overdue payments
  for (const patient of data) {
    await createNotification(
      "Pagamento Atrasado",
      `cliente ${patient.name} está com pagamento atrasado desde ${new Date(patient.payment_due_date!).toLocaleDateString("pt-BR")}.`,
      user.id,
    )
  }

  return data as Patient[]
}
