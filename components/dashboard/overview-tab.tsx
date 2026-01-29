"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Calendar,
  Users,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertCircle,
  Loader2,
  Plus,
  Cake,
  Briefcase,
  PlayCircle,
} from "lucide-react"
import {
  getDashboardStats,
  getUpcomingAppointments,
  getRecentPatients,
  getTodayBirthdays,
} from "@/app/actions/dashboard"
import { useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase-client"

interface OverviewTabProps {
  user: { email: string; name: string }
  onNavigate: (tab: string) => void
}

export default function OverviewTab({ user, onNavigate }: OverviewTabProps) {
  const [stats, setStats] = useState({
    appointmentsToday: 0,
    activePatients: 0,
    completionRate: 0,
    growthRate: 0,
  })
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([])
  const [recentPatients, setRecentPatients] = useState<any[]>([])
  const [birthdays, setBirthdays] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasWatchedTutorial, setHasWatchedTutorial] = useState(true)
  const t = useTranslations('dashboard.overview')
  const supabase = createClient()

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, appointmentsData, patientsData, birthdaysData] = await Promise.all([
          getDashboardStats(),
          getUpcomingAppointments(),
          getRecentPatients(),
          getTodayBirthdays(),
        ])

        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          const { data: tutorialData } = await supabase
            .from('user_settings')
            .select('has_watched_tutorial')
            .eq('user_id', currentUser.id)
            .single()
          setHasWatchedTutorial(tutorialData?.has_watched_tutorial || false)
        }

        setStats(statsData)
        setUpcomingAppointments(appointmentsData)
        setRecentPatients(patientsData)
        setBirthdays(birthdaysData)
      } catch (error) {
        console.error("Error loading dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const statsCards = [
    {
      label: t('stats.appointmentsToday'),
      value: stats.appointmentsToday.toString(),
      icon: <Calendar className="w-6 h-6" />,
      color: "from-blue-500 to-blue-600",
    },
    {
      label: t('stats.activePatients'),
      value: stats.activePatients.toString(),
      icon: <Users className="w-6 h-6" />,
      color: "from-green-500 to-green-600",
    },
    {
      label: t('stats.completionRate'),
      value: `${stats.completionRate}%`,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: "from-purple-500 to-purple-600",
    },
    {
      label: t('stats.growthMonth'),
      value: `${stats.growthRate > 0 ? "+" : ""}${stats.growthRate}%`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: "from-orange-500 to-orange-600",
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-xl p-6 sm:p-8 cursor-pointer hover:shadow-lg transition-shadow">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
          {t('welcome')}{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{user.name}</span>
        </h1>
        <p className="text-muted-foreground">{t('summary')}</p>
      </div>

      {/* Tutorial Notification */}
      {!hasWatchedTutorial && (
        <Card className="p-6 border-primary/20 bg-gradient-to-r from-primary/5 to-background">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <PlayCircle className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground mb-2">{t('newHere')}</h3>
              <p className="text-muted-foreground mb-4">
                {t('watchTutorial')}
              </p>
              <Button onClick={() => onNavigate("tutorial")} variant="outline" className="gap-2">
                <PlayCircle className="w-4 h-4" />
                {t('buttonTutorial')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 border border-border bg-card">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-secondary text-secondary-foreground">
            <Cake className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-foreground mb-2">{t('birthdays')}</h3>
            <div className="space-y-2">
              {birthdays.length > 0 ? (
                birthdays.map((person) => (
                  <div key={person.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${person.type === "client" ? "bg-blue-100 dark:bg-blue-900" : "bg-green-100 dark:bg-green-900"}`}>
                        {person.type === "client" ? (
                          <Users className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                        ) : (
                          <Briefcase className="w-4 h-4 text-green-600 dark:text-green-300" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{person.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-muted-foreground break-words">{person.phone}</p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${person.type === "client" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                              }`}
                          >
                            {person.type === "client" ? t('client') : t('professional')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-muted rounded-lg text-muted-foreground">{t('noBirthdays')}</div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <Card key={i} className="p-6 border border-border hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color} text-white`}>{stat.icon}</div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <Card className="p-6 border border-border cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">{t('upcoming.title')}</h2>
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{apt.patient}</p>
                      <p className="text-sm text-muted-foreground">{apt.professional}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{apt.time}</p>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${apt.status === "scheduled"
                          ? "bg-green-100 text-green-700"
                          : apt.status === "completed"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                          }`}
                      >
                        {apt.status === "scheduled"
                          ? t('upcoming.scheduled')
                          : apt.status === "completed"
                            ? t('upcoming.completed')
                            : t('upcoming.canceled')}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">{t('upcoming.empty')}</p>
                  <Button onClick={() => onNavigate("appointments")} size="sm" className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('upcoming.createBtn')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card className="p-6 border border-border cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">{t('recentClients.title')}</h2>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>

            <div className="space-y-3">
              {recentPatients.length > 0 ? (
                recentPatients.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.lastVisit}</p>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full ${patient.status === "active" ? "bg-green-500" : "bg-gray-300"}`}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm mb-4">{t('recentClients.empty')}</p>
                  <Button onClick={() => onNavigate("patients")} size="sm" variant="outline" className="gap-2">
                    <Plus className="w-4 h-4" />
                    {t('recentClients.addBtn')}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-secondary/5 cursor-pointer hover:shadow-lg transition-shadow">
        <h2 className="text-lg font-bold text-foreground mb-4">{t('quickActions.title')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Button
            onClick={() => onNavigate("appointments")}
            variant="outline"
            className="p-4 h-auto flex-col items-start bg-background hover:border-primary/50"
          >
            <Calendar className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-semibold text-foreground">{t('quickActions.newAppointment')}</p>
          </Button>
          <Button
            onClick={() => onNavigate("patients")}
            variant="outline"
            className="p-4 h-auto flex-col items-start bg-background hover:border-primary/50"
          >
            <Users className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-semibold text-foreground">{t('quickActions.newClient')}</p>
          </Button>
          <Button
            onClick={() => onNavigate("subscriptions")}
            variant="outline"
            className="p-4 h-auto flex-col items-start bg-background hover:border-primary/50"
          >
            <AlertCircle className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-semibold text-foreground">{t('quickActions.settings')}</p>
          </Button>
          <Button
            onClick={() => onNavigate("reports")}
            variant="outline"
            className="p-4 h-auto flex-col items-start bg-background hover:border-primary/50"
          >
            <TrendingUp className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-semibold text-foreground">{t('quickActions.metrics')}</p>
          </Button>
        </div>
      </Card>
    </div>
  )
}
