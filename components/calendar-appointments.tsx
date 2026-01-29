"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Plus, Trash2, Edit2, Clock, CheckCircle2, XCircle, Loader2, CalendarDays, Calendar as CalendarIcon } from "lucide-react"
import WeeklyCalendar from "@/components/weekly-calendar"
import { WeeklyView } from "@/components/appointments/weekly-view"
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  updateAppointmentStatus,
} from "@/app/actions/appointments"
import { getPatients } from "@/app/actions/patients"
import { getProfessionals } from "@/app/actions/professionals"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import { useTranslations, useLocale } from 'next-intl'

interface Appointment {
  id: string
  user_id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export default function CalendarAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([])
  const [professionals, setProfessionals] = useState<Array<{ id: string; name: string }>>([])
  const [selectedProfessional, setSelectedProfessional] = useState<string | "all">("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('dashboard.appointments')
  const locale = useLocale()

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    patient_id: "",
    professional_id: "",
    appointment_date: "",
    appointment_time: "",
    duration_minutes: 60,
    notes: "",
    recurrence_type: "none",
    recurrence_weekdays: [] as number[],
    recurrence_count: 1,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [appointmentsData, patientsData, professionalsData] = await Promise.all([
        getAppointments(),
        getPatients(),
        getProfessionals(),
      ])
      setAppointments(appointmentsData)
      setPatients(patientsData.map((p) => ({ id: p.id, name: p.name })))
      setProfessionals(professionalsData.map((p) => ({ id: p.id, name: p.name })))
    } catch (error) {
      toast({
        title: t('toast.loadError'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const getAppointmentsForDate = (dateStr: string) => {
    return appointments.filter((apt) => {
      if (apt.appointment_date !== dateStr) return false
      if (selectedProfessional === "all") return true
      return apt.professional_id === selectedProfessional
    })
  }

  const selectedDateAppointments = getAppointmentsForDate(selectedDate)

  const calendarDays = []
  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)

  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day)
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  const handleDayClick = (day: number) => {
    const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)

    // If the user clicks the already-selected day, force a state change so
    // the UI updates again (useful after opening/closing a modal or form where
    // the selected date didn't change). We briefly clear the selection and
    // then reset it on the next tick to trigger re-rendering logic that
    // depends on `selectedDate`.
    if (dateStr === selectedDate) {
      setSelectedDate("")
      // next tick, restore the date to trigger components that watch selectedDate
      setTimeout(() => setSelectedDate(dateStr), 0)
      return
    }

    setSelectedDate(dateStr)
  }

  const handleAddAppointment = async () => {
    if (formData.patient_id && formData.professional_id && formData.appointment_date && formData.appointment_time) {
      try {
        setIsSaving(true)
        if (editingId) {
          const updated = await updateAppointment(editingId, formData)
          setAppointments(appointments.map((a) => (a.id === editingId ? updated : a)))
          toast({
            title: t('toast.updated'),
            description: t('toast.updatedDesc'),
          })
        } else {
          const payload: any = {
            patient_id: formData.patient_id,
            professional_id: formData.professional_id,
            appointment_date: formData.appointment_date,
            appointment_time: formData.appointment_time,
            duration_minutes: formData.duration_minutes,
            notes: formData.notes,
          }

          if (formData.recurrence_type && formData.recurrence_type !== 'none') {
            payload.recurrence = {
              type: formData.recurrence_type,
              weekdays: formData.recurrence_weekdays || [],
              count: formData.recurrence_count || 1,
            }
          }

          const newAppointment = await createAppointment(payload)
          // createAppointment may return a single appointment or an array when recurring
          if (Array.isArray(newAppointment)) {
            setAppointments([...appointments, ...newAppointment])
          } else {
            setAppointments([...appointments, newAppointment])
          }

          toast({
            title: t('toast.created'),
            description: t('toast.createdDesc'),
          })
        }
        setFormData({
          patient_id: "",
          professional_id: "",
          appointment_date: "",
          appointment_time: "",
          duration_minutes: 60,
          notes: "",
          recurrence_type: "none",
          recurrence_weekdays: [],
          recurrence_count: 1,
        })
        setEditingId(null)
        setShowForm(false)
      } catch (error) {
        toast({
          title: t('toast.saveError'),
          description: error instanceof Error ? error.message : t('common.error'),
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setFormData({
      patient_id: appointment.patient_id,
      professional_id: appointment.professional_id,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      duration_minutes: appointment.duration_minutes,
      notes: appointment.notes || "",
      // existing appointments don't have recurrence stored yet, default to none
      recurrence_type: "none",
      recurrence_weekdays: [],
      recurrence_count: 1,
    })
    setEditingId(appointment.id)
    setShowForm(true)
  }

  const handleDeleteAppointment = async (id: string) => {
    const toastId = toast({
      title: t('toast.confirmDelete'),
      description: t('toast.confirmDeleteDesc'),
      action: (
        <ToastAction
          altText={t('toast.delete')}
          onClick={async () => {
            try {
              // toastId.update({ id: toastId.id, title: t('toast.deleting'), description: "Aguarde" } as any)
              await deleteAppointment(id)
              setAppointments(appointments.filter((a) => a.id !== id))
              toast({ title: t('toast.deleted'), description: t('toast.deletedDesc') })
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateAppointmentStatus(id, newStatus)
      setAppointments(appointments.map((a) => (a.id === id ? { ...a, status: newStatus } : a)))
      toast({
        title: t('toast.statusUpdated'),
        description: t('toast.statusUpdatedDesc'),
      })
    } catch (error) {
      toast({
        title: t('toast.statusError'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Clock className="w-4 h-4" />
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />
      case "cancelled":
        return <XCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-700 border-blue-200"
      case "completed":
        return "bg-green-100 text-green-700 border-green-200"
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getDayNames = () => {
    // Generate day names based on locale
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    const days = []
    // Start from Sunday (which is often index 0 in some contexts, but let's just pick a known week)
    // Jan 5 2025 is Sunday
    for (let i = 5; i < 12; i++) {
      const date = new Date(2025, 0, i)
      days.push(formatter.format(date))
    }
    return days
  }

  const dayNames = getDayNames()

  const getPatientName = (patientId: string) => {
    return patients.find((p) => p.id === patientId)?.name || "Cliente não encontrado"
  }

  const getProfessionalName = (professionalId: string) => {
    return professionals.find((p) => p.id === professionalId)?.name || "Profissional não encontrado"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditingId(null)
            setFormData({
              patient_id: "",
              professional_id: "",
              appointment_date: selectedDate,
              appointment_time: "",
              duration_minutes: 60,
              notes: "",
              recurrence_type: "none",
              recurrence_weekdays: [],
              recurrence_count: 1,
            })
            setShowForm(!showForm)
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          {t('newAppointment')}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-secondary/5">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {editingId ? t('editAppointment') : t('newAppointment')}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <select
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('form.patient')}</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            <select
              value={formData.professional_id}
              onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('form.professional')}</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={formData.appointment_date}
              onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
              className="bg-background"
            />
            <Input
              type="time"
              value={formData.appointment_time}
              onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
              className="bg-background"
            />
            <Input
              type="number"
              placeholder={t('form.duration')}
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: Number.parseInt(e.target.value) || 60 })}
              className="bg-background"
            />
            <Input
              placeholder={t('form.notes')}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="bg-background"
            />

            {/* Recurrence options */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">{t('form.recurrence.label')}</label>
              <select
                value={formData.recurrence_type}
                onChange={(e) => setFormData({ ...formData, recurrence_type: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="none">{t('form.recurrence.none')}</option>
                <option value="daily">{t('form.recurrence.daily')}</option>
                <option value="weekly">{t('form.recurrence.weekly')}</option>
                <option value="monthly">{t('form.recurrence.monthly')}</option>
              </select>
            </div>

            {formData.recurrence_type === 'weekly' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-2">{t('form.recurrence.days')}</label>
                <div className="flex gap-2 flex-wrap">
                  {dayNames.map((d, idx) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const idxDay = idx // 0..6
                        const current = formData.recurrence_weekdays || []
                        if (current.includes(idxDay)) {
                          setFormData({ ...formData, recurrence_weekdays: current.filter((c) => c !== idxDay) })
                        } else {
                          setFormData({ ...formData, recurrence_weekdays: [...current, idxDay] })
                        }
                      }}
                      className={`px-2 py-1 border rounded ${formData.recurrence_weekdays?.includes(idx) ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formData.recurrence_type !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('form.recurrence.count')}</label>
                <Input
                  type="number"
                  min={1}
                  value={formData.recurrence_count}
                  onChange={(e) => setFormData({ ...formData, recurrence_count: Number.parseInt(e.target.value) || 1 })}
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleAddAppointment}
              disabled={isSaving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('form.saving')}
                </>
              ) : editingId ? (
                t('form.update')
              ) : (
                t('form.save')
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

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1 p-6 border border-border">
          {/* Professional filter on top */}


          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
              <div className="flex-1">
                <h3 className="font-bold text-foreground capitalize">
                  {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentDate)}
                </h3>
                <p className="text-xs text-muted-foreground">{t('calendar.selectDay')}</p>
              </div>

              {/* Professional filter: stack under title on mobile, inline on desktop */}
              <div className="w-full sm:w-44 mt-2 sm:mt-0">
                <Select value={selectedProfessional} onValueChange={(v) => setSelectedProfessional(v as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('filter.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('filter.all')}</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="cursor-pointer">{p.name}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div />
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-3">
            {calendarDays.map((day, index) => {
              const dateStr = day ? formatDate(currentDate.getFullYear(), currentDate.getMonth(), day) : null
              const dayAppointments = dateStr ? getAppointmentsForDate(dateStr) : []
              const isSelected = dateStr === selectedDate
              const now = new Date()
              const isToday = dateStr === formatDate(now.getFullYear(), now.getMonth(), now.getDate())

              if (!day) {
                return <div key={index} className="w-10 h-10" />
              }

              return (
                <button
                  key={index}
                  onClick={() => handleDayClick(day)}
                  className={`w-10 h-10 flex flex-col cursor-pointer items-center justify-center text-sm font-medium transition-all relative ${isSelected
                    ? "bg-primary text-primary-foreground rounded-full shadow-lg"
                    : "bg-background rounded-md border border-border hover:bg-primary/5"
                    }`}
                >
                  <span className="leading-none">{day}</span>

                  {/* Today indicator (small dot) */}
                  {isToday && !isSelected && (
                    <span className="absolute -top-2 -right-2 w-2 h-2 rounded-full ring-2 ring-primary/40 bg-primary" />
                  )}

                  {/* Appointment count under the number; hide when the day is selected */}
                  {dayAppointments.length > 0 && !isSelected && (
                    <span className="mt-1 text-[11px] text-primary">{dayAppointments.length} </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Month navigation below the calendar */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={handlePrevMonth} className="p-2">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextMonth} className="p-2">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Appointments for selected date */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-foreground mb-4">
              {t('calendar.appointmentsOf')} {new Date(selectedDate + "T00:00:00").toLocaleDateString(locale)}
            </h3>

            {selectedDateAppointments.length > 0 ? (
              <div className="space-y-3">
                {selectedDateAppointments
                  .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
                  .map((appointment) => (
                    <Card key={appointment.id} className="p-4 border border-border hover:shadow-lg transition-shadow">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-bold text-foreground">{getPatientName(appointment.patient_id)}</h4>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(appointment.status)}`}
                            >
                              {getStatusIcon(appointment.status)}
                              {appointment.status === "scheduled" && t('status.scheduled')}
                              {appointment.status === "completed" && t('status.completed')}
                              {appointment.status === "cancelled" && t('status.cancelled')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {appointment.appointment_time} - {getProfessionalName(appointment.professional_id)} (
                            {appointment.duration_minutes} min)
                          </p>
                          {appointment.notes && (
                            <p className="text-sm text-muted-foreground italic">{appointment.notes}</p>
                          )}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditAppointment(appointment)}
                            className="flex-1 sm:flex-none"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAppointment(appointment.id)}
                            className="flex-1 sm:flex-none text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>

                          {appointment.status === "scheduled" && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(appointment.id, "completed")}
                              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white"
                            >
                              {t('status.complete')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card className="p-8 border border-border text-center">
                <p className="text-muted-foreground">{t('emptyDay')}</p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Calendar View */}
      <div className="mt-8 border-t pt-8">
        <h3 className="text-lg font-semibold mb-4">{t('tabs.weekly')}</h3>
        <WeeklyView
          appointments={appointments.map(apt => ({
            ...apt,
            id: apt.id.toString(),
            user_id: apt.user_id.toString(),
            patient_id: apt.patient_id.toString(),
            professional_id: apt.professional_id.toString()
          }))}
          professionals={professionals.map(prof => ({
            id: prof.id.toString(),
            name: prof.name
          }))}
          selectedProfessional={selectedProfessional}
          onSelectProfessional={setSelectedProfessional}
        />
      </div>
    </div>
  )
}
