// Hello World
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import dynamic from "next/dynamic"
import { AnimatePresence, motion } from "motion/react"
import { LogOut, Menu, X, Loader2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { createClient } from "@/lib/supabase-client"
import LanguageToggle from "@/components/language-toggle"
import LeadGenForm from "@/components/lead-gen-form"
import { useToast } from "@/hooks/use-toast"
import { useActivityTracker } from "@/hooks/use-activity-tracker"
import { useFCM } from "@/hooks/use-fcm"
import { VwoMark } from "@/components/brand/vwo-mark"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DASHBOARD_NAV, isDashboardTab, type DashboardTabId } from "@/components/dashboard/nav-config"
import { BRAND } from "@/lib/brand"

// Abas carregadas sob demanda (divide o bundle e evita SSR de gráficos)
const OverviewTab = dynamic(() => import("./dashboard/overview-tab"), { loading: () => <TabLoading /> })
const AppointmentsTab = dynamic(() => import("./dashboard/appointments-tab"), { loading: () => <TabLoading /> })
const PatientsTab = dynamic(() => import("./dashboard/patients-tab"), { loading: () => <TabLoading /> })
const OdontogramTab = dynamic(() => import("./dashboard/odontogram-tab"), { loading: () => <TabLoading /> })
const TreatmentsTab = dynamic(() => import("./dashboard/treatments-tab"), { loading: () => <TabLoading /> })
const AnamnesisTab = dynamic(() => import("./dashboard/anamnesis-tab"), { loading: () => <TabLoading /> })
const DentalDocumentsTab = dynamic(() => import("./dashboard/dental-documents-tab"), { loading: () => <TabLoading /> })
const ReconciliationTab = dynamic(() => import("./dashboard/reconciliation-tab"), { loading: () => <TabLoading /> })
const ProfessionalsTab = dynamic(() => import("./dashboard/professionals-tab"), { loading: () => <TabLoading /> })
const SubscriptionsTab = dynamic(() => import("./dashboard/subscriptions-tab"), { loading: () => <TabLoading /> })
const FinancialTab = dynamic(() => import("./dashboard/financial-tab"), { ssr: false, loading: () => <TabLoading /> })
const AISection = dynamic(() => import("./dashboard/ai-section"), { loading: () => <TabLoading /> })
const GoalsSection = dynamic(() => import("./dashboard/goals-section").then((mod) => mod.GoalsSection), { loading: () => <TabLoading /> })
const SettingsTab = dynamic(() => import("./dashboard/settings-tab"), { loading: () => <TabLoading /> })
const SupportTab = dynamic(() => import("./dashboard/support-tab"), { loading: () => <TabLoading /> })
const RemindersTab = dynamic(() => import("./dashboard/reminders-tab"), { loading: () => <TabLoading /> })
const TutorialTab = dynamic(() => import("./dashboard/tutorial-tab"), { loading: () => <TabLoading /> })
const ImportTab = dynamic(() => import("./dashboard/import-tab"), { loading: () => <TabLoading /> })
const PriceTableTab = dynamic(() => import("./dashboard/price-table-tab"), { loading: () => <TabLoading /> })
const BudgetTab = dynamic(() => import("./dashboard/budget-tab"), { loading: () => <TabLoading /> })
const ClosingTab = dynamic(() => import("./dashboard/closing-tab"), { loading: () => <TabLoading /> })
const NotificationsPanel = dynamic(() => import("./notifications-panel"), { ssr: false })
const TutorialModal = dynamic(() => import("./tutorial-modal"), { ssr: false })
const ImportOnboardingModal = dynamic(() => import("./import-onboarding-modal"), { ssr: false })

function TabLoading() {
    return (
        <div className="flex items-center justify-center p-12" role="status" aria-live="polite">
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
            <span className="sr-only">Carregando…</span>
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
    const [activeTab, setActiveTab] = useState<DashboardTabId>("overview")
    const [showTutorial, setShowTutorial] = useState(false)
    const [hasWatchedTutorial, setHasWatchedTutorial] = useState(false)
    const [showImportOnboarding, setShowImportOnboarding] = useState(false)
    const [showLeadForm, setShowLeadForm] = useState(false)
    const [isTrial, setIsTrial] = useState(false)
    const supabase = useMemo(() => createClient(), [])
    const { toast } = useToast()
    const t = useTranslations("dashboard")
    const tSidebar = useTranslations("dashboard.sidebar")
    const tTitles = useTranslations("titles")
    const locale = useLocale()
    useFCM()
    useActivityTracker()

    const goToTab = useCallback((tab: DashboardTabId) => {
        setActiveTab(tab)
        setSidebarOpen(false)
        window.scrollTo({ top: 0, behavior: "smooth" })
    }, [])

    const checkLeadStatus = useCallback(() => {
        const leadSubmittedKey = `vwd:lead_gen_submitted_${user.email}`
        try {
            if (subscription && !localStorage.getItem(leadSubmittedKey)) setShowLeadForm(true)
        } catch {
            // armazenamento indisponível (modo privado): não exibe o formulário
        }
    }, [subscription, user.email])

    useEffect(() => {
        const loadTutorialStatus = async () => {
            try {
                const { data: { user: currentUser } } = await supabase.auth.getUser()
                if (!currentUser) return

                const { data } = await supabase
                    .from("user_settings")
                    .select("has_watched_tutorial")
                    .eq("user_id", currentUser.id)
                    .maybeSingle()

                const watched = data?.has_watched_tutorial || false
                setHasWatchedTutorial(watched)

                const hasSeenWelcome = localStorage.getItem("vwd:has_seen_welcome_modal")
                if (!hasSeenWelcome && (isNewUser || !watched)) {
                    setTimeout(() => setShowTutorial(true), 500)
                } else {
                    checkLeadStatus()
                }
            } catch (error) {
                console.error("Error loading tutorial status:", error)
            }
        }
        loadTutorialStatus()

        // Deep-link entre abas (ex.: lembretes → tutorial)
        const tabHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (isDashboardTab(detail)) goToTab(detail)
        }
        window.addEventListener("vwd:goto_tab", tabHandler as EventListener)
        return () => window.removeEventListener("vwd:goto_tab", tabHandler as EventListener)
    }, [supabase, isNewUser, checkLeadStatus, goToTab])

    // Detecção de teste gratuito apenas no cliente (evita divergência de hidratação)
    useEffect(() => {
        const lowerPlan = `${subscription?.plan_name || ""} ${subscription?.plan_type || ""} ${subscription?.user_plan || ""}`.toLowerCase()
        setIsTrial(lowerPlan.includes("free") || lowerPlan.includes("trial") || document.cookie.includes("vwd_is_trial=true"))
    }, [subscription])

    // Fecha a gaveta com Esc e trava a rolagem do fundo enquanto aberta
    useEffect(() => {
        if (!sidebarOpen) return
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSidebarOpen(false)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        window.addEventListener("keydown", onKey)
        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener("keydown", onKey)
        }
    }, [sidebarOpen])

    const activeItem = useMemo(
        () => DASHBOARD_NAV.flatMap((g) => g.items).find((item) => item.id === activeTab),
        [activeTab],
    )
    const sectionLabel = activeItem ? tSidebar(activeItem.labelKey) : tSidebar("overview")

    useEffect(() => {
        document.title = tTitles("dashboard", { section: sectionLabel })
    }, [sectionLabel, tTitles])

    const todayLabel = useMemo(() => {
        return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(new Date())
    }, [locale])

    const markers = useMemo(
        () => ({
            ...(hasWatchedTutorial ? {} : { tutorial: "dot" as const }),
            import: t("sidebar.new"),
        }),
        [hasWatchedTutorial, t],
    )

    const sidebarFooter = (
        <div className="flex items-center gap-3 px-2 py-1.5">
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary font-display text-sm font-semibold text-ink"
                aria-hidden
            >
                {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <button
                type="button"
                onClick={onLogout}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
                aria-label={t("header.logout")}
                title={t("header.logout")}
            >
                <LogOut className="h-4 w-4" aria-hidden />
            </button>
        </div>
    )

    return (
        <div className="min-h-screen bg-surface font-sans text-foreground">
            {showLeadForm && (
                <LeadGenForm
                    onComplete={(data) => {
                        fetch("/api/leads", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(data),
                        }).catch((e) => console.error("Failed to save lead:", e))
                        setShowLeadForm(false)
                        try {
                            localStorage.setItem(`vwd:lead_gen_submitted_${user.email}`, "true")
                        } catch {
                            // ignorado
                        }
                        toast({ title: t("leadForm.successTitle"), description: t("leadForm.successDesc") })
                    }}
                />
            )}
            <TutorialModal
                open={showTutorial}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowTutorial(false)
                        try {
                            localStorage.setItem("vwd:has_seen_welcome_modal", "true")
                        } catch {
                            // ignorado
                        }
                        checkLeadStatus()
                    } else {
                        setShowTutorial(true)
                    }
                }}
            />
            <ImportOnboardingModal
                open={showImportOnboarding}
                onOpenChange={setShowImportOnboarding}
                onNavigateToImport={() => goToTab("import")}
                onDismiss={() => setShowImportOnboarding(false)}
            />

            {/* Barra lateral fixa (desktop) */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] border-r border-border lg:block" aria-label={BRAND.name}>
                <DashboardSidebar activeTab={activeTab} onSelect={goToTab} markers={markers} footer={sidebarFooter} />
            </aside>

            {/* Gaveta (mobile/tablet) */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            key="scrim"
                            className="fixed inset-0 z-40 bg-[#0f1f33]/40 lg:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            aria-hidden
                        />
                        <motion.aside
                            key="drawer"
                            className="fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] border-r border-border shadow-xl lg:hidden"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 32 }}
                            role="dialog"
                            aria-modal="true"
                            aria-label={tSidebar("navLabel")}
                        >
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(false)}
                                className="absolute right-2 top-2 z-10 flex h-12 w-12 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-ink"
                                aria-label={t("header.closeMenu")}
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                            <DashboardSidebar activeTab={activeTab} onSelect={goToTab} markers={markers} footer={sidebarFooter} staticLogo />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <div className="lg:pl-[272px]">
                {/* Cabeçalho */}
                <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="-ml-2 flex h-12 w-12 items-center justify-center rounded-sm text-ink hover:bg-surface lg:hidden"
                            aria-label={t("header.openMenu")}
                            aria-expanded={sidebarOpen}
                        >
                            <Menu className="h-5 w-5" aria-hidden />
                        </button>
                        <VwoMark className="w-7 lg:hidden" decorative />

                        <div className="min-w-0 flex-1">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.h1
                                    key={activeTab}
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: -8, opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                                    className="truncate font-display text-[17px] font-semibold tracking-[-0.01em] text-ink sm:text-lg"
                                >
                                    {sectionLabel}
                                </motion.h1>
                            </AnimatePresence>
                            <p className="hidden truncate text-xs capitalize text-muted-foreground sm:block">{todayLabel}</p>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            {isTrial && (
                                <span className="hidden rounded-sm border border-primary/30 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary sm:inline-block">
                                    {t("header.freeTrial")}
                                </span>
                            )}
                            <LanguageToggle variant="icon" className="lg:hidden" />
                            <LanguageToggle variant="compact" className="hidden lg:flex" />
                            <NotificationsPanel />
                        </div>
                    </div>
                </header>

                <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
                    <div className="mx-auto max-w-[1360px]">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {activeTab === "overview" && (
                                    <OverviewTab
                                        user={user}
                                        onNavigate={(tab: string) => {
                                            if (isDashboardTab(tab)) goToTab(tab)
                                        }}
                                    />
                                )}
                                {activeTab === "import" && <ImportTab />}
                                {activeTab === "reminders" && <RemindersTab />}
                                {activeTab === "ai" && <AISection planType={subscription?.plan_type || "basic"} />}
                                {activeTab === "goals" && <GoalsSection />}
                                {activeTab === "tutorial" && <TutorialTab onMarkWatched={() => setHasWatchedTutorial(true)} />}
                                {activeTab === "appointments" && <AppointmentsTab />}
                                {activeTab === "patients" && <PatientsTab />}
                                {activeTab === "odontogram" && <OdontogramTab />}
                                {activeTab === "treatments" && <TreatmentsTab />}
                                {activeTab === "anamnesis" && <AnamnesisTab />}
                                {activeTab === "dentalDocuments" && <DentalDocumentsTab />}
                                {activeTab === "financial" && <FinancialTab />}
                                {activeTab === "reconciliation" && <ReconciliationTab />}
                                {activeTab === "price-table" && <PriceTableTab />}
                                {activeTab === "budgets" && <BudgetTab />}
                                {activeTab === "closing" && <ClosingTab />}
                                {activeTab === "professionals" && <ProfessionalsTab />}
                                {activeTab === "subscriptions" && <SubscriptionsTab subscription={subscription} />}
                                {activeTab === "support" && <SupportTab />}
                                {activeTab === "settings" && <SettingsTab />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    )
}
