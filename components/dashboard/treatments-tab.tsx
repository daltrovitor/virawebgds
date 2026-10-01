// Hello World
"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Activity,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  FileText,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Sparkles,
  ClipboardList,
  Save,
  X,
} from "lucide-react"
import { getPatients, type Patient } from "@/app/actions/patients"
import { useToast } from "@/hooks/use-toast"
import { toothName } from "@/lib/teeth"

export interface TreatmentItem {
  id: string
  procedure: string
  tooth?: number | null
  status: "pending" | "in_progress" | "completed"
  notes?: string
  completedAt?: string
}

export interface DentalTreatment {
  id: string
  patientId: string
  patientName: string
  title: string
  status: "planned" | "in_progress" | "completed" | "cancelled"
  totalCost?: number
  items: TreatmentItem[]
  evolutionNotes?: { id: string; date: string; text: string; professionalName: string }[]
  createdAt: string
}

export default function TreatmentsTab({ isDemo = false }: { isDemo?: boolean }) {
  const [treatments, setTreatments] = useState<DentalTreatment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedTreatment, setSelectedTreatment] = useState<DentalTreatment | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEvolutionModal, setShowEvolutionModal] = useState(false)
  const [newEvolutionText, setNewEvolutionText] = useState("")

  // Form states for new treatment
  const [newPatientId, setNewPatientId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newItems, setNewItems] = useState<{ procedure: string; tooth?: number }[]>([
    { procedure: "Exame Clínico e Radiográfico" },
  ])

  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const pts = isDemo
        ? ([
            { id: "1", name: "Maria Silva", phone: "(11) 99999-1111" },
            { id: "2", name: "Carlos Mendes", phone: "(11) 99999-2222" },
          ] as any)
        : await getPatients()
      setPatients(pts)

      // Initial treatments from localStorage or default samples
      const stored = localStorage.getItem("vwd:dental_treatments")
      if (stored) {
        const parsed = JSON.parse(stored)
        setTreatments(parsed)
        if (parsed.length > 0) setSelectedTreatment(parsed[0])
      } else {
        const defaultTreatments: DentalTreatment[] = [
          {
            id: "treat-1",
            patientId: pts[0]?.id || "1",
            patientName: pts[0]?.name || "Maria Silva",
            title: "Tratamento Endodôntico e Reabilitação Estética",
            status: "in_progress",
            totalCost: 1850,
            createdAt: new Date().toISOString(),
            items: [
              { id: "item-1", procedure: "Endodontia Molar (Canal)", tooth: 16, status: "completed", completedAt: "2026-09-25" },
              { id: "item-2", procedure: "Pino de Fibra de Vidro", tooth: 16, status: "completed", completedAt: "2026-09-28" },
              { id: "item-3", procedure: "Coroa Cerâmica Metal-Free", tooth: 16, status: "in_progress" },
              { id: "item-4", procedure: "Profilaxia e Aplicação Tópica de Flúor", tooth: null, status: "pending" },
            ],
            evolutionNotes: [
              {
                id: "evo-1",
                date: "2026-09-25",
                text: "Realizada odontometria e instrumentação rotatória do dente 16. Curativo de hidróxido de cálcio colocado.",
                professionalName: "Dr. Roberto Santos (CRO 84210)",
              },
              {
                id: "evo-2",
                date: "2026-09-28",
                text: "Obturação endodôntica concluída com sucesso. Cimentação de pino de fibra de vidro.",
                professionalName: "Dr. Roberto Santos (CRO 84210)",
              },
            ],
          },
          {
            id: "treat-2",
            patientId: pts[1]?.id || "2",
            patientName: pts[1]?.name || "Carlos Mendes",
            title: "Instalação de Implante Osseointegrado",
            status: "planned",
            totalCost: 3200,
            createdAt: new Date().toISOString(),
            items: [
              { id: "item-5", procedure: "Cirurgia de Implante Dentário Titânio", tooth: 46, status: "pending" },
              { id: "item-6", procedure: "Enxerto Ósseo Particulado", tooth: 46, status: "pending" },
              { id: "item-7", procedure: "Prótese sobre Implante Parafusada", tooth: 46, status: "pending" },
            ],
            evolutionNotes: [],
          },
        ]
        setTreatments(defaultTreatments)
        if (defaultTreatments.length > 0) setSelectedTreatment(defaultTreatments[0])
        localStorage.setItem("vwd:dental_treatments", JSON.stringify(defaultTreatments))
      }
    } catch (err) {
      console.error("Error loading treatments:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleItemStatus = (itemId: string) => {
    if (!selectedTreatment) return

    const updatedItems = selectedTreatment.items.map((item) => {
      if (item.id === itemId) {
        const nextStatus: "pending" | "in_progress" | "completed" =
          item.status === "completed" ? "pending" : item.status === "pending" ? "in_progress" : "completed"
        return {
          ...item,
          status: nextStatus,
          completedAt: nextStatus === "completed" ? new Date().toISOString().split("T")[0] : undefined,
        }
      }
      return item
    })

    const allCompleted = updatedItems.every((i) => i.status === "completed")
    const updatedTreatment: DentalTreatment = {
      ...selectedTreatment,
      items: updatedItems,
      status: allCompleted ? "completed" : "in_progress",
    }

    const updatedList = treatments.map((t) => (t.id === updatedTreatment.id ? updatedTreatment : t))
    setTreatments(updatedList)
    setSelectedTreatment(updatedTreatment)
    localStorage.setItem("vwd:dental_treatments", JSON.stringify(updatedList))

    toast({
      title: "Item atualizado",
      description: "Status do procedimento odontológico atualizado com sucesso.",
    })
  }

  const handleAddEvolutionNote = () => {
    if (!selectedTreatment || !newEvolutionText.trim()) return

    const newNote = {
      id: `evo-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      text: newEvolutionText.trim(),
      professionalName: "Cirurgião-Dentista Responsável",
    }

    const updatedTreatment: DentalTreatment = {
      ...selectedTreatment,
      evolutionNotes: [newNote, ...(selectedTreatment.evolutionNotes || [])],
    }

    const updatedList = treatments.map((t) => (t.id === updatedTreatment.id ? updatedTreatment : t))
    setTreatments(updatedList)
    setSelectedTreatment(updatedTreatment)
    localStorage.setItem("vwd:dental_treatments", JSON.stringify(updatedList))
    setNewEvolutionText("")
    setShowEvolutionModal(false)

    toast({
      title: "Evolução clínica registrada!",
      description: "Anotação de atendimento anexada ao histórico do tratamento.",
    })
  }

  const handleCreateTreatment = () => {
    if (!newPatientId || !newTitle.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o paciente e digite um título para o plano de tratamento.",
        variant: "destructive",
      })
      return
    }

    const patient = patients.find((p) => p.id === newPatientId)
    const newTreat: DentalTreatment = {
      id: `treat-${Date.now()}`,
      patientId: newPatientId,
      patientName: patient?.name || "Paciente",
      title: newTitle.trim(),
      status: "planned",
      createdAt: new Date().toISOString(),
      items: newItems
        .filter((it) => it.procedure.trim())
        .map((it, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          procedure: it.procedure,
          tooth: it.tooth || null,
          status: "pending",
        })),
      evolutionNotes: [],
    }

    const updatedList = [newTreat, ...treatments]
    setTreatments(updatedList)
    setSelectedTreatment(newTreat)
    localStorage.setItem("vwd:dental_treatments", JSON.stringify(updatedList))
    setShowNewModal(false)
    setNewTitle("")
    setNewItems([{ procedure: "Consulta Inicial" }])

    toast({
      title: "Plano de Tratamento Criado!",
      description: `Tratamento para ${newTreat.patientName} iniciado com sucesso.`,
    })
  }

  const filteredTreatments = treatments.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.patientName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Tratamentos Odontológicos & Evolução Clínica
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Planejamento clínico de etapas por dente, acompanhamento de sessões e diário de bordo do paciente.
          </p>
        </div>

        <Button
          onClick={() => {
            if (patients.length > 0 && !newPatientId) setNewPatientId(patients[0].id)
            setShowNewModal(true)
          }}
          className="cursor-pointer font-semibold shadow-xs"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Plano de Tratamento
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por paciente ou tratamento..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex gap-1.5 w-full sm:w-auto">
          {(["all", "in_progress", "planned", "completed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-sm text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {st === "all"
                ? "Todos"
                : st === "in_progress"
                ? "Em Andamento"
                : st === "planned"
                ? "Planejados"
                : "Concluídos"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Treatments list */}
        <div className="lg:col-span-5 space-y-3">
          {filteredTreatments.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground border-border/80">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-xs font-medium">Nenhum tratamento encontrado para o filtro.</p>
            </Card>
          ) : (
            filteredTreatments.map((t) => {
              const isSelected = selectedTreatment?.id === t.id
              const completedCount = t.items.filter((i) => i.status === "completed").length
              const percent = t.items.length > 0 ? Math.round((completedCount / t.items.length) * 100) : 0

              return (
                <Card
                  key={t.id}
                  onClick={() => setSelectedTreatment(t)}
                  className={`p-4 border transition-all cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-primary border-primary shadow-xs bg-background"
                      : "border-border/80 hover:border-primary/50 bg-card hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {t.patientName}
                      </span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">{t.title}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${
                        t.status === "completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : t.status === "in_progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {t.status === "completed"
                        ? "Concluído"
                        : t.status === "in_progress"
                        ? "Em Curso"
                        : "Planejado"}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Progresso</span>
                      <span className="font-semibold text-foreground">
                        {completedCount} de {t.items.length} etapas ({percent}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>

        {/* Right: Selected treatment details & clinical evolution */}
        <div className="lg:col-span-7">
          {selectedTreatment ? (
            <Card className="p-5 border border-border shadow-xs bg-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    {selectedTreatment.patientName}
                  </span>
                  <h3 className="text-lg font-bold text-foreground mt-0.5">
                    {selectedTreatment.title}
                  </h3>
                </div>

                <Button
                  size="sm"
                  onClick={() => setShowEvolutionModal(true)}
                  className="cursor-pointer font-semibold h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Evolução Clínica
                </Button>
              </div>

              {/* Procedures Checklist */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Etapas e Procedimentos do Tratamento
                </h4>
                <div className="space-y-1.5">
                  {selectedTreatment.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItemStatus(item.id)}
                      className={`p-3 rounded-sm border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        item.status === "completed"
                          ? "bg-emerald-50/50 border-emerald-200 text-foreground"
                          : item.status === "in_progress"
                          ? "bg-blue-50/40 border-blue-200 text-foreground"
                          : "bg-background border-border/80 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-xs flex items-center justify-center border transition-colors ${
                            item.status === "completed"
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : item.status === "in_progress"
                              ? "bg-blue-500 border-blue-500 text-white"
                              : "border-border bg-background"
                          }`}
                        >
                          {item.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {item.status === "in_progress" && <Clock className="w-3 h-3" />}
                        </div>
                        <div>
                          <p
                            className={`text-xs font-bold ${
                              item.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {item.procedure}
                          </p>
                          {item.tooth && (
                            <span className="text-[11px] text-primary font-semibold">
                              Dente {item.tooth} ({toothName(item.tooth)})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${
                            item.status === "completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.status === "completed"
                            ? "Concluído"
                            : item.status === "in_progress"
                            ? "Em Execução"
                            : "Pendente"}
                        </span>
                        {item.completedAt && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {item.completedAt}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Evolution History */}
              <div className="pt-3 border-t border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-primary" />
                  Diário de Bordo & Evolução das Sessões
                </h4>

                {(!selectedTreatment.evolutionNotes || selectedTreatment.evolutionNotes.length === 0) ? (
                  <p className="text-xs text-muted-foreground p-4 bg-muted/20 rounded-sm text-center border border-dashed border-border">
                    Nenhuma anotação de evolução registrada ainda. Clique em "Evolução Clínica" para relatar o atendimento de hoje.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedTreatment.evolutionNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-sm border border-border/80 bg-background text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                          <span className="font-semibold text-primary flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {note.date}
                          </span>
                          <span>{note.professionalName}</span>
                        </div>
                        <p className="text-foreground leading-relaxed font-medium">{note.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-foreground">Nenhum tratamento selecionado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um plano de tratamento ao lado para visualizar os procedimentos e o diário de evolução.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* New Treatment Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-lg w-full p-5 bg-card border border-border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Novo Plano de Tratamento Odontológico</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Paciente / Cliente:</label>
                <select
                  value={newPatientId}
                  onChange={(e) => setNewPatientId(e.target.value)}
                  className="h-9 w-full rounded-sm border border-input bg-background px-3 text-xs"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Título do Tratamento:</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Reabilitação Oral, Prótese Fixa e Endodontia"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">Procedimentos Iniciais:</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {newItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input
                        value={item.procedure}
                        onChange={(e) => {
                          const updated = [...newItems]
                          updated[index].procedure = e.target.value
                          setNewItems(updated)
                        }}
                        placeholder="Nome do procedimento"
                        className="h-8 text-xs flex-1"
                      />
                      <Input
                        type="number"
                        value={item.tooth || ""}
                        onChange={(e) => {
                          const updated = [...newItems]
                          updated[index].tooth = e.target.value ? Number(e.target.value) : undefined
                          setNewItems(updated)
                        }}
                        placeholder="Dente FDI"
                        className="h-8 text-xs w-24"
                      />
                      {newItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewItems(newItems.filter((_, i) => i !== index))}
                          className="text-destructive p-1 hover:bg-destructive/10 rounded-xs cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewItems([...newItems, { procedure: "" }])}
                  className="mt-2 text-xs h-7 cursor-pointer"
                >
                  <Plus className="w-3 h-3 mr-1" /> Adicionar Procedimento
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowNewModal(false)}
                className="cursor-pointer text-xs"
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateTreatment} className="cursor-pointer text-xs font-semibold">
                Salvar Tratamento
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Clinical Evolution Modal */}
      {showEvolutionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-md w-full p-5 bg-card border border-border shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Registrar Evolução Clínica da Sessão</h3>
              <button
                type="button"
                onClick={() => setShowEvolutionModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Descreva os procedimentos realizados hoje, anestésicos utilizados, intercorrências e orientações dadas ao paciente.
              </p>
              <textarea
                rows={4}
                value={newEvolutionText}
                onChange={(e) => setNewEvolutionText(e.target.value)}
                placeholder="Ex: Realizada exodontia do dente 38 com anestesia mepivacaína 2%. Sutura com fio de seda 3-0. Prescrito analgésico e anti-inflamatório. Paciente orientado sobre repouso e compressas de gelo."
                className="w-full rounded-sm border border-input bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setShowEvolutionModal(false)}
                className="cursor-pointer text-xs"
              >
                Cancelar
              </Button>
              <Button onClick={handleAddEvolutionNote} className="cursor-pointer text-xs font-semibold">
                Salvar Registro Clínico
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
