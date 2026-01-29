"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail, Phone, FileText, Calendar, MapPin, Save, Upload, Loader2, CreditCard } from "lucide-react"
import { getPatientById, updatePatientNotes, updatePatientPhoto } from "@/app/actions/patients"
import { mapDbErrorToUserMessage } from "@/lib/error-messages"
import { getPatientFinancialSummary, getRecentPayments } from "@/app/actions/financial-actions"
import PaymentModal from "@/components/financial/payment-modal"
import { PatientFinancialTab } from "@/components/financial/patient-financial-tab"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"
import type { Patient } from "@/app/actions/patients"

interface PatientProfileModalProps {
  patientId: string | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
}

export default function PatientProfileModal({ patientId, isOpen, onClose, onUpdate }: PatientProfileModalProps) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [financialSummary, setFinancialSummary] = useState<{ paid: number; due: number; discounts: number } | null>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState("info")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [initialPendingPaymentId, setInitialPendingPaymentId] = useState<string | null>(null)
  const { toast } = useToast()
  const t = useTranslations("dashboard.patientProfile")
  const tCommon = useTranslations("common")

  useEffect(() => {
    if (patientId && isOpen) {
      loadPatient()
    }
  }, [patientId, isOpen])

  const loadPatient = async () => {
    if (!patientId) return

    setLoading(true)
    try {
      const [data, fin, recentPayments] = await Promise.all([
        getPatientById(patientId),
        getPatientFinancialSummary(patientId),
        getRecentPayments(50)
      ])

      setPatient(data)
      setNotes(data.notes || "")
      setFinancialSummary(fin)
      setPayments(recentPayments)
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

  if (!patient && !loading) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t("title")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : patient ? (
          <div className="mt-4 space-y-6">
            {/* Profile Header - Always visible */}
            <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={patient.profile_photo_url || undefined} alt={patient.name} />
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-primary to-secondary text-white">
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
                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
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
                  <h3 className="text-2xl font-bold text-foreground mb-2">{patient.name}</h3>
                  <span
                    className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${patient.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      }`}
                  >
                    {patient.status === "active" ? t("active") : t("inactive")}
                  </span>
                </div>
              </div>
            </Card>

            {/* Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="info" className="gap-2">
                  <FileText className="w-4 h-4" />
                  {t("tabs.info")}
                </TabsTrigger>
                <TabsTrigger value="financial" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  {t("tabs.financial")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4">
                <div className="space-y-6">
                  {/* Patient Information */}
                  <Card className="p-6">
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
                  <Card className="p-6">
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

              <TabsContent value="financial" className="mt-4">
                <div className="space-y-6">
                  {/* Financial Summary Card */}
                  <Card className="p-6">
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
