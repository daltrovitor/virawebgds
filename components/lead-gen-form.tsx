// Hello World
"use client"

import { useEffect, useId, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

/** Respostas do perfil da clínica. O ramo é sempre odontologia (produto exclusivo para dentistas). */
export interface LeadFormData {
    language: "pt" | "en"
    niche: "odontologia"
    revenue: string
    clients: string
    appointments: string
}

interface LeadGenFormProps {
    onComplete: (data: LeadFormData) => void
    /** Fechar sem responder também conta como "já visto": o formulário não volta a aparecer. */
    onDismiss: () => void
}

const REVENUE_RANGES = ["Até R$ 5 mil", "R$ 5 mil – R$ 20 mil", "R$ 20 mil – R$ 50 mil", "Acima de R$ 50 mil"]

type Step = { key: "language" | "revenue" | "clients" | "appointments"; title: string; description: string }

const STEPS: Step[] = [
    { key: "language", title: "Qual idioma você prefere?", description: "Which language do you prefer?" },
    { key: "revenue", title: "Qual o faturamento mensal médio da clínica?", description: "Para entendermos o tamanho da sua operação." },
    { key: "clients", title: "Quantos pacientes ativos a clínica tem hoje?", description: "Uma estimativa já ajuda." },
    { key: "appointments", title: "Quantas consultas vocês fazem por mês?", description: "Média de atendimentos mensais." },
]

export default function LeadGenForm({ onComplete, onDismiss }: LeadGenFormProps) {
    const [step, setStep] = useState(0)
    const [visible, setVisible] = useState(false)
    const [data, setData] = useState<LeadFormData>({ language: "pt", niche: "odontologia", revenue: "", clients: "", appointments: "" })
    const titleId = useId()
    const descId = useId()

    // Aparece com um pequeno atraso, depois que o painel carregou
    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 1200)
        return () => clearTimeout(timer)
    }, [])

    // Esc fecha (e conta como visto)
    useEffect(() => {
        if (!visible) return
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss()
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [visible, onDismiss])

    if (!visible) return null

    const current = STEPS[step]
    const isLast = step === STEPS.length - 1
    const value = data[current.key]
    const canAdvance = current.key === "language" || current.key === "revenue" ? Boolean(value) : /^\d{1,6}$/.test(String(value))

    const next = () => {
        if (!canAdvance) return
        if (isLast) onComplete(data)
        else setStep((s) => s + 1)
    }

    const optionClass = (selected: boolean) =>
        cn(
            "flex min-h-12 items-center justify-between gap-2 rounded-sm border px-4 text-left text-[14.5px] transition-colors",
            selected
                ? "border-primary bg-primary/[0.06] font-semibold text-primary ring-1 ring-primary"
                : "border-border bg-background font-medium text-ink-soft hover:border-ink/30 hover:text-ink",
        )

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f1f33]/45 p-4 backdrop-blur-sm" role="presentation">
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                initial={{ y: 24, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="relative w-full max-w-lg overflow-hidden rounded-md border border-border bg-background shadow-[0_40px_80px_-40px_rgba(15,31,51,0.55)]"
            >
                {/* Progresso */}
                <div className="h-1 w-full bg-secondary" aria-hidden>
                    <motion.div className="h-full bg-primary" animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ type: "spring", stiffness: 200, damping: 30 }} />
                </div>

                <button
                    type="button"
                    onClick={onDismiss}
                    className="absolute right-2 top-3 flex h-11 w-11 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface hover:text-ink"
                    aria-label="Fechar e não perguntar novamente"
                >
                    <X className="h-4 w-4" aria-hidden />
                </button>

                <div className="px-6 pb-2 pt-8 sm:px-8">
                    <p className="text-[12px] font-medium tabular text-muted-foreground">
                        {step + 1} de {STEPS.length}
                    </p>
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={current.key}
                            initial={{ x: 16, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -16, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <h2 id={titleId} className="mt-2 pr-8 font-display text-[1.4rem] font-semibold leading-tight tracking-[-0.02em] text-ink">
                                {current.title}
                            </h2>
                            <p id={descId} className="mt-1.5 text-[14px] text-ink-soft">
                                {current.description}
                            </p>

                            <div className="mt-6 min-h-[120px]">
                                {current.key === "language" && (
                                    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby={titleId}>
                                        {([
                                            ["pt", "Português"],
                                            ["en", "English"],
                                        ] as const).map(([code, label]) => (
                                            <button
                                                key={code}
                                                type="button"
                                                role="radio"
                                                aria-checked={data.language === code}
                                                onClick={() => setData((d) => ({ ...d, language: code }))}
                                                className={optionClass(data.language === code)}
                                            >
                                                {label}
                                                {data.language === code && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {current.key === "revenue" && (
                                    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby={titleId}>
                                        {REVENUE_RANGES.map((range) => (
                                            <button
                                                key={range}
                                                type="button"
                                                role="radio"
                                                aria-checked={data.revenue === range}
                                                onClick={() => setData((d) => ({ ...d, revenue: range }))}
                                                className={optionClass(data.revenue === range)}
                                            >
                                                {range}
                                                {data.revenue === range && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {(current.key === "clients" || current.key === "appointments") && (
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={999999}
                                        autoFocus
                                        aria-labelledby={titleId}
                                        placeholder={current.key === "clients" ? "Ex.: 150" : "Ex.: 80"}
                                        value={data[current.key]}
                                        onChange={(e) => setData((d) => ({ ...d, [current.key]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                        onKeyDown={(e) => e.key === "Enter" && next()}
                                        className="h-12 w-full rounded-sm border border-input bg-background px-3.5 text-[16px] tabular text-ink focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                                    />
                                )}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-4 sm:px-8">
                    {step > 0 ? (
                        <button type="button" onClick={() => setStep((s) => s - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-[14px] font-medium text-ink-soft hover:text-ink">
                            <ArrowLeft className="h-4 w-4" aria-hidden />
                            Voltar
                        </button>
                    ) : (
                        <button type="button" onClick={onDismiss} className="h-11 rounded-sm px-3 text-[14px] font-medium text-muted-foreground hover:text-ink">
                            Agora não
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={next}
                        disabled={!canAdvance}
                        className="inline-flex h-11 items-center gap-2 rounded-sm bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isLast ? "Concluir" : "Próximo"}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                </div>
            </motion.div>
        </div>
    )
}
