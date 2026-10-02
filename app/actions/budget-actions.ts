"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { calculateItemTotals, calculateBudgetTotals } from "@/lib/budget-calculations"
import type {
  Budget,
  BudgetItem,
  BudgetItemExecution,
  BudgetPaymentMethod,
  BudgetStatus,
  BudgetItemDraft,
  InstallmentInterval,
} from "@/lib/budget-types"
import { decodeRegion, withRegionSuffix } from "@/lib/dental-regions"
import { toPaymentsMethod, type PlannedInstallment } from "@/lib/payment-plan"
import { recordPayment } from "./financial-actions"

// ============================================================
// Helpers
// ============================================================

type SupabaseError = { code?: string; message?: string } | null | undefined

/** Coluna inexistente (banco sem a migração 071): PostgreSQL 42703 ou cache do PostgREST (PGRST204). */
function isMissingColumn(error: SupabaseError): boolean {
  if (!error) return false
  return error.code === "42703" || error.code === "PGRST204" || /column .* does not exist|Could not find the '.*' column/i.test(error.message || "")
}

/** Etiqueta usada nas observações das parcelas — permite localizar parcelas mesmo sem a coluna budget_id. */
function budgetTag(budgetId: string): string {
  return `#${budgetId.slice(0, 8)}`
}

async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
}

// ============================================================
// BUDGETS (Orçamentos)
// ============================================================

const BUDGET_SELECT = `
  *,
  patient:patients(id, name),
  items:budget_items(*),
  payment_methods:budget_payment_methods(*)
`

export async function getBudgets(): Promise<Budget[]> {
  const { supabase, user } = await requireUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching budgets:", error)
    return []
  }
  return (data || []) as unknown as Budget[]
}

export async function getBudgetById(id: string): Promise<Budget | null> {
  const { supabase, user } = await requireUser()
  if (!user) return null

  const { data, error } = await supabase
    .from("budgets")
    .select(BUDGET_SELECT)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error) {
    console.error("Error fetching budget:", error)
    return null
  }
  return data as unknown as Budget
}

export async function getBudgetsByPatient(patientId: string): Promise<Budget[]> {
  const { supabase, user } = await requireUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("budgets")
    .select(`
      *,
      patient:patients(id, name),
      items:budget_items(*)
    `)
    .eq("user_id", user.id)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching budgets for patient:", error)
    return []
  }
  return (data || []) as unknown as Budget[]
}

export interface CreateBudgetPayload {
  patient_id: string
  items: BudgetItemDraft[]
  notes?: string
  valid_until?: string
  down_payment: number
  installment_count: number
  installment_interval: InstallmentInterval
  payment_methods: { method: BudgetPaymentMethod["method"]; amount: number }[]
  status?: BudgetStatus
  // Fluxo odontológico (gravados quando a migração 071 existir)
  professional_id?: string | null
  discount_amount?: number
  first_due_date?: string | null
  payment_method?: BudgetPaymentMethod["method"] | null
}

export async function createBudget(payload: CreateBudgetPayload): Promise<{ success: boolean; data?: Budget; error?: string; degraded?: boolean }> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: "User not authenticated" }
  if (!payload.patient_id) return { success: false, error: "Selecione o paciente." }
  if (payload.items.length === 0) return { success: false, error: "Inclua ao menos um procedimento." }

  const totals = calculateBudgetTotals(payload.items, payload.down_payment, payload.installment_count)
  const discount = Math.min(Math.max(0, payload.discount_amount || 0), totals.total_amount)
  const totalAmount = Math.round((totals.total_amount - discount) * 100) / 100
  const remaining = Math.max(0, totalAmount - payload.down_payment)
  const installmentValue = payload.installment_count > 0 ? Math.round((remaining / payload.installment_count) * 100) / 100 : remaining
  const discountNote = discount > 0 ? `Desconto aplicado: R$ ${discount.toFixed(2).replace(".", ",")}` : ""

  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .insert({
      user_id: user.id,
      patient_id: payload.patient_id,
      status: payload.status || "draft",
      notes: [payload.notes?.trim(), discountNote].filter(Boolean).join("\n") || null,
      valid_until: payload.valid_until || null,
      down_payment: payload.down_payment,
      installment_count: payload.installment_count,
      installment_interval: payload.installment_interval,
      installment_value: installmentValue,
      subtotal: totals.subtotal,
      total_tax: totals.total_tax,
      total_amount: totalAmount,
      total_cost: totals.total_cost,
      net_revenue: Math.round((totalAmount - totals.total_cost) * 100) / 100,
    })
    .select()
    .single()

  if (budgetError || !budget) {
    console.error("Error creating budget:", budgetError)
    return { success: false, error: budgetError?.message || "Não foi possível criar o orçamento." }
  }

  let degraded = false

  // Campos da migração 071 — não fatais
  const extra: Record<string, unknown> = {}
  if (payload.professional_id) extra.professional_id = payload.professional_id
  if (discount > 0) extra.discount_amount = discount
  if (payload.first_due_date) extra.first_due_date = payload.first_due_date
  if (payload.payment_method) extra.payment_method = payload.payment_method
  if (Object.keys(extra).length > 0) {
    const { error: extraError } = await supabase.from("budgets").update(extra).eq("id", budget.id).eq("user_id", user.id)
    if (extraError) {
      degraded = true
      if (!isMissingColumn(extraError)) console.error("Non-fatal: budget extra fields:", extraError)
    }
  }

  // Itens: tenta gravar região em colunas próprias; sem a migração, a região vai no nome do item.
  const baseRows = payload.items.map((item) => {
    const calc = calculateItemTotals(item)
    return {
      budget_id: budget.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      cost_per_unit: item.cost_per_unit,
      tax_percent: item.tax_percent,
      subtotal: calc.subtotal,
      tax_amount: calc.tax_amount,
      total: calc.total,
    }
  })

  const richRows = baseRows.map((row, i) => ({
    ...row,
    tooth: payload.items[i].tooth ?? null,
    region: payload.items[i].region ?? null,
  }))

  let { error: itemsError } = await supabase.from("budget_items").insert(richRows)
  if (itemsError && isMissingColumn(itemsError)) {
    degraded = true
    const legacyRows = baseRows.map((row, i) => ({
      ...row,
      product_name: withRegionSuffix(row.product_name, decodeRegion(payload.items[i].region ?? null, payload.items[i].tooth ?? null)),
    }))
    ;({ error: itemsError } = await supabase.from("budget_items").insert(legacyRows))
  }

  if (itemsError) {
    console.error("Error inserting budget items:", itemsError)
    await supabase.from("budgets").delete().eq("id", budget.id)
    return { success: false, error: itemsError.message }
  }

  if (payload.payment_methods.length > 0) {
    const { error: pmError } = await supabase.from("budget_payment_methods").insert(
      payload.payment_methods.map((pm) => ({ budget_id: budget.id, method: pm.method, amount: pm.amount })),
    )
    if (pmError) console.error("Non-fatal: budget payment methods:", pmError)
  }

  return { success: true, data: budget as unknown as Budget, degraded }
}

// ============================================================
// PLANO DE PAGAMENTO → CONTAS A RECEBER
// ============================================================

export interface BudgetInstallmentRow {
  id: string
  amount: number
  status: string
  due_date: string | null
  payment_date: string | null
  notes: string | null
  method?: string | null
  installment_number?: number | null
  document_number?: string | null
}

/**
 * Fecha o orçamento e lança as parcelas como recebíveis pendentes.
 * Idempotente: se já existirem parcelas do orçamento, não duplica.
 */
export async function closeBudgetWithPlan(
  budgetId: string,
  schedule: PlannedInstallment[],
): Promise<{ success: boolean; error?: string; created?: number; degraded?: boolean }> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: "User not authenticated" }

  const { data: budget, error: fetchError } = await supabase
    .from("budgets")
    .select("id, patient_id, status, total_amount")
    .eq("id", budgetId)
    .eq("user_id", user.id)
    .single()
  if (fetchError || !budget) return { success: false, error: "Orçamento não encontrado." }

  const existing = await getBudgetInstallments(budgetId)
  const tag = budgetTag(budgetId)
  let created = 0
  let degraded = false

  if (existing.length === 0 && schedule.length > 0) {
    const now = new Date().toISOString()
    const total = schedule.filter((s) => s.number > 0).length
    const rows = schedule.map((item) => {
      const method = toPaymentsMethod(item.method)
      const parcelLabel = item.number === 0 ? "Entrada" : `Parcela ${item.label}`
      return {
        user_id: user.id,
        patient_id: budget.patient_id,
        amount: item.amount,
        status: "pending",
        due_date: item.dueDate,
        payment_date: null,
        notes: `Orçamento ${tag} · ${parcelLabel}${item.method === "boleto" ? " · Boleto" : ""}`,
        method,
        created_at: now,
        updated_at: now,
        budget_id: budgetId,
        installment_number: item.number,
        installment_total: total,
      }
    })

    let { error: insertError } = await supabase.from("payments").insert(rows)
    if (insertError && isMissingColumn(insertError)) {
      degraded = true
      const legacy = rows.map(({ budget_id: _b, installment_number: _n, installment_total: _t, ...rest }) => rest)
      ;({ error: insertError } = await supabase.from("payments").insert(legacy))
      if (insertError && isMissingColumn(insertError)) {
        const minimal = legacy.map(({ method: _m, ...rest }) => rest)
        ;({ error: insertError } = await supabase.from("payments").insert(minimal))
      }
    }
    if (insertError) {
      console.error("Error creating installments:", insertError)
      return { success: false, error: insertError.message }
    }
    created = rows.length
  }

  if (budget.status !== "approved" && budget.status !== "paid") {
    const { error } = await supabase
      .from("budgets")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", budgetId)
      .eq("user_id", user.id)
    if (error) return { success: false, error: error.message }
  }

  return { success: true, created, degraded }
}

export async function getBudgetInstallments(budgetId: string): Promise<BudgetInstallmentRow[]> {
  const { supabase, user } = await requireUser()
  if (!user) return []

  const columns = "id, amount, status, due_date, payment_date, notes"
  const byColumn = await supabase
    .from("payments")
    .select(`${columns}, method, installment_number, document_number`)
    .eq("user_id", user.id)
    .eq("budget_id", budgetId)
    .order("due_date", { ascending: true })

  if (!byColumn.error && byColumn.data && byColumn.data.length > 0) return byColumn.data as BudgetInstallmentRow[]

  const byTag = await supabase
    .from("payments")
    .select(columns)
    .eq("user_id", user.id)
    .ilike("notes", `Orçamento ${budgetTag(budgetId)}%`)
    .order("due_date", { ascending: true })

  if (byTag.error) {
    console.error("Error fetching installments:", byTag.error)
    return []
  }
  return (byTag.data || []) as BudgetInstallmentRow[]
}

export async function settleInstallment(paymentId: string, paidAt?: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: "User not authenticated" }
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("payments")
    .update({ status: "paid", payment_date: paidAt || now, updated_at: now })
    .eq("id", paymentId)
    .eq("user_id", user.id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateBudgetStatus(
  id: string,
  status: BudgetStatus,
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: "User not authenticated" }

  const { data: budget, error: fetchError } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (fetchError || !budget) {
    return { success: false, error: "Orçamento não encontrado" }
  }

  const { error } = await supabase
    .from("budgets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error updating budget status:", error)
    return { success: false, error: error.message }
  }

  // Integração financeira: quitar parcelas existentes ou registrar o recebimento integral.
  if (status === "paid" && budget.status !== "paid") {
    try {
      const installments = await getBudgetInstallments(id)
      const open = installments.filter((p) => p.status === "pending" || p.status === "overdue")
      if (installments.length > 0) {
        const now = new Date().toISOString()
        if (open.length > 0) {
          await supabase
            .from("payments")
            .update({ status: "paid", payment_date: now, updated_at: now })
            .in("id", open.map((p) => p.id))
            .eq("user_id", user.id)
        }
      } else {
        await recordPayment({
          patient_id: budget.patient_id,
          amount: budget.total_amount || 0,
          status: "paid",
          notes: `Orçamento ${budgetTag(budget.id)} · Pagamento integral`,
          payment_date: new Date().toISOString(),
        })
      }
      revalidatePath("/dashboard")
    } catch (paymentErr) {
      console.error("Error creating integrated financial records for budget:", paymentErr)
    }
  }

  return { success: true }
}

export async function duplicateBudget(id: string): Promise<{ success: boolean; data?: Budget; error?: string }> {
  const original = await getBudgetById(id)
  if (!original) return { success: false, error: "Budget not found" }

  const itemDrafts: BudgetItemDraft[] = (original.items || []).map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    cost_per_unit: item.cost_per_unit,
    tax_percent: item.tax_percent,
    tooth: item.tooth ?? null,
    region: item.region ?? null,
  }))

  return createBudget({
    patient_id: original.patient_id,
    items: itemDrafts,
    notes: original.notes || "",
    valid_until: "",
    down_payment: original.down_payment,
    installment_count: original.installment_count,
    installment_interval: original.installment_interval,
    payment_methods: (original.payment_methods || []).map((pm) => ({ method: pm.method, amount: pm.amount })),
    status: "draft",
    professional_id: original.professional_id ?? null,
    discount_amount: original.discount_amount ?? 0,
  })
}

export async function deleteBudget(id: string): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: "User not authenticated" }

  await supabase.from("budget_items").delete().eq("budget_id", id)
  await supabase.from("budget_payment_methods").delete().eq("budget_id", id)

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error deleting budget:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================================================
// PROCEDIMENTOS A REALIZAR (itens de orçamentos fechados)
// ============================================================

export interface TreatmentQueueItem {
  id: string
  budget_id: string
  budget_tag: string
  product_name: string
  tooth: number | null
  region: string | null
  execution_status: BudgetItemExecution
  /** false quando o banco ainda não tem a coluna de execução (migração 071). */
  trackable: boolean
}

export async function getPatientTreatmentQueue(patientId: string): Promise<TreatmentQueueItem[]> {
  const { supabase, user } = await requireUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("budgets")
    .select("id, status, items:budget_items(*)")
    .eq("user_id", user.id)
    .eq("patient_id", patientId)
    .in("status", ["approved", "paid"])
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching treatment queue:", error)
    return []
  }

  return (data || []).flatMap((b) =>
    ((b.items || []) as BudgetItem[]).map((item) => ({
      id: item.id,
      budget_id: b.id as string,
      budget_tag: budgetTag(b.id as string),
      product_name: item.product_name,
      tooth: item.tooth ?? null,
      region: item.region ?? null,
      execution_status: (item.execution_status || "pending") as BudgetItemExecution,
      trackable: item.execution_status !== undefined,
    })),
  )
}

export async function updateBudgetItemExecution(
  itemId: string,
  status: BudgetItemExecution,
  appointmentId?: string | null,
): Promise<{ success: boolean; error?: string; needsMigration?: boolean }> {
  const { supabase, user } = await requireUser()
  if (!user) return { success: false, error: "User not authenticated" }

  // Garante que o item pertence a um orçamento do usuário (RLS de budget_items depende do orçamento)
  const { data: owned } = await supabase
    .from("budget_items")
    .select("id, budget:budgets!inner(user_id)")
    .eq("id", itemId)
    .eq("budget.user_id", user.id)
    .maybeSingle()
  if (!owned) return { success: false, error: "Procedimento não encontrado." }

  const { error } = await supabase
    .from("budget_items")
    .update({
      execution_status: status,
      executed_at: status === "completed" ? new Date().toISOString() : null,
      executed_appointment_id: status === "completed" ? appointmentId ?? null : null,
    })
    .eq("id", itemId)

  if (error) {
    if (isMissingColumn(error)) return { success: false, needsMigration: true, error: "Atualize o banco (script 071) para registrar a execução." }
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export async function getBudgetDashboardStats() {
  const empty = { totalBudgets: 0, totalRevenue: 0, netRevenue: 0, conversionRate: 0, approvedCount: 0, openCount: 0, openValue: 0 }
  const { supabase, user } = await requireUser()
  if (!user) return empty

  const { data: budgets, error } = await supabase
    .from("budgets")
    .select("id, status, total_amount, total_cost, net_revenue")
    .eq("user_id", user.id)

  if (error) {
    console.error("Error fetching budget stats:", error)
    return empty
  }

  const all = budgets || []
  const closed = all.filter((b) => b.status === "approved" || b.status === "paid")
  const open = all.filter((b) => b.status === "draft" || b.status === "sent")
  const decided = all.filter((b) => b.status !== "draft" && b.status !== "sent").length
  const round = (n: number) => Math.round(n * 100) / 100

  return {
    totalBudgets: all.length,
    totalRevenue: round(closed.reduce((sum, b) => sum + (b.total_amount || 0), 0)),
    netRevenue: round(closed.reduce((sum, b) => sum + (b.net_revenue || 0), 0)),
    conversionRate: decided > 0 ? Math.round((closed.length / decided) * 100) : 0,
    approvedCount: closed.length,
    openCount: open.length,
    openValue: round(open.reduce((sum, b) => sum + (b.total_amount || 0), 0)),
  }
}

// ============================================================
// FICHA DO PACIENTE — resumo financeiro e clínico por orçamento
// ============================================================

export interface PatientBudgetSummary {
  id: string
  status: BudgetStatus
  created_at: string
  updated_at: string
  total_amount: number
  discount_amount: number
  items: number
  executed: number
  received: number
  pending: number
  overdue: number
}

export async function getPatientBudgetSummaries(patientId: string): Promise<PatientBudgetSummary[]> {
  const { supabase, user } = await requireUser()
  if (!user) return []

  const [{ data: budgets, error }, { data: payments }] = await Promise.all([
    supabase
      .from("budgets")
      .select("*, items:budget_items(*)")
      .eq("user_id", user.id)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount, status, due_date, notes")
      .eq("user_id", user.id)
      .eq("patient_id", patientId)
      .ilike("notes", "Orçamento #%"),
  ])

  if (error) {
    console.error("Error fetching patient budgets:", error)
    return []
  }

  const today = new Date().toISOString().slice(0, 10)
  return (budgets || []).map((b) => {
    const tag = `Orçamento ${budgetTag(b.id as string)}`
    const own = (payments || []).filter((p) => (p.notes || "").startsWith(tag))
    const sum = (list: typeof own) => Math.round(list.reduce((s, p) => s + Number(p.amount || 0), 0) * 100) / 100
    const paid = own.filter((p) => p.status === "paid")
    const open = own.filter((p) => p.status !== "paid" && p.status !== "refunded")
    const items = (b.items || []) as BudgetItem[]
    return {
      id: b.id as string,
      status: b.status as BudgetStatus,
      created_at: b.created_at as string,
      updated_at: b.updated_at as string,
      total_amount: Number(b.total_amount || 0),
      discount_amount: Number(b.discount_amount || 0),
      items: items.length,
      executed: items.filter((it) => it.execution_status === "completed").length,
      received: sum(paid),
      pending: sum(open.filter((p) => (p.due_date || "") >= today)),
      overdue: sum(open.filter((p) => (p.due_date || "") < today)),
    }
  })
}
