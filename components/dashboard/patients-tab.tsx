"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Trash2, Edit2, Search, Mail, Phone, FileText, Loader2, Eye } from "lucide-react"
import {
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
  updatePatientStatus,
  type Patient,
} from "@/app/actions/patients"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { mapDbErrorToUserMessage } from "@/lib/error-messages"
import PatientProfileModal from "@/components/patient-profile-modal"
import PlanLimitBanner from "@/components/plan-limit-banner"
import { useRouter } from "next/navigation"
import UpgradeModal from "@/components/upgrade-modal"
import { getCurrentPlan } from "@/app/actions/subscription"
import { checkLimit } from "@/lib/usage-stats"
import { parseISO, format } from "date-fns"
import { ptBR } from "date-fns/locale"

import { useTranslations } from 'next-intl'

export default function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all")
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<"basic" | "premium" | "master">("basic")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    date_of_birth: "",
    birthday: "",
    address: "",
    notes: "",
  })
  const { toast } = useToast()
  const t = useTranslations('dashboard.patients')
  const tCommon = useTranslations('common')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    loadPatients()
    loadPlan()
  }, [])

  const loadPlan = async () => {
    try {
      const plan = await getCurrentPlan()
      setCurrentPlan(plan)
    } catch (error) {
      console.error(" Error loading plan:", error)
    }
  }

  const loadPatients = async () => {
    try {
      const data = await getPatients()
      setPatients(data)
    } catch (error) {
      toast({
        title: t('toast.loadError'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddPatient = async () => {
    setSaving(true)
    if (!formData.name) {
      toast({
        title: t('toast.nameRequired'),
        description: t('toast.nameRequiredDesc'),
        variant: "destructive",
      })
      return
    }

    if (!editingId) {
      try {
        const limitCheck = await checkLimit(currentPlan, "patients")
        if (!limitCheck.allowed) {
          setShowUpgradeModal(true)
          return
        }
      } catch (error) {
        console.error(" Error checking limit:", error)
      }
    }

    try {
      if (editingId) {
        const result = await updatePatient(editingId, formData)
        if (!result.success) {
          toast({
            title: t('toast.updateError'),
            description: result.error,
            variant: "destructive",
          })
          setSaving(false)
          return
        }
        toast({
          title: t('toast.updated'),
          description: t('toast.updatedDesc'),
        })
      } else {
        const result = await createPatient(formData)
        if (!result.success) {
          toast({
            title: t('toast.saveError'),
            description: result.error,
            variant: "destructive",
          })
          setSaving(false)
          return
        }
        toast({
          title: t('toast.created'),
          description: t('toast.createdDesc'),
        })
      }

      await loadPatients()
      setFormData({ name: "", email: "", phone: "", cpf: "", date_of_birth: "", birthday: "", address: "", notes: "" })
      setShowForm(false)
      setEditingId(null)
    } catch (error) {
      if (error instanceof Error && error.message.includes("Limite")) {
        setShowUpgradeModal(true)
      } else {
        const raw = error instanceof Error ? error.message : String(error)
        const description = mapDbErrorToUserMessage(raw)

        toast({
          title: t('toast.saveError'),
          description,
          variant: "destructive",
        })
      }
    }
    finally {
      setSaving(false)
    }
  }

  const handleEditPatient = (patient: Patient) => {
    setFormData({
      name: patient.name,
      email: patient.email || "",
      phone: patient.phone || "",
      cpf: patient.cpf || "",
      date_of_birth: patient.date_of_birth || "",
      birthday: patient.birthday || "",
      address: patient.address || "",
      notes: patient.notes || "",
    })
    setEditingId(patient.id)
    setShowForm(true)
  }

  const handleDeletePatient = async (id: string) => {
    const toastId = toast({
      title: t('toast.confirmDelete'),
      description: t('toast.confirmDeleteDesc'),
      action: (
        <ToastAction
          altText={t('toast.delete')}
          onClick={async () => {
            try {
              // toastId.update({ id: toastId.id, title: t('toast.deleting'), description: "Aguarde" } as any)
              await deletePatient(id)
              toast({ title: t('toast.deleted'), description: t('toast.deletedDesc') })
              await loadPatients()
            } catch (error) {
              toast({
                title: t('toast.deleteError'),
                description: error instanceof Error ? error.message : t('common.error'),
                variant: "destructive",
              })
            }
          }}
        >
          {t('toast.delete')}
        </ToastAction>
      ),
    })
  }

  const handleStatusChange = async (id: string, newStatus: "active" | "inactive") => {
    try {
      await updatePatientStatus(id, newStatus)
      toast({
        title: t('toast.statusUpdated'),
        description: t('toast.statusUpdatedDesc', { status: newStatus === "active" ? t('status.active') : t('status.inactive') }),
      })
      await loadPatients()
    } catch (error) {
      toast({
        title: t('toast.statusError'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      })
    }
  }

  const handleViewProfile = (patientId: string) => {
    setSelectedPatientId(patientId)
    setShowProfileModal(true)
  }

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (patient.email && patient.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.cpf && patient.cpf.includes(searchTerm))
    const matchesStatus = filterStatus === "all" || patient.status === filterStatus
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null)
            setFormData({
              name: "",
              email: "",
              phone: "",
              cpf: "",
              date_of_birth: "",
              birthday: "",
              address: "",
              notes: "",
            })
            setShowForm(!showForm)
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          {t('newPatient')}
        </Button>
      </div>

      <PlanLimitBanner
        currentCount={patients.length}
        limitType="patients"
        onUpgrade={() => router.push("/dashboard?tab=subscriptions")}
      />

      {showForm && (
        <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-secondary/5">
          <h3 className="text-lg font-bold text-foreground mb-4">{editingId ? t('editPatient') : t('newPatient')}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              placeholder={t('form.name')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-background"
            />
            <Input
              type="email"
              placeholder={t('form.email')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-background"
            />
            <Input
              placeholder={t('form.phone')}
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="bg-background"
            />
            <Input
              placeholder={t('form.cpf')}
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              className="bg-background"
            />
            <Input
              type="date"
              placeholder={t('form.birthday')}
              value={formData.birthday || formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value, date_of_birth: e.target.value })}
              className="bg-background"
            />
            <Input
              placeholder={t('form.address')}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="bg-background"
            />
            <Input
              placeholder={t('form.notes')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="sm:col-span-2 bg-background"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleAddPatient} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingId ? t('form.updating') : t('form.saving')}
                </>
              ) : (
                editingId ? t('form.update') : t('form.save')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false)
                setEditingId(null)
              }}
            >
              {t('form.cancel')}
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant={filterStatus === "all" ? "default" : "outline"} onClick={() => setFilterStatus("all")}>
            {t('filter.all')}
          </Button>
          <Button variant={filterStatus === "active" ? "default" : "outline"} onClick={() => setFilterStatus("active")}>
            {t('filter.active')}
          </Button>
          <Button
            variant={filterStatus === "inactive" ? "default" : "outline"}
            onClick={() => setFilterStatus("inactive")}
          >
            {t('filter.inactive')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => (
            <Card key={patient.id} className="p-4 sm:p-6 border border-border hover:shadow-lg transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={patient.profile_photo_url || undefined} alt={patient.name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-semibold">
                        {patient.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground text-lg">{patient.name}</h3>
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${patient.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                      >
                        {patient.status === "active" ? t('status.active') : t('status.inactive')}
                      </span>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-3">
                    {patient.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        {patient.email}
                      </div>
                    )}
                    {patient.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        {patient.phone}
                      </div>
                    )}
                    {patient.cpf && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        CPF: {patient.cpf}
                      </div>
                    )}
                    {(patient.date_of_birth || patient.birthday) && (
                      <div className="text-sm text-muted-foreground">
                        {t('form.birthday')}: {
                          new Date(
                            `${(patient.birthday ?? patient.date_of_birth) || ""}T00:00:00`
                          ).toLocaleDateString("pt-BR") // Keep locale fixed for date format consistency or change to user locale if desired
                        }
                      </div>
                    )}
                  </div>

                  {patient.address && <p className="text-sm text-muted-foreground mb-2">{t('form.address')}: {patient.address}</p>}
                  {patient.notes && <p className="text-sm text-muted-foreground italic">{t('form.notes')}: {patient.notes}</p>}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleViewProfile(patient.id)}
                    className="flex-1 sm:flex-none gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    {t('viewProfile')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPatient(patient)}
                    className="flex-1 sm:flex-none"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePatient(patient.id)}
                    className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-8 border border-border text-center">
            <p className="text-muted-foreground">{t('empty')}</p>
            <Button onClick={() => setShowForm(true)} className="mt-4" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('createFirst')}
            </Button>
          </Card>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentPlan={currentPlan}
        limitType="patients"
        currentCount={patients.length}
      />

      <PatientProfileModal
        patientId={selectedPatientId}
        isOpen={showProfileModal}
        onClose={() => {
          setShowProfileModal(false)
          setSelectedPatientId(null)
        }}
        onUpdate={loadPatients}
      />
    </div>
  )
}
