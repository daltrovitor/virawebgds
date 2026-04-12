'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WeeklyView } from './weekly-view'
import CalendarAppointments from '../calendar-appointments'

export function CalendarSection() {
  const [activeView, setActiveView] = useState<'weekly' | 'monthly'>('weekly')

  return (
    <div className="w-full space-y-4">
      <Tabs 
        defaultValue="weekly" 
        className="w-full"
        onValueChange={(value) => setActiveView(value as 'weekly' | 'monthly')}
      >
        <div className="flex justify-between items-center mb-4">
          <TabsList className="grid w-full max-w-[400px] grid-cols-2">
            <TabsTrigger value="weekly">Visualização Semanal</TabsTrigger>
            <TabsTrigger value="monthly">Visualização Mensal</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="weekly" className="mt-4">
          <WeeklyView
            appointments={[]}
            professionals={[]}
            selectedProfessional={""}
            onSelectProfessional={() => {}}
          />
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <CalendarAppointments />
        </TabsContent>
      </Tabs>
    </div>
  )
}
