"use server"

import { createClient } from "@/lib/supabase/server"
import { createNotification } from "./notifications"
import { getUserSubscription } from "./subscription"
import { checkLimit } from "@/lib/usage-stats"
import { updateGoalsForAction } from "./update-goals"

export interface Appointment {
  id: string
  user_id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getAppointments() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", user.id)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })

  if (error) {
    console.error(" Error fetching appointments:", error)
    throw new Error("Failed to fetch appointments")
  }

  return data as Appointment[]
}

export async function createAppointment(appointmentData: {
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  notes?: string
  recurrence?: {
    type: 'daily' | 'weekly' | 'monthly' | string
    weekdays?: number[]
    count?: number
  }
}) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const subscription = await getUserSubscription()
  const planType = (subscription?.plan_type?.toLowerCase() as any) || "basic"

  const limitCheck = await checkLimit(planType, "appointmentsPerMonth")

  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message || "Limite de agendamentos mensais atingido.")
  }

  // Support recurring appointments: if recurrence provided, generate multiple rows
  const recurrence = (appointmentData as any).recurrence

  if (recurrence && recurrence.count && recurrence.count > 100) {
    throw new Error('Número de repetições muito alto')
  }

  if (!recurrence || recurrence.type === 'none') {
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        user_id: user.id,
        ...appointmentData,
        notes: appointmentData.notes || null,
        status: "scheduled",
      })
      .select()
      .single()

    if (error) {
      console.error(" Error creating appointment:", error)
      throw new Error("Failed to create appointment")
    }

    try {
        const apptDate = new Date(`${appointmentData.appointment_date}T${appointmentData.appointment_time}:00`)
        const triggerAt = new Date(apptDate.getTime() - 5 * 60000)
        
        if (triggerAt.getTime() > Date.now()) {
            await supabase.from("reminders").insert({
                user_id: user.id,
                title: "Agendamento Próximo",
                description: `Você tem um agendamento em 5 minutos.`,
                scheduled_at: triggerAt.toISOString(),
                sent: false
            })
        }
    } catch (e) {
        console.error("Error creating appointment reminder", e)
    }

    await createNotification("Agendamento Criado", "Novo agendamento foi criado com sucesso.", user.id)
    
    // Atualiza as metas de agendamentos
    await updateGoalsForAction({ type: "appointment" })

    return data as Appointment
  }

  // generate occurrences based on recurrence rules
  const occurrences: Array<any> = []
  const startDate = new Date(appointmentData.appointment_date + 'T00:00:00')
  const timePart = appointmentData.appointment_time || '00:00'
  const [startHour, startMinute] = timePart.split(':').map((v) => parseInt(v, 10))

  const count = recurrence.count || 1

  if (recurrence.type === 'daily') {
    for (let i = 0; i < count; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      occurrences.push({
        user_id: user.id,
        patient_id: appointmentData.patient_id,
        professional_id: appointmentData.professional_id,
        appointment_date: dateStr,
        appointment_time: appointmentData.appointment_time,
        duration_minutes: appointmentData.duration_minutes,
        notes: appointmentData.notes || null,
        status: 'scheduled',
      })
    }
  } else if (recurrence.type === 'weekly') {
    // recurrence.weekdays is array of weekday indexes 0(Sun)-6
    const weekdays: number[] = recurrence.weekdays && recurrence.weekdays.length ? recurrence.weekdays : [startDate.getDay()]
    let found = 0
    let cursor = new Date(startDate)
    // iterate forward until we collect 'count' occurrences
    while (found < count) {
      if (weekdays.includes(cursor.getDay())) {
        occurrences.push({
          user_id: user.id,
          patient_id: appointmentData.patient_id,
          professional_id: appointmentData.professional_id,
          appointment_date: cursor.toISOString().split('T')[0],
          appointment_time: appointmentData.appointment_time,
          duration_minutes: appointmentData.duration_minutes,
          notes: appointmentData.notes || null,
          status: 'scheduled',
        })
        found++
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  } else if (recurrence.type === 'monthly') {
    const dayOfMonth = startDate.getDate()
    for (let i = 0; i < count; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, dayOfMonth)
      const dateStr = d.toISOString().split('T')[0]
      occurrences.push({
        user_id: user.id,
        patient_id: appointmentData.patient_id,
        professional_id: appointmentData.professional_id,
        appointment_date: dateStr,
        appointment_time: appointmentData.appointment_time,
        duration_minutes: appointmentData.duration_minutes,
        notes: appointmentData.notes || null,
        status: 'scheduled',
      })
    }
  } else {
    throw new Error('Tipo de recorrência não suportado')
  }

  // Insert all occurrences in a single batch
  const { data: inserted, error: insertErr } = await supabase.from('appointments').insert(occurrences).select()
  if (insertErr) {
    console.error(' Error creating recurring appointments:', insertErr)
    throw new Error('Failed to create recurring appointments')
  }

  try {
      const reminderOccurrences = occurrences.map(occ => {
          const apptDate = new Date(`${occ.appointment_date}T${occ.appointment_time}:00`)
          const triggerAt = new Date(apptDate.getTime() - 5 * 60000)
          
          if (triggerAt.getTime() > Date.now()) {
              return {
                  user_id: user.id,
                  title: "Agendamento Próximo",
                  description: `Você tem um agendamento em 5 minutos.`,
                  scheduled_at: triggerAt.toISOString(),
                  sent: false
              }
          }
          return null
      }).filter(Boolean)
      
      if (reminderOccurrences.length > 0) {
          await supabase.from("reminders").insert(reminderOccurrences)
      }
  } catch (e) {
      console.error("Error creating recurring appointment reminders", e)
  }

  await createNotification("Agendamentos Criados", `${inserted.length} agendamento(s) criados com sucesso.`, user.id)
  await updateGoalsForAction({ type: "appointment" })
  return inserted as Appointment[]
}

export async function updateAppointment(
  appointmentId: string,
  appointmentData: {
    patient_id: string
    professional_id: string
    appointment_date: string
    appointment_time: string
    duration_minutes: number
    notes?: string
  },
) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({
      ...appointmentData,
      notes: appointmentData.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error(" Error updating appointment:", error)
    throw new Error("Failed to update appointment")
  }

  await createNotification("Agendamento Atualizado", "Agendamento foi atualizado com sucesso.", user.id)

  return data as Appointment
}

export async function deleteAppointment(appointmentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase.from("appointments").delete().eq("id", appointmentId).eq("user_id", user.id)

  if (error) {
    console.error(" Error deleting appointment:", error)
    throw new Error("Failed to delete appointment")
  }

  await createNotification("Agendamento Cancelado", "Agendamento foi cancelado com sucesso.", user.id)

  return { success: true }
}

// Retorna contagem de agendamentos por profissional para um período (dia/semana/mês)
export async function getAppointmentCountsByProfessional(period: "day" | "week" | "month", referenceDate?: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("User not authenticated")

  const ref = referenceDate ? new Date(referenceDate) : new Date()

  let start: Date = new Date()
  let end: Date = new Date()

  if (period === "day") {
    start = new Date(ref)
    start.setHours(0, 0, 0, 0)
    end = new Date(ref)
    end.setHours(23, 59, 59, 999)
  } else if (period === "week") {
    // week starting on Monday
    const d = new Date(ref)
    const day = d.getDay()
    const diff = (day + 6) % 7
    start = new Date(d)
    start.setDate(d.getDate() - diff)
    start.setHours(0, 0, 0, 0)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else {
    // month
    start = new Date(ref.getFullYear(), ref.getMonth(), 1)
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  }

  const startISO = start.toISOString().split("T")[0]
  const endISO = end.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("appointments")
    .select("professional_id")
    .eq("user_id", user.id)
    .gte("appointment_date", startISO)
    .lte("appointment_date", endISO)

  if (error) {
    console.error("Error fetching appointment counts:", error)
    return []
  }

  const map: Record<string, number> = {}
  data?.forEach((row: any) => {
    const key = row.professional_id || "unknown"
    map[key] = (map[key] || 0) + 1
  })

  return Object.keys(map).map((k) => ({ professional_id: k === "unknown" ? null : k, count: map[k] }))
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("user_id", user.id)

  if (error) {
    console.error(" Error updating appointment status:", error)
    throw new Error("Failed to update appointment status")
  }

  // If appointment was completed, create a financial session row (if not exists)
  try {
    if (status === "completed") {
      // fetch appointment details to get date and patient
      const { data: appointment, error: apptErr } = await supabase
        .from("appointments")
        .select("id, patient_id, appointment_date")
        .eq("id", appointmentId)
        .eq("user_id", user.id)
        .single()

      if (!apptErr && appointment) {
        // avoid duplicate sessions for same appointment
        const { data: existing } = await supabase
          .from("financial_sessions")
          .select("id")
          .eq("appointment_id", appointmentId)
          .maybeSingle()

        if (!existing) {
          const defaultPrice = 100.0 // TODO: make configurable per patient/professional
          const { error: sessErr } = await supabase.from("financial_sessions").insert([
            {
              user_id: user.id,
              patient_id: appointment.patient_id || null,
              appointment_id: appointmentId,
              session_date: appointment.appointment_date,
              unit_price: defaultPrice,
              discount: 0,
              paid: false,
            },
          ])

          if (sessErr) {
            console.error("Error creating financial session:", sessErr)
          } else {
            await createNotification(
              "Sessão Registrada",
              `Sessão do dia ${new Date(appointment.appointment_date).toLocaleDateString("pt-BR")} registrada no financeiro.`,
              user.id,
            )
          }
        }
      }
    }
  } catch (e) {
    console.error("Error while creating financial session:", e)
  }

  return { success: true }
}
