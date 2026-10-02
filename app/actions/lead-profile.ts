"use server"

import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

/**
 * Formulário de perfil da clínica (lead): exibido uma única vez por conta.
 * A marcação fica nos metadados do usuário (vale em qualquer navegador/aparelho);
 * quem já respondeu antes desta mudança é reconhecido pelo registro em `leads`.
 */

const SEEN_KEY = "vwo_lead_form_seen_at"

const leadSchema = z.object({
  language: z.enum(["pt", "en"]),
  revenue: z.string().trim().min(1).max(60),
  clients: z.coerce.number().int().min(0).max(999999),
  appointments: z.coerce.number().int().min(0).max(999999),
})

async function markSeen(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.auth.updateUser({ data: { [SEEN_KEY]: new Date().toISOString() } })
  if (error) console.error("Lead form: could not persist seen flag:", error)
}

export async function getLeadFormStatus(): Promise<{ show: boolean }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { show: false }
  if (user.user_metadata?.[SEEN_KEY]) return { show: false }

  const { data: existing, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
  if (leadError) {
    // Na dúvida, não insiste com o usuário
    console.error("Lead form: status check failed:", leadError)
    return { show: false }
  }
  if (existing && existing.length > 0) {
    await markSeen(supabase)
    return { show: false }
  }
  return { show: true }
}

export async function submitLeadForm(input: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = leadSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: "Respostas inválidas." }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { success: false, error: "Sessão expirada." }

  const { error: insertError } = await supabase.from("leads").insert({
    user_id: user.id,
    ramo: "odontologia",
    faturamento: parsed.data.revenue,
    clientes: parsed.data.clients,
    agendamentos: parsed.data.appointments,
    idioma: parsed.data.language,
  })
  // Mesmo se a gravação falhar, não pergunta de novo
  await markSeen(supabase)
  if (insertError) {
    console.error("Lead form: insert failed:", insertError)
    return { success: false, error: insertError.message }
  }
  return { success: true }
}

export async function dismissLeadForm(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { success: false }
  await markSeen(supabase)
  return { success: true }
}
