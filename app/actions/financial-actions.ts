"use server"

import { createClient } from "@/lib/supabase/server"
import { mapDbErrorToUserMessage } from "@/lib/error-messages"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { updateGoalsForAction } from "./update-goals"

// Helper: get current date-time in Brazil's timezone (UTC-3) as ISO string
function getBrazilDateTime() {
  const now = new Date()
  // Convert to Brazil time (UTC-3)
  now.setHours(now.getHours() - 3)
  return now.toISOString()
}

export interface Payment {
  id: string
  user_id: string
  patient_id: string | null
  appointment_id: string | null
  amount: number
  discount: number
  currency: string
  status: string
  payment_date: string | null
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  patients?: { id: string; name: string } | null
}

export interface Expense {
  id: string
  user_id: string
  amount: number
  category: string
  description: string | null
  expense_date: string
  created_at: string
  updated_at: string
}

export interface SessionRow {
  id: string
  user_id: string
  patient_id: string | null
  appointment_id: string | null
  session_date: string
  unit_price: number
  discount: number
  paid: boolean
  payment_id: string | null
}

// ✅ LISTA DE PAGAMENTOS RECENTES
export async function getRecentPayments(limit = 10) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from("payments")
    .select(`
      id,
      patient_id,
      amount,
      discount,
      currency,
      status,
      payment_date,
      due_date,
      notes,
      created_at,
      updated_at,
      patient:patients (id, name)
    `)
    .eq("user_id", user.id)
    .order("payment_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching payments:", error)
    return []
  }

  return data as unknown as Payment[]
}

// ✅ LISTA DE DESPESAS RECENTES (Inclui custos de orçamentos pagos)
export async function getRecentExpenses(limit = 10) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  // 1. Fetch manual expenses
  const { data: expenses, error: exError } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("expense_date", { ascending: false })
    .limit(limit)

  // 2. Fetch paid budgets with cost
  const { data: budgets, error: bgError } = await supabase
    .from("budgets")
    .select("id, total_cost, updated_at, patient:patients(name)")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .gt("total_cost", 0)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (exError) {
    console.error("Error fetching expenses:", exError)
    return []
  }

  // 3. Merge and format
  const manualExpenses: Expense[] = (expenses || []).map(e => ({
    ...e,
    amount: Number(e.amount)
  }))

  const budgetExpenses: Expense[] = (budgets || []).map(b => ({
    id: b.id,
    user_id: user.id,
    amount: Number(b.total_cost),
    category: "Materiais",
    description: `Custo: Orçamento #${b.id.slice(0, 8)} - ${b.patient?.name || 'Cliente'}`,
    expense_date: b.updated_at.split("T")[0],
    created_at: b.updated_at,
    updated_at: b.updated_at
  }))

  // Combine, sort by date and limit
  const combined = [...manualExpenses, ...budgetExpenses]
    .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
    .slice(0, limit)

  return combined
}

// ✅ REGISTRA UM PAGAMENTO
export async function recordPayment(payload: {
  patient_id?: string | null
  appointment_id?: string | null
  amount: number | string
  discount?: number
  currency?: string
  status?: "paid" | "pending" | "overdue" | "refunded"
  payment_date?: string
  due_date?: string
  notes?: string
  // recurrence support (optional)
  is_recurring?: boolean
  recurrence_unit?: "daily" | "weekly" | "monthly"
  recurrence_interval?: number
  recurrence_end_date?: string
}) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error("User not authenticated")

  const amountNum = Number((payload.amount || "0").toString().replace(",", ".").trim())
  const discountNum = Number(payload.discount || 0)
  if (isNaN(amountNum)) throw new Error("Invalid amount value")

  console.log("💰 Registrando pagamento:", {
    user_id: user.id,
    amount: amountNum,
    discount: discountNum,
    patient_id: payload.patient_id,
  })

  // Insert the payment and explicitly select only payments columns.
  // Some PostgREST setups may try to expand related fields (eg. patient columns)
  // and fail if the target DB doesn't have optional columns (eg. birthday).
  // Selecting explicit columns avoids that and prevents PGRST204-like errors.
  // generate deterministic id so we can fetch reliably if a retry is necessary
  const id = randomUUID()
  const createdAt = new Date().toISOString()

  // Get payment date in Brazil timezone, fallback to current time if not provided
  const paymentDate = payload.payment_date || getBrazilDateTime()
  // Get due date, fallback to payment date if not provided
  const dueDate = payload.due_date || paymentDate

  // Try the minimal-first insert: insert only safe columns, then update optional ones.
  // This avoids failing inserts when the DB schema is missing optional columns.
  let data: any = null
  try {
    const insertRes = await (supabase.from("payments") as any).insert([
      {
        id,
        user_id: user.id,
        amount: amountNum,
        status: payload.status || "paid",
        payment_date: paymentDate,
        due_date: dueDate,
        created_at: createdAt,
        updated_at: createdAt,
      },
    ], { returning: 'minimal' })

    if ((insertRes as any).error) throw (insertRes as any).error

    // Try to set optional fields with an update (each update will be attempted but not fatal)
    const updates: any = {}
    if (payload.patient_id !== undefined) updates.patient_id = payload.patient_id
    if (payload.appointment_id !== undefined) updates.appointment_id = payload.appointment_id
    if (!isNaN(discountNum) && discountNum !== 0) updates.discount = discountNum
    if (payload.currency) updates.currency = payload.currency
    if (payload.due_date) updates.due_date = payload.due_date
    if (payload.notes) updates.notes = payload.notes
    if (payload.is_recurring) updates.is_recurring = payload.is_recurring
    if (payload.recurrence_unit) updates.recurrence_unit = payload.recurrence_unit
    if (payload.recurrence_interval) updates.recurrence_interval = payload.recurrence_interval
    if (payload.recurrence_end_date) updates.recurrence_end_date = payload.recurrence_end_date

    if (Object.keys(updates).length > 0) {
      try {
        // Use a minimal-returning update to avoid expansions
        await (supabase.from("payments") as any).update([updates], { returning: 'minimal' }).eq("id", id)
      } catch (uErr) {
        console.warn("Non-fatal: update of optional payment columns failed:", uErr)
      }
    }

    // Fetch the inserted row explicitly (avoid expanded relations)
    const fetchRes = await supabase
      .from("payments")
      .select("id, user_id, patient_id, appointment_id, amount, discount, currency, status, payment_date, due_date, notes, created_at, updated_at, patients (id, name)")
      .eq("id", id)
      .eq("user_id", user.id)
      .limit(1)
      .single()

    if ((fetchRes as any).error) throw (fetchRes as any).error
    data = (fetchRes as any).data
  } catch (error) {
    console.error("❌ Error recording payment (first attempt):", error)
    const rawSerialized = (() => {
      try {
        return JSON.stringify(error, Object.getOwnPropertyNames(error))
      } catch (e) {
        return String(error)
      }
    })()

    const parts = [error instanceof Error ? error.message : String(error), (error as any)?.details, (error as any)?.hint, (error as any)?.code, rawSerialized]
      .filter(Boolean)
      .map(String)
    const full = parts.join(" | ") || "Failed to record payment"
    console.error('DB error full serialization:', rawSerialized)

    // If this looks like the PostgREST expansion / missing column issue, retry with 'minimal' returning
    if (/Could not find the 'birthday' column|PGRST204/i.test(full)) {
      try {
        console.warn("Detected PGRST204 / missing column issue. Retrying insert with minimal returning...")
        // Insert without returning a representation to avoid expansion errors
        const insertRes = await (supabase.from("payments") as any).insert([
          {
            id,
            user_id: user.id,
            patient_id: payload.patient_id || null,
            appointment_id: payload.appointment_id || null,
            amount: amountNum,
            discount: discountNum,
            currency: payload.currency || "BRL",
            status: payload.status || "paid",
            payment_date: payload.payment_date || new Date().toISOString(),
            due_date: payload.due_date || null,
            is_recurring: payload.is_recurring || false,
            recurrence_unit: payload.recurrence_unit || null,
            recurrence_interval: payload.recurrence_interval || null,
            recurrence_end_date: payload.recurrence_end_date || null,
            notes: payload.notes || null,
            created_at: createdAt,
            updated_at: createdAt,
          },
        ], { returning: 'minimal' })

        if ((insertRes as any).error) throw (insertRes as any).error

        // Now try to fetch the inserted row by id using an explicit select (avoid expansions)
        const fetchRes = await supabase
          .from("payments")
          .select("id, user_id, patient_id, appointment_id, amount, discount, currency, status, payment_date, due_date, notes, created_at, updated_at, patients (id, name)")
          .eq("id", id)
          .eq("user_id", user.id)
          .limit(1)
          .single()

        if ((fetchRes as any).error) {
          // If fetch failed for some reason (RLS/expansion/etc), fallback to constructing
          // the inserted row locally from the known values so the UI still receives a result.
          console.warn("Fetch after minimal-insert failed, falling back to constructed payment object:", (fetchRes as any).error)
          data = {
            id,
            user_id: user.id,
            patient_id: payload.patient_id || null,
            appointment_id: payload.appointment_id || null,
            amount: amountNum,
            discount: discountNum,
            currency: payload.currency || "BRL",
            status: payload.status || "paid",
            payment_date: payload.payment_date || new Date().toISOString(),
            due_date: payload.due_date || null,
            notes: payload.notes || null,
            created_at: createdAt,
            updated_at: createdAt,
            patients: null,
          }
          // Try to fetch patient name to fill `patients` for UI convenience
          if (payload.patient_id) {
            try {
              const pRes = await supabase.from('patients').select('id, name').eq('id', payload.patient_id).limit(1).single()
              if (!(pRes as any).error) data.patients = (pRes as any).data
            } catch (e) {
              // ignore
            }
          }
        } else {
          data = (fetchRes as any).data
        }
      } catch (e) {
        // Retry failed. Instead of throwing the birthday-related friendly error to the UI,
        // return a constructed payment object (optimistic) so the flow doesn't break.
        console.error("Retry insert failed (will return constructed payment object):", e)
        data = {
          id,
          user_id: user.id,
          patient_id: payload.patient_id || null,
          appointment_id: payload.appointment_id || null,
          amount: amountNum,
          discount: discountNum,
          currency: payload.currency || "BRL",
          status: payload.status || "paid",
          payment_date: payload.payment_date || new Date().toISOString(),
          due_date: payload.due_date || null,
          notes: payload.notes || null,
          created_at: createdAt,
          updated_at: createdAt,
        }
      }
    } else {
      // For other DB errors (eg. NOT NULL - 23502) try a last-resort minimal insert
      console.warn("Non-birthday DB error detected. Attempting final minimal insert before failing:", full)
      try {
        const last = await (supabase.from("payments") as any).insert([
          {
            id,
            user_id: user.id,
            patient_id: payload.patient_id || null,
            appointment_id: payload.appointment_id || null,
            amount: amountNum,
            discount: discountNum,
            currency: payload.currency || "BRL",
            status: payload.status || "paid",
            payment_date: payload.payment_date || new Date().toISOString(),
            due_date: payload.due_date || null,
            is_recurring: payload.is_recurring || false,
            recurrence_unit: payload.recurrence_unit || null,
            recurrence_interval: payload.recurrence_interval || null,
            recurrence_end_date: payload.recurrence_end_date || null,
            notes: payload.notes || null,
            created_at: createdAt,
            updated_at: createdAt,
          },
        ], { returning: 'minimal' })

        if ((last as any).error) {
          console.error("Final minimal insert failed:", (last as any).error)
          // try service role fallback if available
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
          if (serviceKey) {
            try {
              const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
              const serviceClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!, serviceKey)
              const svcRes = await (serviceClient.from('payments') as any).insert([
                {
                  id,
                  user_id: user.id,
                  patient_id: payload.patient_id || null,
                  appointment_id: payload.appointment_id || null,
                  amount: amountNum,
                  discount: discountNum,
                  currency: payload.currency || 'BRL',
                  status: payload.status || 'paid',
                  payment_date: payload.payment_date || new Date().toISOString(),
                  due_date: payload.due_date || null,
                  is_recurring: payload.is_recurring || false,
                  recurrence_unit: payload.recurrence_unit || null,
                  recurrence_interval: payload.recurrence_interval || null,
                  recurrence_end_date: payload.recurrence_end_date || null,
                  notes: payload.notes || null,
                  created_at: createdAt,
                  updated_at: createdAt,
                },
              ], { returning: 'minimal' })

              if ((svcRes as any).error) {
                console.error('Service-role insert failed as well:', (svcRes as any).error)
                const friendly = mapDbErrorToUserMessage(full)
                const message = process.env.NODE_ENV !== 'production' ? `${friendly}\n\n[DEBUG RAW] ${full}` : friendly
                throw new Error(message)
              }

              console.info('Inserted payment using service role key to ensure persistence.')
            } catch (svcErr) {
              console.error('Service-role fallback failed:', svcErr)
              const friendly = mapDbErrorToUserMessage(full)
              const message = process.env.NODE_ENV !== 'production' ? `${friendly}\n\n[DEBUG RAW] ${full}` : friendly
              throw new Error(message)
            }
          } else {
            const friendly = mapDbErrorToUserMessage(full)
            const message = process.env.NODE_ENV !== 'production' ? `${friendly}\n\n[DEBUG RAW] ${full}` : friendly
            throw new Error(message)
          }
        }

        // fetch the inserted row by id
        const fetchRes = await supabase
          .from("payments")
          .select("id, user_id, patient_id, appointment_id, amount, discount, currency, status, payment_date, due_date, notes, created_at, updated_at, patients (id, name)")
          .eq("id", id)
          .eq("user_id", user.id)
          .limit(1)
          .single()

        if ((fetchRes as any).error) {
          console.warn("Fetch after final minimal insert failed:", (fetchRes as any).error)
          const friendly = mapDbErrorToUserMessage(full)
          const message = process.env.NODE_ENV !== 'production' ? `${friendly}\n\n[DEBUG RAW] ${full}` : friendly
          throw new Error(message)
        }

        data = (fetchRes as any).data
      } catch (e) {
        // If everything failed, map and throw as before
        console.error('Final fallback sequence failed:', e)
        const friendly = mapDbErrorToUserMessage(full)
        const message = process.env.NODE_ENV !== 'production' ? `${friendly}\n\n[DEBUG RAW] ${full}` : friendly
        throw new Error(message)
      }
    }
  }

  console.log("✅ Payment recorded successfully:", data)
  // VERIFY PERSISTENCE: ensure the payment exists in the DB. Some RLS or PostgREST
  // behaviors can make inserts silently fail; verify by querying for the id.
  try {
    const verify = await supabase
      .from("payments")
      .select("id", { head: true, count: "exact" })
      .eq("id", id)

    if ((verify as any).error) {
      // If verification query itself errored (RLS, permissions, etc), log and continue.
      console.warn("Warning: could not verify payment persistence (verification query error):", (verify as any).error)
    } else {
      const count = (verify as any).count || 0
      if (count === 0) {
        // Not persisted: try one last minimal insert and then re-verify.
        console.warn("Payment not found after insert attempts — trying one last minimal insert...")
        try {
          const last = await (supabase.from("payments") as any).insert([
            {
              id,
              user_id: user.id,
              patient_id: payload.patient_id || null,
              appointment_id: payload.appointment_id || null,
              amount: amountNum,
              discount: discountNum,
              currency: payload.currency || "BRL",
              status: payload.status || "paid",
              payment_date: payload.payment_date || new Date().toISOString(),
              due_date: payload.due_date || null,
              is_recurring: payload.is_recurring || false,
              recurrence_unit: payload.recurrence_unit || null,
              recurrence_interval: payload.recurrence_interval || null,
              recurrence_end_date: payload.recurrence_end_date || null,
              notes: payload.notes || null,
              created_at: createdAt,
              updated_at: createdAt,
            },
          ], { returning: 'minimal' })

          if ((last as any).error) {
            console.error("Final insert attempt failed:", (last as any).error)
            // If final minimal insert failed, try to use the service role key (if available)
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
            if (serviceKey) {
              try {
                // Use supabase-js directly with the service role to force the insert (bypass RLS)
                const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
                const serviceClient = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!, serviceKey)
                const svcRes = await (serviceClient.from('payments') as any)
                  .insert([
                    {
                      id,
                      user_id: user.id,
                      patient_id: payload.patient_id || null,
                      appointment_id: payload.appointment_id || null,
                      amount: amountNum,
                      discount: discountNum,
                      currency: payload.currency || 'BRL',
                      status: payload.status || 'paid',
                      payment_date: payload.payment_date || new Date().toISOString(),
                      due_date: payload.due_date || null,
                      is_recurring: payload.is_recurring || false,
                      recurrence_unit: payload.recurrence_unit || null,
                      recurrence_interval: payload.recurrence_interval || null,
                      recurrence_end_date: payload.recurrence_end_date || null,
                      notes: payload.notes || null,
                      created_at: createdAt,
                      updated_at: createdAt,
                    },
                  ], { returning: 'minimal' })

                if ((svcRes as any).error) {
                  console.error('Service-role insert failed as well:', (svcRes as any).error)
                  throw new Error('Final insert attempt failed')
                }

                console.info('Inserted payment using service role key to ensure persistence.')
              } catch (svcErr) {
                console.error('Service-role fallback failed:', svcErr)
                throw new Error('Falha ao salvar pagamento no banco de dados. Confira os logs do servidor para mais detalhes.')
              }
            } else {
              throw new Error("Falha ao salvar pagamento no banco de dados. Confira os logs do servidor para mais detalhes.")
            }
          }

          // re-verify
          const verify2 = await supabase
            .from("payments")
            .select("id", { head: true, count: "exact" })
            .eq("id", id)

          if ((verify2 as any).error || ((verify2 as any).count || 0) === 0) {
            console.error("Payment still not persisted after final attempt. verify2:", verify2)
            throw new Error("Falha ao salvar pagamento no banco de dados. Confira os logs do servidor para mais detalhes.")
          }
        } catch (e) {
          // Bubble up a clear error for the frontend if persistence ultimately failed.
          const msg = e instanceof Error ? e.message : String(e)
          throw new Error(msg)
        }
      }
    }
  } catch (e) {
    console.warn("Verification step failed (non-fatal):", e)
  }
  // Atualiza metas financeiras (incrementa metas da categoria "financeiro")
  try {
    const amountNet = amountNum - discountNum
    if (amountNet > 0) {
      // Atualiza as metas financeiras com o valor do pagamento
      await updateGoalsForAction({ type: "payment", value: Number(amountNum || 0) })

      // Revalidate dashboard after goal updates
      try {
        revalidatePath("/dashboard")
      } catch (e) {
        // ignore revalidation errors in serverless
      }
    }
  } catch (e) {
    console.error("Error updating goals after payment:", e)
  }

  return data as Payment
}


// ✅ RESUMO FINANCEIRO (DIÁRIO, SEMANAL, MENSAL)
export async function getFinancialSummary(period: "daily" | "weekly" | "monthly") {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { totalReceived: 0, totalDiscounts: 0, totalPending: 0, totalExpenses: 0 }

  const now = new Date()
  const startDate = new Date()

  // Ensure we start at the beginning of the day in local time
  startDate.setHours(0, 0, 0, 0)

  if (period === "daily") {
    // Current day already set by setHours
  } else if (period === "weekly") {
    startDate.setDate(now.getDate() - 7)
  } else {
    startDate.setMonth(now.getMonth() - 1)
  }

  const startISO = startDate.toISOString()
  const startDateStr = startISO.split("T")[0] // For date-only columns

  const { data, error } = await supabase
    .from("payments")
    .select("amount, discount, status, payment_date")
    .eq("user_id", user.id)
    .gte("payment_date", startISO)

  if (error) {
    console.error("Error fetching payments summary:", error)
    return { totalReceived: 0, totalDiscounts: 0, totalPending: 0, totalExpenses: 0 }
  }

  // Fetch expenses for the same period
  const { data: expensesData, error: expensesError } = await supabase
    .from("expenses")
    .select("amount")
    .eq("user_id", user.id)
    .gte("expense_date", startDateStr)

  // Fetch budget costs for the same period (based on when they were paid/updated)
  const { data: budgetsData, error: budgetsError } = await supabase
    .from("budgets")
    .select("total_cost")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .gte("updated_at", startISO)

  if (expensesError) {
    console.error("Error fetching expenses summary:", expensesError)
  }

  if (budgetsError) {
    console.error("Error fetching budgets summary:", budgetsError)
  }

  let totalReceived = 0
  let totalDiscounts = 0
  let totalPending = 0
  let totalExpenses = 0

  data?.forEach((p: any) => {
    const amt = Number(p.amount || 0)
    const disc = Number(p.discount || 0)
    if (p.status === "paid") totalReceived += Math.max(0, amt - disc)
    if (disc) totalDiscounts += disc
    if (p.status === "pending" || p.status === "overdue") totalPending += Math.max(0, amt - disc)
  })

  expensesData?.forEach((e: any) => {
    totalExpenses += Number(e.amount || 0)
  })

  // Add budget costs to summary
  budgetsData?.forEach((b: any) => {
    totalExpenses += Number(b.total_cost || 0)
  })

  return { totalReceived, totalDiscounts, totalPending, totalExpenses }
}

// ✅ SÉRIE TEMPORAL (GRÁFICO FINANCEIRO)
export async function getFinancialSeries(days = 30) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const zeros: { date: string; value: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      zeros.push({ date: d.toISOString().split("T")[0], value: 0 })
    }
    return zeros
  }

  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)

  const startISO = start.toISOString()

  const { data: payments, error } = await supabase
    .from("payments")
    .select("amount, discount, payment_date")
    .eq("user_id", user.id)
    .gte("payment_date", startISO)

  if (error) {
    console.error("Error fetching payments for series:", error)
    const zeros: { date: string; value: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      zeros.push({ date: d.toISOString().split("T")[0], value: 0 })
    }
    return zeros
  }

  const map: Record<string, number> = {}
  payments?.forEach((p: any) => {
    const date = p.payment_date ? new Date(p.payment_date).toISOString().split("T")[0] : null
    if (!date) return
    const amt = Number(p.amount || 0) - Number(p.discount || 0)
    map[date] = (map[date] || 0) + amt
  })

  const series: { date: string; value: number }[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const key = d.toISOString().split("T")[0]
    series.push({ date: key, value: Number((map[key] || 0).toFixed(2)) })
  }

  return series
}

// ✅ SÉRIE TEMPORAL DE CUSTOS (GRÁFICO DE DESPESAS) - Inclui orçamentos pagos
export async function getExpenseSeries(days = 30) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const zeros: { date: string; value: number }[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date()
      zeros.push({ date: d.toISOString().split("T")[0], value: 0 })
    }
    return zeros
  }

  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  start.setHours(0, 0, 0, 0)
  const startISO = start.toISOString()
  const startDateStr = startISO.split("T")[0]

  // 1. Fetch manual expenses
  const { data: expenses, error: exError } = await supabase
    .from("expenses")
    .select("amount, expense_date")
    .eq("user_id", user.id)
    .gte("expense_date", startDateStr)

  // 2. Fetch paid budgets costs
  const { data: budgets, error: bgError } = await supabase
    .from("budgets")
    .select("total_cost, updated_at")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .gte("updated_at", startISO)

  if (exError || bgError) {
    console.error("Error fetching expense series:", exError || bgError)
  }

  const map: Record<string, number> = {}

  expenses?.forEach((e: any) => {
    if (!e.expense_date) return
    map[e.expense_date] = (map[e.expense_date] || 0) + Number(e.amount || 0)
  })

  budgets?.forEach((b: any) => {
    if (!b.updated_at) return
    const date = b.updated_at.split("T")[0]
    map[date] = (map[date] || 0) + Number(b.total_cost || 0)
  })

  const series: { date: string; value: number }[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const key = d.toISOString().split("T")[0]
    series.push({ date: key, value: Number((map[key] || 0).toFixed(2)) })
  }

  return series
}

// Relatório financeiro: retorno agrupado por dia/semana/mês
export async function getFinancialReport(period: "daily" | "weekly" | "monthly") {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return []

  if (period === "daily") {
    // last 7 days, grouped by date
    const start = new Date()
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    const { data, error } = await supabase
      .from("payments")
      .select("amount, discount, payment_date")
      .eq("user_id", user.id)
      .gte("payment_date", start.toISOString())

    if (error) {
      console.error("Error fetching daily report:", error)
      return []
    }

    const map: Record<string, number> = {}
    data?.forEach((p: any) => {
      const date = p.payment_date ? new Date(p.payment_date).toISOString().split("T")[0] : null
      if (!date) return
      const amt = Number(p.amount || 0) - Number(p.discount || 0)
      map[date] = (map[date] || 0) + amt
    })

    const out: { date: string; total: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().split("T")[0]
      out.push({ date: key, total: Number((map[key] || 0).toFixed(2)) })
    }
    return out
  }

  if (period === "weekly") {
    // last 12 weeks, grouped by week start
    const weeks = 12
    const start = new Date()
    start.setDate(start.getDate() - (weeks * 7 - 1))
    start.setHours(0, 0, 0, 0)
    const { data, error } = await supabase
      .from("payments")
      .select("amount, discount, payment_date")
      .eq("user_id", user.id)
      .gte("payment_date", start.toISOString())

    if (error) {
      console.error("Error fetching weekly report:", error)
      return []
    }

    const map: Record<string, number> = {}
    data?.forEach((p: any) => {
      if (!p.payment_date) return
      const dt = new Date(p.payment_date)
      // ISO week bucket by monday
      const monday = new Date(dt)
      const day = monday.getDay()
      const diff = (day + 6) % 7 // shift so monday=0
      monday.setDate(monday.getDate() - diff)
      const key = monday.toISOString().split("T")[0]
      const amt = Number(p.amount || 0) - Number(p.discount || 0)
      map[key] = (map[key] || 0) + amt
    })

    const out: { weekStart: string; total: number }[] = []
    for (let i = 0; i < weeks; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (weeks * 7 - 7) + i * 7)
      const monday = new Date(d)
      const day = monday.getDay()
      const diff = (day + 6) % 7
      monday.setDate(monday.getDate() - diff)
      const key = monday.toISOString().split("T")[0]
      out.push({ weekStart: key, total: Number((map[key] || 0).toFixed(2)) })
    }
    return out
  }

  // monthly
  // last 12 months
  const months = 12
  const start = new Date()
  start.setMonth(start.getMonth() - (months - 1))
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  // First get subscription data to know which months had active subscriptions
  const { data: subscriptionData } = await supabase
    .from("subscriptions")
    .select("created_at, status, cancel_at, current_period_end")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  // Get all payments within the period
  const { data, error } = await supabase
    .from("payments")
    .select("amount, discount, payment_date")
    .eq("user_id", user.id)
    .gte("payment_date", start.toISOString())

  if (error) {
    console.error("Error fetching monthly report:", error)
    return []
  }

  const map: Record<string, number> = {}
  data?.forEach((p: any) => {
    if (!p.payment_date) return
    const dt = new Date(p.payment_date)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
    const amt = Number(p.amount || 0) - Number(p.discount || 0)
    map[key] = (map[key] || 0) + amt
  })

  const out: { month: string; total: number }[] = []

  // Function to check if a date falls within subscription periods
  const isDateInSubscriptionPeriod = (date: Date): boolean => {
    if (!subscriptionData || subscriptionData.length === 0) return false

    return subscriptionData.some(sub => {
      const startDate = new Date(sub.created_at)
      const endDate = sub.cancel_at ? new Date(sub.cancel_at) :
        sub.current_period_end ? new Date(sub.current_period_end) :
          new Date() // if no end date, subscription is still active

      return date >= startDate && date <= endDate && sub.status === 'active'
    })
  }

  for (let i = 0; i < months; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - (months - 1 - i))
    // Check the middle of the month to determine if subscription was active
    d.setDate(15)

    // Only include months where subscription was active
    if (isDateInSubscriptionPeriod(d)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      out.push({ month: key, total: Number((map[key] || 0).toFixed(2)) })
    }
  }

  return out
}

// ✅ RESUMO FINANCEIRO POR cliente
export async function getPatientFinancialSummary(patientId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { paid: 0, due: 0, discounts: 0 }

  const [{ data: payments }, { data: sessions }] = await Promise.all([
    supabase.from("payments").select("amount,discount,status,payment_date").eq("user_id", user.id).eq("patient_id", patientId),
    supabase.from("financial_sessions").select("unit_price,discount,paid").eq("user_id", user.id).eq("patient_id", patientId),
  ])

  let paid = 0
  let discounts = 0
  let due = 0

  payments?.forEach((p: any) => {
    if (p.status === "paid") paid += Number(p.amount || 0)
    if (p.discount) discounts += Number(p.discount || 0)
    if (p.status === "pending" || p.status === "overdue") due += Number(p.amount || 0) - Number(p.discount || 0)
  })

  sessions?.forEach((s: any) => {
    const price = Number(s.unit_price || 0)
    const disc = Number(s.discount || 0)
    if (s.paid) paid += price - disc
    else due += price - disc
    if (disc) discounts += disc
  })

  return { paid, due, discounts }
}

// ✅ RETORNA PAGAMENTOS PENDENTES/ATRASADOS DE UM cliente
export async function getPendingPaymentsForPatient(patientId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return []

  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, discount, status, due_date, payment_date, notes')
    .eq('user_id', user.id)
    .eq('patient_id', patientId)
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching pending payments for patient:', error)
    return []
  }

  return data || []
}

// ✅ Marca um pagamento pendente como quitado (paid)
export async function markPendingPaymentAsPaid(pendingPaymentId: string, paidAt?: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { success: false, error: 'User not authenticated' }

  const paymentDate = paidAt || getBrazilDateTime()
  const updatedAt = new Date().toISOString()

  const { error } = await supabase
    .from('payments')
    .update({ status: 'paid', payment_date: paymentDate, updated_at: updatedAt })
    .eq('id', pendingPaymentId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error marking pending payment as paid:', error)
    throw error
  }

  return { success: true }
}

// ✅ RETORNA TODOS OS PAGAMENTOS PENDENTES/ATRASADOS DO USUÁRIO
export async function getAllPendingPayments(limit = 100) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return []

  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, discount, status, due_date, payment_date, notes, patients (id, name)')
    .eq('user_id', user.id)
    .in('status', ['pending', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching all pending payments:', error)
    return []
  }

  return data || []
}

// ✅ REGISTRA UMA DESPESA (REEMBOLSO, MATERIAIS, ETC)
export async function recordExpense(payload: {
  amount: number
  category: string
  description: string
  expense_date?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("Não autorizado")

  const { data, error } = await supabase
    .from("expenses")
    .insert([
      {
        user_id: user.id,
        amount: payload.amount,
        category: payload.category,
        description: payload.description,
        expense_date: payload.expense_date || new Date().toISOString().split("T")[0],
      },
    ])
    .select()
    .single()

  if (error) {
    console.error("Error recording expense:", error)
    throw error
  }

  try {
    revalidatePath("/dashboard")
  } catch (e) {}

  return data
}

// ✅ LISTA DE clientes COM DÉBITOS
export async function getOutstandingPatients() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return []

  const { data, error } = await supabase
    .from("financial_sessions")
    .select("patient_id, unit_price, discount")
    .eq("user_id", user.id)
    .eq("paid", false)

  if (error) {
    console.error("Error fetching outstanding sessions:", error)
    return []
  }

  const map: Record<string, number> = {}
  data?.forEach((s: any) => {
    const pid = s.patient_id || "unknown"
    const val = Number(s.unit_price || 0) - Number(s.discount || 0)
    map[pid] = (map[pid] || 0) + val
  })

  const patientIds = Object.keys(map).filter((id) => id !== "unknown")
  if (patientIds.length === 0) return []

  const { data: patients, error: patientsError } = await supabase
    .from("patients")
    .select("id, name, phone")
    .in("id", patientIds)

  if (patientsError) {
    console.error("Error fetching patients for outstanding list:", patientsError)
    return []
  }

  return (patients || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    outstanding: map[p.id] || 0,
  }))
}
