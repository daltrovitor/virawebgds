"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface WeeklyCalendarProps {
  value?: Date
  onChange?: (date: Date) => void
  appointments?: Array<{
    id: string
    title: string
    start: string
    end: string
    color?: string
  }>
}

export default function WeeklyCalendar({ value = new Date(), onChange, appointments = [] }: WeeklyCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(value)
  const [weekDates, setWeekDates] = useState<Date[]>([])
  
  const timeSlots = Array.from({ length: 24 }, (_, i) => i)
  const hourLabels = timeSlots.map(hour => 
    `${hour.toString().padStart(2, '0')}:00`
  )

  useEffect(() => {
    const dates = getWeekDates(selectedDate)
    setWeekDates(dates)
  }, [selectedDate])

  const getWeekDates = (date: Date) => {
    const start = new Date(date)
    start.setDate(start.getDate() - start.getDay()) // Start from Sunday
    
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      return day
    })
  }

  const formatDay = (date: Date) => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return {
      dayName: days[date.getDay()],
      dayNumber: date.getDate(),
      isToday: isSameDay(date, new Date())
    }
  }

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear()
  }

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() - 7)
    setSelectedDate(newDate)
    onChange?.(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(selectedDate.getDate() + 7)
    setSelectedDate(newDate)
    onChange?.(newDate)
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            {weekDates[0]?.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="outline" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[auto_repeat(7,1fr)] border rounded-lg overflow-hidden">
        {/* Time labels column */}
        <div className="border-r">
          <div className="h-12 border-b"></div> {/* Empty corner cell */}
          {hourLabels.map((hour) => (
            <div key={hour} className="h-12 border-b px-2 flex items-center text-sm text-muted-foreground">
              {hour}
            </div>
          ))}
        </div>

        {/* Days columns */}
        {weekDates.map((date, dayIndex) => {
          const { dayName, dayNumber, isToday } = formatDay(date)
          return (
            <div key={dayIndex} className="border-r last:border-r-0">
              {/* Day header */}
              <div className={`h-12 border-b p-1 text-center ${isToday ? 'bg-primary/5' : ''}`}>
                <div className="text-sm font-medium">{dayName}</div>
                <div className={`text-lg ${isToday ? 'text-primary font-bold' : ''}`}>{dayNumber}</div>
              </div>

              {/* Time slots */}
              {timeSlots.map((hour) => (
                <div key={hour} className="h-12 border-b hover:bg-muted/50 transition-colors">
                  {/* Add appointment rendering logic here */}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
