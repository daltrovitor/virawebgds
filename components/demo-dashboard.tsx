"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Menu, X, Calendar, Users, BarChart3, Home,
    CreditCard, List, Sparkles, Target, Settings, HeadphonesIcon, StickyNote, PlayCircle, LogOut, Upload, BellRing
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
import RemindersTab from "./dashboard/reminders-tab"
import SupportTab from "./dashboard/support-tab"
import TutorialTab from "./dashboard/tutorial-tab"
import ImportTab from "./dashboard/import-tab"
import SettingsTab from "./dashboard/settings-tab"
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

interface DemoDashboardProps {
    showFullPage?: boolean;
}

export default function DemoDashboard({ showFullPage = true }: DemoDashboardProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)
    const tSidebar = useTranslations('dashboard.sidebar')
    const tCommon = useTranslations('common')
    const tImport = useTranslations('dashboard.importTab')
    const tDashboard = useTranslations('dashboard')

    const menuItems = [
        { id: "overview", label: tSidebar('overview'), icon: <Home className="w-5 h-5" /> },
        { id: "import", label: tSidebar('import'), icon: <Upload className="w-5 h-5" /> },
        { id: "notes", label: tSidebar('notes'), icon: <StickyNote className="w-5 h-5" /> },
        { id: "checklist", label: tSidebar('checklist'), icon: <List className="w-5 h-5" /> },
        { id: "reminders", label: tSidebar('reminders'), icon: <BellRing className="w-5 h-5" /> },
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
                name: it.nome || it.name,
                status: it.status || 'active'
            }))
            sessionStorage.setItem(key, JSON.stringify([...newItems, ...existing]))
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
            case "reminders": return <RemindersTab {...props} />
            case "reports": return <ReportsTab {...props} />
            case "subscriptions": return <SubscriptionsTab userId="demo-user" {...props} />
            case "tutorial": return <TutorialTab {...props} />
            case "support": return <SupportTab {...props} />
            case "settings": return <SettingsTab {...props} />
            default: return <OverviewTab user={{ name: tCommon('visitor'), email: "demo@viraweb.com" }} onNavigate={setActiveTab} {...props} />
        }
    }

    return (
        <div className={`flex ${showFullPage ? "h-screen" : "h-[600px]"} bg-slate-50 overflow-hidden border border-slate-300 relative`}>
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 z-40 sm:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                ${sidebarOpen ? "translate-x-0 w-full lg:w-64" : "-translate-x-full sm:translate-x-0 w-16"} 
                fixed sm:relative bg-white transition-all duration-300 flex flex-col z-50 h-full border-r border-slate-200
            `}>
                <div className="p-4 flex items-center justify-between border-b border-slate-200 h-16 shrink-0">
                    {sidebarOpen && (
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Image src="/viraweb3.png" alt="ViraWeb" width={110} height={30} className="h-auto w-auto" priority />
                        </div>
                    )}
                    {!sidebarOpen && <Image src="/viraweb6.png" alt="ViraWeb" width={24} height={24} className="mx-auto" priority />}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden sm:flex text-slate-400 hover:text-slate-900 transition-colors">
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                    {/* Mobile close button */}
                    <button onClick={() => setSidebarOpen(false)} className="sm:hidden text-slate-900">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 overflow-hidden pt-4 space-y-0.5">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveTab(item.id)
                                if (window.innerWidth < 1024) setSidebarOpen(false)
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 transition-all border-l-4 ${activeTab === item.id ? "bg-slate-50 border-primary text-slate-900" : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                        >
                            <span className={`${activeTab === item.id ? "text-primary" : ""}`}>{item.icon}</span>
                            {(sidebarOpen || (window.innerWidth < 640)) && <span className="font-black text-[11px] uppercase tracking-tighter">{item.label}</span>}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-200">
                    <button onClick={() => window.location.href = "/"} className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 transition-colors uppercase font-bold text-[11px] tracking-widest">
                        <LogOut className="w-4 h-4" />
                        {sidebarOpen && <span>{tSidebar('exitDemo')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 bg-slate-100 overflow-hidden">
                <header className="h-16 border-b border-slate-300 bg-white flex items-center justify-between px-4 sm:px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(true)} className="sm:hidden text-slate-500 p-2 hover:bg-slate-100">
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-3">
                            <h2 className="text-[14px] font-black text-slate-900 uppercase tracking-widest truncate max-w-[120px] sm:max-w-none">
                                {menuItems.find(i => i.id === activeTab)?.label}
                            </h2>
                            <div className="hidden md:flex px-2 py-0.5 bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em] border border-slate-900">
                                {tCommon('demoMode')}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <NotificationsPanel isDemo={true} />
                        <div className="h-4 w-[1px] bg-slate-200 mx-0.5 sm:mx-1" />
                        <LanguageToggle />
                        <div className="w-7 h-7 hidden sm:flex rounded-none bg-slate-900 border border-slate-300 items-center justify-center text-white font-black text-[10px]">
                            V
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-3 sm:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto">
                        <div className="bg-white border border-slate-300 shadow-sm p-4 sm:p-6 min-h-full">
                            {renderTab()}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
