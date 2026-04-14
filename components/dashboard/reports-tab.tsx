"use client"

import { useState, useEffect, useRef } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { 
  Loader2, 
  BarChart3, 
  Users, 
  CheckCircle2, 
  Download, 
  TrendingUp, 
  Wallet, 
  Target, 
  Package,
  ArrowUpRight,
  ArrowDownRight,
  FileText
} from "lucide-react"
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
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  getDashboardStats,
  getAppointmentsByMonth,
  getPatientGrowth,
  getFinancialStats,
  getBudgetStats,
  getServiceStats,
  getIncomeExpenseData,
} from "@/app/actions/reports"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

// Definindo tipos para os dados
interface Stats {
  totalAppointments: number
  activePatients: number
  totalProfessionals: number
  completionRate: number
}

interface FinancialStats {
  totalIncome: number
  totalExpenses: number
  manualExpenses: number
  budgetCosts: number
  netProfit: number
}

interface BudgetStats {
  total: number
  approved: number
  pending: number
  totalValue: number
}

interface ServiceStats {
  totalServices: number
  averagePrice: number
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

interface FinancialData {
  month: string
  income: number
  expenses: number
}

export default function ReportsTab({ isDemo = false }: { isDemo?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ totalAppointments: 0, activePatients: 0, totalProfessionals: 0, completionRate: 0 })
  const [financialStats, setFinancialStats] = useState<FinancialStats>({ totalIncome: 0, totalExpenses: 0, manualExpenses: 0, budgetCosts: 0, netProfit: 0 })
  const [budgetStats, setBudgetStats] = useState<BudgetStats>({ total: 0, approved: 0, pending: 0, totalValue: 0 })
  const [serviceStats, setServiceStats] = useState<ServiceStats>({ totalServices: 0, averagePrice: 0 })
  
  const [appointmentData, setAppointmentData] = useState<AppointmentData[]>([])
  const [patientData, setPatientData] = useState<PatientData[]>([])
  const [financialData, setFinancialData] = useState<FinancialData[]>([])
  
  const t = useTranslations("dashboard.reports")
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadData() {
      if (isDemo) {
        setStats({ totalAppointments: 156, activePatients: 28, totalProfessionals: 5, completionRate: 92 })
        setFinancialStats({ totalIncome: 12500, totalExpenses: 5800, manualExpenses: 4200, budgetCosts: 1600, netProfit: 6700 })
        setBudgetStats({ total: 45, approved: 32, pending: 13, totalValue: 25000 })
        setServiceStats({ totalServices: 12, averagePrice: 150 })
        
        setAppointmentData([
          { month: "Jan", completed: 30, cancelled: 5 },
          { month: "Fev", completed: 25, cancelled: 3 },
          { month: "Mar", completed: 40, cancelled: 8 },
        ])
        setPatientData([
          { month: "Jan", totalPatients: 20, newPatients: 5 },
          { month: "Fev", totalPatients: 24, newPatients: 4 },
          { month: "Mar", totalPatients: 28, newPatients: 4 },
        ])
        setFinancialData([
          { month: "Jan", income: 4500, expenses: 1200 },
          { month: "Fev", income: 5200, expenses: 1500 },
          { month: "Mar", income: 6800, expenses: 1800 },
        ])
        setLoading(false)
        return
      }

      try {
        const [
          statsData, 
          appointmentsData, 
          patientsData, 
          finStats, 
          budStats, 
          servStats, 
          finData
        ] = await Promise.all([
          getDashboardStats(),
          getAppointmentsByMonth(),
          getPatientGrowth(),
          getFinancialStats(),
          getBudgetStats(),
          getServiceStats(),
          getIncomeExpenseData(),
        ])

        setStats(statsData)
        setAppointmentData(appointmentsData)
        setPatientData(patientsData)
        setFinancialStats(finStats)
        setBudgetStats(budStats)
        setServiceStats(servStats)
        setFinancialData(finData)
      } catch (error) {
        console.error("Error loading reports data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isDemo])

  const handlePrint = (sectionId?: string) => {
    if (sectionId) {
      const element = document.getElementById(sectionId)
      if (element) {
        // Marcamos o que queremos imprimir e o que queremos esconder
        document.body.classList.add('printing-single-section')
        const sections = document.querySelectorAll('[id^="section-"]')
        sections.forEach(s => {
          if (s.id === sectionId) {
            s.classList.add('print-target')
          } else {
            s.classList.add('print-hidden')
          }
        })
      }
    }

    // Pequeno delay para garantir que o browser registre as classes antes do print dialog
    setTimeout(() => {
      window.print()
      
      // Cleanup após o print (alguns browsers rodam isso logo após abrir o dialog, outros após fechar)
      document.body.classList.remove('printing-single-section')
      document.querySelectorAll('.print-target, .print-hidden').forEach(el => {
        el.classList.remove('print-target', 'print-hidden')
      })
    }, 50)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    )
  }

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"]

  return (
    <div className="space-y-8 p-4 md:p-6" ref={reportRef}>
      {/* Header com Ações */}      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 no-print">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-1">{t("title")}</h1>
          <p className="text-slate-500 font-medium">{t("subtitle")}</p>
        </div>
        <Button 
          onClick={handlePrint}
          className="rounded-none bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-12 font-black uppercase tracking-tighter shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          {t("downloadAll")}
        </Button>
      </div>

      <style jsx global>{`
        @media print {
          .no-print, 
          header, 
          aside,
          button,
          [role="button"],
          .print-hidden {
            display: none !important;
          }
          
          .printing-single-section .space-y-8 > div:not(.print-target) {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .p-4, .p-6, .p-8 {
            padding: 0 !important;
          }
          
          body {
            background: white !important;
          }
          
          .shadow-xl, .shadow-lg, .shadow-md {
            box-shadow: none !important;
            border: 1px solid #eee !important;
          }
          
          .max-w-7xl {
            max-width: 100% !important;
            width: 100% !important;
          }

          .print-target {
            display: block !important;
            width: 100% !important;
            border: none !important;
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
        }
      `}</style>

      {/* Seção Financeira */}
      <div id="section-financial" className="space-y-6 pt-6 border-t border-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
              {t("sections.financial")}
            </h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => handlePrint("section-financial")} className="rounded-md hover:bg-primary hover:text-white transition-all no-print">
            <Download className="h-4 w-4 mr-2" /> {t("downloadSection")}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="relative overflow-hidden border-0 shadow-lg group">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("stats.totalIncome")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600">R$ {financialStats.totalIncome.toLocaleString("pt-BR")}</span>
                <div className="flex items-center text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  12%
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="relative overflow-hidden border-0 shadow-lg group">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("stats.totalExpenses")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-rose-600">R$ {financialStats.totalExpenses.toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex flex-col gap-1.5 text-[10px] text-muted-foreground border-t border-muted pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium uppercase tracking-wider">{t("stats.manualExpenses")}:</span>
                    <span className="font-bold">R$ {financialStats.manualExpenses.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-primary uppercase tracking-wider">{t("stats.budgetCosts")}:</span>
                    <span className="font-bold text-primary">R$ {financialStats.budgetCosts.toLocaleString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-primary/10 via-background to-background group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{t("stats.netProfit")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-primary">
                R$ {financialStats.netProfit.toLocaleString("pt-BR")}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 font-medium">{t("stats.netProfitDesc")}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-xl overflow-hidden bg-white dark:bg-slate-900/50 backdrop-blur-md">
          <CardHeader className="border-b border-muted/30">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              {t("charts.financial")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] pt-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(val) => `R$${val}`} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)", background: 'rgba(255,255,255,0.9)' }}
                  formatter={(value) => [`R$ ${Number(value).toLocaleString("pt-BR")}`]}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '30px' }} />
                <Area 
                  type="monotone" 
                  dataKey="income" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorIncome)" 
                  name={t("income")} 
                />
                <Area 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorExpenses)" 
                  name={t("expenses")} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Seção CRM & Agendamentos */}
      <div id="section-crm" className="space-y-6 pt-6 border-t border-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">
              {t("sections.crm")}
            </h3>
          </div>
          <Button variant="outline" size="sm" onClick={() => handlePrint("section-crm")} className="rounded-md no-print">
            <Download className="h-4 w-4 mr-2" /> {t("downloadSection")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-primary/5 transition-all bg-white dark:bg-slate-900/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("stats.totalAppointments")}</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary opacity-50" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats.totalAppointments}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">{t("stats.totalAppointmentsDesc")}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg hover:shadow-primary/5 transition-all bg-white dark:bg-slate-900/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("stats.activePatients")}</CardTitle>
              <Users className="h-4 w-4 text-primary opacity-50" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats.activePatients}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">{t("stats.activePatientsDesc")}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg hover:shadow-primary/5 transition-all bg-white dark:bg-slate-900/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("stats.totalProfessionals")}</CardTitle>
              <Users className="h-4 w-4 text-blue-500 opacity-50" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats.totalProfessionals}</div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Equipe ativa</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg hover:shadow-emerald-500/5 transition-all bg-white dark:bg-slate-900/40">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t("stats.completionRate")}</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500 opacity-50" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-emerald-500">{stats.completionRate}%</div>
              <div className="h-1.5 w-full bg-muted rounded-md mt-3 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-1000" 
                  style={{ width: `${stats.completionRate}%` }} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="shadow-lg border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden group">
            <CardHeader className="border-b border-muted/50 pb-4">
               <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{t("charts.appointments")}</CardTitle>
                  <CardDescription>Comparativo de status por período</CardDescription>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <BarChart3 className="h-5 w-5" />
                </div>
               </div>
            </CardHeader>
            <CardContent className="h-[350px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appointmentData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Bar dataKey="completed" fill="#10b981" name={t("completed")} radius={[6, 6, 0, 0]} barSize={25} />
                  <Bar dataKey="cancelled" fill="#ef4444" name={t("cancelled")} radius={[6, 6, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="border-b border-muted/50 pb-4">
               <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{t("charts.growth")}</CardTitle>
                  <CardDescription>Evolução da base de clientes</CardDescription>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <TrendingUp className="h-5 w-5" />
                </div>
               </div>
            </CardHeader>
            <CardContent className="h-[350px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={patientData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="totalPatients" 
                    stroke="url(#lineGradient)" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8, strokeWidth: 0 }}
                    name={t("total")} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="newPatients" 
                    stroke="#f59e0b" 
                    strokeWidth={3} 
                    strokeDasharray="5 5"
                    dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} 
                    name={t("new")} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seção Orçamentos & Serviços */}
      <div id="section-budgets" className="space-y-4 pt-4 border-t border-muted">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {t("sections.budgets")} & {t("sections.services")}
          </h3>
          <Button variant="ghost" size="sm" onClick={() => handlePrint("section-budgets")} className="no-print">
            <Download className="h-4 w-4 mr-1" /> {t("downloadSection")}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.totalBudgets")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{budgetStats.total}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.approvedBudgets")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{budgetStats.approved}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.totalServices")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serviceStats.totalServices}</div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.averagePrice")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                R$ {serviceStats.averagePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{t("charts.budgets")}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: t("stats.approvedBudgets"), value: budgetStats.approved },
                      { name: t("stats.pendingBudgets"), value: budgetStats.pending },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[0, 1].map((index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : "#f59e0b"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm bg-primary/5 border-dashed border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Meta de Faturamento (Projetada)
              </CardTitle>
              <CardDescription>Valor total em orçamentos pendentes e aprovados</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center h-[230px] gap-4">
              <div className="text-4xl font-black text-primary">
                R$ {budgetStats.totalValue.toLocaleString("pt-BR")}
              </div>
              <p className="text-sm text-center text-muted-foreground max-w-xs">
                Este valor representa o volume total de negócios gerados pela plataforma no período atual.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
