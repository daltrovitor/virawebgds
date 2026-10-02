// Hello World
/**
 * Clínica fictícia para a demonstração interativa (sem Supabase).
 * Nomes, telefones e documentos são inventados.
 */

import type { Budget, ServiceProduct } from "./budget-types"
import type { ClinicalStatus } from "./appointment-status"

export interface DemoPatient {
  id: string
  name: string
  phone: string
  email: string
  cpf: string
  date_of_birth: string
  address: string
  insurance: string
  profile_photo_url: string | null
}

export interface DemoAppointment {
  id: string
  user_id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: string
  clinical_status: ClinicalStatus
  first_visit: boolean
  notes: string | null
  planned_procedure: string | null
  occurrence: string | null
  created_at: string
  updated_at: string
}

export const DEMO_PROFESSIONALS = [
  { id: "demo-prof-1", name: "Dra. Helena Prado", specialty: "Dentística e Prótese" },
  { id: "demo-prof-2", name: "Dr. Rafael Moura", specialty: "Implantodontia" },
]

export const DEMO_PATIENTS: DemoPatient[] = [
  { id: "demo-pat-1", name: "Beatriz Vasconcelos", phone: "(62) 99812-4407", email: "beatriz.v@exemplo.com", cpf: "000.000.001-91", date_of_birth: "1988-03-14", address: "Rua das Acácias, 120 — Setor Bueno, Goiânia", insurance: "Particular", profile_photo_url: null },
  { id: "demo-pat-2", name: "Otávio Ramalho", phone: "(62) 98455-1320", email: "otavio.r@exemplo.com", cpf: "000.000.002-72", date_of_birth: "1979-11-02", address: "Av. T-9, 2300 — Jardim América, Goiânia", insurance: "Particular", profile_photo_url: null },
  { id: "demo-pat-3", name: "Luíza Fontes", phone: "(62) 99641-0088", email: "luiza.f@exemplo.com", cpf: "000.000.003-53", date_of_birth: "1995-07-21", address: "Rua 1.136, 45 — Setor Marista, Goiânia", insurance: "Odonto Plus", profile_photo_url: null },
  { id: "demo-pat-4", name: "Caio Bittencourt", phone: "(62) 98203-7715", email: "caio.b@exemplo.com", cpf: "000.000.004-34", date_of_birth: "2001-01-30", address: "Alameda dos Ipês, 9 — Setor Oeste, Goiânia", insurance: "Particular", profile_photo_url: null },
  { id: "demo-pat-5", name: "Marina Teixeira", phone: "(62) 99377-5562", email: "marina.t@exemplo.com", cpf: "000.000.005-15", date_of_birth: "1983-09-09", address: "Rua 10, 515 — Setor Oeste, Goiânia", insurance: "Particular", profile_photo_url: null },
  { id: "demo-pat-6", name: "Henrique Salles", phone: "(62) 98120-4493", email: "henrique.s@exemplo.com", cpf: "000.000.006-04", date_of_birth: "1969-05-18", address: "Av. Portugal, 1148 — Setor Marista, Goiânia", insurance: "Odonto Plus", profile_photo_url: null },
]

const now = "2026-01-01T12:00:00.000Z"

const category = (id: string, name: string) => ({ id, user_id: "demo", name, description: null, color: null, icon: null, created_at: now, updated_at: now })
const CATEGORIES = {
  dent: category("demo-cat-dent", "Dentística"),
  prot: category("demo-cat-prot", "Prótese"),
  perio: category("demo-cat-perio", "Periodontia"),
  radio: category("demo-cat-radio", "Radiologia"),
  endo: category("demo-cat-endo", "Endodontia"),
  cir: category("demo-cat-cir", "Cirurgia e Implantes"),
}

const product = (id: string, cat: keyof typeof CATEGORIES, name: string, price: number, cost: number): ServiceProduct => ({
  id,
  user_id: "demo",
  category_id: CATEGORIES[cat].id,
  name,
  description: null,
  base_price: price,
  cost,
  duration_minutes: 60,
  tax_percent: 0,
  active: true,
  created_at: now,
  updated_at: now,
  category: CATEGORIES[cat],
})

export const DEMO_PRODUCTS: ServiceProduct[] = [
  product("demo-p-1", "dent", "Restauração em resina — 1 face", 250, 40),
  product("demo-p-2", "dent", "Restauração em resina — 2 faces", 380, 55),
  product("demo-p-3", "dent", "Clareamento de consultório", 1200, 180),
  product("demo-p-4", "prot", "Faceta cerâmica E.max (fluxo digital)", 3850, 900),
  product("demo-p-5", "prot", "Coroa metalocerâmica", 2200, 520),
  product("demo-p-6", "perio", "Profilaxia + raspagem com ultrassom", 300, 30),
  product("demo-p-7", "radio", "Check-up periapical", 300, 45),
  product("demo-p-8", "endo", "Tratamento de canal — molar", 1500, 210),
  product("demo-p-9", "cir", "Exodontia simples", 350, 50),
  product("demo-p-10", "cir", "Implante osseointegrado", 3500, 1100),
]

/** Segunda-feira da semana atual (local). */
function mondayOfThisWeek(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

export function buildDemoAppointments(): DemoAppointment[] {
  const monday = mondayOfThisWeek()
  const at = (dayOffset: number) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + dayOffset)
    return iso(d)
  }
  const rows: Array<[number, string, number, string, string, ClinicalStatus, boolean, string | null]> = [
    [0, "08:30", 60, "demo-pat-1", "demo-prof-1", "finished", false, "Facetas 11 e 21 — prova"],
    [0, "10:00", 90, "demo-pat-2", "demo-prof-2", "finished", false, "Implante 46 — cirurgia"],
    [0, "14:00", 120, "demo-pat-3", "demo-prof-1", "missed", false, "Restaurações 36 e 37"],
    [1, "09:00", 60, "demo-pat-4", "demo-prof-1", "finished", true, "Avaliação inicial"],
    [1, "14:00", 90, "demo-pat-5", "demo-prof-1", "cancelled_patient", false, "Clareamento"],
    [2, "08:00", 60, "demo-pat-6", "demo-prof-2", "confirmed", false, "Controle pós-cirúrgico"],
    [2, "09:30", 60, "demo-pat-1", "demo-prof-1", "reception", false, "Facetas — cimentação"],
    [2, "14:00", 120, "demo-pat-2", "demo-prof-1", "in_care", false, "Canal 36"],
    [3, "09:30", 60, "demo-pat-3", "demo-prof-1", "confirmed", false, "Restaurações 36 e 37 (remarcada)"],
    [3, "14:00", 120, "demo-pat-4", "demo-prof-2", "scheduled", false, "Exodontia 38"],
    [4, "09:00", 120, "demo-pat-5", "demo-prof-1", "scheduled", false, "Clareamento (remarcado)"],
    [4, "11:00", 60, "demo-pat-6", "demo-prof-2", "scheduled", false, "Moldagem coroa 26"],
    [4, "16:00", 60, "demo-pat-1", "demo-prof-1", "scheduled", false, "Ajuste oclusal"],
  ]
  return rows.map(([day, time, duration, patient, prof, clinical, first, planned], i) => ({
    id: `demo-apt-${i + 1}`,
    user_id: "demo",
    patient_id: patient,
    professional_id: prof,
    appointment_date: at(day),
    appointment_time: time,
    duration_minutes: duration,
    status: clinical === "finished" ? "completed" : clinical.startsWith("cancelled") || clinical.startsWith("missed") ? "cancelled" : "scheduled",
    clinical_status: clinical,
    first_visit: first,
    notes: null,
    planned_procedure: planned,
    occurrence: clinical === "finished" ? "Procedimento realizado sem intercorrências." : null,
    created_at: now,
    updated_at: now,
  }))
}

function demoBudget(id: string, patientId: string, status: Budget["status"], lines: Array<[string, number | null, string]>, created: string, installments: number): Budget {
  const items = lines.map(([productId, tooth, region], i) => {
    const p = DEMO_PRODUCTS.find((x) => x.id === productId)!
    return {
      id: `${id}-item-${i + 1}`,
      budget_id: id,
      product_id: p.id,
      product_name: p.name,
      quantity: 1,
      unit_price: p.base_price,
      cost_per_unit: p.cost || 0,
      tax_percent: 0,
      subtotal: p.base_price,
      tax_amount: 0,
      total: p.base_price,
      tooth,
      region,
      execution_status: (status === "approved" && i < 2 ? "completed" : "pending") as "completed" | "pending",
      created_at: created,
    }
  })
  const total = items.reduce((s, it) => s + it.total, 0)
  const cost = items.reduce((s, it) => s + it.cost_per_unit, 0)
  return {
    id,
    user_id: "demo",
    patient_id: patientId,
    status,
    notes: null,
    valid_until: null,
    down_payment: 0,
    installment_count: installments,
    installment_interval: "monthly",
    installment_value: Math.round((total / Math.max(1, installments)) * 100) / 100,
    subtotal: total,
    total_tax: 0,
    total_amount: total,
    total_cost: cost,
    net_revenue: total - cost,
    professional_id: "demo-prof-1",
    discount_amount: 0,
    first_due_date: created.slice(0, 10),
    payment_method: "credit_card",
    created_at: created,
    updated_at: created,
    items,
    payment_methods: [],
    patient: { id: patientId, name: DEMO_PATIENTS.find((p) => p.id === patientId)?.name || "" },
  }
}

export function buildDemoBudgets(): Budget[] {
  return [
    demoBudget("demo-bud-1898", "demo-pat-1", "approved", [
      ["demo-p-4", 11, "tooth:11"],
      ["demo-p-4", 21, "tooth:21"],
      ["demo-p-4", 12, "tooth:12"],
      ["demo-p-4", 22, "tooth:22"],
      ["demo-p-6", null, "none"],
      ["demo-p-7", null, "none"],
    ], "2026-09-28T10:00:00.000Z", 12),
    demoBudget("demo-bud-1902", "demo-pat-3", "draft", [
      ["demo-p-2", 36, "tooth:36"],
      ["demo-p-1", 37, "tooth:37"],
    ], "2026-09-30T15:00:00.000Z", 3),
    demoBudget("demo-bud-1871", "demo-pat-2", "approved", [
      ["demo-p-10", 46, "tooth:46"],
      ["demo-p-8", 36, "tooth:36"],
    ], "2026-08-11T09:00:00.000Z", 10),
    demoBudget("demo-bud-1850", "demo-pat-5", "rejected", [["demo-p-3", null, "arch:upper"]], "2026-07-02T09:00:00.000Z", 1),
  ]
}
