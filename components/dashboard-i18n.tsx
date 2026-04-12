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
    Loader2,
    Upload,
    BellRing,
} from "lucide-react"

import dynamic from 'next/dynamic'
import Image from "next/image"
import { createClient } from "@/lib/supabase-client"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"
import LeadGenForm from "@/components/lead-gen-form"
import { useToast } from "@/hooks/use-toast"
import { useActivityTracker } from "@/hooks/use-activity-tracker"
import { useFCM } from "@/hooks/use-fcm"

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
const RemindersTab = dynamic(() => import("./dashboard/reminders-tab"), { loading: () => <TabLoading /> })
const TutorialTab = dynamic(() => import("./dashboard/tutorial-tab"), { loading: () => <TabLoading /> })
const ImportTab = dynamic(() => import("./dashboard/import-tab"), { loading: () => <TabLoading /> })
const NotificationsPanel = dynamic(() => import("./notifications-panel"), { ssr: false })
const TutorialModal = dynamic(() => import("./tutorial-modal"), { ssr: false })
const ImportOnboardingModal = dynamic(() => import("./import-onboarding-modal"), { ssr: false })
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
    plan_name: string
    plan_type: "basic" | "premium" | "master" | "free"
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
    user_plan?: string
}

interface DashboardProps {
    user: { email: string; name: string }
    onLogout: () => void
    subscription?: Subscription
    isNewUser?: boolean
}

export default function Dashboard({ user, onLogout, subscription, isNewUser = false }: DashboardProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")
    const [showTutorial, setShowTutorial] = useState(false)
    const [hasWatchedTutorial, setHasWatchedTutorial] = useState(false)
    const [showImportOnboarding, setShowImportOnboarding] = useState(false)
    const [hasSeenImportFeature, setHasSeenImportFeature] = useState(true)
    const [hasClickedImport, setHasClickedImport] = useState(false)
    const [showLeadForm, setShowLeadForm] = useState(false)
    const supabase = createClient()
    const { toast } = useToast()
    const t = useTranslations('dashboard')
    const tTitles = useTranslations('titles')
    useFCM()

    // Track user activity (heartbeat every 5 min)
    useActivityTracker()

    useEffect(() => {
        loadTutorialStatus()

        // Tab switching listener for deep-linking
        const tabHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (detail) {
                setActiveTab(detail)
                // Scroll to top when switching tabs
                window.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }
        window.addEventListener('vwd:goto_tab', tabHandler as EventListener)
        return () => window.removeEventListener('vwd:goto_tab', tabHandler as EventListener)
    }, [])

    const checkLeadStatus = () => {
        // Show lead form if new user, has subscription and hasn't submitted before for this account
        const leadSubmittedKey = `vwd:lead_gen_submitted_${user.email}`
        const leadSubmitted = localStorage.getItem(leadSubmittedKey)
        if (subscription && !leadSubmitted) {
            setShowLeadForm(true)
        }
    }

    const dismissWelcomeModal = () => {
        setShowTutorial(false)
        localStorage.setItem('vwd:has_seen_welcome_modal', 'true')
    }

    const loadTutorialStatus = async () => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) return

            const { data } = await supabase
                .from('user_settings')
                .select('has_watched_tutorial')
                .eq('user_id', currentUser.id)
                .maybeSingle()

            const watched = data?.has_watched_tutorial || false
            setHasWatchedTutorial(watched)
            
            const hasSeenWelcome = localStorage.getItem('vwd:has_seen_welcome_modal')
            if (!hasSeenWelcome && (isNewUser || !watched)) {
                // Show welcome modal automatically if they haven't seen it AND (it's signup OR they never watched tutorial)
                setTimeout(() => {
                    setShowTutorial(true)
                }, 500)
            } else {
                // If they already watched it (or we don't need to show it), check the lead status
                checkLeadStatus()
            }
        } catch (error) {
            console.error('Error loading tutorial status:', error)
        }
    }

    const loadImportFeatureStatus = async () => {
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) return

            const { data } = await supabase
                .from('user_settings')
                .select('has_seen_import_feature')
                .eq('user_id', currentUser.id)
                .maybeSingle()

            const seen = data?.has_seen_import_feature ?? false
            setHasSeenImportFeature(seen)
            setHasClickedImport(seen)

            if (!seen) {
                setTimeout(() => {
                    setShowImportOnboarding(true)
                }, 1500)
            }
        } catch (error) {
            console.error('Error loading import feature status:', error)
        }
    }

    const dismissImportOnboarding = async () => {
        setHasSeenImportFeature(true)
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser()
            if (!currentUser) return

            await supabase
                .from('user_settings')
                .upsert({
                    user_id: currentUser.id,
                    has_seen_import_feature: true,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' })
        } catch (error) {
            console.error('Error updating import feature status:', error)
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
        {
            id: "import",
            label: t('sidebar.import'),
            icon: <Upload className="w-5 h-5" />,
            badge: t('sidebar.new'),
            pulsing: false,
        },
        { id: "notes", label: t('sidebar.notes'), icon: <StickyNote className="w-5 h-5" /> },
        { id: "checklist", label: t('sidebar.checklist'), icon: <List className="w-5 h-5" /> },
        { id: "reminders", label: t('sidebar.reminders'), icon: <BellRing className="w-5 h-5" /> },
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

    useEffect(() => {
        const sectionName = navItems.find(item => item.id === activeTab)?.label || t('sidebar.overview')
        document.title = tTitles('dashboard', { section: sectionName })
    }, [activeTab, tTitles, navItems])

    return (
        <div className="min-h-screen bg-[#f8fafc] font-sans">
            {showLeadForm && (
                <LeadGenForm 
                    onComplete={(data) => {
                        try {
                            fetch('/api/leads', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(data)
                            });
                        } catch (e) {
                            console.error("Failed to save lead:", e)
                        }
                        setShowLeadForm(false)
                        const leadSubmittedKey = `vwd:lead_gen_submitted_${user.email}`
                        localStorage.setItem(leadSubmittedKey, "true")
                        toast({
                            title: t('leadForm.successTitle'),
                            description: t('leadForm.successDesc'),
                        })
                    }} 
                />
            )}
            <TutorialModal 
                open={showTutorial} 
                onOpenChange={(open) => {
                    if (!open) {
                        dismissWelcomeModal()
                        checkLeadStatus()
                    } else {
                        setShowTutorial(true)
                    }
                }} 
            />
            <ImportOnboardingModal
                open={showImportOnboarding}
                onOpenChange={setShowImportOnboarding}
                onNavigateToImport={() => {
                    setActiveTab("import")
                    setHasClickedImport(true)
                }}
                onDismiss={dismissImportOnboarding}
            />
            {/* Header */}
            <header className="border-b border-slate-200 bg-white sticky top-0 z-40 h-14 sm:h-16">
                <div className="flex items-center justify-between px-2 sm:px-6 h-full">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <div className="flex items-center gap-1.5 sm:gap-3">
                            <Image width={512} height={160} alt="ViraWeb logo" src="/viraweb3.png" className="w-24 sm:w-40" style={{ height: "auto" }} priority />
                            {(() => {
                                const lowerPlan = `${subscription?.plan_name || ""} ${subscription?.plan_type || ""} ${subscription?.user_plan || ""}`.toLowerCase()
                                
                                const isTrialOrFree = 
                                    lowerPlan.includes("free") || lowerPlan.includes("trial") ||
                                    (typeof window !== 'undefined' && document.cookie.includes('vwd_is_trial=true'))

                                if (isTrialOrFree) {
                                    return (
                                        <span className="bg-primary text-primary-foreground text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-none shadow-sm uppercase tracking-wider flex items-center gap-1 border border-primary/20">
                                            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                            {t('header.freeTrial')}
                                        </span>
                                    )
                                }
                                return null
                            })()}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-4">
                        <LanguageToggle variant="icon" className="sm:flex lg:hidden" />
                        <LanguageToggle variant="compact" className="hidden lg:flex" />
                        <NotificationsPanel />
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-[#0f172a]">{user.name}</p>
                            <p className="text-xs font-medium text-slate-500">{user.email}</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onLogout}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-none h-8 sm:h-9"
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
                    className={`fixed inset-y-0 left-0 lg:relative z-50 transition-all duration-300 overflow-hidden shrink-0 border-r border-slate-200 bg-white ${
                        sidebarOpen ? "w-full lg:w-64 translate-x-0" : "-translate-x-full lg:translate-x-0 w-0 lg:w-64"
                    }`}
                >
                    <nav className="p-4 space-y-1 h-[calc(100vh-64px)] overflow-hidden w-full lg:w-64">
                        {navItems.map((item) => (
                            <div key={item.id} className="relative">
                                <NavItem
                                    icon={item.icon}
                                    label={item.label}
                                    active={activeTab === item.id}
                                    badge={(item as { badge?: string }).badge}
                                    pulsing={(item as { pulsing?: boolean }).pulsing}
                                    onClick={() => {
                                        setActiveTab(item.id)
                                        setSidebarOpen(false)
                                        if (item.id === "import") {
                                            setHasClickedImport(true)
                                        }
                                    }}
                                />
                                {(item as { notification?: React.ReactNode }).notification}
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-auto">
                    <div className="p-4 sm:p-6 lg:p-8">
                        <div className="max-w-7xl mx-auto">
                            {activeTab === "overview" && <OverviewTab user={user} onNavigate={(tab) => setActiveTab(tab)} />}
                            {activeTab === "import" && <ImportTab />}
                            {activeTab === "notes" && <NotesTab />}
                            {activeTab === "checklist" && <ChecklistTab />}
                            {activeTab === "reminders" && <RemindersTab />}
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
    badge,
    pulsing,
}: {
    icon: React.ReactNode
    label: string
    active: boolean
    onClick: () => void
    badge?: string
    pulsing?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-none transition-all duration-200 ${active
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                } ${pulsing ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-white animate-pulse" : ""}`}
        >
            <div className={`${active ? "text-primary-foreground" : "text-slate-400 group-hover:text-slate-600"}`}>
                {icon}
            </div>
            <span className={`text-[14px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
            {badge && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#1e293b] text-white shadow-sm">
                    {badge}
                </span>
            )}
        </button>
    )
}
