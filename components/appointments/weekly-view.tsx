'use client'

import React, { useState } from 'react'
import { useTheme } from 'next-themes'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useToast } from "@/hooks/use-toast"
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

interface WeeklyViewProps {
  appointments: Appointment[]
  professionals: Array<{ id: string; name: string }>
  selectedProfessional: string
  onSelectProfessional: (value: string) => void
}

export function WeeklyView({
  appointments,
  professionals,
  selectedProfessional,
  onSelectProfessional
}: WeeklyViewProps): React.ReactElement {
  const { theme } = useTheme();
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const t = useTranslations('dashboard.appointments.weeklyView')
  const locale = useLocale()

  // Get start and end of week
  const startOfWeek = new Date(currentWeek)
  startOfWeek.setDate(currentWeek.getDate() - currentWeek.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  // Filter appointments by professional and current week
  const filteredAppointments = appointments?.filter(appointment => {
    const appointmentDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`)
    const isInWeek = appointmentDate >= startOfWeek && appointmentDate <= endOfWeek
    return (selectedProfessional === "all" || appointment.professional_id === selectedProfessional) && isInWeek
  })

  // Generate time slots from 8:00 to 18:00
  const timeSlots = Array.from({ length: 11 }, (_, i) => {
    const hour = i + 8
    return `${hour.toString().padStart(2, '0')}:00`
  })

  // Generate weekday headers
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    return day
  })

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <Select
          value={selectedProfessional}
          onValueChange={onSelectProfessional}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder={t('placeholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allProfessionals')}</SelectItem>
            {professionals?.map((professional) => (
              <SelectItem key={professional.id} value={professional.id}>
                {professional.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 md:gap-2">
          <button
            onClick={() => {
              const prevWeek = new Date(currentWeek)
              prevWeek.setDate(currentWeek.getDate() - 7)
              setCurrentWeek(prevWeek)
            }}
            className="px-2 md:px-4 py-2 border rounded-md hover:bg-gray-100 text-xs md:text-sm whitespace-nowrap"
          >
            <span className="hidden md:inline">{t('prevWeek')}</span>
            <span className="md:hidden">{t('prev')}</span>
          </button>
          <button
            onClick={() => setCurrentWeek(new Date())}
            className="px-2 md:px-4 py-2 border rounded-md hover:bg-gray-100 text-xs md:text-sm"
          >
            {t('today')}
          </button>
          <button
            onClick={() => {
              const nextWeek = new Date(currentWeek)
              nextWeek.setDate(currentWeek.getDate() + 7)
              setCurrentWeek(nextWeek)
            }}
            className="px-2 md:px-4 py-2 border rounded-md hover:bg-gray-100 text-xs md:text-sm whitespace-nowrap"
          >
            <span className="hidden md:inline">{t('nextWeek')}</span>
            <span className="md:hidden">{t('next')}</span>
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[320px] md:min-w-[800px]">
          {/* Calendar Header */}
          <div className="grid grid-cols-8 gap-1 md:gap-2 mb-2 text-xs md:text-base">
            <div className="p-1 md:p-2 font-semibold text-center">{t('hour')}</div>
            {weekDays.map((day, index) => (
              <div
                key={index}
                className="p-1 md:p-2 font-semibold text-center"
              >
                <span className="hidden md:inline">
                  {day.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}
                </span>
                <span className="md:hidden">
                  {day.toLocaleDateString(locale, { weekday: 'short' }).substring(0, 3)}
                  <br />
                  {day.getDate()}
                </span>
              </div>
            ))}
          </div>

          {/* Time Slots */}
          <div className="space-y-1">
            {timeSlots.map((time) => (
              <div key={time} className="grid grid-cols-8 gap-1 md:gap-2">
                <div className="p-1 md:p-2 text-xs md:text-sm text-center border-r">{time}</div>
                {weekDays.map((day, dayIndex) => {
                  const currentSlotDate = new Date(day)
                  const [hours] = time.split(':')
                  currentSlotDate.setHours(parseInt(hours), 0, 0, 0)

                  const appointmentsInSlot = filteredAppointments?.filter(
                    (apt) => {
                      const aptDate = new Date(`${apt.appointment_date}T${apt.appointment_time}`)
                      return (
                        aptDate.getFullYear() === currentSlotDate.getFullYear() &&
                        aptDate.getMonth() === currentSlotDate.getMonth() &&
                        aptDate.getDate() === currentSlotDate.getDate() &&
                        aptDate.getHours() === currentSlotDate.getHours()
                      )
                    }
                  )

                  return (
                    <div
                      key={dayIndex}
                      className={cn(
                        "p-1 md:p-2 text-xs md:text-sm border rounded-md min-h-[40px] md:min-h-[60px]",
                        appointmentsInSlot && appointmentsInSlot.length > 0
                          ? " hover:bg-gray-50 cursor-pointer"
                          : "hover:bg-gray-50 "
                      )}
                    >
                      {appointmentsInSlot?.map((apt) => (
                        <div
                          key={apt.id}
                          className={
                            `rounded-xl p-3 mb-2 shadow  flex flex-col gap-2 w-full md:h-full h-10 min-w-0 ` +
                            (theme === 'dark' ? 'bg-primary  text-white' : 'bg-primary  text-white')
                          }
                        >
                          <div className="flex items-center justify-between mb-1 w-full">
                            <span className={`font-bold text-sm md:text-base ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
                              {professionals.find(p => p.id === apt.professional_id)?.name || t('client')}
                            </span>
                          </div>
                          <div className={`text-xs md:block hidden md:text-sm mb-1 ${theme === 'dark' ? 'text-white' : 'text-white'}`}>
                            {apt.appointment_time} - {apt.notes || t('noDescription')} ({apt.duration_minutes} min)
                          </div>

                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
