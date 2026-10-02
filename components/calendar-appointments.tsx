// Hello World
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { Loader2, Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WeeklyView, type Appointment } from "@/components/appointments/weekly-view"
import { AppointmentSheet } from "@/components/appointments/appointment-sheet"
import PatientProfileModal from "@/components/patient-profile-modal"
import { Field, NativeSelect, SearchPicker, TextArea, TextInput } from "@/components/dental/form-primitives"
import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  updateAppointment,
  updateAppointmentClinicalStatus,
  updateAppointmentDetails,
} from "@/app/actions/appointments"
import { getPatients } from "@/app/actions/patients"
import { getProfessionals } from "@/app/actions/professionals"
import { getPatientTreatmentQueue, updateBudgetItemExecution, type TreatmentQueueItem } from "@/app/actions/budget-actions"
import { CLINICAL_STATUS, clinicalStatusOf, type ClinicalStatus } from "@/lib/appointment-status"
import type { BudgetItemExecution } from "@/lib/budget-types"
import { DEMO_PATIENTS, DEMO_PROFESSIONALS, buildDemoAppointments, buildDemoBudgets } from "@/lib/demo-clinic"

interface PatientLite {
  id: string
  name: string
  phone?: string | null
}

interface FormState {
  patient_id: string
  professional_id: string
  appointment_date: string
  start: string
  end: string
  planned_procedure: string
  notes: string
  recurrence_type: "none" | "daily" | "weekly" | "monthly"
  recurrence_count: number
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
const toTime = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const emptyForm = (date = todayISO(), start = "08:00", professional = ""): FormState => ({
  patient_id: "",
  professional_id: professional,
  appointment_date: date,
  start,
  end: toTime(toMinutes(start) + 60),
  planned_procedure: "",
  notes: "",
  recurrence_type: "none",
  recurrence_count: 1,
})

export default function CalendarAppointments({ isDemo = false }: { isDemo?: boolean }) {
  const { toast } = useToast()
  const t = useTranslations("dashboard.appointments")
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<PatientLite[]>([])
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([])
  const [selectedProfessional, setSelectedProfessional] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [profilePatientId, setProfilePatientId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isDemo) {
      setAppointments(buildDemoAppointments())
      setPatients(DEMO_PATIENTS.map((p) => ({ id: p.id, name: p.name, phone: p.phone })))
      setProfessionals(DEMO_PROFESSIONALS.map((p) => ({ id: p.id, name: p.name })))
      setIsLoading(false)
      return
    }
    try {
      const [apts, pts, profs] = await Promise.all([getAppointments(), getPatients(), getProfessionals()])
      setAppointments(apts as Appointment[])
      setPatients(pts.map((p) => ({ id: p.id, name: p.name, phone: p.phone })))
      setProfessionals(profs.filter((p) => p.status !== "inactive").map((p) => ({ id: p.id, name: p.name })))
    } catch (error) {
      toast({ title: t("toast.loadError"), description: error instanceof Error ? error.message : undefined, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [isDemo, toast, t])

  useEffect(() => {
    load()
  }, [load])

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const profById = useMemo(() => new Map(professionals.map((p) => [p.id, p.name])), [professionals])
  const active = appointments.find((a) => a.id === activeId) || null

  // KPIs do dia (topo da pirâmide)
  const today = todayISO()
  const kpis = useMemo(() => {
    const scope = appointments.filter((a) => selectedProfessional === "all" || a.professional_id === selectedProfessional)
    const todayList = scope.filter((a) => a.appointment_date === today).map((a) => clinicalStatusOf(a))
    const pendingClosure = scope.filter((a) => a.appointment_date < today && CLINICAL_STATUS[clinicalStatusOf(a)].coarse === "scheduled").length
    return [
      { label: "Consultas hoje", value: todayList.length },
      { label: "Confirmadas", value: todayList.filter((s) => s === "confirmed").length },
      { label: "Na clínica agora", value: todayList.filter((s) => s === "reception" || s === "in_care").length },
      { label: "Sem baixa de status", value: pendingClosure },
    ]
  }, [appointments, selectedProfessional, today])

  // ------------------------------------------------------------ ações
  const openNew = (date?: string, start?: string) => {
    setEditingId(null)
    setForm(emptyForm(date, start, selectedProfessional === "all" ? (professionals.length === 1 ? professionals[0].id : "") : selectedProfessional))
    setFormOpen(true)
  }

  const openEdit = (apt: Appointment) => {
    setActiveId(null)
    setEditingId(apt.id)
    setForm({
      patient_id: apt.patient_id,
      professional_id: apt.professional_id,
      appointment_date: apt.appointment_date,
      start: apt.appointment_time.slice(0, 5),
      end: toTime(toMinutes(apt.appointment_time) + (apt.duration_minutes || 60)),
      planned_procedure: apt.planned_procedure || "",
      notes: apt.notes || "",
      recurrence_type: "none",
      recurrence_count: 1,
    })
    setFormOpen(true)
  }

  const duration = Math.max(15, toMinutes(form.end) - toMinutes(form.start))
  const formValid = form.patient_id && form.professional_id && form.appointment_date && form.start && toMinutes(form.end) > toMinutes(form.start)

  const saveForm = async () => {
    if (!formValid) return
    setSaving(true)
    try {
      const base = {
        patient_id: form.patient_id,
        professional_id: form.professional_id,
        appointment_date: form.appointment_date,
        appointment_time: form.start,
        duration_minutes: duration,
        notes: form.notes,
        planned_procedure: form.planned_procedure,
      }
      if (isDemo) {
        const now = new Date().toISOString()
        if (editingId) {
          setAppointments((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...base } : a)))
        } else {
          setAppointments((prev) => [...prev, { ...base, id: crypto.randomUUID(), user_id: "demo", status: "scheduled", clinical_status: "scheduled", first_visit: false, occurrence: null, created_at: now, updated_at: now }])
        }
      } else if (editingId) {
        const updated = await updateAppointment(editingId, base)
        setAppointments((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...(updated as Appointment) } : a)))
      } else {
        const payload = {
          ...base,
          ...(form.recurrence_type !== "none"
            ? { recurrence: { type: form.recurrence_type, weekdays: [new Date(`${form.appointment_date}T00:00:00`).getDay()], count: form.recurrence_count } }
            : {}),
        }
        const created = await createAppointment(payload as Parameters<typeof createAppointment>[0])
        setAppointments((prev) => [...prev, ...((Array.isArray(created) ? created : [created]) as Appointment[])])
      }
      toast({ title: editingId ? t("toast.updated") : t("toast.created") })
      setFormOpen(false)
      setEditingId(null)
    } catch (error) {
      toast({ title: t("toast.saveError"), description: error instanceof Error ? error.message : undefined, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (id: string, status: ClinicalStatus) => {
    const patch = { status: CLINICAL_STATUS[status].coarse, clinical_status: status }
    if (isDemo) {
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
      return
    }
    const res = await updateAppointmentClinicalStatus(id, status)
    if (!res.success) {
      toast({ title: "Não foi possível atualizar o status", description: res.error, variant: "destructive" })
      throw new Error(res.error)
    }
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
    if (res.persisted === "coarse" && CLINICAL_STATUS[status].coarse !== status) {
      toast({
        title: `Status salvo como “${CLINICAL_STATUS[status].coarse === "cancelled" ? "Cancelado" : CLINICAL_STATUS[status].coarse === "completed" ? "Concluído" : "Agendado"}”`,
        description: "Para guardar o status detalhado, aplique a atualização do banco (scripts/071_vwo_fluxo_clinico.sql).",
      })
    }
  }

  const saveDetails = async (id: string, details: { planned_procedure: string; occurrence: string; first_visit: boolean }) => {
    if (!isDemo) {
      const res = await updateAppointmentDetails(id, details)
      if (!res.success) {
        toast({ title: "Não foi possível salvar", description: res.error, variant: "destructive" })
        return
      }
    }
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...details } : a)))
    toast({ title: "Descrição do atendimento salva" })
  }

  const remove = (id: string) => {
    toast({
      title: t("toast.confirmDelete"),
      description: t("toast.confirmDeleteDesc"),
      action: (
        <ToastAction
          altText={t("toast.delete")}
          onClick={async () => {
            try {
              if (!isDemo) await deleteAppointment(id)
              setAppointments((prev) => prev.filter((a) => a.id !== id))
              setActiveId(null)
              toast({ title: t("toast.deleted") })
            } catch (error) {
              toast({ title: t("toast.deleteError"), description: error instanceof Error ? error.message : undefined, variant: "destructive" })
            }
          }}
        >
          {t("toast.delete")}
        </ToastAction>
      ),
    })
  }

  const loadQueue = useCallback(
    async (patientId: string): Promise<TreatmentQueueItem[]> => {
      if (isDemo) {
        return buildDemoBudgets()
          .filter((b) => b.patient_id === patientId && (b.status === "approved" || b.status === "paid"))
          .flatMap((b) =>
            (b.items || []).map((it) => ({
              id: it.id,
              budget_id: b.id,
              budget_tag: `#${b.id.replace(/\D/g, "")}`,
              product_name: it.product_name,
              tooth: it.tooth ?? null,
              region: it.region ?? null,
              execution_status: (it.execution_status || "pending") as BudgetItemExecution,
              trackable: true,
            })),
          )
      }
      return getPatientTreatmentQueue(patientId)
    },
    [isDemo],
  )

  const changeExecution = async (item: TreatmentQueueItem, status: BudgetItemExecution, appointmentId: string) => {
    if (isDemo) return true
    const res = await updateBudgetItemExecution(item.id, status, appointmentId)
    if (!res.success) {
      toast({ title: "Não foi possível registrar", description: res.error, variant: res.needsMigration ? "default" : "destructive" })
      return false
    }
    return true
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        <span className="sr-only">Carregando agenda…</span>
      </div>
    )
  }

  const patientOptions = patients.map((p) => ({ id: p.id, label: p.name, meta: p.phone || null }))

  return (
    <div className="space-y-5">
      {/* KPIs + ação primária */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <section className="grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4" aria-label="Resumo da agenda">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28, delay: i * 0.05 }}
              className="bg-background px-4 py-3.5"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular text-ink">{k.value}</p>
            </motion.div>
          ))}
        </section>
        <button
          type="button"
          onClick={() => openNew()}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-sm bg-primary px-6 text-[14px] font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-[0.98] xl:h-auto"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {t("newAppointment")}
        </button>
      </div>

      <WeeklyView
        appointments={appointments}
        professionals={professionals}
        patients={patients}
        selectedProfessional={selectedProfessional}
        onSelectProfessional={setSelectedProfessional}
        onOpenAppointment={(apt) => setActiveId(apt.id)}
        onSlotClick={(date, time) => openNew(date, time)}
      />

      <AppointmentSheet
        appointment={active}
        patient={active ? patientById.get(active.patient_id) : undefined}
        professionalName={active ? profById.get(active.professional_id) : undefined}
        onClose={() => setActiveId(null)}
        onStatusChange={changeStatus}
        onSaveDetails={saveDetails}
        onOpenPatient={(patientId) => {
          setActiveId(null)
          setProfilePatientId(patientId)
        }}
        onEdit={openEdit}
        onDelete={remove}
        loadQueue={loadQueue}
        onExecutionChange={changeExecution}
      />

      {/* Formulário de agendamento */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]" data-lenis-prevent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-semibold text-ink">{editingId ? "Remarcar agendamento" : "Novo agendamento"}</DialogTitle>
            <DialogDescription>Defina paciente, dentista e horário de início e fim.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 pt-1 sm:grid-cols-2">
            <Field label="Paciente" className="sm:col-span-2">
              <SearchPicker options={patientOptions} value={form.patient_id} onChange={(id) => setForm((f) => ({ ...f, patient_id: id }))} placeholder="Buscar por nome ou telefone" label="Paciente" />
            </Field>
            <Field label="Dentista" htmlFor="apt-prof" className="sm:col-span-2">
              <NativeSelect id="apt-prof" value={form.professional_id} onChange={(e) => setForm((f) => ({ ...f, professional_id: e.target.value }))}>
                <option value="">Selecione</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Data" htmlFor="apt-date">
              <TextInput id="apt-date" type="date" value={form.appointment_date} onChange={(e) => setForm((f) => ({ ...f, appointment_date: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início" htmlFor="apt-start">
                <TextInput
                  id="apt-start"
                  type="time"
                  step={900}
                  value={form.start}
                  onChange={(e) => {
                    const start = e.target.value
                    setForm((f) => ({ ...f, start, end: toTime(toMinutes(start) + Math.max(15, toMinutes(f.end) - toMinutes(f.start))) }))
                  }}
                />
              </Field>
              <Field label="Fim" htmlFor="apt-end">
                <TextInput id="apt-end" type="time" step={900} value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
              </Field>
            </div>
            <Field label="Previsto" htmlFor="apt-form-planned" className="sm:col-span-2">
              <TextInput id="apt-form-planned" value={form.planned_procedure} onChange={(e) => setForm((f) => ({ ...f, planned_procedure: e.target.value }))} placeholder="Ex.: restaurações 36 e 37" />
            </Field>
            <Field label="Observações" htmlFor="apt-form-notes" className="sm:col-span-2">
              <TextArea id="apt-form-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="min-h-[72px]" />
            </Field>
            {!editingId && (
              <>
                <Field label="Repetir" htmlFor="apt-rec">
                  <NativeSelect id="apt-rec" value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value as FormState["recurrence_type"] }))}>
                    <option value="none">Não repetir</option>
                    <option value="daily">Diariamente</option>
                    <option value="weekly">Semanalmente</option>
                    <option value="monthly">Mensalmente</option>
                  </NativeSelect>
                </Field>
                {form.recurrence_type !== "none" && (
                  <Field label="Quantidade de sessões" htmlFor="apt-rec-count">
                    <TextInput id="apt-rec-count" type="number" min={1} max={52} value={form.recurrence_count} onChange={(e) => setForm((f) => ({ ...f, recurrence_count: Math.max(1, Number(e.target.value) || 1) }))} />
                  </Field>
                )}
              </>
            )}
          </div>
          <div className="mt-2 flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12.5px] text-muted-foreground">Duração: {duration} min</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-11 flex-1 rounded-sm border border-border px-4 text-[14px] font-medium text-ink hover:bg-surface sm:flex-none">
                Cancelar
              </button>
              <button
                type="button"
                disabled={!formValid || saving}
                onClick={saveForm}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:flex-none"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {editingId ? "Salvar alterações" : "Agendar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PatientProfileModal isOpen={Boolean(profilePatientId)} onClose={() => setProfilePatientId(null)} patientId={profilePatientId} isDemo={isDemo} />
    </div>
  )
}
