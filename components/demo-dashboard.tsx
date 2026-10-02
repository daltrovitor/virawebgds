// Hello World
"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { LogOut, Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"
import LanguageToggle from "@/components/language-toggle"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { DASHBOARD_NAV, isDashboardTab, type DashboardTabId } from "@/components/dashboard/nav-config"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"

// Componentes reais em modo demonstração (dados de sessão, sem Supabase)
import OverviewTab from "./dashboard/overview-tab"
import AppointmentsTab from "./dashboard/appointments-tab"
import OdontogramTab from "./dashboard/odontogram-tab"
import TreatmentsTab from "./dashboard/treatments-tab"
import AnamnesisTab from "./dashboard/anamnesis-tab"
import DentalDocumentsTab from "./dashboard/dental-documents-tab"
import ReconciliationTab from "./dashboard/reconciliation-tab"
import PatientsTab from "./dashboard/patients-tab"
import ProfessionalsTab from "./dashboard/professionals-tab"
import FinancialTab from "./dashboard/financial-tab"
import PriceTableTab from "./dashboard/price-table-tab"
import BudgetTab from "./dashboard/budget-tab"
import ClosingTab from "./dashboard/closing-tab"
import AISection from "./dashboard/ai-section"
import { GoalsSection } from "./dashboard/goals-section"
import RemindersTab from "./dashboard/reminders-tab"
import SupportTab from "./dashboard/support-tab"
import TutorialTab from "./dashboard/tutorial-tab"
import ImportTab from "./dashboard/import-tab"
import SettingsTab from "./dashboard/settings-tab"
import SubscriptionsTab from "./dashboard/subscriptions-tab"
import NotificationsPanel from "./notifications-panel"

interface DemoDashboardProps {
    showFullPage?: boolean
    /** Sobrescreve a altura (ex.: "h-full" dentro da página /demo). */
    className?: string
}

type DemoRecord = Record<string, unknown> & { nome?: string; name?: string; status?: string }

export default function DemoDashboard({ showFullPage = true, className }: DemoDashboardProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<DashboardTabId>("overview")
    const tSidebar = useTranslations("dashboard.sidebar")
    const tCommon = useTranslations("common")

    const activeItem = DASHBOARD_NAV.flatMap((g) => g.items).find((i) => i.id === activeTab)

    // Atalhos internos (ex.: "Novo orçamento" na ficha do paciente)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            if (isDashboardTab(detail)) setActiveTab(detail)
        }
        window.addEventListener("vwd:goto_tab", handler as EventListener)
        return () => window.removeEventListener("vwd:goto_tab", handler as EventListener)
    }, [])

    const selectTab = (tab: DashboardTabId) => {
        setActiveTab(tab)
        setSidebarOpen(false)
    }

    const handleImportDemoSuccess = (entity: string, items: DemoRecord[]) => {
        const storageKeys: Record<string, string> = {
            clients: "demo_patients",
            professionals: "demo_professionals",
            goals: "demo_goals",
        }
        const key = storageKeys[entity]
        if (!key) return
        try {
            const existing = JSON.parse(sessionStorage.getItem(key) || "[]") as DemoRecord[]
            const newItems = items.map((it) => ({
                ...it,
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                name: it.nome || it.name,
                status: it.status || "active",
            }))
            sessionStorage.setItem(key, JSON.stringify([...newItems, ...existing]))
            window.dispatchEvent(new Event("demoDataUpdated"))
        } catch {
            // armazenamento de sessão indisponível: a demo segue sem persistir
        }
    }

    const visitor = { name: tCommon("visitor"), email: "demo@viraweb.online" }
    const renderTab = () => {
        const props = { isDemo: true }
        switch (activeTab) {
            case "import": return <ImportTab isDemo={true} onImportSuccess={handleImportDemoSuccess} />
            case "appointments": return <AppointmentsTab {...props} />
            case "patients": return <PatientsTab {...props} />
            case "odontogram": return <OdontogramTab {...props} />
            case "treatments": return <TreatmentsTab {...props} />
            case "anamnesis": return <AnamnesisTab {...props} />
            case "dentalDocuments": return <DentalDocumentsTab {...props} />
            case "financial": return <FinancialTab {...props} />
            case "reconciliation": return <ReconciliationTab />
            case "price-table": return <PriceTableTab />
            case "budgets": return <BudgetTab {...props} />
            case "closing": return <ClosingTab />
            case "professionals": return <ProfessionalsTab {...props} />
            case "ai": return <AISection planType="premium" {...props} />
            case "goals": return <GoalsSection {...props} />
            case "reminders": return <RemindersTab {...props} />
            case "subscriptions": return <SubscriptionsTab userId="demo-user" {...props} />
            case "tutorial": return <TutorialTab {...props} />
            case "support": return <SupportTab {...props} />
            case "settings": return <SettingsTab {...props} />
            default:
                return (
                    <OverviewTab
                        user={visitor}
                        onNavigate={(tab: string) => isDashboardTab(tab) && setActiveTab(tab)}
                        {...props}
                    />
                )
        }
    }

    const exitButton = (
        <button
            type="button"
            onClick={() => { window.location.href = "/" }}
            className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-ink"
        >
            <LogOut className="h-4 w-4" aria-hidden />
            {tSidebar("exitDemo")}
        </button>
    )

    return (
        <div className={cn("relative flex overflow-hidden border border-border bg-surface", showFullPage ? "h-screen" : "h-[640px]", className)}>
            <aside className="hidden w-[248px] shrink-0 border-r border-border md:block" aria-label={BRAND.name}>
                <DashboardSidebar activeTab={activeTab} onSelect={selectTab} footer={exitButton} staticLogo />
            </aside>

            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            className="absolute inset-0 z-40 bg-[#0f1f33]/40 md:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            aria-hidden
                        />
                        <motion.aside
                            className="absolute inset-y-0 left-0 z-50 w-[min(84%,300px)] border-r border-border shadow-xl md:hidden"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 32 }}
                        >
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(false)}
                                className="absolute right-1 top-2 z-10 flex h-12 w-12 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface"
                                aria-label={tCommon("closeMenu")}
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>
                            <DashboardSidebar activeTab={activeTab} onSelect={selectTab} footer={exitButton} staticLogo />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen(true)}
                            className="-ml-2 flex h-12 w-12 items-center justify-center rounded-sm text-ink hover:bg-surface md:hidden"
                            aria-label={tCommon("openMenu")}
                        >
                            <Menu className="h-5 w-5" aria-hidden />
                        </button>
                        <p className="truncate font-display text-[15px] font-semibold text-ink">
                            {activeItem ? tSidebar(activeItem.labelKey) : ""}
                        </p>
                        <span className="hidden rounded-sm border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline-block">
                            {tCommon("demoMode")}
                        </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <NotificationsPanel isDemo={true} />
                        <LanguageToggle />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 sm:p-6" data-lenis-prevent>
                    <div className="mx-auto max-w-7xl">{renderTab()}</div>
                </div>
            </div>
        </div>
    )
}
