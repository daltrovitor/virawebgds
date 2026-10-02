// Hello World
"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Users,
  Search,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Activity,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Layers,
  Smile,
} from "lucide-react"
import Odontogram, { ToothData } from "@/components/dental/odontogram"
import {
  toothName,
  type ToothCondition,
  TOOTH_CONDITION_LABELS,
  TOOTH_CONDITION_COLORS,
  isValidTooth,
} from "@/lib/teeth"
import { getPatients, type Patient } from "@/app/actions/patients"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase-client"

export default function OdontogramTab({ isDemo = false }: { isDemo?: boolean }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [patientSearch, setPatientSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([])
  const [inspectedTooth, setInspectedTooth] = useState<number | null>(11)
  const [teethData, setTeethData] = useState<Record<number, ToothData>>({})
  const [toothNoteInput, setToothNoteInput] = useState("")
  const [selectedCondition, setSelectedCondition] = useState<ToothCondition>("healthy")
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    loadPatientsList()
  }, [])

  const loadPatientsList = async () => {
    try {
      setLoading(true)
      if (isDemo) {
        setPatients([
          { id: "1", name: "Maria Silva", email: "maria@email.com", phone: "(11) 99999-1111", status: "active" } as any,
          { id: "2", name: "Carlos Mendes", email: "carlos@email.com", phone: "(11) 99999-2222", status: "active" } as any,
          { id: "3", name: "Beatriz Lima", email: "beatriz@email.com", phone: "(11) 99999-3333", status: "active" } as any,
        ])
        setSelectedPatientId("1")
        loadPatientOdontogram("1")
        return
      }

      const list = await getPatients()
      setPatients(list)
      if (list.length > 0) {
        setSelectedPatientId(list[0].id)
        loadPatientOdontogram(list[0].id)
      }
    } catch (err) {
      console.error("Error loading patients:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadPatientOdontogram = async (patientId: string) => {
    try {
      // Try fetching from localStorage or Supabase
      const stored = localStorage.getItem(`vwd:odontogram:${patientId}`)
      if (stored) {
        setTeethData(JSON.parse(stored))
        return
      }

      // Paciente real sem registro: odontograma em branco. O exemplo abaixo existe apenas na demonstração.
      if (!isDemo) {
        setTeethData({})
        return
      }
      const initialRecord: Record<number, ToothData> = {
        16: { condition: "restored", notes: "Restauração em resina composta MOD" },
        11: { condition: "healthy", notes: "Hígido" },
        21: { condition: "healthy", notes: "Hígido" },
        26: { condition: "caries", notes: "Cárie oclusal ativa", procedures: ["Restauração Resina"] },
        36: { condition: "endodontic", notes: "Tratamento de canal concluído", procedures: ["Endodontia"] },
        46: { condition: "implant", notes: "Implante osseointegrado e coroa sobre implante", procedures: ["Prótese sobre Implante"] },
        48: { condition: "missing", notes: "Exodontia realizada" },
      }
      setTeethData(initialRecord)
    } catch (err) {
      console.error("Error loading odontogram:", err)
    }
  }

  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id)
    setSelectedTeeth([])
    setInspectedTooth(11)
    loadPatientOdontogram(id)
  }

  const handleToothClick = (toothNumber: number) => {
    setInspectedTooth(toothNumber)
    const existing = teethData[toothNumber]
    setSelectedCondition(existing?.condition || "healthy")
    setToothNoteInput(existing?.notes || "")
  }

  const handleApplyToothCondition = (cond: ToothCondition) => {
    if (!inspectedTooth) return
    setSelectedCondition(cond)
    setTeethData((prev) => ({
      ...prev,
      [inspectedTooth]: {
        ...prev[inspectedTooth],
        condition: cond,
        notes: toothNoteInput || prev[inspectedTooth]?.notes,
      },
    }))
  }

  const handleSaveToothNotes = () => {
    if (!inspectedTooth) return
    setTeethData((prev) => ({
      ...prev,
      [inspectedTooth]: {
        ...prev[inspectedTooth],
        condition: selectedCondition,
        notes: toothNoteInput,
      },
    }))
    toast({
      title: `Dente ${inspectedTooth} atualizado`,
      description: "Informações clínicas salvas com sucesso.",
    })
  }

  const handleSaveFullOdontogram = async () => {
    if (!selectedPatientId) return
    setSaving(true)
    try {
      localStorage.setItem(`vwd:odontogram:${selectedPatientId}`, JSON.stringify(teethData))
      // Also try saving to Supabase if table exists
      try {
        await (supabase.from("odontogram_records") as any).upsert({
          patient_id: selectedPatientId,
          data: teethData,
          updated_at: new Date().toISOString(),
        })
      } catch (e) {
        // Table might be created via migration, fallback quietly
      }

      toast({
        title: "Odontograma Salvo!",
        description: "Mapa odontológico do paciente registrado com sucesso.",
      })
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o odontograma.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleBatchApplyCondition = (cond: ToothCondition) => {
    if (selectedTeeth.length === 0) {
      toast({
        title: "Nenhum dente selecionado",
        description: "Selecione dentes no odontograma para aplicar a alteração em lote.",
        variant: "destructive",
      })
      return
    }

    setTeethData((prev) => {
      const updated = { ...prev }
      selectedTeeth.forEach((t) => {
        updated[t] = {
          ...updated[t],
          condition: cond,
        }
      })
      return updated
    })

    toast({
      title: "Alteração em lote aplicada",
      description: `Condição "${TOOTH_CONDITION_LABELS[cond]}" aplicada a ${selectedTeeth.length} dentes.`,
    })
  }

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  // Calculate statistics
  const stats = Object.values(teethData).reduce(
    (acc, curr) => {
      const c = curr.condition || "healthy"
      if (c === "caries") acc.caries++
      else if (c === "restored") acc.restored++
      else if (c === "endodontic") acc.endodontic++
      else if (c === "implant") acc.implant++
      else if (c === "missing") acc.missing++
      return acc
    },
    { caries: 0, restored: 0, endodontic: 0, implant: 0, missing: 0 }
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Smile className="w-6 h-6 text-primary" />
            Odontograma & Prontuário Odontológico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeamento anatômico completo da dentição FDI, diagnóstico visual de dentes e acompanhamento clínico.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSaveFullOdontogram}
            disabled={saving || !selectedPatientId}
            className="cursor-pointer font-semibold shadow-xs"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Odontograma
          </Button>
        </div>
      </div>

      {/* Patient Selector and Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-4 p-4 border border-border shadow-xs bg-card space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              Selecionar Paciente / Cliente
            </label>
            <span className="text-xs text-muted-foreground">{patients.length} cadastrados</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Buscar paciente por nome..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-border/40" data-lenis-prevent>
            {filteredPatients.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3 text-center">Nenhum paciente encontrado.</p>
            ) : (
              filteredPatients.map((p) => (
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
              ))
            )}
          </div>
        </Card>

        {/* Stats summary */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-3 border border-border/80 bg-background flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Cáries</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-rose-600">{stats.caries}</span>
              <span className="text-[10px] text-muted-foreground">detectadas</span>
            </div>
          </Card>
          <Card className="p-3 border border-border/80 bg-background flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Restaurações</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-blue-600">{stats.restored}</span>
              <span className="text-[10px] text-muted-foreground">ativas</span>
            </div>
          </Card>
          <Card className="p-3 border border-border/80 bg-background flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Canais (Endo)</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-purple-600">{stats.endodontic}</span>
              <span className="text-[10px] text-muted-foreground">tratados</span>
            </div>
          </Card>
          <Card className="p-3 border border-border/80 bg-background flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Implantes</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-amber-600">{stats.implant}</span>
              <span className="text-[10px] text-muted-foreground">instalados</span>
            </div>
          </Card>
          <Card className="p-3 border border-border/80 bg-background flex flex-col justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Ausentes</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-500">{stats.missing}</span>
              <span className="text-[10px] text-muted-foreground">extraídos</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Main Odontogram Area */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 space-y-4">
          <Odontogram
            selectedTeeth={selectedTeeth}
            onSelectionChange={setSelectedTeeth}
            teethData={teethData}
            onToothClick={handleToothClick}
          />

          {/* Batch Actions Bar */}
          {selectedTeeth.length > 0 && (
            <Card className="p-3 border border-primary/40 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Aplicar aos {selectedTeeth.length} dentes selecionados:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TOOTH_CONDITION_LABELS) as ToothCondition[]).slice(0, 5).map((cond) => (
                  <Button
                    key={cond}
                    size="sm"
                    variant="outline"
                    onClick={() => handleBatchApplyCondition(cond)}
                    className="h-7 text-[11px] cursor-pointer"
                  >
                    {TOOTH_CONDITION_LABELS[cond]}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Tooth Inspector Sidebar */}
        <div className="xl:col-span-4">
          <Card className="p-4 border border-border shadow-xs bg-card space-y-4 sticky top-20">
            {inspectedTooth ? (
              <>
                <div className="border-b border-border/60 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Ficha do Dente
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-sm bg-muted text-foreground">
                      FDI #{inspectedTooth}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground mt-1 capitalize">
                    {toothName(inspectedTooth)}
                  </h3>
                </div>

                {/* Condition Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">
                    Condição Clínica Atual:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(TOOTH_CONDITION_LABELS) as ToothCondition[]).map((cond) => {
                      const isSelected = selectedCondition === cond
                      const c = TOOTH_CONDITION_COLORS[cond]
                      return (
                        <button
                          key={cond}
                          type="button"
                          onClick={() => handleApplyToothCondition(cond)}
                          className={`p-2 rounded-sm border text-[11px] text-left font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? "ring-2 ring-primary border-primary bg-background shadow-xs font-bold text-foreground"
                              : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-xs border shrink-0 ${c.bg} ${c.border}`} />
                          <span className="truncate">{TOOTH_CONDITION_LABELS[cond]}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Clinical Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">
                    Anotações Clínicas do Dente:
                  </label>
                  <textarea
                    rows={3}
                    value={toothNoteInput}
                    onChange={(e) => setToothNoteInput(e.target.value)}
                    placeholder="Ex: Fratura de cúspide, restauração infiltrada, sensibilidade ao frio..."
                    className="w-full rounded-sm border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden resize-none"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveToothNotes}
                    className="w-full text-xs font-semibold cursor-pointer h-8"
                  >
                    Gravar Anotação no Dente
                  </Button>
                </div>

                {/* Planned Procedures */}
                {teethData[inspectedTooth]?.procedures && teethData[inspectedTooth]!.procedures!.length > 0 && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-xs font-bold text-foreground block mb-1.5">
                      Procedimentos Registrados:
                    </span>
                    <ul className="space-y-1">
                      {teethData[inspectedTooth]!.procedures!.map((proc, i) => (
                        <li key={i} className="text-xs bg-muted/50 p-1.5 rounded-sm border border-border/50 text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span>{proc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <Smile className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-xs font-medium">Clique em um dente no odontograma para inspecionar e alterar sua condição clínica.</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
