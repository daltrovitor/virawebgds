"use client"

import { createClient } from "@/lib/supabase-client"
import { PaymentData } from "@/lib/types"
import { useEffect, useState } from "react"

export interface UsePaymentsReturn {
  createPayment: (data: Omit<PaymentData, 'id'>) => Promise<string>
  updatePayment: (id: string, data: Partial<PaymentData>) => Promise<void>
  getPaymentsByPatient: (patientId: string) => Promise<PaymentData[]>
  loading: boolean
  error: string | null
}

export function usePayments(): UsePaymentsReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const createPayment = async (data: Omit<PaymentData, 'id'>): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      // Try inserting including `method` first. If the DB is missing the column
      // (e.g. older schema), fall back to inserting without it.
      const insertPayload: any = {
        user_id: user.id,
        patient_id: data.patientId,
        amount: data.amount,
        method: data.method,
        status: data.status,
        payment_date: data.paymentDate?.toISOString(),
        // DB expects a non-null due_date (date). Use paymentDate's YYYY-MM-DD
        // part when available, otherwise default to today to satisfy NOT NULL.
        due_date: (data.paymentDate ? data.paymentDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        notes: data.notes
      }
      // If an attendanceId was provided, store the FK so attendance->payments
      // relationship works when selecting attendance with payments(...)
      if ((data as any).attendanceId) insertPayload.attendance_id = (data as any).attendanceId

      let res = await supabase.from("payments").insert([insertPayload]).select().single()

      // If PostgREST returned an error that mentions the missing column `method`,
      // retry without the field.
      if (res.error && typeof res.error.message === 'string' && res.error.message.includes('method')) {
        const fallbackPayload = { ...insertPayload }
        delete fallbackPayload.method
        const fallbackRes = await supabase.from("payments").insert([fallbackPayload]).select().single()
        if (fallbackRes.error) throw fallbackRes.error
        return fallbackRes.data.id
      }

      if (res.error) throw res.error
      // Notify interested UI that a payment was created/changed
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('payment-changed', { detail: { patientId: insertPayload.patient_id, status: insertPayload.status } }))
        }
      } catch (e) {
        // ignore dispatch errors
      }
      return res.data.id
    } catch (err) {
      // Build a helpful message from Supabase error objects when possible
      console.error("Erro ao criar pagamento (detalhes):", err)
      const parts: string[] = []
      try {
        if (err instanceof Error && err.message) parts.push(err.message)
        // Supabase error shape often contains message/details/hint/code
        const asAny: any = err
        if (asAny?.message && typeof asAny.message === 'string' && !parts.includes(asAny.message)) parts.push(asAny.message)
        if (asAny?.details) parts.push(String(asAny.details))
        if (asAny?.hint) parts.push(String(asAny.hint))
        if (asAny?.code) parts.push(String(asAny.code))
      } catch (ex) {
        // ignore
      }

      const fullMessage = parts.filter(Boolean).join(' | ') || "Erro ao criar pagamento"
      throw new Error(fullMessage)
    }
  }

  const updatePayment = async (id: string, data: Partial<PaymentData>): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const updatePayload: any = {
        amount: data.amount,
        method: data.method,
        status: data.status,
        payment_date: data.paymentDate?.toISOString(),
        due_date: (data.paymentDate ? data.paymentDate.toISOString().split('T')[0] : undefined),
        notes: data.notes
      }

  // Return the patient_id so callers (or listeners) can react to the change
  let res = await supabase.from("payments").update(updatePayload).eq('id', id).eq('user_id', user.id).select('patient_id,status').single()

      if (res.error && typeof res.error.message === 'string' && res.error.message.includes('method')) {
        const fallbackPayload = { ...updatePayload }
        delete fallbackPayload.method
        const fallbackRes = await supabase.from("payments").update(fallbackPayload).eq('id', id).eq('user_id', user.id)
        if (fallbackRes.error) throw fallbackRes.error
        return
      }

      if (res.error) throw res.error

      // Dispatch a global event so UI (attendance list) can refresh for the affected patient
      try {
        if (typeof window !== 'undefined' && res.data?.patient_id) {
          window.dispatchEvent(new CustomEvent('payment-changed', { detail: { patientId: res.data.patient_id, status: res.data.status } }))
        }
      } catch (e) {
        // ignore
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Erro ao atualizar pagamento")
    }
  }

  const getPaymentsByPatient = async (patientId: string): Promise<PaymentData[]> => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          method,
          status,
          payment_date,
          notes
        `)
        .eq('user_id', user.id)
        .eq('patient_id', patientId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      
      return data?.map(p => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        status: p.status,
        paymentDate: p.payment_date ? new Date(p.payment_date) : undefined,
        notes: p.notes
      })) || []
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Erro ao carregar pagamentos")
    }
  }

  return {
    createPayment,
    updatePayment,
    getPaymentsByPatient,
    loading,
    error
  }
}
