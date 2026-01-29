"use client"

import { useState, useEffect } from "react"
// Importando os subcomponentes do Card
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription, // Importado para uso futuro, embora não usado nos stats
} from "@/components/ui/card"
import { Loader2, BarChart3, Users, CheckCircle2 } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import {
  getDashboardStats,
  getAppointmentsByMonth,
  getPatientGrowth,
} from "@/app/actions/reports"

// Definindo tipos para os dados (boa prática)
interface Stats {
  totalAppointments: number
  activePatients: number
  completionRate: number
}

interface AppointmentData {
  month: string
  completed: number
  cancelled: number
}

interface PatientData {
  month: string
  totalPatients: number
  newPatients: number
}

export default function ReportsTab() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({
    totalAppointments: 0,
    activePatients: 0,
    completionRate: 0,
  })
  const [appointmentData, setAppointmentData] = useState<AppointmentData[]>([])
  const [patientData, setPatientData] = useState<PatientData[]>([])
  const t = useTranslations("dashboard.reports")

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, appointmentsData, patientsData] = await Promise.all([
          getDashboardStats(),
          getAppointmentsByMonth(),
          getPatientGrowth(),
        ])

        setStats(statsData)
        setAppointmentData(appointmentsData)
        setPatientData(patientsData)
      } catch (error) {
        console.error("Error loading reports data:", error)
        // Aqui você poderia definir um estado de erro para exibir na UI
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Título da Página */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Cards de resumo refatorados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("stats.totalAppointments")}
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">
              {stats.totalAppointments}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.totalAppointmentsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("stats.activePatients")}
            </CardTitle>
            <Users className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl text-emerald-500 font-bold">{stats.activePatients}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("stats.activePatientsDesc")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("stats.completionRate")}
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">
              {stats.completionRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completionRate >= 90
                ? t("stats.performanceExcellent")
                : t("stats.performanceGood")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos refatorados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("appointmentsChart")}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2"> {/* Padding ajustado para o gráfico */}
            {appointmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={appointmentData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="completed"
                    fill="#10b981"
                    name={t("completed")}
                    radius={[4, 4, 0, 0]} // Cantos arredondados
                  />
                  <Bar
                    dataKey="cancelled"
                    fill="#ef4444"
                    name={t("cancelled")}
                    radius={[4, 4, 0, 0]} // Cantos arredondados
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("patientsChart")}</CardTitle>
          </CardHeader>
          <CardContent className="pl-2"> {/* Padding ajustado para o gráfico */}
            {patientData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={patientData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalPatients"
                    stroke="#2563eb"
                    strokeWidth={2}
                    name={t("total")}
                  />
                  <Line
                    type="monotone"
                    dataKey="newPatients"
                    stroke="#facc15"
                    strokeWidth={2}
                    name={t("new")}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
