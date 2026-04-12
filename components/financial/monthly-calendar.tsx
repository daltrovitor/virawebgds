"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

interface MonthlyCalendarProps {
  initialDate?: Date
  selected?: Date | undefined
  onSelect?: (date: Date | undefined) => void
  scheduledDates?: Array<string | Date> // array of 'YYYY-MM-DD' or Date
}

export default function MonthlyCalendar({ initialDate = new Date(), selected, onSelect, scheduledDates = [] }: MonthlyCalendarProps) {
  const t = useTranslations("common")
  const [currentDate, setCurrentDate] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1))

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const formatDate = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const monthNames = [
    t("months.0"),
    t("months.1"),
    t("months.2"),
    t("months.3"),
    t("months.4"),
    t("months.5"),
    t("months.6"),
    t("months.7"),
    t("months.8"),
    t("months.9"),
    t("months.10"),
    t("months.11"),
  ]

  const dayNames = [
    t("days.0"),
    t("days.1"),
    t("days.2"),
    t("days.3"),
    t("days.4"),
    t("days.5"),
    t("days.6"),
  ]

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDay = getFirstDayOfMonth(currentDate)

  const calendarDays: Array<number | null> = []
  for (let i = 0; i < firstDay; i++) calendarDays.push(null)
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day)

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))

  const handleDayClick = (day: number | null) => {
    if (!day) return
    const dateStr = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
    const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    if (selected && selected instanceof Date) {
      const selStr = formatDate(selected.getFullYear(), selected.getMonth(), selected.getDate())
      if (selStr === dateStr) {
        // toggle off
        onSelect?.(undefined)
        return
      }
    }
    onSelect?.(dateObj)
  }

  const isScheduled = (day: number | null) => {
    if (!day) return false
    const d = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
    // normalize scheduledDates to strings YYYY-MM-DD
    return scheduledDates.some(sd => {
      if (!sd) return false
      if (typeof sd === 'string') return sd === d
      if (sd instanceof Date) {
        const s = formatDate(sd.getFullYear(), sd.getMonth(), sd.getDate())
        return s === d
      }
      return false
    })
  }

  const isSelected = (day: number | null) => {
    if (!day || !selected) return false
    const d = formatDate(currentDate.getFullYear(), currentDate.getMonth(), day)
    const s = formatDate(selected.getFullYear(), selected.getMonth(), selected.getDate())
    return d === s
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} className="p-2">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="font-medium">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </div>
          <Button variant="outline" size="sm" onClick={handleNextMonth} className="p-2">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, index) => {
          const scheduled = day ? isScheduled(day) : false
          const isSel = isSelected(day)
          const isToday = day ? (new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear()) : false

          if (!day) return <div key={index} className="w-9 h-9" />

          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              className={`w-9 h-9 flex items-center justify-center text-sm font-medium transition-colors relative ${isSel
                  ? "bg-blue-500 text-white rounded-full shadow-sm ring-1 ring-blue-300"
                  : "bg-transparent text-muted-foreground rounded-md hover:bg-white/5"
                }`}
            >
              <span className="leading-none">{day}</span>

              {isToday && !isSel && <span className="absolute -top-2 -right-2 w-2 h-2 rounded-full ring-2 ring-blue-300 bg-blue-500" />}

              {scheduled && !isSel && <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-blue-400" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
