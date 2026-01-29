"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    LogOut,
    Menu,
    X,
    Calendar,
    Users,
    BarChart3,
    Home,
    CreditCard,
    List,
    Sparkles,
    Target,
    Settings,
    HeadphonesIcon,
    StickyNote,
    PlayCircle,
    AlertCircle,
    Loader2
} from "lucide-react"

import dynamic from 'next/dynamic'
import Image from "next/image"
import { createClient } from "@/lib/supabase-client"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"

// Dynamic imports to optimize bundle splitting and fix SSR issues with charts
const ChecklistTab = dynamic(() => import("./dashboard/checklist-tab"), { loading: () => <TabLoading /> })
const OverviewTab = dynamic(() => import("./dashboard/overview-tab"), { loading: () => <TabLoading /> })
const AppointmentsTab = dynamic(() => import("./dashboard/appointments-tab"), { loading: () => <TabLoading /> })
const PatientsTab = dynamic(() => import("./dashboard/patients-tab"), { loading: () => <TabLoading /> })
const ProfessionalsTab = dynamic(() => import("./dashboard/professionals-tab"), { loading: () => <TabLoading /> })
const ReportsTab = dynamic(() => import("./dashboard/reports-tab"), { ssr: false, loading: () => <TabLoading /> })
const SubscriptionsTab = dynamic(() => import("./dashboard/subscriptions-tab"), { loading: () => <TabLoading /> })
const FinancialTab = dynamic(() => import("./dashboard/financial-tab"), { ssr: false, loading: () => <TabLoading /> })
const AISection = dynamic(() => import("./dashboard/ai-section"), { loading: () => <TabLoading /> })
const GoalsSection = dynamic(() => import("./dashboard/goals-section").then(mod => mod.GoalsSection), { loading: () => <TabLoading /> })
const SettingsTab = dynamic(() => import("./dashboard/settings-tab"), { loading: () => <TabLoading /> })
const SupportTab = dynamic(() => import("./dashboard/support-tab"), { loading: () => <TabLoading /> })
const NotesTab = dynamic(() => import("./dashboard/notes-tab"), { loading: () => <TabLoading /> })
const TutorialTab = dynamic(() => import("./dashboard/tutorial-tab"), { loading: () => <TabLoading /> })
const NotificationsPanel = dynamic(() => import("./notifications-panel"), { ssr: false })
const TutorialModal = dynamic(() => import("./tutorial-modal"), { ssr: false })
const ThemeSettings = dynamic(() => import("./dashboard/theme-settings"), { ssr: false })

function TabLoading() {
    return (
        <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
}

interface Subscription {
    id: string
    plan_name: "basic" | "premium" | "master"
    plan_type: "basic" | "premium" | "master"
    status: "active" | "canceled" | "expired"
    stripe_subscription_id: string | null
    stripe_customer_id: string | null
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
    max_patients: number | null
    max_professionals: number | null
    max_appointments_per_month: number | null
    virabot_enabled: boolean
    created_at: string
    updated_at: string
}

interface DashboardProps {
    user: { email: string; name: string }
    onLogout: () => void
    subscription?: Subscription
    isNewUser?: boolean
}

export default function Dashboard({ user, onLogout, subscription, isNewUser = false }: DashboardProps) {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [activeTab, setActiveTab] = useState("overview")
    const [showTutorial, setShowTutorial] = useState(isNewUser)
    const [hasWatchedTutorial, setHasWatchedTutorial] = useState(false)
    const supabase = createClient()
    const t = useTranslations('dashboard')

    useEffect(() => {
        loadTutorialStatus()
    }, [])

    const loadTutorialStatus = async () => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) return

            const { data } = await supabase
                .from('user_settings')
                .select('has_watched_tutorial')
                .eq('user_id', currentUser.id)
                .single()

            setHasWatchedTutorial(data?.has_watched_tutorial || false)
        } catch (error) {
            console.error('Error loading tutorial status:', error)
        }
    }

    const navItems = [
        {
            id: "overview",
            label: t('sidebar.overview'),
            icon: <Home className="w-5 h-5" />,
            notification: !hasWatchedTutorial ? (
                <div className="absolute -right-1 -top-1">
                    <AlertCircle className="w-4 h-4 text-primary animate-pulse" />
                </div>
            ) : null
        },
        { id: "notes", label: t('sidebar.notes'), icon: <StickyNote className="w-5 h-5" /> },
        { id: "checklist", label: t('sidebar.checklist'), icon: <List className="w-5 h-5" /> },
        { id: "ai", label: t('sidebar.ai'), icon: <Sparkles className="w-5 h-5" /> },
        { id: "goals", label: t('sidebar.goals'), icon: <Target className="w-5 h-5" /> },
        { id: "appointments", label: t('sidebar.appointments'), icon: <Calendar className="w-5 h-5" /> },
        { id: "patients", label: t('sidebar.patients'), icon: <Users className="w-5 h-5" /> },
        { id: "financial", label: t('sidebar.financial'), icon: <CreditCard className="w-5 h-5" /> },
        { id: "professionals", label: t('sidebar.professionals'), icon: <Users className="w-5 h-5" /> },
        { id: "reports", label: t('sidebar.reports'), icon: <BarChart3 className="w-5 h-5" /> },
        { id: "subscriptions", label: t('sidebar.subscriptions'), icon: <CreditCard className="w-5 h-5" /> },
        { id: "support", label: t('sidebar.support'), icon: <HeadphonesIcon className="w-5 h-5" /> },
        {
            id: "tutorial",
            label: t('sidebar.tutorial'),
            icon: <PlayCircle className="w-5 h-5" />,
            notification: !hasWatchedTutorial ? (
                <div className="absolute -right-1 -top-1">
                    <AlertCircle className="w-4 h-4 text-primary" />
                </div>
            ) : null
        },
        { id: "settings", label: t('sidebar.settings'), icon: <Settings className="w-5 h-5" /> },
    ]

    return (
        <div className="min-h-screen bg-background">
            <TutorialModal open={showTutorial} onOpenChange={setShowTutorial} />
            {/* Header */}
            <header className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
                <div className="flex items-center justify-between px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <div className="flex items-center gap-3">
                            <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-40" />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageToggle variant="compact" />
                        <NotificationsPanel />
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-semibold text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onLogout}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('header.logout')}</span>
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <aside
                    className={`${sidebarOpen ? "w-64" : "w-0"
                        } border-r border-border bg-card transition-all duration-300 overflow-hidden lg:w-64`}
                >
                    <nav className="p-4 space-y-2  h-[calc(100vh-73px)] overflow-y-auto">
                        {navItems.map((item) => (
                            <div key={item.id} className="relative">
                                <NavItem
                                    icon={item.icon}
                                    label={item.label}
                                    active={activeTab === item.id}
                                    onClick={() => {
                                        setActiveTab(item.id)
                                        setSidebarOpen(false)
                                    }}
                                />
                                {item.notification}
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        <div className="max-w-7xl mx-auto">
                            {activeTab === "overview" && <OverviewTab user={user} onNavigate={(tab) => setActiveTab(tab)} />}
                            {activeTab === "notes" && <NotesTab />}
                            {activeTab === "checklist" && <ChecklistTab />}
                            {activeTab === "ai" && <AISection planType={subscription?.plan_type || "basic"} />}
                            {activeTab === "goals" && <GoalsSection />}
                            {activeTab === "tutorial" && (
                                <TutorialTab onMarkWatched={() => setHasWatchedTutorial(true)} />
                            )}
                            {activeTab === "appointments" && <AppointmentsTab />}
                            {activeTab === "patients" && <PatientsTab />}
                            {activeTab === "financial" && <FinancialTab />}
                            {activeTab === "professionals" && <ProfessionalsTab />}
                            {activeTab === "reports" && <ReportsTab />}
                            {activeTab === "subscriptions" && <SubscriptionsTab subscription={subscription} />}
                            {activeTab === "support" && <SupportTab />}
                            {activeTab === "settings" && <SettingsTab />}
                        </div>
                    </div>
                </main>
            </div>
            {/* ThemeSettings shown only on the dashboard */}
            <ThemeSettings />
        </div>
    )
}

function NavItem({
    icon,
    label,
    active,
    onClick,
}: {
    icon: React.ReactNode
    label: string
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full cursor-pointer flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active
                ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md"
                : "text-foreground hover:bg-muted"
                }`}
        >
            {icon}
            <span className="font-medium text-sm">{label}</span>
        </button>
    )
}
