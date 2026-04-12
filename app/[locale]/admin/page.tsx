"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase-client"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
    Users, BarChart3, Settings, Shield, LayoutDashboard, Search, Bell, 
    ArrowUpRight, DollarSign, UserCheck, TrendingUp,
    Briefcase, Globe, Loader2, AlertCircle, LogOut, ChevronRight, Clock,
    MessageSquare, Send, X, MoreHorizontal, ArrowLeft, CheckCircle2, Menu, BellOff
} from "lucide-react"
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetTrigger 
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PRODUCTS } from "@/lib/products"
import Image from "next/image"
import { useTranslations } from 'next-intl'
import { useFCM } from "@/hooks/use-fcm"
import { respondToTicket, updateTicketStatusAction, deleteSupportTicket, broadcastNotification } from "@/app/actions/support"
import { Trash2, Megaphone } from "lucide-react"

// Recharts components imports
import { 
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
    CartesianGrid, Tooltip 
} from 'recharts'

interface DashboardData {
    stats: {
        totalUsers: number
        activeSubs: number
        totalLeads: number
        inactiveUsers: number
        revenue: {
            day: number
            week: number
            month: number
        }
        analytics: {
            uniqueVisitors: number
            pageViews: number
            activeSessions: number
            topPaths: { path: string, count: number }[]
            topRefs: { source: string, visits: number }[]
            chartData: { date: string, visits: number }[]
        }
    }
    leads: any[]
    users: any[]
    userStats: Record<string, { clients: number, professionals: number, appointments: number }>
    activityMap: Record<string, string> // user_id -> last_seen_at ISO string
    supportTickets: any[]
}

/** Returns a human-readable relative time string in Portuguese */
function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return "Nunca acessou"
    const now = Date.now()
    const then = new Date(dateStr).getTime()
    const diffMs = now - then
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHour / 24)

    if (diffSec < 60) return "Agora"
    if (diffMin < 60) return `${diffMin}min atrás`
    if (diffHour < 24) return `${diffHour}h atrás`
    if (diffDay === 1) return "Ontem"
    if (diffDay < 7) return `${diffDay} dias atrás`
    if (diffDay < 30) return `${Math.floor(diffDay / 7)} sem. atrás`
    if (diffDay < 365) return `${Math.floor(diffDay / 30)} meses atrás`
    return `${Math.floor(diffDay / 365)} ano(s) atrás`
}

/** Returns a color class based on how long ago the user was active */
function activityColor(dateStr: string | null | undefined): string {
    if (!dateStr) return "text-red-500"
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffDay = diffMs / (1000 * 60 * 60 * 24)
    if (diffDay < 1) return "text-emerald-500"
    if (diffDay < 3) return "text-yellow-500"
    if (diffDay < 7) return "text-orange-500"
    return "text-red-500"
}

export default function AdminPage() {
    const { user, signOut, loading: authLoading } = useAuth() as any
    useFCM()
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
    const [activeTab, setActiveTab] = useState("overview")
    const [mounted, setMounted] = useState(false)
    const [period, setPeriod] = useState<"24h" | "7d" | "30d" | "total">("total")
    const [data, setData] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    // Support state
    const [activeTicket, setActiveTicket] = useState<any | null>(null)
    const [ticketMessages, setTicketMessages] = useState<any[]>([])
    const [newMessage, setNewMessage] = useState("")
    const [sendingReply, setSendingReply] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    
    // Broadcast state
    const [broadcastTitle, setBroadcastTitle] = useState("")
    const [broadcastBody, setBroadcastBody] = useState("")
    const [broadcastUrl, setBroadcastUrl] = useState("https://gdc.viraweb.online")
    const [sendingBroadcast, setSendingBroadcast] = useState(false)
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default")
    
    const supabase = createClient()
    const { toast } = useToast()

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (!("Notification" in window)) {
                setNotifPermission("unsupported")
            } else {
                setNotifPermission(Notification.permission)
            }
        }
    }, [])

    const requestNotifPermission = async () => {
        if (typeof window === 'undefined' || !("Notification" in window)) return
        
        try {
            const permission = await Notification.requestPermission()
            setNotifPermission(permission)
            
            if (permission === 'granted') {
                toast({
                    title: "Notificações Ativadas",
                    description: "Você receberá alertas de novos tickets e mensagens.",
                })
                // Trigger FCM hook logic if it's not already running
                window.location.reload() 
            } else {
                toast({
                    title: "Notificações Bloqueadas",
                    description: "Habilite nas configurações do seu navegador para receber alertas.",
                    variant: "destructive"
                })
            }
        } catch (err) {
            console.error("Error requesting notif permission:", err)
        }
    }

    useEffect(() => {
        if (!authLoading && user) {
            checkAdminStatus()
        } else if (!authLoading && !user) {
            setIsAdmin(false)
            setLoading(false)
        }
    }, [user, authLoading])

    useEffect(() => {
        setMounted(true)
        if (isAdmin) {
            document.title = "Vira Web - Admin painel"
        } else {
            document.title = "Login | Vira Web Admin"
        }
    }, [isAdmin])

    const checkAdminStatus = async () => {
        if (!user?.id) return;
        setLoading(true)
        try {
            // Tenta buscar no profiles (novo padrão)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .maybeSingle()

            let userRole = profile?.role

            // Se não encontrou no profiles ou deu erro, tenta no users (legado)
            if (!userRole || profileError) {
                const { data: legacyUser } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle()
                userRole = legacyUser?.role
            }

            // Normalize role: removes whitespace and accents/diacritics
            const normalizedRole = userRole?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

            if (normalizedRole !== 'admin') {
                console.warn("User is not admin:", user.id, "Role:", userRole)
                setIsAdmin(false)
            } else {
                setIsAdmin(true)
                
                // Auto-consent for admins to ensure persistent session
                if (typeof window !== 'undefined') {
                    const currentConsent = localStorage.getItem('vwd:consent_cookies')
                    if (currentConsent !== 'true') {
                        localStorage.setItem('vwd:consent_cookies', 'true')
                        window.dispatchEvent(new Event('vwd:consent_changed'))
                    }
                }

                fetchDashboardData()
            }
        } catch (err) {
            console.error("Admin check error:", err)
            setIsAdmin(false)
        } finally {
            setLoading(false)
        }
    }
 
    const fetchDashboardData = async () => {
        setLoading(true)
        setError(null)
        try {
            // Get date limits
            const now = new Date()
            const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
            
            let periodCutoff = twentyFourHoursAgo
            if (period === "7d") periodCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
            if (period === "30d") periodCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            if (period === "total") periodCutoff = new Date(0).toISOString()

            // Busca de users (usado como fonte de verdade para usuários e planos)
            const { data: usersData, count: usersCount, error: usersError } = await supabase
                .from('users')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })

            if (usersError) throw usersError

            // Fetch subscriptions to identify trials
            const { data: subsData } = await supabase
                .from('subscriptions')
                .select('user_id, plan_price, status, plan_name')
                .order('created_at', { ascending: false })

            // Busca de leads simplificada com mapeamento de usuários manual
            let leadsData: any[] = []
            try {
                const { data: simpleLeads, error: simpleError } = await supabase
                    .from('leads')
                    .select('*')
                    .order('created_at', { ascending: false })
                
                if (simpleError) {
                    console.error("Leads query failed:", simpleError.message)
                }

                // Mapeia os dados do usuário para o lead manualmente
                leadsData = simpleLeads?.map((lead) => {
                    const user = usersData?.find((u: any) => u.id === lead.user_id)
                    return {
                        ...lead,
                        profiles: user || null
                    }
                }) || []
            } catch (e) {
                console.error("Error fetching leads:", e)
                leadsData = []
            }

            const { data: visits } = await supabase
                .from('traffic_analytics')
                .select('*')
                .order('created_at', { ascending: false })
                .gte('created_at', periodCutoff)

            const usersWithPlans = usersData?.filter((u: any) => u.subscription_plan && u.subscription_plan !== 'none' && u.subscription_plan !== 'free') || []
            const totalRevenuePerMonth = usersWithPlans.reduce((acc: number, u: any) => {
                const product = PRODUCTS.find(p => p.planType === u.subscription_plan)
                return acc + (product?.priceInCents || 0)
            }, 0) / 100

            // Analytics Calculations
            const pageViews = visits?.length || 0
            
            // Unique Visitors (Last 24h)
            const visitors24h = new Set(visits?.filter(v => v.created_at >= twentyFourHoursAgo).map(v => v.visitor_id || v.id)).size
            
            // Active Sessions (Last 5 min)
            const activeSessions = new Set(visits?.filter(v => v.created_at >= fiveMinAgo).map(v => v.visitor_id || v.id)).size
            
            // Top Paths
            const pathCounts: Record<string, number> = {}
            visits?.forEach(v => {
                pathCounts[v.path] = (pathCounts[v.path] || 0) + 1
            })
            const topPaths = Object.entries(pathCounts)
                .map(([path, count]) => ({ path, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5)

            // Referrers
            const refCounts: Record<string, number> = {}
            visits?.forEach(v => {
                const ref = v.referrer || "Direto"
                refCounts[ref] = (refCounts[ref] || 0) + 1
            })
            const topRefs = Object.entries(refCounts)
                .map(([source, visits]) => ({ source, visits }))
                .sort((a, b) => b.visits - a.visits)
                .slice(0, 4)

            // Chart Data (Last 7 days)
            const visitsByDate: Record<string, number> = {}
            const last7Days = Array.from({length: 7}, (_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - i)
                return d.toISOString().split('T')[0]
            }).reverse()
            
            last7Days.forEach(date => visitsByDate[date] = 0)
            
            visits?.forEach(v => {
                const date = new Date(v.created_at).toISOString().split('T')[0]
                if (visitsByDate[date] !== undefined) {
                    visitsByDate[date]++
                }
            })
            
            const chartData = Object.entries(visitsByDate).map(([date, count]) => ({
                date: date.split('-').reverse().slice(0,2).join('/'),
                visits: count
            }))

            // Fetch counts for users
            const userCounts: Record<string, { clients: number, professionals: number, appointments: number }> = {}
            
            const [
                { data: patientsCounts },
                { data: professionalsCounts },
                { data: appointmentsCounts },
                { data: activityData },
                { data: ticketsData }
            ] = await Promise.all([
                supabase.from('patients').select('user_id'),
                supabase.from('professionals').select('user_id'),
                supabase.from('appointments').select('user_id'),
                supabase.from('user_activity').select('user_id, last_seen_at'),
                supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
            ])

            // Build activity map
            const activityMap: Record<string, string> = {}
            activityData?.forEach((a: { user_id: string; last_seen_at: string }) => {
                activityMap[a.user_id] = a.last_seen_at
            })

            // Count users inactive for 7+ days
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime()
            const inactiveCount = (usersData || []).filter((u: any) => {
                const lastSeen = activityMap[u.id]
                if (!lastSeen) return true // Never accessed
                return new Date(lastSeen).getTime() < sevenDaysAgo
            }).length

            usersData?.forEach(u => {
                userCounts[u.id] = {
                    clients: patientsCounts?.filter(p => p.user_id === u.id).length || 0,
                    professionals: professionalsCounts?.filter(p => p.user_id === u.id).length || 0,
                    appointments: appointmentsCounts?.filter(p => p.user_id === u.id).length || 0
                }
            })

            setData({
                stats: {
                    totalUsers: usersCount || 0,
                    activeSubs: usersWithPlans.length,
                    totalLeads: leadsData.length,
                    inactiveUsers: inactiveCount,
                    revenue: {
                        day: totalRevenuePerMonth / 30,
                        week: totalRevenuePerMonth / 4.3,
                        month: totalRevenuePerMonth
                    },
                    analytics: {
                        uniqueVisitors: visitors24h,
                        pageViews,
                        activeSessions,
                        topPaths,
                        topRefs,
                        chartData
                    }
                },
                leads: leadsData,
                users: usersData?.map(u => {
                    const sub = subsData?.find(s => s.user_id === u.id)
                    return {
                        ...u,
                        is_trial: sub ? (sub.plan_price === 0 && sub.plan_name === 'premium') : false
                    }
                }) || [],
                userStats: userCounts,
                activityMap,
                supportTickets: ticketsData?.map((t: any) => ({
                    ...t,
                    profiles: usersData?.find((u: any) => u.id === t.user_id) || null
                })) || []
            })
        } catch (err: any) {
            console.error("Data fetch error:", err)
            setError(err.message || "Falha ao carregar dados")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAdmin) {
            fetchDashboardData()
        }
    }, [period, isAdmin])

    const fetchMessages = async (ticketId: string) => {
        try {
            const { data, error: err } = await supabase
                .from('support_messages')
                .select('*')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true })
            if (!err && data) {
                setTicketMessages(data)
            }
        } catch (err) {
            console.error("Mensagens erro:", err)
        }
    }

    const loadTicket = (ticket: any) => {
        setActiveTicket(ticket)
        fetchMessages(ticket.id)
    }

    const sendReply = async () => {
        if (!newMessage.trim() || !activeTicket || !user) return
        setSendingReply(true)
        try {
            await respondToTicket(activeTicket.id, newMessage)
            
            setNewMessage("")
            await fetchMessages(activeTicket.id)
            toast({ title: "Resposta enviada" })
        } catch (err) {
            toast({ title: "Erro ao enviar resposta", variant: "destructive" })
        } finally {
            setSendingReply(false)
        }
    }

    const updateTicketStatus = async (ticketId: string, status: string) => {
        setUpdatingStatus(true)
        try {
            await updateTicketStatusAction(ticketId, status)
            
            if (activeTicket && activeTicket.id === ticketId) {
                setActiveTicket({ ...activeTicket, status })
            }
            toast({ title: `Status atualizado para ${status}` })
            // Refresh counts/data
            fetchDashboardData()
        } catch (err) {
            toast({ title: "Erro ao atualizar ticket", variant: "destructive" })
        } finally {
            setUpdatingStatus(false)
        }
    }
    
    const handleDeleteTicket = async (ticketId: string) => {
        if (!confirm("Tem certeza que deseja excluir permanentemente este ticket?")) return
        try {
            await deleteSupportTicket(ticketId)
            toast({ title: "Ticket excluído com sucesso" })
            if (activeTicket?.id === ticketId) setActiveTicket(null)
            fetchDashboardData()
        } catch (err) {
            toast({ title: "Erro ao excluir ticket", variant: "destructive" })
        }
    }

    const handleSendBroadcast = async () => {
        if (!broadcastTitle || !broadcastBody) {
            toast({ title: "Título e mensagem são obrigatórios", variant: "destructive" })
            return
        }
        setSendingBroadcast(true)
        try {
            const result = await broadcastNotification(broadcastTitle, broadcastBody, broadcastUrl)
            toast({ title: "Comunicado enviado!", description: `Notificação disparada para ${result.count} usuários.` })
            setBroadcastTitle("")
            setBroadcastBody("")
        } catch (err: any) {
            toast({ title: "Erro ao enviar comunicado", description: err.message, variant: "destructive" })
        } finally {
            setSendingBroadcast(false)
        }
    }

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-slate-400 font-bold tracking-widest uppercase text-[10px] animate-pulse">Sincronizando Dados</p>
            </div>
        )
    }

    if (isAdmin === false || !user) {
        return <AdminLogin onAdminSuccess={() => checkAdminStatus()} currentEmail={user?.email} onSignOut={() => signOut()} />
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex selection:bg-primary/10">
            {/* Sidebar Slim */}
            <aside className="w-60 bg-white border-r border-slate-200 hidden lg:flex flex-col sticky top-0 h-screen z-50">
                <div className="p-6 border-b border-slate-50">
                    <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-32 mx-auto" />
                    <div className="text-center mt-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Painel Admin</span>
                    </div>
                </div>
                
                <nav className="flex-1 px-3 space-y-0.5 mt-6">
                    {[
                        { id: "overview", icon: LayoutDashboard, label: "Visão Geral", active: activeTab === "overview" },
                        { id: "analytics", icon: BarChart3, label: "Tráfego & Análise", active: activeTab === "analytics" },
                        { id: "members", icon: Users, label: "Membros", active: activeTab === "members" },
                        { id: "leads", icon: Briefcase, label: "Perfil dos Usuários", active: activeTab === "leads" },
                        { id: "finance", icon: DollarSign, label: "Financeiro", active: activeTab === "finance" },
                        { id: "support", icon: MessageSquare, label: "Tickets de Suporte", active: activeTab === "support" },
                        { id: "broadcast", icon: Megaphone, label: "Comunicados", active: activeTab === "broadcast" },
                    ].map((item, i) => (
                        <button 
                            key={i} 
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                                item.active 
                                ? "bg-primary/10 text-primary font-bold" 
                                : "text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-900"
                            }`}
                        >
                            <item.icon className="w-4 h-4" />
                            <span className="text-[13px]">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-4 mt-auto">
                    <button 
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 text-slate-500 hover:text-red-500 transition-colors font-bold text-xs"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair do Admin
                    </button>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <header className="h-16 bg-white border-b border-slate-200 shrink-0 px-4 lg:px-8 flex items-center justify-between sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        {/* Hamburger for Mobile */}
                        <div className="lg:hidden">
                            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-slate-500">
                                        <Menu className="w-5 h-5" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="p-0 w-72">
                                    <SheetHeader className="p-6 border-b border-slate-50">
                                        <SheetTitle className="flex flex-col items-center">
                                            <Image width={120} height={40} alt="ViraWeb logo" src="/viraweb3.png" className="w-32 mb-2" />
                                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Menu Admin</span>
                                        </SheetTitle>
                                    </SheetHeader>
                                    <nav className="p-4 space-y-1 mt-4">
                                        {[
                                            { id: "overview", icon: LayoutDashboard, label: "Visão Geral", active: activeTab === "overview" },
                                            { id: "analytics", icon: BarChart3, label: "Tráfego & Análise", active: activeTab === "analytics" },
                                            { id: "members", icon: Users, label: "Membros", active: activeTab === "members" },
                                            { id: "leads", icon: Briefcase, label: "Perfil dos Usuários", active: activeTab === "leads" },
                                            { id: "finance", icon: DollarSign, label: "Financeiro", active: activeTab === "finance" },
                                            { id: "support", icon: MessageSquare, label: "Tickets de Suporte", active: activeTab === "support" },
                                            { id: "broadcast", icon: Megaphone, label: "Comunicados", active: activeTab === "broadcast" },
                                        ].map((item, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => {
                                                    setActiveTab(item.id)
                                                    setIsMobileMenuOpen(false)
                                                }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                                    item.active 
                                                    ? "bg-primary/10 text-primary font-bold" 
                                                    : "text-slate-500 font-medium hover:bg-slate-50"
                                                }`}
                                            >
                                                <item.icon className="w-5 h-5" />
                                                <span className="text-sm">{item.label}</span>
                                            </button>
                                        ))}
                                    </nav>
                                    <div className="p-4 absolute bottom-0 left-0 right-0">
                                        <Button 
                                            variant="ghost" 
                                            className="w-full justify-start gap-3 h-12 text-red-500 hover:text-red-600 hover:bg-red-50 font-bold"
                                            onClick={() => signOut()}
                                        >
                                            <LogOut className="w-5 h-5" />
                                            Sair do Admin
                                        </Button>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>

                        <div className="hidden sm:flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Páginas /</span>
                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">
                                {activeTab === "overview" && "Visão Geral"}
                                {activeTab === "analytics" && "Analíticos"}
                                {activeTab === "members" && "Membros"}
                                {activeTab === "leads" && "Perfil"}
                                {activeTab === "finance" && "Financeiro"}
                                {activeTab === "support" && "Suporte"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Notification Enable Button */}
                        {notifPermission !== "granted" && notifPermission !== "unsupported" && (
                            <Button 
                                onClick={requestNotifPermission}
                                size="sm" 
                                className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest gap-2 h-9 px-4 rounded-full shadow-lg shadow-amber-200"
                            >
                                <Bell className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Habilitar Notificações</span>
                                <span className="sm:hidden">Notificações</span>
                            </Button>
                        )}
                        {notifPermission === "granted" && (
                            <div className="flex items-center gap-2">
                                <div className="px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest hidden sm:inline">Push Ativo</span>
                                    <Bell className="w-3.5 h-3.5 text-emerald-600 sm:hidden" />
                                </div>
                            </div>
                        )}
                        {notifPermission === "unsupported" && (
                            <div className="px-3 py-1.5 bg-slate-50 rounded-full text-slate-400 flex items-center gap-2">
                                <BellOff className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Não suportado</span>
                            </div>
                        )}
                        
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-400 text-xs shadow-sm">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <div className="p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                            <div>
                                <h3 className="text-xs font-black text-red-600 uppercase tracking-widest">Erro de Dados</h3>
                                <p className="text-[11px] text-red-500/80 font-bold mt-0.5">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {activeTab === "overview" && "Painel Executivo"}
                                {activeTab === "analytics" && "Análise de Tráfego "}
                                {activeTab === "members" && "Base de Usuários"}
                                {activeTab === "leads" && "Perfil e Respostas dos Usuários"}
                                {activeTab === "finance" && "Consolidado Financeiro"}
                                {activeTab === "support" && "Atendimento e Chamados"}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {activeTab === "support" ? "Gerencie os tickets dos assinantes e resolva os problemas." : "Gestão de métricas e performance em tempo real."}
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    {(activeTab === "overview" || activeTab === "finance" || activeTab === "analytics") && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-slate-900">
                            {activeTab === "analytics" ? (
                                <>
                                    {[
                                        { title: "Visitantes (24h)", value: data?.stats.analytics.uniqueVisitors || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
                                        { title: "Visualizações", value: data?.stats.analytics.pageViews || 0, icon: Globe, color: "text-emerald-500", bg: "bg-emerald-50" },
                                        { title: "Sessões Ativas", value: (data?.stats as any)?.analytics?.activeSessions || 0, icon: Clock, color: "text-orange-500", bg: "bg-orange-50" },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm group">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.title}</span>
                                                <div className={`w-7 h-7 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
                                                    <stat.icon className="w-4 h-4" />
                                                </div>
                                            </div>
                                            <div className="text-lg font-black text-slate-900">{stat.value}</div>
                                        </div>
                                    ))}
                                </>
                            ) : (
                                <>
                                    {[
                                        { title: "Membros", value: data?.stats.totalUsers || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
                                        { title: "Assinantes", value: data?.stats.activeSubs || 0, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-50" },
                                        { title: "Inativos (7d+)", value: data?.stats.inactiveUsers || 0, icon: Clock, color: "text-red-500", bg: "bg-red-50" },
                                        { title: "Faturamento", value: `R$ ${data?.stats.revenue.month.toFixed(2) || "0.00"}`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white border border-slate-100 p-4 rounded-xl shadow-sm group">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.title}</span>
                                                <div className={`w-7 h-7 ${stat.bg} ${stat.color} rounded-lg flex items-center justify-center`}>
                                                    <stat.icon className="w-4 h-4" />
                                                </div>
                                            </div>
                                            <div className="text-lg font-black text-slate-900">{stat.value}</div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    )}

                    {/* Analytics Graphics */}
                    {activeTab === "analytics" && (
                        <>
                            <Card className="p-6 border border-slate-100 rounded-xl shadow-sm overflow-hidden bg-white">
                                <div className="flex items-center justify-between mb-8">
                                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-primary" />
                                        Fluxo de Visitantes (Últimos 7 dias)
                                    </h3>
                                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-primary" />
                                            Visualizações
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[250px] w-full mt-4">
                                    {mounted && (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={data?.stats.analytics.chartData || []}>
                                                <defs>
                                                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="date" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                                                />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
                                                    cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                                                />
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="visits" 
                                                    stroke="#3b82f6" 
                                                    strokeWidth={3}
                                                    fillOpacity={1} 
                                                    fill="url(#colorVisits)" 
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </Card>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <Card className="p-6 border border-slate-100 rounded-xl shadow-sm bg-white">
                                    <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-blue-500" />
                                        Canais de Aquisição 
                                    </h3>
                                    <div className="space-y-4">
                                        {data?.stats.analytics.topRefs.map((item, i) => {
                                            const percentage = Math.round((item.visits / (data?.stats.analytics.pageViews || 1)) * 100)
                                            return (
                                                <div key={i} className="flex items-center justify-between">
                                                    <div className="flex flex-col gap-1 w-full max-w-[240px]">
                                                        <span className="text-xs font-bold text-slate-700 truncate">{item.source}</span>
                                                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                                                        </div>
                                                    </div>
                                                    <span className="text-xs font-black text-slate-900">{item.visits} v.</span>
                                                </div>
                                            )
                                        })}
                                        {data?.stats.analytics.topRefs.length === 0 && (
                                            <p className="text-xs text-slate-400 italic">Aguardando primeiros dados...</p>
                                        )}
                                    </div>
                                </Card>
                                <Card className="p-6 border border-slate-100 rounded-xl shadow-sm bg-white">
                                    <h3 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        Páginas mais Visitadas 
                                    </h3>
                                    <div className="space-y-3">
                                        {data?.stats.analytics.topPaths.map((p, i) => (
                                            <div key={i} className="flex items-center justify-between p-2 bg-slate-50/50 rounded-lg">
                                                <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-white rounded border border-slate-100 truncate max-w-[150px]">{p.path}</span>
                                                <span className="text-[11px] font-black text-slate-900">{p.count} views</span>
                                            </div>
                                        ))}
                                        {data?.stats.analytics.topPaths.length === 0 && (
                                            <p className="text-xs text-slate-400 italic">Navegue no site para gerar dados.</p>
                                        )}
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* Revenue Display */}
                    {(activeTab === "overview" || activeTab === "finance") && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {[
                                { label: "Diário", value: data?.stats.revenue.day || 0 },
                                { label: "Semanal", value: data?.stats.revenue.week || 0 },
                                { label: "Mensal (MRR)", value: data?.stats.revenue.month || 0 },
                            ].map((item, i) => (
                                <div key={i} className="bg-slate-900 rounded-xl p-4 text-white">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-xs font-bold text-primary">R$</span>
                                        <span className="text-xl font-black">{item.value?.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 text-slate-900 font-sans">
                        {/* Users Table */}
                        {(activeTab === "overview" || activeTab === "members") && (
                            <div className={`${activeTab === "overview" ? "xl:col-span-3" : "xl:col-span-5"} bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden`}>
                                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-slate-900">Membros & Planos</h3>
                                    {activeTab === "overview" && <Button onClick={() => setActiveTab("members")} variant="link" size="sm" className="text-xs font-black text-primary">Ver todos</Button>}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50/50 text-slate-400 font-bold uppercase tracking-widest">
                                            <tr>
                                                <th className="px-6 py-3">Usuário</th>
                                                <th className="px-6 py-3 text-center">Clientes</th>
                                                <th className="px-6 py-3 text-center">Profs</th>
                                                <th className="px-6 py-3 text-center">Agend.</th>
                                                <th className="px-6 py-3">Plano</th>
                                                <th className="px-6 py-3 text-center">Última Atividade</th>
                                                <th className="px-6 py-3 text-right">Data</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 font-medium h-full">
                                            {(activeTab === "overview" ? data?.users?.slice(0, 7) : data?.users || [])?.map((u, i) => {
                                                const stats = data?.userStats?.[u.id] || { clients: 0, professionals: 0, appointments: 0 }
                                                return (
                                                    <tr key={i} className="hover:bg-slate-50/20 transition-colors">
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-[10px]">
                                                                    {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-700">{u.full_name || u.email?.split('@')[0]}</p>
                                                                    <p className="text-[9px] text-slate-400">{u.email}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`font-black text-[11px] ${stats.clients > 0 ? "text-blue-600" : "text-slate-300"}`}>
                                                                {stats.clients}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`font-black text-[11px] ${stats.professionals > 0 ? "text-purple-600" : "text-slate-300"}`}>
                                                                {stats.professionals}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <span className={`font-black text-[11px] ${stats.appointments > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                                                                {stats.appointments}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${u.is_trial ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-600"}`}>
                                                                {u.is_trial ? "Free Trial" : u.subscription_plan}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-3 text-center">
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${(() => {
                                                                    const lastSeen = data?.activityMap?.[u.id]
                                                                    if (!lastSeen) return "bg-red-500"
                                                                    const diffMs = Date.now() - new Date(lastSeen).getTime()
                                                                    const diffDay = diffMs / (1000 * 60 * 60 * 24)
                                                                    if (diffDay < 1) return "bg-emerald-500 animate-pulse"
                                                                    if (diffDay < 3) return "bg-yellow-500"
                                                                    if (diffDay < 7) return "bg-orange-500"
                                                                    return "bg-red-500"
                                                                })()}`} />
                                                                <span className={`text-[10px] font-black ${activityColor(data?.activityMap?.[u.id])}`}>
                                                                    {timeAgo(data?.activityMap?.[u.id])}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right text-slate-400">
                                                            {new Date(u.created_at).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Recent Leads */}
                        {(activeTab === "overview" || activeTab === "leads") && (
                            <div className={`${activeTab === "overview" ? "xl:col-span-2" : "xl:col-span-5"} bg-white border border-slate-100 rounded-xl shadow-sm flex flex-col`}>
                                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-slate-900">Respostas dos usuários</h3>
                                    {activeTab === "overview" && <Button onClick={() => setActiveTab("leads")} variant="link" size="sm" className="text-xs font-black text-primary">Ver Leads</Button>}
                                </div>
                                <div className="divide-y divide-slate-50 h-full">
                                    {(activeTab === "overview" ? data?.leads?.slice(0, 10) : data?.leads || [])?.map((lead, i) => (
                                        <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-xs font-black text-white shrink-0">
                                                    {(lead.profiles?.full_name || lead.profiles?.email || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="font-black text-slate-900 text-sm">{lead.profiles?.full_name || lead.profiles?.email?.split('@')[0]}</p>
                                                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-black uppercase rounded">
                                                            {lead.profiles?.subscription_plan}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{lead.profiles?.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 sm:text-right sm:flex-col sm:gap-1">
                                                <div className="px-2 py-1 bg-slate-100 rounded text-[9px] font-black text-slate-600 uppercase">RAMO: {lead.ramo || 'Geral'}</div>
                                                <div className="px-2 py-1 bg-emerald-50 rounded text-[9px] font-black text-emerald-600 uppercase">GANHOS: {lead.faturamento}</div>
                                                <div className="px-2 py-1 bg-blue-50 rounded text-[9px] font-black text-blue-600 uppercase">CLIENTES: {lead.clientes}</div>
                                                <div className="px-2 py-1 bg-purple-50 rounded text-[9px] font-black text-purple-600 uppercase">AGENDAMENTOS: {lead.agendamentos || 0}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {(data?.leads?.length === 0 || !data?.leads) && (
                                        <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-xs italic">
                                            Nenhum lead disponível.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Support Section */}
                    {activeTab === "support" && (
                        <div className="flex h-[700px] bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
                            {/* Tickets List */}
                            <div className={`w-full lg:w-1/3 border-r border-slate-100 flex flex-col ${activeTicket ? "hidden lg:flex" : "flex"}`}>
                                <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                    <h3 className="text-sm font-black text-slate-900">Tickets ({data?.supportTickets?.length || 0})</h3>
                                    <p className="text-[11px] font-medium text-slate-500">
                                        Abertos: {data?.supportTickets?.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length || 0}
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                                    {data?.supportTickets?.map((ticket: any) => (
                                        <button 
                                            key={ticket.id} 
                                            onClick={() => loadTicket(ticket)}
                                            className={`w-full p-4 text-left hover:bg-slate-50 transition-colors flex flex-col gap-2 ${activeTicket?.id === ticket.id ? "bg-slate-50 border-l-2 border-primary" : ""}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-900 truncate">{ticket.subject}</span>
                                                <Badge className={`text-[9px] uppercase font-black px-1.5 py-0 rounded ${
                                                    ticket.status === 'open' ? 'bg-blue-100 text-blue-700' :
                                                    ticket.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                                    ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {ticket.status === "open" ? "Aberto" : ticket.status === "in_progress" ? "Em andamento" : ticket.status === "resolved" ? "Resolvido" : "Fechado"}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">
                                                    {ticket.profiles?.full_name || ticket.profiles?.email}
                                                </span>
                                                <span className="text-[9px] font-medium text-slate-400">
                                                    {timeAgo(ticket.created_at)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                    {(!data?.supportTickets || data.supportTickets.length === 0) && (
                                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
                                            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                                            <p className="text-xs font-bold">Nenhum ticket</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Ticket Details/Chat Area */}
                            {activeTicket ? (
                                <div className={`flex-1 flex flex-col min-w-0 ${!activeTicket ? "hidden lg:flex" : "flex"}`}>
                                    {/* Header */}
                                    <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => setActiveTicket(null)} className="lg:hidden p-1 text-slate-400 hover:text-slate-600">
                                                <ArrowLeft className="w-5 h-5" />
                                            </button>
                                            <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center text-xs font-black text-white shrink-0">
                                                {(activeTicket.profiles?.full_name || activeTicket.profiles?.email || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-black text-slate-900 truncate pr-4">{activeTicket.subject}</h3>
                                                <p className="text-[11px] font-medium text-slate-500 truncate">
                                                    {activeTicket.profiles?.email} • {timeAgo(activeTicket.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline"
                                                size="sm" 
                                                onClick={() => handleDeleteTicket(activeTicket.id)}
                                                className="h-8 gap-1.5 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 font-bold text-xs"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Excluir
                                            </Button>
                                            {activeTicket.status !== 'resolved' && activeTicket.status !== 'closed' && (
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => updateTicketStatus(activeTicket.id, 'resolved')}
                                                    disabled={updatingStatus}
                                                    className="h-8 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Finalizar
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Messages list */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">

                                        {/* Replies */}
                                        {ticketMessages.map((msg, i) => (
                                            <div key={i} className={`flex flex-col max-w-[85%] ${msg.is_staff ? "ml-auto" : "mr-auto"}`}>
                                                <div className={`flex items-baseline gap-2 mb-1 px-1 ${msg.is_staff ? "justify-end" : "justify-start"}`}>
                                                    <span className={`text-xs font-bold ${msg.is_staff ? "text-primary" : "text-slate-700"}`}>
                                                        {msg.is_staff ? "Suporte" : (activeTicket.profiles?.full_name || 'Usuário')}
                                                    </span>
                                                    <span className="text-[9px] font-medium text-slate-400">{new Date(msg.created_at).toLocaleString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                                                </div>
                                                <div className={`text-sm p-3.5 rounded-2xl shadow-sm whitespace-pre-wrap ${
                                                    msg.is_staff 
                                                    ? "bg-primary text-white rounded-tr-sm" 
                                                    : "bg-white border border-slate-200 text-slate-700 rounded-tl-sm"
                                                }`}>
                                                    {msg.message}
                                                </div>
                                            </div>
                                        ))}
                                        {ticketMessages.length === 0 && (
                                            <div className="text-center p-4">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-slate-100">Ticket Criado</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Reply Box */}
                                    <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                                        {activeTicket.status === 'closed' || activeTicket.status === 'resolved' ? (
                                            <div className="text-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-500">
                                                Este ticket está {activeTicket.status === 'closed' ? 'fechado' : 'resolvido'}. 
                                                <Button variant="link" onClick={() => updateTicketStatus(activeTicket.id, 'open')} className="px-1 h-auto text-primary">Reabrir</Button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2">
                                                <Textarea 
                                                    placeholder="Digite sua resposta (Suporte)..."
                                                    value={newMessage}
                                                    onChange={e => setNewMessage(e.target.value)}
                                                    className="resize-none min-h-[60px] rounded-xl text-sm"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            sendReply();
                                                        }
                                                    }}
                                                />
                                                <Button 
                                                    size="icon"
                                                    className="w-12 h-12 shrink-0 rounded-xl bg-primary hover:bg-primary/90 text-white shadow-sm mt-auto"
                                                    onClick={sendReply}
                                                    disabled={sendingReply || !newMessage.trim()}
                                                >
                                                    {sendingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-slate-50/50 p-12 text-center text-slate-400">
                                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                                    <h4 className="text-sm font-black text-slate-600">Selecione um Ticket</h4>
                                    <p className="text-xs font-medium">Escolha um chamado na lista ao lado para ver os detalhes e responder.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "broadcast" && (
                        <div className="p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-8">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Comunicado Global</h1>
                                <p className="text-sm font-medium text-slate-500">
                                    Envie uma notificação push para todos os usuários que possuem dispositivos registrados.
                                </p>
                            </div>

                            <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px] overflow-hidden bg-white">
                                <CardHeader className="border-b border-slate-50 p-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                            <Megaphone className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-black">Nova Mensagem de Massa</CardTitle>
                                            <CardDescription className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Notificação Imediata
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest px-1">Título da Notificação</label>
                                            <Input 
                                                placeholder="Ex: 🎉 Novidade Importante!"
                                                value={broadcastTitle}
                                                onChange={(e) => setBroadcastTitle(e.target.value)}
                                                className="h-12 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-primary/20 transition-all font-medium"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest px-1">Mensagem</label>
                                            <Textarea 
                                                placeholder="Descreva o que os usuários irão receber no celular ou computador..."
                                                value={broadcastBody}
                                                onChange={(e) => setBroadcastBody(e.target.value)}
                                                className="min-h-[120px] rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-primary/20 transition-all font-medium resize-none"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-700 uppercase tracking-widest px-1">URL de Destino (Opcional)</label>
                                            <Input 
                                                placeholder="https://gdc.viraweb.online"
                                                value={broadcastUrl}
                                                onChange={(e) => setBroadcastUrl(e.target.value)}
                                                className="h-12 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-primary/20 transition-all font-medium"
                                            />
                                            <p className="text-[10px] font-bold text-slate-400 px-1">
                                                Link que será aberto quando o usuário clicar na notificação.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <Button 
                                            onClick={handleSendBroadcast}
                                            disabled={sendingBroadcast || !broadcastTitle || !broadcastBody}
                                            className="w-full h-14 bg-primary hover:bg-primary/95 text-white rounded-2xl font-black text-sm shadow-[0_12px_24px_-8px_rgba(59,130,246,0.3)] gap-2 group relative overflow-hidden active:scale-[0.98] transition-all"
                                        >
                                            {sendingBroadcast ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                    Disparar para Todos os Usuários
                                                </>
                                            )}
                                        </Button>
                                        <div className="mt-4 flex items-center justify-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100/50">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <p className="text-[10px] font-bold text-amber-700 leading-tight">
                                                Atenção: Esta ação é irreversível e enviará uma notificação real para todos os dispositivos registrados na plataforma.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}

function AdminLogin({ onAdminSuccess, currentEmail, onSignOut }: { onAdminSuccess: () => void, currentEmail?: string, onSignOut: () => void }) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth() as any
    const { toast } = useToast()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await signIn(email, password)
            if (error) {
                toast({ title: "Erro de login", description: error.message, variant: "destructive" })
            } else {
                onAdminSuccess()
            }
        } catch (err: any) {
            toast({ title: "Erro", description: "Falha na conexão", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[20px_20px]">
            <Card className="max-w-md w-full border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[32px] overflow-hidden bg-white/80 backdrop-blur-xl">
                <div className="h-1 bg-primary" />
                <CardHeader className="pt-10 pb-6 text-center">
                    <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-40 mx-auto mb-6" />
                    <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Admin System</CardTitle>
                    <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-1">
                        Acesso Restrito - Monitoramento
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-12">
                    {currentEmail && (
                        <div className="mb-6 p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                            <p className="text-sm font-bold text-slate-600 mb-4 truncate">{currentEmail}</p>
                            <p className="text-[11px] font-black text-red-500 mb-6 uppercase tracking-wider">Perfil não autorizado</p>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="h-10 rounded-xl font-bold text-xs" onClick={() => window.location.origin}>Sair</Button>
                                <Button className="h-10 rounded-xl font-bold text-xs bg-slate-900" onClick={onSignOut}>Trocar</Button>
                            </div>
                        </div>
                    )}

                    {!currentEmail && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</Label>
                                <Input 
                                    id="email"
                                    type="email"
                                    className="h-11 bg-slate-50/50 border-slate-100 rounded-xl font-medium shadow-sm"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="pass" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</Label>
                                <Input 
                                    id="pass"
                                    type="password"
                                    className="h-11 bg-slate-50/50 border-slate-100 rounded-xl font-medium shadow-sm"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button disabled={loading} className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-primary/20 transition-all mt-2">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Desbloquear Acesso"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function Label({ children, htmlFor, className }: { children: React.ReactNode, htmlFor: string, className?: string }) {
    return <label htmlFor={htmlFor} className={`block text-xs font-medium text-slate-700 ${className}`}>{children}</label>
}
