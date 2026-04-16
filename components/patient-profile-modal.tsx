"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail, Phone, FileText, Calendar, MapPin, Save, Upload, Loader2, CreditCard, Clock, CheckCircle2, XCircle, Image as ImageIcon, File, Trash2, Download } from "lucide-react"
import { getPatientById, updatePatientNotes, updatePatientPhoto, updatePatientFiles } from "@/app/actions/patients"
import { getPatientAppointments, updateAppointmentOccurrence } from "@/app/actions/appointments"
import { mapDbErrorToUserMessage } from "@/lib/error-messages"
import { getPatientFinancialSummary, getRecentPayments } from "@/app/actions/financial-actions"
import PaymentModal from "@/components/financial/payment-modal"
import { PatientFinancialTab } from "@/components/financial/patient-financial-tab"
import { useToast } from "@/hooks/use-toast"
import { useTranslations, useLocale } from "next-intl"
import type { Patient } from "@/app/actions/patients"

interface PatientProfileModalProps {
  patientId: string | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
  isDemo?: boolean
}

export default function PatientProfileModal({ patientId, isOpen, onClose, onUpdate, isDemo = false }: PatientProfileModalProps) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [financialSummary, setFinancialSummary] = useState<{ paid: number; due: number; discounts: number } | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("info")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [initialPendingPaymentId, setInitialPendingPaymentId] = useState<string | null>(null)
  const [patientFiles, setPatientFiles] = useState<{ id: string; name: string; url: string; type: 'image' | 'file'; uploadedAt: string }[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const { toast } = useToast()
  const t = useTranslations("dashboard.patientProfile")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const isEn = locale === 'en'

  const formatTime = (timeStr: string) => {
    if (!timeStr) return ""
    const [h, m] = timeStr.split(':')
    if (!h || !m) return timeStr
    const hour = parseInt(h)
    if (isEn) {
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const h12 = hour % 12 || 12
      return `${h12}:${m} ${ampm}`
    }
    return `${h.padStart(2, '0')}:${m}`
  }

  useEffect(() => {
    if (patientId && isOpen) {
      loadPatient()
    }
  }, [patientId, isOpen])

  const loadPatient = async () => {
    if (!patientId) return

    setLoading(true)
    if (isDemo) {
      setPatient({
        id: "1",
        name: "Maria Silva",
        email: "maria@email.com",
        phone: "(11) 99999-1111",
        cpf: "123.456.789-00",
        status: "active",
        notes: "Paciente em acompanhamento regular.",
        created_at: new Date().toISOString()
      } as any)
      setNotes("Paciente em acompanhamento regular.")
      setFinancialSummary({ paid: 450, due: 150, discounts: 0 })
      setPayments([
        { id: "1", patient_id: "1", amount: 150, status: "paid", date: new Date().toISOString() },
        { id: "2", patient_id: "1", amount: 150, status: "paid", date: new Date().toISOString() },
        { id: "3", patient_id: "1", amount: 150, status: "pending", date: new Date().toISOString() },
      ])
      setAppointments([
        { id: "1", patient_id: "1", professional_id: "1", appointment_date: new Date().toISOString().split('T')[0], appointment_time: "09:00", status: "completed", notes: "Consulta realizada com sucesso", planned_procedure: "Consulta geral", occurrence: "Paciente apresentou bom progresso" },
        { id: "2", patient_id: "1", professional_id: "2", appointment_date: new Date().toISOString().split('T')[0], appointment_time: "14:00", status: "scheduled", notes: "Consulta de acompanhamento", planned_procedure: "Avaliação", occurrence: null },
      ] as any)
      setLoading(false)
      return
    }
    try {
      const [data, fin, recentPayments, apts] = await Promise.all([
        getPatientById(patientId),
        getPatientFinancialSummary(patientId),
        getRecentPayments(50),
        getPatientAppointments(patientId),
      ])
  
      setPatient(data)
      setNotes(data.notes || "")
      setFinancialSummary(fin)
      setPayments(recentPayments)
      setAppointments(apts)
      setPatientFiles(data.patient_files || [])
    } catch (error) {
      toast({
        title: t("toast.loadError"),
        description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!patientId) return

    setSaving(true)
    try {
      await updatePatientNotes(patientId, notes)
      toast({
        title: t("toast.notesSaved"),
        description: t("toast.notesSavedDesc"),
      })
      if (onUpdate) onUpdate()
    } catch (error) {
      toast({
        title: t("toast.notesError"),
        description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!patientId || !e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]
    if (!file.type.startsWith("image/")) {
      toast({
        title: t("photo.invalid"),
        description: t("photo.invalidDesc"),
        variant: "destructive",
      })
      return
    }

    setUploading(true)
    try {
      // Convert image to base64 for demo purposes
      // In production, you would upload to Supabase Storage or another service
      const reader = new FileReader()
      reader.onloadend = async () => {
        const photoUrl = reader.result as string
        await updatePatientPhoto(patientId, photoUrl)
        setPatient((prev) => (prev ? { ...prev, profile_photo_url: photoUrl } : null))
        toast({
          title: t("toast.photoUpdated"),
          description: t("toast.photoUpdatedDesc"),
        })
        if (onUpdate) onUpdate()
      }
      reader.readAsDataURL(file)
    } catch (error) {
      toast({
        title: t("toast.uploadError"),
        description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }



  const handleMultipleFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!patientId || !e.target.files || e.target.files.length === 0) return

    setUploadingFiles(true)
    try {
      const files = Array.from(e.target.files)
      const newFiles: typeof patientFiles = []

      for (const file of files) {
        const reader = new FileReader()
        
        await new Promise<void>((resolve) => {
          reader.onloadend = async () => {
            const fileUrl = reader.result as string
            const isImage = file.type.startsWith("image/")
            
            newFiles.push({
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              url: fileUrl,
              type: isImage ? "image" : "file",
              uploadedAt: new Date().toISOString(),
            })
            resolve()
          }
          reader.readAsDataURL(file)
        })
      }

      const updatedFiles = [...patientFiles, ...newFiles]
      await updatePatientFiles(patientId, updatedFiles)
      setPatientFiles(updatedFiles)
      
      toast({
        title: t("toast.filesUploaded"),
        description: t("toast.filesUploadedDesc", { count: newFiles.length }),
      })
      if (onUpdate) onUpdate()
    } catch (error) {
      toast({
        title: t("toast.uploadError"),
        description: mapDbErrorToUserMessage(error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      })
    } finally {
      setUploadingFiles(false)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!patientId) return
    
    try {
      const updatedFiles = patientFiles.filter(f => f.id !== fileId)
      await updatePatientFiles(patientId, updatedFiles)
      setPatientFiles(updatedFiles)
      toast({ title: t("toast.fileDeleted") })
      if (onUpdate) onUpdate()
    } catch (error) {
      toast({
        title: t("toast.saveError"),
        description: t("toast.saveErrorDesc"),
        variant: "destructive",
      })
    }
  }

  if (!patient && !loading) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[98vw] max-h-[95vh] overflow-y-auto p-4 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("title")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : patient ? (
          <div className="mt-4 space-y-6 min-w-0">
            {/* Profile Header - Always visible */}
            <Card className="p-4 sm:p-8 bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative">
                  <Avatar className="w-40 h-40 border-4 border-white shadow-lg">
                    <AvatarImage src={patient.profile_photo_url || undefined} alt={patient.name} />
                    <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-secondary text-white font-bold">
                      {patient.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <label
                    htmlFor="photo-upload"
                    className="absolute bottom-2 right-2 p-3 bg-primary text-white rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-md"
                  >
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-4xl font-bold text-foreground mb-3">{patient.name}</h3>
                  <p className="text-lg text-muted-foreground mb-4">{patient.email}</p>
                  <span
                    className={`inline-block text-sm font-semibold px-4 py-2 rounded-full ${patient.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}
                  >
                    {patient.status === "active" ? t("active") : t("inactive")}
                  </span>
                </div>
              </div>
            </Card>

            {/* Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info" className="gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("tabs.info")}</span>
                </TabsTrigger>
                <TabsTrigger value="appointments" className="gap-2">
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("tabs.appointments")}</span>
                </TabsTrigger>
                <TabsTrigger value="financial" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("tabs.financial")}</span>
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("tabs.files")}</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Patient Information */}
                  <Card className="p-4 sm:p-6">
                    <h4 className="text-lg font-bold text-foreground mb-4">{t("info.title")}</h4>
                    <div className="grid sm:grid-cols-2 gap-4 min-w-0">
                      {patient.email && (
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <Mail className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t("info.email")}</p>
                            <p className="text-sm font-medium text-foreground truncate">{patient.email}</p>
                          </div>
                        </div>
                      )}

                      {patient.phone && (
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <Phone className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{t("info.phone")}</p>
                            <p className="text-sm font-medium text-foreground">{patient.phone}</p>
                          </div>
                        </div>
                      )}

                      {patient.cpf && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("info.cpf")}</p>
                            <p className="text-sm font-medium text-foreground">{patient.cpf}</p>
                          </div>
                        </div>
                      )}

                      {(patient.birthday || patient.date_of_birth) && (
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-lg flex-shrink-0">
                            <Calendar className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("info.birthday")}</p>
                            <p className="text-sm font-medium text-foreground">
                              {(() => {
                                const raw = (patient.birthday || patient.date_of_birth) as string | undefined
                                try {
                                  return raw ? new Date(raw).toLocaleDateString("pt-BR") : ""
                                } catch (e) {
                                  return ""
                                }
                              })()}
                            </p>
                          </div>
                        </div>
                      )}

                      {patient.address && (
                        <div className="flex items-start gap-3 sm:col-span-2">
                          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                            <MapPin className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">{t("info.address")}</p>
                            <p className="text-sm font-medium text-foreground">{patient.address}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Notes Section */}
                  <Card className="p-4 sm:p-6">
                    <h4 className="text-lg font-bold text-foreground mb-4">{t("notes.title")}</h4>
                    <Textarea
                      placeholder={t("notes.placeholder")}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-[200px] mb-4"
                    />
                    <Button onClick={handleSaveNotes} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {t("notes.save")}
                    </Button>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="appointments" className="mt-4 focus-visible:outline-none">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-bold text-foreground mb-4">{t("appointments.title")}</h4>
                    
                    {appointments.length > 0 ? (
                      <div className="space-y-3">
                        {[...appointments]
                          .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())
                          .map((apt) => (
                            <Card key={apt.id} className="p-4 border border-border hover:shadow-md transition-shadow">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Calendar className="w-4 h-4 text-primary" />
                                      <span className="font-semibold text-foreground">
                                        {new Date(apt.appointment_date + "T00:00:00").toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                                      </span>
                                      <span className="text-muted-foreground">{t("appointments.at")} {formatTime(apt.appointment_time)}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-2">
                                      <span
                                        className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${
                                          apt.status === "completed"
                                            ? "bg-green-100 text-green-700 border-green-200"
                                            : apt.status === "scheduled"
                                            ? "bg-blue-100 text-blue-700 border-blue-200"
                                            : "bg-red-100 text-red-700 border-red-200"
                                        }`}
                                      >
                                        {apt.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                                        {apt.status === "scheduled" && <Clock className="w-3 h-3" />}
                                        {apt.status === "cancelled" && <XCircle className="w-3 h-3" />}
                                        {apt.status === "completed" 
                                          ? tCommon("status.completed") 
                                          : apt.status === "scheduled" 
                                            ? tCommon("status.scheduled") 
                                            : tCommon("status.cancelled")}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Planned Procedure */}
                                {apt.planned_procedure && (
                                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-xs font-semibold text-blue-900 mb-1">{t("appointments.planned")}</p>
                                    <p className="text-sm text-blue-800">{apt.planned_procedure}</p>
                                  </div>
                                )}

                                {/* Original Notes */}
                                {apt.notes && (
                                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <p className="text-xs font-semibold text-slate-900 mb-1">{t("appointments.notesLabel")}</p>
                                    <p className="text-sm text-slate-700">{apt.notes}</p>
                                  </div>
                                )}

                                {/* Occurrence Notes */}
                                {apt.status === "completed" && (
                                  <OccurrenceSection
                                     key={apt.id}
                                     apt={apt}
                                     onSave={async (id, note) => {
                                       await updateAppointmentOccurrence(id, note)
                                       setAppointments(appointments.map(a => a.id === id ? { ...a, occurrence: note } : a))
                                     }}
                                  />
                                )}
                              </div>
                            </Card>
                          ))}
                      </div>
                    ) : (
                      <Card className="p-8 border border-border text-center">
                        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">{t("appointments.empty") || "Nenhum agendamento registrado"}</p>
                      </Card>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financial" className="mt-4 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Financial Summary Card */}
                  <Card className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                      <h4 className="text-lg font-bold text-foreground">{t("financial.title")}</h4>
                      <Button onClick={() => setShowPaymentModal(true)} className="mt-2 sm:mt-0">
                        {t("financial.register")}
                      </Button>
                    </div>

                    {financialSummary ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t("financial.totalPaid")}</p>
                          <p className="text-xl font-bold text-emerald-600">
                            R$ {financialSummary.paid.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("financial.totalDue")}</p>
                          <p className="text-xl font-bold text-amber-600">
                            R$ {financialSummary.due.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">{t("financial.discounts")}</p>
                          <p className="text-xl font-bold text-foreground">
                            R$ {financialSummary.discounts.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("financial.loading")}</p>
                    )}
                  </Card>

                  {/* Financial Details */}
                  {patientId && (
                    <PatientFinancialTab
                      patientId={patientId}
                      payments={payments.filter(p => p.patient_id === patientId)}
                      onOpenPaymentModal={(pendingId) => {
                        setInitialPendingPaymentId(pendingId || null)
                        setShowPaymentModal(true)
                      }}
                    />
                  )}
                </div>
              </TabsContent>

              <TabsContent value="files" className="mt-4 focus-visible:outline-none">
                <div className="space-y-6">
                  {/* Upload Section */}
                  <Card className="p-6 border-2 border-dashed border-primary/50 bg-primary/5">
                    <div className="flex flex-col items-center justify-center py-8">
                      <label htmlFor="files-upload" className="cursor-pointer w-full">
                        <div className="flex flex-col items-center">
                          <div className="p-4 bg-primary/10 rounded-lg mb-3">
                            <ImageIcon className="w-8 h-8 text-primary" />
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-2">{t("files.uploadTitle") || "Adicionar Arquivos e Fotos"}</h3>
                          <p className="text-sm text-muted-foreground mb-4">{t("files.uploadDesc") || "Clique ou arraste arquivos aqui"}</p>
                          <Button asChild disabled={uploadingFiles} className="gap-2">
                            <span>
                              {uploadingFiles ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  {t("files.uploading")}
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  {t("files.select")}
                                </>
                              )}
                            </span>
                          </Button>
                          <p className="text-xs text-muted-foreground mt-3">
                            {t("files.hint")}
                          </p>
                        </div>
                        <input
                          id="files-upload"
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={handleMultipleFilesUpload}
                          disabled={uploadingFiles}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </Card>

                  {/* Files List */}
                  {patientFiles.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="text-lg font-bold text-foreground">{t("files.title")} ({patientFiles.length})</h4>
                      
                      {/* Images Gallery */}
                      {patientFiles.filter(f => f.type === "image").length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-foreground mb-3">{t("files.photos")}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {patientFiles.filter(f => f.type === "image").map((file) => (
                              <div key={file.id} className="relative group">
                                <img
                                  src={file.url}
                                  alt={file.name}
                                  className="w-full h-32 object-cover rounded-lg border border-border"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                  <a href={file.url} download={file.name} className="p-2 bg-white rounded hover:bg-gray-100">
                                    <Download className="w-4 h-4 text-black" />
                                  </a>
                                  <button
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="p-2 bg-red-500 rounded hover:bg-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 text-white" />
                                  </button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2 truncate">{file.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documents List */}
                      {patientFiles.filter(f => f.type === "file").length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-foreground mb-3">{t("files.docs")}</p>
                          <div className="space-y-2">
                            {patientFiles.filter(f => f.type === "file").map((file) => (
                              <Card key={file.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded flex-shrink-0">
                                    <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(file.uploadedAt).toLocaleDateString(locale)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                  <a
                                    href={file.url}
                                    download={file.name}
                                    className="p-2 hover:bg-muted rounded transition-colors"
                                    title={t("files.download")}
                                  >
                                    <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                  </a>
                                  <button
                                    onClick={() => handleDeleteFile(file.id)}
                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-colors"
                                    title={t("files.delete")}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" />
                                  </button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Card className="p-12 border-dashed text-center">
                      <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">{t("files.empty")}</p>
                      <p className="text-sm text-muted-foreground mt-1">{t("files.emptyDesc")}</p>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>

      {/* Payment Modal */}
      {patientId && (
        <PaymentModal
          open={showPaymentModal}
          onOpenChange={(open) => {
            setShowPaymentModal(open)
            if (!open) {
              loadPatient()
              setInitialPendingPaymentId(null)
            }
          }}
          defaultPatientId={patientId}
          onSaved={loadPatient}
          initialSettlePending={Boolean(initialPendingPaymentId)}
          initialPendingPaymentId={initialPendingPaymentId}
        />
      )}
    </Dialog>
  )
}

function OccurrenceSection({ apt, onSave }: { apt: any, onSave: (id: string, note: string) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false)
  const [note, setNote] = useState(apt.occurrence || "")
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const tApt = useTranslations("dashboard.patientProfile.appointments")

  useEffect(() => {
    setNote(apt.occurrence || "")
  }, [apt.occurrence])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(apt.id, note)
      toast({ title: tApt("occurrenceSaved") })
      setIsEditing(false)
    } catch (error) {
       toast({
        title: tApt("saveError"),
        description: tApt("saveErrorDesc"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">{tApt("occurrence")}</p>
        <Textarea
          placeholder={tApt("placeholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-h-[80px]"
          autoFocus
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {tApt("save")}
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              setNote(apt.occurrence || "")
              setIsEditing(false)
            }}
          >
            {tApt("cancel")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-emerald-900 mb-1">{tApt("occurrence")}</p>
          {apt.occurrence ? (
            <p className="text-sm text-emerald-800 whitespace-pre-wrap">{apt.occurrence}</p>
          ) : (
            <p className="text-sm text-emerald-600 italic">{tApt("noInfo")}</p>
          )}
        </div>
        <Button
          size="sm"
          type="button"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            setIsEditing(true)
          }}
          className="ml-2"
        >
          {tApt("edit")}
        </Button>
      </div>
    </div>
  )
}
