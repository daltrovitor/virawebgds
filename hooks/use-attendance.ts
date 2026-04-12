"use client"

import { createClient } from "@/lib/supabase-client"
import { AttendanceRecord, PaymentData } from "@/lib/types"
import { useEffect, useState } from "react"
import { usePayments } from "./use-payments"

export interface UseAttendanceReturn {
  loadAttendance: () => Promise<void>
  loading: boolean
  error: string | null
  records: AttendanceRecord[]
  appointments: { date: Date }[]
  isDateScheduled: (date: Date) => boolean
  stats: {
    total: number
    present: number
    absent: number
    late: number
    cancelled: number
    paid: number
    attendanceRate: number
  } | null
  updateAttendance: (date: Date, data: {
    status: AttendanceRecord['status']
    notes?: string
    payment?: Omit<PaymentData, 'id'>
  }) => Promise<void>
}

export function useAttendance(patientId: string | null): UseAttendanceReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [appointments, setAppointments] = useState<{ date: Date }[]>([])
  const [stats, setStats] = useState<{
    total: number
    present: number
    absent: number
    late: number
    cancelled: number
    paid: number
    attendanceRate: number
  } | null>(null)

  const { createPayment } = usePayments()
  const supabase = createClient()

  const loadAppointments = async (userId: string) => {
    if (!patientId) return

    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("appointment_date")
        .eq("user_id", userId)
        .eq("patient_id", patientId)
        .eq("status", "scheduled")

      if (error) {
        console.error("Erro ao carregar agendamentos:", error)
        throw error
      }

      // Parse appointment_date as a local date (avoid UTC->local timezone shift)
      setAppointments(data?.map(a => ({
        date: new Date(String(a.appointment_date) + 'T00:00:00')
      })) || [])
    } catch (err) {
      console.error("Erro completo ao carregar agendamentos:", err)
      throw err // Propagar erro para tratamento no loadAttendance
    }
  }

  const loadAttendance = async (retryCount = 0) => {
    if (!patientId) {
      setError("ID do cliente não fornecido")
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!supabase) {
        throw new Error("Cliente Supabase não inicializado")
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error("Erro de autenticação:", userError)
        throw new Error("Erro na autenticação")
      }
      if (!user) {
        throw new Error("Usuário não autenticado")
      }

      try {
        // Carregar agendamentos primeiro
        await loadAppointments(user.id)
      } catch (appointmentError) {
        console.error("Erro ao carregar agendamentos:", appointmentError)
        // Continuar mesmo com erro nos agendamentos
      }

      // Carregar registros de presença com pagamentos
      const fullSelect = `
          id,
          session_date,
          status,
          payment_id,
          notes,
          payments!payments_attendance_id_fkey (
            id,
            amount,
            method,
            status,
            payment_date,
            notes
          )
        `

      const fallbackSelect = `
          id,
          session_date,
          status,
          payment_id,
          notes,
          payments!payments_attendance_id_fkey (
            id,
            amount,
            status,
            payment_date,
            notes
          )
        `

      let attendanceRes: any = await supabase
        .from("attendance")
        .select(fullSelect)
        .eq("user_id", user.id)
        .eq("patient_id", patientId)
        .order("session_date", { ascending: false })

      // If the error is due to the missing `method` column in payments, retry without requesting it.
      if (attendanceRes.error && typeof attendanceRes.error.message === 'string' && attendanceRes.error.message.includes('method')) {
        console.warn('Payments.method column missing in DB, retrying attendance select without method')
        attendanceRes = await supabase
          .from("attendance")
          .select(fallbackSelect)
          .eq("user_id", user.id)
          .eq("patient_id", patientId)
          .order("session_date", { ascending: false })
      }

      const attendanceData = attendanceRes.data
      const attendanceError = attendanceRes.error

      if (attendanceError) {
        // Tentar novamente se houver erro de rede (máximo 3 tentativas)
        if (retryCount < 3 && (attendanceError.message?.includes('network') || attendanceError.message?.includes('timeout'))) {
          console.log(`Tentativa ${retryCount + 1} de carregar presenças...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
          return loadAttendance(retryCount + 1)
        }
        console.error("Erro ao carregar presenças:", attendanceError)
        throw new Error(`Erro ao carregar presenças: ${attendanceError.message}`)
      }

      if (!attendanceData) {
        setRecords([])
        setStats({
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          cancelled: 0,
          paid: 0,
          attendanceRate: 0
        })
        return
      }

      const processedRecords: AttendanceRecord[] = attendanceData.map((record: any) => ({
        id: record.id,
        // Parse session_date (YYYY-MM-DD) as local midnight to avoid
        // timezone-induced off-by-one-day when constructing Date from
        // a bare YYYY-MM-DD string which is interpreted as UTC.
        sessionDate: new Date(String(record.session_date) + 'T00:00:00'),
        status: record.status,
        // Prefer explicit payment_id column when present; otherwise use linked payment
        paymentId: record.payment_id || (record.payments && record.payments[0] ? record.payments[0].id : undefined),
        payment: record.payments && record.payments[0] ? {
          id: record.payments[0].id,
          amount: record.payments[0].amount,
          method: record.payments[0].method ?? undefined,
          status: record.payments[0].status,
          paymentDate: record.payments[0].payment_date ? new Date(record.payments[0].payment_date) : undefined,
          notes: record.payments[0].notes
        } : undefined,
        notes: record.notes
      }))

      setRecords(processedRecords)

      // Calcular estatísticas
      const total = processedRecords.length
      const present = processedRecords.filter(r => r.status === "present").length
      const absent = processedRecords.filter(r => r.status === "absent").length
      const late = processedRecords.filter(r => r.status === "late").length
      const cancelled = processedRecords.filter(r => r.status === "cancelled").length
      // Count only records with a payment whose status is 'paid'.
      // Previously we counted any record with a paymentId which made
      // 'pending' payments appear as paid in the UI.
      const paid = processedRecords.filter(r => r.payment && r.payment.status === 'paid').length

      setStats({
        total,
        present,
        absent,
        late,
        cancelled,
        paid,
        attendanceRate: total > 0 ? (present / total) * 100 : 0
      })
    } catch (err) {
      console.error("Erro completo ao carregar presenças:", err)
      setError(err instanceof Error ? err.message : "Erro ao carregar presenças")
    } finally {
      setLoading(false)
    }
  }

  const updateAttendance = async (date: Date, data: {
    status: AttendanceRecord['status']
    notes?: string
    payment?: Omit<PaymentData, 'id'>
  }) => {
    if (!patientId) {
      throw new Error("ID do cliente não fornecido")
    }

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error("Erro na autenticação")
      if (!user) throw new Error("Usuário não autenticado")

      let paymentId = undefined

      // Upsert attendance first (without payment link). We'll then create
      // the payment (if requested) and link both directions so Supabase
      // relationship `attendance -> payments` works (payments.attendance_id).
      const upsertPayload: any = {
        user_id: user.id,
        patient_id: patientId,
        session_date: date.toISOString().split('T')[0], // Garantir formato YYYY-MM-DD
        status: data.status,
        notes: data.notes
      }

      const upsertRes: any = await supabase
        .from('attendance')
        .upsert([upsertPayload], { onConflict: 'user_id,patient_id,session_date' })
        .select()
        .single()

      if (upsertRes.error) {
        console.error('Erro ao salvar presença (detalhes):', upsertRes.error)
        throw new Error(upsertRes.error.message || 'Erro ao salvar presença')
      }

      const attendanceId = upsertRes.data?.id

      // Se tiver dados de pagamento, criar o pagamento e vincular ao attendance
      if (data.payment) {
        try {
          paymentId = await createPayment({
            ...data.payment,
            patientId,
            // pass attendanceId to create payment.attendance_id
            attendanceId
          })

          // update attendance.payment_id to point to the created payment
          const { error: attendanceLinkError } = await supabase
            .from('attendance')
            .update({ payment_id: paymentId })
            .eq('id', attendanceId)

          if (attendanceLinkError) console.error('Erro ao vincular payment_id na attendance:', attendanceLinkError)
        } catch (paymentError) {
          console.error("Erro ao criar pagamento:", paymentError)
          throw new Error(paymentError instanceof Error ? paymentError.message : "Erro ao processar pagamento")
        }
      }



      // If a payment was created and its status indicates pending/paid,
      // persist a lightweight summary on the patient record so the UI can
      // surface how much the patient owes without having to recompute
      // aggregates immediately.
      try {
        if (data.payment) {
          const payStatus = data.payment.status
          const paymentDateStr = data.payment.paymentDate
            ? data.payment.paymentDate.toISOString().split('T')[0]
            : date.toISOString().split('T')[0]

          if (payStatus === 'pending') {
            const { error: patientUpdateError } = await supabase
              .from('patients')
              .update({ payment_status: 'pending', payment_due_date: paymentDateStr })
              .eq('id', patientId)

            if (patientUpdateError) console.error('Erro ao atualizar cliente (pending):', patientUpdateError)
          } else if (payStatus === 'paid') {
            const { error: patientUpdateError } = await supabase
              .from('patients')
              .update({ payment_status: 'paid', last_payment_date: paymentDateStr })
              .eq('id', patientId)

            if (patientUpdateError) console.error('Erro ao atualizar cliente (paid):', patientUpdateError)
          }
        }
      } catch (patientErr) {
        console.error('Erro ao persistir resumo financeiro no cliente:', patientErr)
        // don't block the main flow if patient update fails
      }

      await loadAttendance()
    } catch (err) {
      console.error("Erro completo ao atualizar presença:", err)
      throw new Error(err instanceof Error ? err.message : "Erro ao salvar presença")
    }
  }

  useEffect(() => {
    if (patientId) {
      loadAttendance()
    }
  }, [patientId])

  const isDateScheduled = (date: Date) => {
    return appointments.some(a =>
      a.date.getFullYear() === date.getFullYear() &&
      a.date.getMonth() === date.getMonth() &&
      a.date.getDate() === date.getDate()
    )
  }

  return {
    loadAttendance,
    loading,
    error,
    records,
    appointments,
    isDateScheduled,
    stats,
    updateAttendance
  }
}
