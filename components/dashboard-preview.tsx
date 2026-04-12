"use client"

import { Calendar, Users, Clock, TrendingUp, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useTranslations } from 'next-intl'

export default function DashboardPreview() {
  const t = useTranslations('dashboard.preview')

  return (
    <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background rounded-2xl p-8 border border-border">
      <div className="mb-8">
        <h3 className="text-2xl font-bold text-foreground mb-2">{t('title')}</h3>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-foreground">{t('welcome')}</h4>
            <p className="text-sm text-muted-foreground">{t('today', { date: '19/10/2026' })}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              {t('quickActions.settings')}
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Calendar, label: t('appointmentsToday'), value: "8", color: "text-blue-500" },
            { icon: Users, label: t('activeClients'), value: "124", color: "text-green-500" },
            { icon: Clock, label: t('avgTime'), value: "45 min", color: "text-purple-500" },
            { icon: TrendingUp, label: t('completionRate'), value: "94%", color: "text-orange-500" },
          ].map((metric, idx) => (
            <Card key={idx} className="p-4 border border-border">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{metric.label}</p>
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                </div>
                <metric.icon className={`w-6 h-6 ${metric.color}`} />
              </div>
            </Card>
          ))}
        </div>

        {/* Upcoming Appointments */}
        <Card className="p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-foreground">{t('nextAppointments')}</h4>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              {t('new')}
            </Button>
          </div>
          <div className="space-y-3">
            {[
              { patient: "João Silva", time: "09:00", professional: "Dr. Carlos", status: t('confirmed'), isConfirmed: true },
              { patient: "Maria Santos", time: "10:30", professional: "Dra. Ana", status: t('pending'), isConfirmed: false },
              { patient: "Pedro Costa", time: "14:00", professional: "Dr. Carlos", status: t('confirmed'), isConfirmed: true },
            ].map((apt, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{apt.patient}</p>
                  <p className="text-sm text-muted-foreground">
                    {apt.time} • {apt.professional}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${apt.isConfirmed ? "bg-green-500/20 text-green-700" : "bg-yellow-500/20 text-yellow-700"
                    }`}
                >
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('quickActions.newAppointment'), icon: Calendar },
            { label: t('quickActions.newClient'), icon: Users },
            { label: t('quickActions.reports'), icon: TrendingUp },
            { label: t('quickActions.settings'), icon: Settings },
          ].map((action, idx) => (
            <Button key={idx} variant="outline" className="h-auto flex-col py-4 bg-transparent">
              <action.icon className="w-5 h-5 mb-2" />
              <span className="text-xs text-center">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
