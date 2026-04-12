"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// Função que atualiza metas baseado no tipo de ação e a categoria
export async function updateGoalsForAction(action: {
  type: "appointment" | "patient" | "payment" | "professional",
  value?: number
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  // Mapeia o tipo de ação para a categoria da meta
  const categoryMap = {
    appointment: "agendamentos",
    patient: "clientes", // Alterado de "clientes" para "clientes"
    payment: "financeiro",
    professional: "profissionais"
  }

  const category = categoryMap[action.type]

  try {
    // Busca metas ativas da categoria específica
    const { data: goals } = await supabase
      .from("goals")
      .select("id, current_value, target_value")
      .eq("user_id", user.id)
      .eq("category", category)
      .eq("status", "em_progresso")

    if (goals && goals.length > 0) {
      // Atualiza cada meta encontrada
      const promises = goals.map(async (goal) => {
        const increment = action.value || 1
        const newValue = goal.current_value + increment

        // Verifica se a meta foi atingida
        const status = newValue >= goal.target_value ? "concluida" : "em_progresso"

        return supabase
          .from("goals")
          .update({
            current_value: newValue,
            status,
            updated_at: new Date().toISOString()
          })
          .eq("id", goal.id)
      })

      await Promise.all(promises)
      revalidatePath("/dashboard")
    }
  } catch (e) {
    console.error("Error updating goals:", e)
  }
}
