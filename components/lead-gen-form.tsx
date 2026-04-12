"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { 
    Sparkles, ArrowRight, CheckCircle2, Building2, Wallet, Users, Calendar,
    Activity, Apple, PawPrint, Scale, Calculator, GraduationCap, Briefcase, Plus
} from "lucide-react"

interface LeadGenFormProps {
    onComplete: (data: any) => void
}

export default function LeadGenForm({ onComplete }: LeadGenFormProps) {
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        language: "pt",
        niche: "",
        revenue: "",
        clients: "",
        appointments: ""
    })
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Show after a short delay
        const timer = setTimeout(() => setIsVisible(true), 1200)
        return () => clearTimeout(timer)
    }, [])

    const handleNext = () => {
        if (step < 5) setStep(step + 1)
        else {
            // Save to localStorage so it doesn't show again
            localStorage.setItem("vwd:lead_gen_submitted", "true")
            
            // If it's 'outro', use the custom value
            const finalData = {
                ...formData,
                niche: formData.niche === "outro" ? (formData as any).customNiche : formData.niche
            }
            onComplete(finalData)
        }
    }

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const steps = [
        {
            id: 1,
            title: "Qual idioma você prefere?",
            description: "Which language do you prefer?",
            icon: Users,
            field: "language",
            component: (
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => updateField("language", "pt")}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                            formData.language === "pt" 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-slate-100 bg-white hover:border-slate-200"
                        }`}
                    >
                        <span className="text-2xl">🇧🇷</span>
                        <span className="font-bold text-slate-900">Português</span>
                    </button>
                    <button
                        onClick={() => updateField("language", "en")}
                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                            formData.language === "en" 
                            ? "border-primary bg-primary/5 ring-1 ring-primary" 
                            : "border-slate-100 bg-white hover:border-slate-200"
                        }`}
                    >
                        <span className="text-2xl">🇺🇸</span>
                        <span className="font-bold text-slate-900">English</span>
                    </button>
                </div>
            )
        },
        {
            id: 2,
            title: "Qual o seu ramo de atuação?",
            description: "Isso nos ajuda a personalizar sua experiência.",
            icon: Building2,
            field: "niche",
            component: (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                            { value: "estetica", label: "Estética", icon: Sparkles },
                            { value: "saude", label: "Clínicas", icon: Building2 },
                            { value: "dentista", label: "Dentistas", icon: Sparkles }, // Placeholder icon if needed
                            { value: "fisioterapia", icon: Activity, label: "Fisioterapia" },
                            { value: "psicologia", icon: Users, label: "Psicologia" },
                            { value: "nutricao", icon: Apple, label: "Nutrição" },
                            { value: "veterinaria", icon: PawPrint, label: "Pet/Vet" },
                            { value: "advocacia", icon: Scale, label: "Direito" },
                            { value: "contabilidade", icon: Calculator, label: "Finanças" },
                            { value: "educacao", icon: GraduationCap, label: "Educação" },
                            { value: "consultoria", icon: Briefcase, label: "Consultoria" },
                            { value: "outro", icon: Plus, label: "Outro" },
                        ].map((niche) => {
                            const Icon = niche.icon
                            const isSelected = formData.niche === niche.value
                            return (
                                <button
                                    key={niche.value}
                                    onClick={() => updateField("niche", niche.value)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-2 ${
                                        isSelected 
                                        ? "border-primary bg-primary/5 ring-1 ring-primary" 
                                        : "border-slate-50 bg-white hover:border-slate-200"
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${isSelected ? "text-primary" : "text-slate-400"}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-tight text-center ${isSelected ? "text-primary" : "text-slate-600"}`}>
                                        {niche.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    
                    {formData.niche === "outro" && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="pt-2"
                        >
                            <Input
                                placeholder="Especifique seu ramo..."
                                className="h-11 bg-white border-slate-200 rounded-xl"
                                autoFocus
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, customNiche: e.target.value }))
                                }}
                                value={(formData as any).customNiche || ""}
                            />
                        </motion.div>
                    )}
                </div>
            )
        },
        {
            id: 3,
            title: "Qual o seu faturamento mensal médio?",
            description: "Para entendermos o tamanho da sua operação.",
            icon: Wallet,
            field: "revenue",
            component: (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            "Até R$ 5k",
                            "R$ 5k - R$ 20k",
                            "R$ 20k - R$ 50k",
                            "Acima de R$ 50k"
                        ].map((range) => (
                            <button
                                key={range}
                                onClick={() => updateField("revenue", range)}
                                className={`p-3 text-sm rounded-xl border transition-all ${
                                    formData.revenue === range 
                                    ? "bg-primary/10 border-primary text-primary font-bold shadow-sm" 
                                    : "bg-white border-slate-200 hover:border-primary/50 text-slate-600"
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
            )
        },
        {
            id: 4,
            title: "Quantos clientes você atende hoje?",
            description: "Total de clientes ativos em sua base.",
            icon: Users,
            field: "clients",
            component: (
                <Input
                    type="number"
                    placeholder="Ex: 150"
                    className="h-12 text-lg"
                    value={formData.clients}
                    onChange={(e) => updateField("clients", e.target.value)}
                />
            )
        },
        {
            id: 5,
            title: "Quantos agendamentos tem por mês?",
            description: "Média de atendimentos realizados mensalmente.",
            icon: Calendar,
            field: "appointments",
            component: (
                <Input
                    type="number"
                    placeholder="Ex: 80"
                    className="h-12 text-lg"
                    value={formData.appointments}
                    onChange={(e) => updateField("appointments", e.target.value)}
                />
            )
        }
    ]

    const currentStep = steps.find(s => s.id === step)!

    if (!isVisible) return null

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                <Card className="border-none shadow-[0_20px_50px_rgba(0,0,0,0.2)] overflow-hidden rounded-[32px] bg-white">
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100">
                        <motion.div 
                            className="h-full bg-primary"
                            initial={{ width: "0%" }}
                            animate={{ width: `${(step / 5) * 100}%` }}
                        />
                    </div>

                    <CardHeader className="pt-10 pb-6 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/5 shadow-sm">
                                <currentStep.icon className="w-8 h-8" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-900 mb-2">
                            {currentStep.title}
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium whitespace-pre-line px-4">
                            {currentStep.description}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="px-8 pb-8">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={step}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="min-h-[100px] flex flex-col justify-center"
                            >
                                {currentStep.component}
                            </motion.div>
                        </AnimatePresence>
                    </CardContent>

                    <CardFooter className="px-8 pb-10 border-t border-slate-50 pt-8 flex justify-between gap-4">
                        {step > 1 ? (
                            <Button
                                variant="ghost"
                                onClick={() => setStep(step - 1)}
                                className="text-slate-400 font-bold hover:text-slate-600"
                            >
                                Voltar
                            </Button>
                        ) : <div />}
                        
                        <Button
                            onClick={handleNext}
                            disabled={
                                !formData[currentStep.field as keyof typeof formData] || 
                                (formData.niche === "outro" && step === 2 && !(formData as any).customNiche)
                            }
                            className="h-12 px-8 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all hover:-translate-y-0.5 active:scale-95"
                        >
                            {step === 5 ? "Finalizar" : "Próximo"}
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </CardFooter>
                </Card>
                
                <p className="mt-6 text-center text-slate-400 text-sm font-medium">
                    Leva menos de 30 segundos e nos ajuda a te mostrar o painel ideal.
                </p>
            </motion.div>
        </div>
    )
}
