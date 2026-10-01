// Hello World
"use client"

import React, { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FileText,
  Printer,
  Copy,
  Users,
  CheckCircle2,
  FileCheck,
  Stethoscope,
  Pill,
  ShieldCheck,
  Download,
  Share2,
} from "lucide-react"
import { getPatients, type Patient } from "@/app/actions/patients"
import { useToast } from "@/hooks/use-toast"

type DocType = "prescription" | "certificate" | "tcle" | "post_op"

export default function DentalDocumentsTab({ isDemo = false }: { isDemo?: boolean }) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [activeDocType, setActiveDocType] = useState<DocType>("prescription")
  const [dentistName, setDentistName] = useState("Dr. Roberto Santos")
  const [croNumber, setCroNumber] = useState("CRO-SP 84210")
  const [clinicAddress, setClinicAddress] = useState("Av. Paulista, 1000 - Conj. 120 - São Paulo, SP")

  // Prescription fields
  const [prescriptionItems, setPrescriptionItems] = useState<string>(
    `1. Amoxicilina 500mg ------------------ 21 cápsulas
   Tomar 01 (uma) cápsula por via oral de 8 em 8 horas durante 7 dias.

2. Ibuprofeno 600mg -------------------- 12 comprimidos
   Tomar 01 (um) comprimido por via oral de 8 em 8 horas em caso de dor ou inchaço por até 4 dias.

3. Dipirona Monoidratada 500mg --------- 10 comprimidos
   Tomar 01 (um) comprimido se dor persistente a cada 6 horas.`
  )

  // Certificate fields
  const [certificateDays, setCertificateDays] = useState("02 (dois)")
  const [certificatePeriod, setCertificatePeriod] = useState("manhã e tarde")
  const [cidCode, setCidCode] = useState("K01.1 (Dentes impactados)")

  // Post op instructions
  const [postOpInstructions, setPostOpInstructions] = useState(
    `1. NÃO cuspir ou fazer bochechos nas primeiras 24 horas para preservar o coágulo sanguíneo.
2. Manter a compressa de gaze mordida firmemente por 30 minutos após o procedimento.
3. Aplicar compressas de gelo externamente na face (20 min com gelo, 20 min sem) nas primeiras 24h.
4. Dieta líquida ou pastosa, fria ou morna (evitar alimentos quentes e duros) nos primeiros 2 dias.
5. Não realizar esforços físicos intensos ou exposição prolongada ao sol por 48 horas.
6. Não fumar e não ingerir bebidas alcoólicas por pelo menos 7 dias.
7. Tomar rigorosamente as medicações prescritas nos horários corretos.`
  )

  const { toast } = useToast()

  useEffect(() => {
    loadPatientsList()
  }, [])

  const loadPatientsList = async () => {
    try {
      const list = isDemo
        ? ([
            { id: "1", name: "Maria Silva", cpf: "123.456.789-00" },
            { id: "2", name: "Carlos Mendes", cpf: "234.567.890-11" },
          ] as any)
        : await getPatients()
      setPatients(list)
      if (list.length > 0) setSelectedPatientId(list[0].id)
    } catch (err) {
      console.error("Error loading patients:", err)
    }
  }

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)
  const todayFormatted = new Date().toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const handlePrint = () => {
    window.print()
  }

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Texto copiado!",
      description: "Conteúdo do documento copiado para a área de transferência.",
    })
  }

  const handlePresetPrescription = (type: "standard" | "surgical" | "perio") => {
    if (type === "standard") {
      setPrescriptionItems(
        `1. Amoxicilina 500mg ------------------ 21 cápsulas\n   Tomar 1 cápsula via oral de 8 em 8 horas por 7 dias.\n\n2. Ibuprofeno 600mg -------------------- 12 comprimidos\n   Tomar 1 comprimido de 8 em 8 horas se dor ou inflamação.`
      )
    } else if (type === "surgical") {
      setPrescriptionItems(
        `1. Amoxicilina + Clavulanato 875mg/125mg -- 14 comprimidos\n   Tomar 1 comprimido de 12 em 12 horas por 7 dias.\n\n2. Dexametasona 4mg --------------------- 02 comprimidos\n   Tomar 1 comprimido 1 hora antes do procedimento e 1 comprimido 12h após.\n\n3. Toragesic 10mg sublingual ----------- 06 comprimidos\n   Dissolver 1 comprimido sob a língua a cada 8 horas em caso de dor forte.`
      )
    } else if (type === "perio") {
      setPrescriptionItems(
        `1. Solução de Digluconato de Clorexidina 0,12% -- 01 frasco\n   Bochechar 15ml puro durante 1 minuto, de 12 em 12 horas, após a escovação dental, por 14 dias.\n\n2. Paracetamol 750mg ------------------- 10 comprimidos\n   Tomar 1 comprimido a cada 6 horas se dor leve a moderada.`
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Documentos Clínicos & Prescrições Odontológicas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Emissão de receitas, atestados com CID-10, termos de consentimento e orientações pós-cirúrgicas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} className="cursor-pointer font-semibold shadow-xs">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Documento
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration & Controls */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 border border-border bg-card space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Paciente / Cliente:
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="h-9 w-full rounded-sm border border-input bg-background px-3 text-xs"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.cpf ? `(CPF: ${p.cpf})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Tipo de Documento:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "prescription", label: "Receituário", icon: Pill },
                  { id: "certificate", label: "Atestado", icon: FileCheck },
                  { id: "tcle", label: "Termo TCLE", icon: ShieldCheck },
                  { id: "post_op", label: "Pós-Operatório", icon: Stethoscope },
                ].map((item) => {
                  const Icon = item.icon
                  const active = activeDocType === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveDocType(item.id as DocType)}
                      className={`p-2.5 rounded-sm border text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-background text-foreground border-border/80 hover:bg-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom controls based on active doc type */}
            {activeDocType === "prescription" && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-foreground">Modelos Rápidos:</label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handlePresetPrescription("standard")}
                      className="px-2 py-0.5 text-[10px] rounded-xs bg-muted hover:bg-muted/80 text-foreground font-semibold cursor-pointer"
                    >
                      Clínica Geral
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetPrescription("surgical")}
                      className="px-2 py-0.5 text-[10px] rounded-xs bg-muted hover:bg-muted/80 text-foreground font-semibold cursor-pointer"
                    >
                      Cirúrgico
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetPrescription("perio")}
                      className="px-2 py-0.5 text-[10px] rounded-xs bg-muted hover:bg-muted/80 text-foreground font-semibold cursor-pointer"
                    >
                      Periodontia
                    </button>
                  </div>
                </div>
                <textarea
                  rows={8}
                  value={prescriptionItems}
                  onChange={(e) => setPrescriptionItems(e.target.value)}
                  className="w-full rounded-sm border border-input bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-hidden resize-none font-mono"
                />
              </div>
            )}

            {activeDocType === "certificate" && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Dias de Repouso:</label>
                  <Input
                    value={certificateDays}
                    onChange={(e) => setCertificateDays(e.target.value)}
                    placeholder="Ex: 02 (dois) dias"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">Período:</label>
                  <Input
                    value={certificatePeriod}
                    onChange={(e) => setCertificatePeriod(e.target.value)}
                    placeholder="Ex: manhã e tarde"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">CID-10 Odontológico:</label>
                  <Input
                    value={cidCode}
                    onChange={(e) => setCidCode(e.target.value)}
                    placeholder="Ex: K01.1 (Dentes impactados)"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            )}

            {/* Professional Settings */}
            <div className="pt-3 border-t border-border/60 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Dados do Profissional / Clínica:
              </label>
              <Input
                value={dentistName}
                onChange={(e) => setDentistName(e.target.value)}
                placeholder="Nome do Dentista"
                className="h-8 text-xs"
              />
              <Input
                value={croNumber}
                onChange={(e) => setCroNumber(e.target.value)}
                placeholder="Registro CRO"
                className="h-8 text-xs"
              />
              <Input
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
                placeholder="Endereço da Clínica"
                className="h-8 text-xs"
              />
            </div>
          </Card>
        </div>

        {/* Right: Printable Paper Preview */}
        <div className="lg:col-span-7">
          <Card className="p-8 border border-border shadow-md bg-white text-slate-900 rounded-sm min-h-[560px] flex flex-col justify-between font-serif relative">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("printable-doc-content")
                if (el) handleCopyText(el.innerText)
              }}
              className="absolute top-4 right-4 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer font-sans"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar Texto
            </button>

            <div id="printable-doc-content" className="space-y-6">
              {/* Clinic Header */}
              <div className="text-center border-b border-slate-300 pb-4">
                <h2 className="text-xl font-bold tracking-tight text-slate-950 uppercase font-sans">
                  {dentistName}
                </h2>
                <p className="text-xs text-slate-600 font-sans tracking-wide mt-0.5">
                  Cirurgião-Dentista • {croNumber}
                </p>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  {clinicAddress}
                </p>
              </div>

              {/* Document Title */}
              <div className="text-center py-2">
                <h3 className="text-base font-bold uppercase tracking-widest text-slate-900 underline underline-offset-4 font-sans">
                  {activeDocType === "prescription" && "RECEITUÁRIO ODONTOLÓGICO"}
                  {activeDocType === "certificate" && "ATESTADO ODONTOLÓGICO"}
                  {activeDocType === "tcle" && "TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO"}
                  {activeDocType === "post_op" && "INSTRUÇÕES PÓS-OPERATÓRIAS"}
                </h3>
              </div>

              {/* Patient Header */}
              <div className="bg-slate-50 p-3 rounded-sm border border-slate-200 text-xs font-sans space-y-1">
                <p>
                  <strong>Paciente:</strong> {selectedPatient?.name || "Maria Silva"}
                </p>
                {selectedPatient?.cpf && (
                  <p>
                    <strong>CPF:</strong> {selectedPatient.cpf}
                  </p>
                )}
                <p>
                  <strong>Data de Emissão:</strong> {todayFormatted}
                </p>
              </div>

              {/* Document Body */}
              <div className="text-sm leading-relaxed text-slate-800 space-y-4 pt-2">
                {activeDocType === "prescription" && (
                  <div className="whitespace-pre-line font-mono text-xs bg-slate-50/50 p-4 border border-slate-200 rounded-sm">
                    {prescriptionItems}
                  </div>
                )}

                {activeDocType === "certificate" && (
                  <div className="space-y-4 text-justify">
                    <p>
                      Atesto para os devidos fins que o(a) paciente acima identificado(a) esteve sob meus cuidados profissionais no período de <strong>{certificatePeriod}</strong> do dia de hoje, tendo sido submetido(a) a procedimento odontológico.
                    </p>
                    <p>
                      Em decorrência do tratamento realizado, necessita de <strong>{certificateDays}</strong> de repouso para sua adequada recuperação física e biológica.
                    </p>
                    <p className="text-xs text-slate-600">
                      Classificação Internacional de Doenças (CID-10): <strong>{cidCode}</strong>
                    </p>
                  </div>
                )}

                {activeDocType === "tcle" && (
                  <div className="text-xs leading-relaxed text-justify space-y-3">
                    <p>
                      Eu, paciente acima qualificado(a), declaro que fui devidamente informado(a) e esclarecido(a) pelo cirurgião-dentista sobre o diagnóstico, alternativas de tratamento, riscos inerentes aos procedimentos cirúrgicos e anestésicos, bem como os cuidados necessários para a recuperação.
                    </p>
                    <p>
                      Tive a oportunidade de formular todas as perguntas que julguei necessárias, as quais foram respondidas com clareza. Autorizo a realização dos procedimentos odontológicos acordados em plano de tratamento.
                    </p>
                  </div>
                )}

                {activeDocType === "post_op" && (
                  <div className="whitespace-pre-line text-xs font-sans bg-slate-50 p-4 border border-slate-200 rounded-sm">
                    {postOpInstructions}
                  </div>
                )}
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-12 border-t border-slate-200 grid grid-cols-2 gap-8 text-center font-sans text-xs">
              <div className="space-y-1">
                <div className="border-t border-slate-400 w-48 mx-auto" />
                <p className="font-semibold text-slate-900">{selectedPatient?.name || "Paciente"}</p>
                <p className="text-[11px] text-slate-500">Assinatura do Paciente / Responsável</p>
              </div>

              <div className="space-y-1">
                <div className="border-t border-slate-400 w-48 mx-auto" />
                <p className="font-semibold text-slate-900">{dentistName}</p>
                <p className="text-[11px] text-slate-500">{croNumber}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
