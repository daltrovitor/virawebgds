"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Menu, X, Calendar, Users, BarChart3, Home,
    CreditCard, List, Sparkles, Target, Settings, HeadphonesIcon, StickyNote, PlayCircle, LogOut, Upload
} from "lucide-react"
import { useTranslations } from 'next-intl'
import Image from "next/image"
import LanguageToggle from "@/components/language-toggle"

// Import real components
import OverviewTab from "./dashboard/overview-tab"
import AppointmentsTab from "./dashboard/appointments-tab"
import PatientsTab from "./dashboard/patients-tab"
import ProfessionalsTab from "./dashboard/professionals-tab"
import ReportsTab from "./dashboard/reports-tab"
import FinancialTab from "./dashboard/financial-tab"
import AISection from "./dashboard/ai-section"
import { GoalsSection } from "./dashboard/goals-section"
import NotesTab from "./dashboard/notes-tab"
import ChecklistTab from "./dashboard/checklist-tab"
import SupportTab from "./dashboard/support-tab"
import TutorialTab from "./dashboard/tutorial-tab"
import ImportTab from "./dashboard/import-tab"
import SettingsTab from "./dashboard/settings-tab"
import ThemeSettings from "./dashboard/theme-settings"
import SubscriptionsTab from "./dashboard/subscriptions-tab"
import NotificationsPanel from "./notifications-panel"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export default function DemoDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [activeTab, setActiveTab] = useState("overview")
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const tSidebar = useTranslations('dashboard.sidebar')
    const tCommon = useTranslations('common')
    const tImport = useTranslations('dashboard.importTab')

    const menuItems = [
        { id: "overview", label: tSidebar('overview'), icon: <Home className="w-5 h-5" /> },
        { id: "import", label: tSidebar('import'), icon: <Upload className="w-5 h-5" /> },
        { id: "notes", label: tSidebar('notes'), icon: <StickyNote className="w-5 h-5" /> },
        { id: "checklist", label: tSidebar('checklist'), icon: <List className="w-5 h-5" /> },
        { id: "ai", label: tSidebar('ai'), icon: <Sparkles className="w-5 h-5 text-purple-500" /> },
        { id: "goals", label: tSidebar('goals'), icon: <Target className="w-5 h-5" /> },
        { id: "patients", label: tSidebar('patients'), icon: <Users className="w-5 h-5" /> },
        { id: "financial", label: tSidebar('financial'), icon: <CreditCard className="w-5 h-5" /> },
        { id: "professionals", label: tSidebar('professionals'), icon: <Users className="w-5 h-5" /> },
        { id: "reports", label: tSidebar('reports'), icon: <BarChart3 className="w-5 h-5" /> },
        { id: "subscriptions", label: tSidebar('subscriptions'), icon: <CreditCard className="w-5 h-5" /> },
        { id: "support", label: tSidebar('support'), icon: <HeadphonesIcon className="w-5 h-5" /> },
        { id: "tutorial", label: tSidebar('tutorial'), icon: <PlayCircle className="w-5 h-5" /> },
        { id: "settings", label: tSidebar('settings'), icon: <Settings className="w-5 h-5" /> },
    ]

    const handleImportDemoSuccess = (entity: string, items: any[]) => {
        // Map entity to storage key
        const storageKeys: Record<string, string> = {
            'clients': 'demo_patients',
            'professionals': 'demo_professionals',
            'notes': 'demo_notes',
            'checklist': 'demo_todos',
            'goals': 'demo_goals'
        }

        const key = storageKeys[entity]
        if (key) {
            const existing = JSON.parse(sessionStorage.getItem(key) || '[]')
            const newItems = items.map(it => ({
                ...it,
                id: Math.random().toString(36).substr(2, 9),
                created_at: new Date().toISOString(),
                // Map some fields if necessary (clients use 'name' instead of 'nome' in DB but 'nome' in extraction)
                name: it.nome || it.name,
                status: it.status || 'active'
            }))
            sessionStorage.setItem(key, JSON.stringify([...newItems, ...existing]))

            // Trigger update event for tabs
            window.dispatchEvent(new Event('demoDataUpdated'))
        }

        setTimeout(() => setIsImportModalOpen(false), 2000)
    }

    const renderTab = () => {
        const props = { isDemo: true }
        switch (activeTab) {
            case "overview": return <OverviewTab user={{ name: tCommon('visitor'), email: "demo@viraweb.com" }} onNavigate={setActiveTab} {...props} />
            case "import": return <ImportTab isDemo={true} onImportSuccess={handleImportDemoSuccess} />
            case "patients": return <PatientsTab {...props} />
            case "professionals": return <ProfessionalsTab {...props} />
            case "financial": return <FinancialTab {...props} />
            case "ai": return <AISection planType="premium" {...props} />
            case "goals": return <GoalsSection {...props} />
            case "notes": return <NotesTab {...props} />
            case "checklist": return <ChecklistTab {...props} />
            case "reports": return <ReportsTab {...props} />
            case "subscriptions": return <SubscriptionsTab userId="demo-user" {...props} />
            case "tutorial": return <TutorialTab {...props} />
            case "support": return <SupportTab {...props} />
            case "settings": return <SettingsTab {...props} />
            default: return <OverviewTab user={{ name: tCommon('visitor'), email: "demo@viraweb.com" }} onNavigate={setActiveTab} {...props} />
        }
    }

    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? "w-64" : "w-20"} bg-card border-r border-border transition-all duration-300 flex flex-col z-50`}>
                <div className="p-4 flex items-center justify-between">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Image src="/viraweb3.png" alt="ViraWeb" width={140} height={40} className="h-auto w-auto max-h-10" />
                        </div>
                    )}
                    {!sidebarOpen && <Image src="/viraweb3.png" alt="ViraWeb" width={32} height={32} className="mx-auto h-8 w-8 object-contain" />}
                    <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden sm:flex">
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                </div>

                <nav className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === item.id ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"}`}
                        >
                            {item.icon}
                            {sidebarOpen && <span className="font-medium">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-border">
                    <button onClick={() => window.location.href = "/"} className="w-full flex items-center gap-3 p-3 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
                        <LogOut className="w-5 h-5" />
                        {sidebarOpen && <span className="font-medium">{tSidebar('exitDemo')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-muted/30">
                <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="sm:hidden">
                            <Menu className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-foreground">
                                {menuItems.find(i => i.id === activeTab)?.label}
                            </h2>
                            <Badge variant="outline" className="hidden sm:flex bg-primary/10 text-primary border-primary/20 animate-pulse">
                                Modo Demonstração
                            </Badge>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4">

                        <NotificationsPanel isDemo={true} />
                        <LanguageToggle />
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            V
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {renderTab()}
                    </div>
                </div>
            </main>

            <ThemeSettings />
        </div>
    )
}
