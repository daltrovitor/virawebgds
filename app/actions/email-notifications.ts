"use server"

import {
  sendEmail,
  generateAppointmentConfirmationEmail,
  generateAppointmentReminderEmail,
  generatePaymentReminderEmail,
  generateWelcomeEmail,
} from "@/lib/email"
import { createClient } from "@/lib/supabase/server"

export async function sendAppointmentConfirmation(appointmentId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  // Get appointment details with patient and professional info
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `
      *,
      patients (name, email),
      professionals (name)
    `,
    )
    .eq("id", appointmentId)
    .single()

  if (error || !appointment) {
    throw new Error("Appointment not found")
  }

  const emailContent = generateAppointmentConfirmationEmail({
    patientName: appointment.patients.name,
    professionalName: appointment.professionals.name,
    date: appointment.appointment_date,
    time: appointment.appointment_time,
    clinicName: "ViraWeb Clínica",
  })

  await sendEmail({
    to: appointment.patients.email,
    subject: "Confirmação de Agendamento - ViraWeb",
    html: emailContent.html,
    text: emailContent.text,
  })

  return { success: true }
}

export async function sendAppointmentReminders() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { sent: 0 }
  }

  // Get appointments for tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0]

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select(
      `
      *,
      patients (name, email),
      professionals (name)
    `,
    )
    .eq("user_id", user.id)
    .eq("appointment_date", tomorrowStr)
    .eq("status", "scheduled")

  if (error || !appointments) {
    return { sent: 0 }
  }

  let sent = 0
  for (const appointment of appointments) {
    try {
      const emailContent = generateAppointmentReminderEmail({
        patientName: appointment.patients.name,
        professionalName: appointment.professionals.name,
        date: appointment.appointment_date,
        time: appointment.appointment_time,
        clinicName: "ViraWeb Clínica",
      })

      await sendEmail({
        to: appointment.patients.email,
        subject: "Lembrete: Consulta Amanhã - ViraWeb",
        html: emailContent.html,
        text: emailContent.text,
      })

      sent++
    } catch (error) {
      console.error(" Error sending reminder:", error)
    }
  }

  return { sent }
}

export async function sendPaymentReminders() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { sent: 0 }
  }

  // Get patients with overdue payments
  const today = new Date().toISOString().split("T")[0]

  const { data: patients, error } = await supabase
    .from("patients")
    .select("*")
    .eq("user_id", user.id)
    .eq("payment_status", "overdue")
    .lt("payment_due_date", today)

  if (error || !patients) {
    return { sent: 0 }
  }

  let sent = 0
  for (const patient of patients) {
    try {
      const emailContent = generatePaymentReminderEmail({
        patientName: patient.name,
        amount: 150.0, // This should come from a payments table
        dueDate: patient.payment_due_date,
        clinicName: "ViraWeb Clínica",
      })

      await sendEmail({
        to: patient.email,
        subject: "Lembrete de Pagamento - ViraWeb",
        html: emailContent.html,
        text: emailContent.text,
      })

      sent++
    } catch (error) {
      console.error(" Error sending payment reminder:", error)
    }
  }

  return { sent }
}

export async function sendWelcomeEmailToUser(userName: string, userEmail: string) {
  const emailContent = generateWelcomeEmail({
    userName,
    userEmail,
    clinicName: "ViraWeb",
  })

  await sendEmail({
    to: userEmail,
    subject: "Bem-vindo ao ViraWeb!",
    html: emailContent.html,
    text: emailContent.text,
  })

  return { success: true }
}
