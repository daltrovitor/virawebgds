// Hello World
'use client'

import React, { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslations, useLocale } from 'next-intl'
import {
  Clock,
  User,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  ExternalLink,
} from 'lucide-react'

export interface Appointment {
  id: string
  user_id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: string
  notes: string | null
  planned_procedure?: string | null
  occurrence?: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyViewProps {
  appointments: Appointment[]
  professionals: Array<{ id: string; name: string }>
  patients?: Array<{ id: string; name: string }>
  selectedProfessional: string
  onSelectProfessional: (value: string) => void
  onSelectPatient?: (patientId: string) => void
  onEditAppointment?: (appointment: Appointment) => void
  onSlotClick?: (date: string, time: string) => void
  onStatusChange?: (id: string, status: string) => void
  onDeleteAppointment?: (id: string) => void
}

export function WeeklyView({
  appointments,
  professionals,
  patients = [],
  selectedProfessional,
  onSelectProfessional,
  onSelectPatient,
  onEditAppointment,
  onSlotClick,
  onStatusChange,
  onDeleteAppointment,
}: WeeklyViewProps): React.ReactElement {
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null)
  const t = useTranslations('dashboard.appointments.weeklyView')
  const locale = useLocale()
  const isEn = locale === 'en'

  // Get start and end of week (Sunday to Saturday)
  const startOfWeek = new Date(currentWeek)
  startOfWeek.setDate(currentWeek.getDate() - currentWeek.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // Filter appointments by professional and current week
  const filteredAppointments = appointments?.filter((appointment) => {
    const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`)
    const isInWeek = appointmentDate >= startOfWeek && appointmentDate <= endOfWeek
    return (selectedProfessional === 'all' || appointment.professional_id === selectedProfessional) && isInWeek
  })

  // Generate time slots from 07:00 to 19:00
  const timeSlots = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 7
    if (isEn) {
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const h12 = hour % 12 || 12
      return `${h12}:00 ${ampm}`
    }
    return `${hour.toString().padStart(2, '0')}:00`
  })

  // Generate 7 days of the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    return day
  })

  const formatDateIso = (d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const getPatientName = (patientId: string) => {
    return patients?.find((p) => p.id === patientId)?.name || 'Cliente'
  }

  const getProfessionalName = (profId: string) => {
    return professionals?.find((p) => p.id === profId)?.name || ''
  }

  const getWeekRangeLabel = () => {
    const startStr = startOfWeek.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    const endStr = endOfWeek.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    return `${startStr} – ${endStr}`
  }

  const activePatientName = activeAppointment ? getPatientName(activeAppointment.patient_id) : ''
  const activeProfName = activeAppointment ? getProfessionalName(activeAppointment.professional_id) : ''

  return (
    <div className="w-full space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <Select value={selectedProfessional} onValueChange={onSelectProfessional}>
            <SelectTrigger className="w-full sm:w-[220px] bg-white cursor-pointer h-10">
              <SelectValue placeholder={t('placeholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allProfessionals')}</SelectItem>
              {professionals?.map((professional) => (
                <SelectItem key={professional.id} value={professional.id} className="cursor-pointer">
                  {professional.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="hidden md:inline-block text-sm font-semibold text-slate-700 capitalize bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
            {getWeekRangeLabel()}
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const prevWeek = new Date(currentWeek)
              prevWeek.setDate(currentWeek.getDate() - 7)
              setCurrentWeek(prevWeek)
            }}
            className="cursor-pointer h-10 px-3 text-xs sm:text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">{t('prevWeek')}</span>
            <span className="sm:hidden">{t('prev')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeek(new Date())}
            className="cursor-pointer h-10 px-3 text-xs sm:text-sm font-medium"
          >
            {t('today')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const nextWeek = new Date(currentWeek)
              nextWeek.setDate(currentWeek.getDate() + 7)
              setCurrentWeek(nextWeek)
            }}
            className="cursor-pointer h-10 px-3 text-xs sm:text-sm font-medium"
          >
            <span className="hidden sm:inline">{t('nextWeek')}</span>
            <span className="sm:hidden">{t('next')}</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main Weekly Grid */}
      <div className="w-full overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-xs">
        <div className="min-w-[840px] p-2 sm:p-4">
          {/* Header Row: Days */}
          <div className="grid grid-cols-8 gap-2 mb-2 pb-2 border-b border-slate-200">
            <div className="p-2 font-bold text-xs uppercase tracking-wider text-slate-500 text-center flex items-center justify-center">
              <Clock className="w-4 h-4 mr-1 text-slate-400" />
              {t('hour')}
            </div>
            {weekDays.map((day, index) => {
              const isToday =
                day.getDate() === new Date().getDate() &&
                day.getMonth() === new Date().getMonth() &&
                day.getFullYear() === new Date().getFullYear()

              return (
                <div
                  key={index}
                  className={cn(
                    'p-2 text-center rounded-lg transition-colors',
                    isToday ? 'bg-primary/10 border border-primary/30 text-primary font-bold' : 'text-slate-700'
                  )}
                >
                  <div className="text-xs uppercase font-medium text-slate-500">
                    {day.toLocaleDateString(locale, { weekday: 'short' })}
                  </div>
                  <div className="text-base sm:text-lg font-extrabold">{day.getDate()}</div>
                </div>
              )
            })}
          </div>

          {/* Time Slots Rows */}
          <div className="space-y-1">
            {timeSlots.map((timeLabel) => {
              const rawHourStr = timeLabel.split(':')[0]
              const hourNumber = parseInt(rawHourStr, 10) + (timeLabel.includes('PM') && !rawHourStr.startsWith('12') ? 12 : 0)
              const standardTimeStr = `${String(hourNumber).padStart(2, '0')}:00`

              return (
                <div key={timeLabel} className="grid grid-cols-8 gap-2">
                  {/* Time column */}
                  <div className="p-2 text-xs font-semibold text-slate-500 text-center flex items-center justify-center border-r border-slate-100 bg-slate-50/50 rounded-md">
                    {timeLabel}
                  </div>

                  {/* 7 Days columns for this hour */}
                  {weekDays.map((day, dayIndex) => {
                    const dateIso = formatDateIso(day)

                    const appointmentsInSlot = filteredAppointments?.filter((apt) => {
                      if (apt.appointment_date !== dateIso) return false
                      const aptHour = parseInt(apt.appointment_time.split(':')[0], 10)
                      return aptHour === hourNumber
                    })

                    const hasAppointments = Boolean(appointmentsInSlot && appointmentsInSlot.length > 0)

                    return (
                      <div
                        key={dayIndex}
                        onClick={() => {
                          if (!hasAppointments && onSlotClick) {
                            onSlotClick(dateIso, standardTimeStr)
                          }
                        }}
                        className={cn(
                          'p-1.5 sm:p-2 border border-slate-200/80 rounded-lg min-h-[90px] sm:min-h-[105px] transition-all flex flex-col justify-start gap-1.5 relative group',
                          hasAppointments
                            ? 'bg-slate-50/40'
                            : 'hover:bg-primary/5 hover:border-primary/40 cursor-pointer bg-white'
                        )}
                        title={!hasAppointments ? `Agendar em ${day.toLocaleDateString(locale)} às ${standardTimeStr}` : undefined}
                      >
                        {!hasAppointments && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center h-full text-primary/70 text-xs font-semibold gap-1">
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agendar</span>
                          </div>
                        )}

                        {appointmentsInSlot?.map((apt) => {
                          const patientName = getPatientName(apt.patient_id)
                          const profName = getProfessionalName(apt.professional_id)

                          const isCompleted = apt.status === 'completed'
                          const isCancelled = apt.status === 'cancelled'

                          const cardBg = isCompleted
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : isCancelled
                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                            : 'bg-primary hover:bg-primary/95 text-primary-foreground'

                          return (
                            <div
                              key={apt.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveAppointment(apt)
                              }}
                              className={cn(
                                'rounded-lg p-2.5 shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between gap-1.5 w-full border border-black/10 select-none hover:shadow-md hover:scale-[1.01]',
                                cardBg
                              )}
                            >
                              {/* CLIENT NAME BIG & PROMINENT */}
                              <div>
                                <span className="font-extrabold text-sm sm:text-base md:text-lg leading-tight block tracking-tight line-clamp-2 drop-shadow-xs">
                                  {patientName}
                                </span>
                              </div>

                              {/* Time & Professional */}
                              <div className="flex flex-col gap-0.5 text-[11px] sm:text-xs opacity-95">
                                <div className="flex items-center gap-1 font-semibold">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  <span>{apt.appointment_time} ({apt.duration_minutes}m)</span>
                                </div>
                                {profName && (
                                  <div className="truncate text-[10px] sm:text-[11px] opacity-85">
                                    {profName}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Appointment Detail Modal */}
      {activeAppointment && (
        <Dialog open={Boolean(activeAppointment)} onOpenChange={(open) => !open && setActiveAppointment(null)}>
          <DialogContent className="max-w-md bg-white border border-slate-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {activePatientName}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm text-slate-700">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-800">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span className="font-semibold">
                    {new Date(`${activeAppointment.appointment_date}T00:00:00`).toLocaleDateString(locale, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>
                    {activeAppointment.appointment_time} ({activeAppointment.duration_minutes} minutos)
                  </span>
                </div>
                {activeProfName && (
                  <div className="flex items-center gap-2 text-slate-800">
                    <User className="w-4 h-4 text-primary" />
                    <span>Profissional: <strong>{activeProfName}</strong></span>
                  </div>
                )}
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider',
                      activeAppointment.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeAppointment.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-blue-100 text-blue-800'
                    )}
                  >
                    {activeAppointment.status === 'completed'
                      ? 'Concluído'
                      : activeAppointment.status === 'cancelled'
                      ? 'Cancelado'
                      : 'Agendado'}
                  </span>
                </div>
              </div>

              {activeAppointment.planned_procedure && (
                <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-100 text-blue-950 text-xs">
                  <span className="font-bold block mb-0.5">Procedimento Planejado:</span>
                  <span>{activeAppointment.planned_procedure}</span>
                </div>
              )}

              {activeAppointment.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-semibold block mb-0.5">Observações:</span>
                  <span>{activeAppointment.notes}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                {onSelectPatient && activeAppointment.patient_id && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onSelectPatient(activeAppointment.patient_id)
                      setActiveAppointment(null)
                    }}
                    className="w-full cursor-pointer flex items-center justify-center gap-2 text-primary border-primary/30 hover:bg-primary/5"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver Ficha e Histórico do Paciente
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {onEditAppointment && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onEditAppointment(activeAppointment)
                        setActiveAppointment(null)
                      }}
                      className="cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </Button>
                  )}

                  {onStatusChange && activeAppointment.status !== 'completed' && (
                    <Button
                      onClick={() => {
                        onStatusChange(activeAppointment.id, 'completed')
                        setActiveAppointment(null)
                      }}
                      className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Concluir
                    </Button>
                  )}

                  {onDeleteAppointment && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        onDeleteAppointment(activeAppointment.id)
                        setActiveAppointment(null)
                      }}
                      className="cursor-pointer flex items-center justify-center gap-1.5 col-span-2 sm:col-span-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
