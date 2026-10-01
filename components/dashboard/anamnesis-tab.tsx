// Hello World
"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Users,
  Search,
  Save,
  ShieldAlert,
  Heart,
  Pill,
  Clock,
  Printer,
  Sparkles,
} from "lucide-react"
import { getPatients, type Patient } from "@/app/actions/patients"
import { useToast } from "@/hooks/use-toast"

interface AnamnesisQuestion {
  id: string
  label: string
  category: "cardiovascular" | "allergy" | "medication" | "dental" | "general"
  alertOnYes: boolean
  alertTitle: string
}

const DEFAULT_QUESTIONS: AnamnesisQuestion[] = [
  {
    id: "q_anesthesia",
    label: "Já teve reação alérgica ou complicação com anestesia odontológica?",
    category: "allergy",
    alertOnYes: true,
    alertTitle: "Risco: Alergia a Anestésicos Locais",
  },
  {
    id: "q_cardio",
    label: "Possui problemas cardíacos, pressão alta, sopro ou prótese de válvula cardíaca?",
    category: "cardiovascular",
    alertOnYes: true,
    alertTitle: "Cardiopatia / Hipertensão (Atenção a Vasoconstritores e Profilaxia)",
  },
  {
    id: "q_diabetes",
    label: "É diabético ou possui histórico de alterações glicêmicas?",
    category: "general",
    alertOnYes: true,
    alertTitle: "Diabetes Mellitus (Atenção ao tempo cirúrgico e cicatrização)",
  },
  {
    id: "q_anticoagulant",
    label: "Toma anticoagulantes (AAS, Marevan, Xarelto) ou bifosfonatos (para osteoporose)?",
    category: "medication",
    alertOnYes: true,
    alertTitle: "Uso de Anticoagulantes / Bifosfonatos (Risco Hemorrágico e Osteonecrose)",
  },
  {
    id: "q_allergies",
    label: "Possui alergia a medicamentos (ex: Penicilina, Dipirona, AINEs) ou látex?",
    category: "allergy",
    alertOnYes: true,
    alertTitle: "Alergias Medicamentosas / Látex",
  },
  {
    id: "q_pregnancy",
    label: "Está gestante ou em período de amamentação?",
    category: "general",
    alertOnYes: true,
    alertTitle: "Gestante / Lactante (Restrição para Raios-X e fármacos)",
  },
  {
    id: "q_bleeding",
    label: "Apresenta sangramento fácil na gengiva ao escovar ou passar fio dental?",
    category: "dental",
    alertOnYes: false,
    alertTitle: "Gengivite / Periodontite Ativa",
  },
  {
    id: "q_bruxism",
    label: "Acorda com dor na mandíbula, estalos na ATM ou aperta os dentes à noite?",
    category: "dental",
    alertOnYes: false,
    alertTitle: "Bruxismo / Disfunção Temporomandibular (DTM)",
  },
  {
    id: "q_smoker",
    label: "Faz uso frequente de tabaco ou consome bebidas alcoólicas?",
    category: "general",
    alertOnYes: false,
    alertTitle: "Tabagismo / Fator de Risco Periodontal e Implantes",
  },
  {
    id: "q_medications",
    label: "Faz uso contínuo de algum outro medicamento não citado?",
    category: "medication",
    alertOnYes: false,
    alertTitle: "Medicamentos de uso contínuo",
  },
]

export default function AnamnesisTab({ isDemo = false }: { isDemo?: boolean }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<Record<string, { yes: boolean; details: string }>>({})
  const [additionalNotes, setAdditionalNotes] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    loadPatientsList()
  }, [])

  const loadPatientsList = async () => {
    try {
      setLoading(true)
      const list = isDemo
        ? ([
            { id: "1", name: "Maria Silva", phone: "(11) 99999-1111" },
            { id: "2", name: "Carlos Mendes", phone: "(11) 99999-2222" },
          ] as any)
        : await getPatients()
      setPatients(list)
      if (list.length > 0) {
        setSelectedPatientId(list[0].id)
        loadPatientAnamnesis(list[0].id)
      }
    } catch (err) {
      console.error("Error loading patients for anamnesis:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadPatientAnamnesis = (patientId: string) => {
    const stored = localStorage.getItem(`vwd:anamnesis:${patientId}`)
    if (stored) {
      const data = JSON.parse(stored)
      setAnswers(data.answers || {})
      setAdditionalNotes(data.notes || "")
    } else {
      // Default empty answers
      const initial: Record<string, { yes: boolean; details: string }> = {}
      DEFAULT_QUESTIONS.forEach((q) => {
        initial[q.id] = { yes: false, details: "" }
      })
      // Sample mock for Maria
      if (patientId === "1") {
        initial.q_allergies = { yes: true, details: "Alergia severa a Dipirona e Sulfas." }
        initial.q_cardio = { yes: true, details: "Hipertensão controlada com Losartana 50mg." }
      }
      setAnswers(initial)
      setAdditionalNotes(patientId === "1" ? "Paciente relata ansiedade moderada a tratamentos odontológicos." : "")
    }
  }

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id)
    loadPatientAnamnesis(id)
  }

  const handleToggleAnswer = (qId: string, val: boolean) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        yes: val,
        details: prev[qId]?.details || "",
      },
    }))
  }

  const handleDetailsChange = (qId: string, details: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        yes: prev[qId]?.yes || false,
        details,
      },
    }))
  }

  const handleSaveAnamnesis = () => {
    if (!selectedPatientId) return
    const data = {
      patientId: selectedPatientId,
      answers,
      notes: additionalNotes,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(`vwd:anamnesis:${selectedPatientId}`, JSON.stringify(data))
    toast({
      title: "Anamnese Salva!",
      description: "Questionário de saúde registrado e alertas clínicos atualizados.",
    })
  }

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  // Identify active clinical alerts based on "yes" answers
  const activeAlerts = DEFAULT_QUESTIONS.filter((q) => q.alertOnYes && answers[q.id]?.yes)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            Anamnese Odontológica & Alertas Clínicos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Questionário de saúde bucal e sistêmica do paciente, histórico de patologias, medicamentos e riscos cirúrgicos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => window.print()}
            className="cursor-pointer font-semibold text-xs h-9"
          >
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir Ficha
          </Button>
          <Button onClick={handleSaveAnamnesis} className="cursor-pointer font-semibold text-xs h-9 shadow-xs">
            <Save className="w-4 h-4 mr-1.5" /> Salvar Anamnese
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient selector column */}
        <Card className="lg:col-span-4 p-4 border border-border bg-card space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              Pacientes Cadastrados
            </label>
            <span className="text-xs text-muted-foreground">{patients.length}</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-border/40" data-lenis-prevent>
            {patients
              .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPatient(p.id)}
                  className={`w-full text-left p-2.5 rounded-sm transition-colors cursor-pointer flex items-center justify-between ${
                    selectedPatientId === p.id
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="truncate">
                    <p className="text-xs font-bold truncate">{p.name}</p>
                    <p className="text-[11px] opacity-80 truncate">{p.phone || p.email || "Sem contato"}</p>
                  </div>
                  {selectedPatientId === p.id && <CheckCircle2 className="w-4 h-4 shrink-0 ml-2" />}
                </button>
              ))}
          </div>
        </Card>

        {/* Anamnesis Form */}
        <div className="lg:col-span-8 space-y-4">
          {/* Active Alerts Banner */}
          {activeAlerts.length > 0 && (
            <Card className="p-4 border-l-4 border-l-destructive border-border bg-destructive/10 text-foreground space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <h4 className="text-sm font-bold text-destructive">
                  Alertas Médicos & Cuidados Clínicos Importantes ({activeAlerts.length})
                </h4>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {activeAlerts.map((al) => (
                  <span
                    key={al.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold bg-destructive text-white shadow-xs"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {al.alertTitle}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Form Card */}
          <Card className="p-5 border border-border shadow-xs bg-card space-y-5">
            <div className="border-b border-border/60 pb-3 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Questionário de Saúde Odontológico
                </span>
                <h3 className="text-lg font-bold text-foreground mt-0.5">
                  {selectedPatient?.name || "Selecione um paciente"}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground font-medium">Revisão Clínica 2026</span>
            </div>

            <div className="space-y-4 divide-y divide-border/40">
              {DEFAULT_QUESTIONS.map((q, idx) => {
                const ans = answers[q.id] || { yes: false, details: "" }
                return (
                  <div key={q.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-foreground flex-1">
                        <span className="text-primary font-bold mr-1.5">{idx + 1}.</span>
                        {q.label}
                      </p>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleAnswer(q.id, false)}
                          className={`px-3 py-1 text-xs rounded-sm font-bold border transition-colors cursor-pointer ${
                            !ans.yes
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Não
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAnswer(q.id, true)}
                          className={`px-3 py-1 text-xs rounded-sm font-bold border transition-colors cursor-pointer ${
                            ans.yes
                              ? "bg-destructive border-destructive text-white shadow-xs"
                              : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          Sim
                        </button>
                      </div>
                    </div>

                    {ans.yes && (
                      <div className="pl-4 border-l-2 border-primary/50">
                        <input
                          type="text"
                          value={ans.details}
                          onChange={(e) => handleDetailsChange(q.id, e.target.value)}
                          placeholder="Detalhes (medicamento, dosagem, frequência, observações clínicas...)"
                          className="h-8 w-full rounded-sm border border-input bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Additional notes */}
            <div className="pt-4 border-t border-border/60 space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Observações Clínicas Adicionais / Queixa Principal:
              </label>
              <textarea
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Ex: Queixa principal é dor ao mastigar no lado direito inferior; paciente fóbico a agulha; prefere consultas à tarde."
                className="w-full rounded-sm border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden resize-none"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
