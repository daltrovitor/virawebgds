"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  LogOut,
  Menu,
  X,
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
  Upload,
  BellRing,
} from "lucide-react"
import ChecklistTab from "./dashboard/checklist-tab"
import RemindersTab from "./dashboard/reminders-tab"
import OverviewTab from "./dashboard/overview-tab"
import PatientsTab from "./dashboard/patients-tab"
import ProfessionalsTab from "./dashboard/professionals-tab"
import ReportsTab from "./dashboard/reports-tab"
import SubscriptionsTab from "./dashboard/subscriptions-tab"
import FinancialTab from "./dashboard/financial-tab"
import AISection from "./dashboard/ai-section"
import { GoalsSection } from "./dashboard/goals-section"
import SettingsTab from "./dashboard/settings-tab"
import SupportTab from "./dashboard/support-tab"
import NotesTab from "./dashboard/notes-tab"
import TutorialTab from "./dashboard/tutorial-tab"
import ImportTab from "./dashboard/import-tab"
import NotificationsPanel from "./notifications-panel"
import TutorialModal from "./tutorial-modal"
import ImportOnboardingModal from "./import-onboarding-modal"
import ThemeSettings from "./dashboard/theme-settings"
import Image from "next/image"
import { createClient } from "@/lib/supabase-client"

interface Subscription {
  id: string
  plan_name: "basic" | "premium" | "master" | string
  plan_type: "basic" | "premium" | "master" | string
  user_plan?: string
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("overview")
  const [showTutorial, setShowTutorial] = useState(false)
  const [hasWatchedTutorial, setHasWatchedTutorial] = useState(false)
  const [showImportOnboarding, setShowImportOnboarding] = useState(false)
  const [hasSeenImportFeature, setHasSeenImportFeature] = useState(true)
  const [hasClickedImport, setHasClickedImport] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadTutorialStatus()
    loadImportFeatureStatus()
    
    // Check if welcome modal was already seen
    const hasSeenWelcome = localStorage.getItem('vwd:has_seen_welcome_modal')
    if (isNewUser || !hasSeenWelcome) {
      setTimeout(() => setShowTutorial(true), 1000)
    }
  }, [isNewUser])

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
        .single()

      setHasWatchedTutorial(data?.has_watched_tutorial || false)
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
        // Small delay to not compete with tutorial modal
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
      label: "Visão Geral",
      icon: <Home className="w-5 h-5" />,
      notification: !hasWatchedTutorial ? (
        <div className="absolute -right-1 -top-1">
          <AlertCircle className="w-4 h-4 text-primary animate-pulse" />
        </div>
      ) : null
    },
    {
      id: "import",
      label: "Importar dados",
      icon: <Upload className="w-5 h-5" />,
      badge: "Novo",
      pulsing: !hasClickedImport,
    },
    { id: "notes", label: "Notas", icon: <StickyNote className="w-5 h-5" /> },
    { id: "checklist", label: "Checklist", icon: <List className="w-5 h-5" /> },
    { id: "reminders", label: "Lembretes", icon: <BellRing className="w-5 h-5" /> },
    { id: "ai", label: "ViraBot IA", icon: <Sparkles className="w-5 h-5" /> },
    { id: "goals", label: "Metas", icon: <Target className="w-5 h-5" /> },
    { id: "patients", label: "Clientes", icon: <Users className="w-5 h-5" /> },
    { id: "financial", label: "Financeiro", icon: <CreditCard className="w-5 h-5" /> },
    { id: "professionals", label: "Profissionais", icon: <Users className="w-5 h-5" /> },
    { id: "reports", label: "Relatórios", icon: <BarChart3 className="w-5 h-5" /> },
    { id: "subscriptions", label: "Assinatura", icon: <CreditCard className="w-5 h-5" /> },
    { id: "support", label: "Suporte", icon: <HeadphonesIcon className="w-5 h-5" /> },
    {
      id: "tutorial",
      label: "Tutorial",
      icon: <PlayCircle className="w-5 h-5" />,
      notification: !hasWatchedTutorial ? (
        <div className="absolute -right-1 -top-1">
          <AlertCircle className="w-4 h-4 text-primary" />
        </div>
      ) : null
    },
    { id: "settings", label: "Configurações", icon: <Settings className="w-5 h-5" /> },
  ]

  return (
    <div className="min-h-screen bg-background">
      <TutorialModal open={showTutorial} onOpenChange={(open) => {
        if (!open) dismissWelcomeModal()
        else setShowTutorial(true)
      }} />
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
      <header className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
        <div className="flex items-center justify-between px-2 sm:px-6 py-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-1 sm:gap-3 flex-wrap">
              <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-24 sm:w-32" />
              {(() => {
                const planName = (subscription?.plan_name || "").toLowerCase()
                const planType = (subscription?.plan_type || "").toLowerCase()
                const userPlan = (subscription?.user_plan || "").toLowerCase()
                const isFreeOrTrial = 
                  planName.includes("free") || planName.includes("trial") ||
                  planType.includes("free") || planType.includes("trial") ||
                  userPlan.includes("free") || userPlan.includes("trial") ||
                  (typeof window !== 'undefined' && document.cookie.includes('vwd_is_trial=true'))

                if (isFreeOrTrial) {
                  const displayTier = planName.includes("master") || planType.includes("master") || userPlan.includes("master") 
                    ? "MASTER" 
                    : "PREMIUM"

                  return (
                    <span className="inline-flex items-center gap-1 rounded-none bg-primary px-1.5 py-0.5 text-[9px] font-black text-primary-foreground shadow-sm whitespace-nowrap">
                      <Sparkles className="w-3 h-3" />
                      TRIAL {displayTier}
                    </span>
                  )
                }
                return null
              })()}
            </div>
          </div>

          <div className="flex items-center gap-4">
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
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 lg:relative lg:z-30 ${sidebarOpen ? "translate-x-0 w-full lg:w-64" : "-translate-x-full lg:translate-x-0 w-0 lg:w-64"
            } border-r border-border bg-white transition-all duration-300 overflow-hidden ${!sidebarOpen ? "pointer-events-none lg:pointer-events-auto" : "pointer-events-auto"}`}
        >
          <nav className="p-4 space-y-2 h-[calc(100vh-73px)] overflow-hidden">
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
              {activeTab === "patients" && <PatientsTab />}
              {activeTab === "financial" && <FinancialTab />}
              {activeTab === "professionals" && <ProfessionalsTab />}
              {activeTab === "reports" && <ReportsTab />}
              {activeTab === "subscriptions" && <SubscriptionsTab subscription={subscription} />}
              {activeTab === "support" && <SupportTab />}
              {activeTab === "settings" && <SettingsTab subscription={subscription} />}
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
      className={`w-full cursor-pointer flex items-center gap-3 px-4 py-3 rounded-none transition-all duration-200 ${active
        ? "bg-primary text-primary-foreground shadow-md"
        : "text-foreground hover:bg-muted"
        } ${pulsing ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-card animate-pulse" : ""}`}
    >
      {icon}
      <span className="font-bold text-[13px] uppercase tracking-tight">{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-none bg-primary text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  )
}
