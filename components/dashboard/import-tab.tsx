"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"
import {
    Upload,
    FileText,
    Image as ImageIcon,
    Table2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Trash2,
    X,
    Info,
    FileSpreadsheet,
    ArrowRight,
    Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase-client"

// ─────────────── Types ───────────────

type UploadStatus = "idle" | "pasting" | "dragging" | "uploading" | "processing" | "preview" | "saving" | "success" | "error"

interface ExtractedItem {
    [key: string]: any
    selected: boolean
    _score?: number
}

type EntityTypeLocal = 'clients' | 'professionals' | 'notes' | 'checklist' | 'goals'

interface ImportResult {
    total: number
    inserted: number
    errors: string[]
}

function getEntityColumns(entity: EntityTypeLocal): { key: string; label: string }[] {
    switch (entity) {
        case 'clients':
            return [
                { key: 'nome', label: 'preview.columns.name' },
                { key: 'email', label: 'preview.columns.email' },
                { key: 'telefone', label: 'preview.columns.phone' },
                { key: 'cpf', label: 'preview.columns.cpf' },
                { key: 'data_nascimento', label: 'preview.columns.birthDate' },
            ]
        case 'professionals':
            return [
                { key: 'nome', label: 'preview.columns.name' },
                { key: 'especialidade', label: 'preview.columns.specialty' },
                { key: 'email', label: 'preview.columns.email' },
                { key: 'telefone', label: 'preview.columns.phone' },
            ]
        case 'notes':
            return [
                { key: 'titulo', label: 'preview.columns.title' },
                { key: 'conteudo', label: 'preview.columns.content' },
            ]
        case 'checklist':
            return [
                { key: 'titulo', label: 'preview.columns.title' },
                { key: 'data', label: 'preview.columns.date' },
            ]
        case 'goals':
            return [
                { key: 'titulo', label: 'preview.columns.title' },
                { key: 'descricao', label: 'preview.columns.description' },
                { key: 'categoria', label: 'preview.columns.category' },
                { key: 'prazo', label: 'preview.columns.deadline' },
                { key: 'valor_alvo', label: 'preview.columns.targetValue' },
                { key: 'valor_atual', label: 'preview.columns.currentValue' },
            ]
        default:
            return []
    }
}

const ACCEPTED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/bmp",
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
]

const ACCEPTED_EXTENSIONS = ".png,.jpg,.jpeg,.webp,.bmp,.pdf,.csv,.xlsx,.xls"

function getFileTypeIcon(type: string) {
    if (type.startsWith("image/")) return <ImageIcon className="w-5 h-5" />
    if (type.includes("pdf")) return <FileText className="w-5 h-5" />
    return <FileSpreadsheet className="w-5 h-5" />
}

// ─────────────── Component ───────────────

export default function ImportTab({ isDemo = false, onImportSuccess }: { isDemo?: boolean, onImportSuccess?: (entity: string, items: any[]) => void }) {
    const t = useTranslations("dashboard.importTab")
    const [status, setStatus] = useState<UploadStatus>("idle")
    const [file, setFile] = useState<File | null>(null)
    const [progress, setProgress] = useState(0)
    const [items, setItems] = useState<ExtractedItem[]>([])
    const [entity, setEntity] = useState<EntityTypeLocal>('clients')
    const [entityFromAPI, setEntityFromAPI] = useState<EntityTypeLocal>('clients')
    const [errorMessage, setErrorMessage] = useState("")
    const [subStatus, setSubStatus] = useState("")
    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [manualText, setManualText] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()
    const supabase = createClient()

    function getFileTypeLabel(type: string) {
        if (type.startsWith("image/")) return t("dragUpload.images")
        if (type.includes("pdf")) return t("dragUpload.pdf")
        if (type.includes("csv") || type.includes("text/csv")) return t("dragUpload.csv")
        return t("dragUpload.xlsx")
    }

    // Progress animation
    useEffect(() => {
        if (status === "uploading" || status === "processing" || status === "saving") {
            const target = status === "uploading" ? 40 : status === "processing" ? 95 : 99
            const interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= target) {
                        // Allow small incremental progress even after hitting target to show "alive" status
                        if (prev < 98) return prev + 0.1
                        return target
                    }
                    // Faster at first, then slows down as it approaches target
                    const delta = (target - prev) / 10 + Math.random() * 2
                    return prev + delta
                })
            }, 300)
            return () => clearInterval(interval)
        }
    }, [status])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setStatus((prev) => (prev === "idle" || prev === "dragging" ? "dragging" : prev))
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setStatus((prev) => (prev === "dragging" ? "idle" : prev))
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
            processFile(droppedFile, entity)
        }
    }, [entity])

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            processFile(selected, entity)
        }
    }, [entity])

    const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newEntity = e.target.value as EntityTypeLocal
        setEntity(newEntity)
        if (file && (status === "preview" || status === "error" || status === "success")) {
            processFile(file, newEntity)
        }
    }

    const processFile = async (selectedFile: File, targetEntity: EntityTypeLocal) => {
        // Validate type
        if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
            setErrorMessage(t("errorMsgs.invalidFormat"))
            setStatus("error")
            return
        }

        // Validate size (max 10MB)
        if (selectedFile.size > 10 * 1024 * 1024) {
            setErrorMessage(t("errorMsgs.fileTooLarge"))
            setStatus("error")
            return
        }

        setFile(selectedFile)
        setProgress(0)
        setStatus("uploading")
        setErrorMessage("")
        setItems([])
        setImportResult(null)

        try {
            const formData = new FormData()
            if (selectedFile) {
                formData.append("file", selectedFile)
            } else if (manualText) {
                formData.append("text", manualText)
            }
            formData.append("entity", targetEntity)
            if (isDemo) formData.append("isDemo", "true")

            setStatus("processing")
            if (selectedFile?.type.startsWith("image/")) {
                setSubStatus(t("status.ocr"))
            } else if (selectedFile?.type.includes("pdf")) {
                setSubStatus(t("status.pdf"))
            } else if (manualText) {
                setSubStatus(t("status.generic"))
            } else {
                setSubStatus(t("status.generic"))
            }

            const response = await fetch("/api/import", {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: "Erro" }))
                throw new Error(errorData.error || `Erro ${response.status}`)
            }

            const data = await response.json()
            const fetchedItems: any[] = data.items || data.clients || []
            const apiEntity = data.entity || entity

            if (!fetchedItems || fetchedItems.length === 0) {
                setErrorMessage(t("errorMsgs.noItems"))
                setStatus("error")
                return
            }

            // Ensure all items have selected property
            const mapped = fetchedItems.map((it: any) => ({
                ...it,
                selected: it.selected !== false,
            }))

            setEntityFromAPI(apiEntity)
            setItems(mapped)
            setProgress(100)
            setStatus("preview")
        } catch (err) {
            console.error("Import error:", err)
            setErrorMessage(err instanceof Error ? err.message : t("errorMsgs.generic"))
            setStatus("error")
        }
    }

    const handleConfirmImport = async () => {
        const selectedItems = items.filter((item) => item.selected)
        if (selectedItems.length === 0) {
            toast({
                title: t(`entityMessages.${entity}.noSelection`),
                description: t(`entityMessages.${entity}.selectAtLeastOne`),
                variant: "destructive",
            })
            return
        }

        setStatus("saving")

        if (isDemo) {
            // Simulate saving
            await new Promise(resolve => setTimeout(resolve, 1500))

            toast({
                title: "Modo Demonstração",
                description: "A importação real está disponível apenas na versão completa. No modo demo, os dados são apenas processados para visualização.",
                variant: "default",
            })

            setStatus("preview") // Return to preview instead of success
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error(t("errorMsgs.unauthorized"))
            }

            const results: ImportResult = { total: selectedItems.length, inserted: 0, errors: [] }
            const currentEntity = entityFromAPI || entity

            if (currentEntity === 'clients') {
                for (const item of selectedItems) {
                    const { error } = await supabase.from("patients").insert({
                        user_id: user.id,
                        name: item.nome || t("defaults.noName"),
                        email: item.email || null,
                        phone: item.telefone || null,
                        cpf: item.cpf || null,
                        birth_date: item.data_nascimento || null,
                        status: "active",
                    })

                    if (error) {
                        results.errors.push(`${item.nome}: ${error.message}`)
                    } else {
                        results.inserted++
                    }
                }
            } else if (currentEntity === 'professionals') {
                for (const item of selectedItems) {
                    const { error } = await supabase.from("professionals").insert({
                        user_id: user.id,
                        name: item.nome || t("defaults.noName"),
                        email: item.email || null,
                        phone: item.telefone || null,
                    })

                    if (error) {
                        results.errors.push(`${item.nome}: ${error.message}`)
                    } else {
                        results.inserted++
                    }
                }
            } else if (currentEntity === 'notes') {
                for (const item of selectedItems) {
                    const { error } = await supabase.from("user_notes").insert({
                        user_id: user.id,
                        title: item.titulo || t("defaults.noTitle"),
                        content: item.conteudo || t("defaults.importedNote"),
                    })

                    if (error) results.errors.push(`${item.titulo}: ${error.message}`)
                    else results.inserted++
                }
            } else if (currentEntity === 'checklist') {
                for (const item of selectedItems) {
                    const { error } = await supabase.from("todos").insert({
                        user_id: user.id,
                        title: item.titulo || t("defaults.noTitle"),
                        completed: false,
                    })

                    if (error) results.errors.push(`${item.titulo}: ${error.message}`)
                    else results.inserted++
                }
            } else if (currentEntity === 'goals') {
                for (const item of selectedItems) {
                    const { error } = await supabase.from("goals").insert({
                        user_id: user.id,
                        title: item.titulo || t("defaults.noTitle"),
                        description: item.descricao || null,
                        category: item.categoria || t("defaults.general"),
                        target_value: parseFloat(String(item.valor_alvo)) || 0,
                        current_value: parseFloat(String(item.valor_atual)) || 0,
                        unit: t("defaults.unit")
                    })

                    if (error) results.errors.push(`${item.titulo}: ${error.message}`)
                    else results.inserted++
                }
            } else {
                results.errors.push(t("errorMsgs.notImplemented", { entity: currentEntity }))
            }

            setImportResult(results)
            setStatus("success")

            if (results.inserted > 0) {
                toast({
                    title: t("toast.success"),
                    description: t(`entityMessages.${currentEntity}.success`, { inserted: results.inserted, total: results.total }),
                })
            }

            if (results.errors.length > 0) {
                toast({
                    title: t("toast.errorTitle"),
                    description: t(`entityMessages.${currentEntity}.error`, { count: results.errors.length }),
                    variant: "destructive",
                })
            }
        } catch (err) {
            console.error("Save error:", err)
            setErrorMessage(err instanceof Error ? err.message : "Erro.")
            setStatus("error")
        }
    }

    const handleReset = () => {
        setStatus("idle")
        setFile(null)
        setProgress(0)
        setItems([])
        setErrorMessage("")
        setImportResult(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const toggleItem = (index: number) => {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
        )
    }

    const toggleAll = () => {
        const allSelected = items.every((item) => item.selected)
        setItems((prev) => prev.map((item) => ({ ...item, selected: !allSelected })))
    }

    const updateItem = (index: number, field: string, value: string) => {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        )
    }

    const removeItem = (index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-foreground">{t("title")}</h2>
                <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                <div className="mt-3">
                    <label className="text-sm text-muted-foreground mr-2">{t("entitySelect")}</label>
                    <select
                        value={entity}
                        onChange={handleEntityChange}
                        className="border px-2 py-1 rounded"
                    >
                        <option value="clients">{t("entities.clients")}</option>
                        <option value="professionals">{t("entities.professionals")}</option>
                        <option value="notes">{t("entities.notes")}</option>
                        <option value="checklist">{t("entities.checklist")}</option>
                        <option value="goals">{t("entities.goals")}</option>
                    </select>
                </div>
            </div>

            {/* Info Banner */}
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t.rich("infoBanner", {
                        strong: (chunks) => <strong>{chunks}</strong>
                    })}
                </p>
            </div>

            {/* Upload Zone */}
            {(status === "idle" || status === "dragging") && (
                <Card
                    className={`relative p-8 sm:p-12 border-2 border-dashed cursor-pointer transition-all duration-300 ${status === "dragging"
                        ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept={ACCEPTED_EXTENSIONS}
                        onChange={handleFileSelect}
                    />
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className={`p-4 rounded-2xl transition-colors duration-300 ${status === "dragging"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                            }`}>
                            <Upload className="w-10 h-10" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-foreground mb-1">
                                {status === "dragging" ? t("dragUpload.drag") : t("dragUpload.drop")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {t("dragUpload.orClick")}
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                            {[
                                { icon: <ImageIcon className="w-4 h-4" />, label: t("dragUpload.images") },
                                { icon: <FileText className="w-4 h-4" />, label: t("dragUpload.pdf") },
                                { icon: <Table2 className="w-4 h-4" />, label: t("dragUpload.csv") },
                                { icon: <FileSpreadsheet className="w-4 h-4" />, label: t("dragUpload.xlsx") },
                            ].map((item) => (
                                <span
                                    key={item.label}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground"
                                >
                                    {item.icon}
                                    {item.label}
                                </span>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{t("dragUpload.maxSize")}</p>
                    </div>
                </Card>
            )}

            {/* Uploading/Processing State */}
            {(status === "uploading" || status === "processing") && (
                <Card className="p-8">
                    <div className="flex flex-col items-center space-y-6">
                        <div className="relative">
                            <div className="p-6 rounded-2xl bg-primary/10">
                                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                            </div>
                        </div>
                        <div className="text-center w-full flex flex-col items-center">
                            <p className="text-lg font-semibold text-foreground mb-1">
                                {status === "uploading" ? (t("uploading") || "Enviando arquivo...") : (t("processing") || "Processando dados...")}
                            </p>
                            <p className="text-sm text-slate-500 animate-pulse">
                                {subStatus || t("status.wait")}
                            </p>

                            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 mt-6 overflow-hidden">
                                <div
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="mt-2 text-xs text-slate-400">{Math.round(progress)}%</p>
                        </div>
                    </div>
                </Card>
            )}

            {/* Error State */}
            {status === "error" && (
                <Card className="p-8">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 rounded-2xl bg-destructive/10">
                            <AlertCircle className="w-8 h-8 text-destructive" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-foreground">{t("errorTitle")}</p>
                            <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                        </div>
                        <Button onClick={handleReset} variant="outline" className="gap-2">
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            {t("tryAgain")}
                        </Button>
                    </div>
                </Card>
            )}

            {/* Preview Table */}
            {status === "preview" && items.length > 0 && (
                <div className="space-y-4">
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{t("preview.title")}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {t(`entityMessages.${entity}.selected`, { selected: items.filter((item) => item.selected).length, total: items.length })}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={toggleAll}>
                                    {items.every((item) => item.selected) ? t("preview.deselectAll") : t("preview.selectAll")}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleReset}>
                                    <X className="w-4 h-4 mr-1" />
                                    {t("preview.cancel")}
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto -mx-6">
                            <div className="px-6" style={{ minWidth: `${(getEntityColumns(entity).length + 1) * 180}px` }}>
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={items.every((item) => item.selected)}
                                                    onChange={toggleAll}
                                                    className="rounded border-border"
                                                />
                                            </th>
                                            {getEntityColumns(entity).map((col) => (
                                                <th key={col.key} className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider min-w-[160px]">
                                                    {col.label.startsWith('preview.') ? t(col.label) : col.label}
                                                </th>
                                            ))}
                                            <th className="w-10" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, index) => (
                                            <tr
                                                key={index}
                                                className={`border-b border-border/50 transition-colors ${item.selected ? "bg-primary/5" : "opacity-50"
                                                    }`}
                                            >
                                                <td className="py-3 px-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.selected}
                                                        onChange={() => toggleItem(index)}
                                                        className="rounded border-border"
                                                    />
                                                </td>
                                                {getEntityColumns(entity).map((col) => (
                                                    <td key={col.key} className="py-3 px-2 min-w-[160px]">
                                                        <Input
                                                            value={String(item[col.key] || "")}
                                                            onChange={(e) => updateItem(index, col.key, e.target.value)}
                                                            className="h-8 text-sm bg-transparent border-transparent hover:border-border focus:border-primary"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="py-3 px-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeItem(index)}
                                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Card>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={handleReset}>
                            {t("preview.cancel")}
                        </Button>
                        <Button
                            onClick={handleConfirmImport}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg"
                            disabled={items.filter((item) => item.selected).length === 0}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {t("confirmBtn", { count: items.filter((item) => item.selected).length })}
                        </Button>
                    </div>
                </div>
            )}

            {/* Saving State */}
            {status === "saving" && (
                <Card className="p-8">
                    <div className="flex flex-col items-center space-y-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-lg font-semibold text-foreground">{t(`entityMessages.${entity}.saving`)}</p>
                        <p className="text-sm text-muted-foreground">{t("savingDesc")}</p>
                    </div>
                </Card>
            )}

            {/* Success State */}
            {status === "success" && importResult && (
                <Card className="p-8">
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-4 rounded-2xl bg-green-100 dark:bg-green-900/30">
                            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-foreground">{t("successTitle")}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {t(`entityMessages.${entityFromAPI || entity}.success`, { inserted: importResult.inserted, total: importResult.total })}
                            </p>
                        </div>
                        {importResult.errors.length > 0 && (
                            <div className="w-full max-w-md">
                                <p className="text-sm font-medium text-destructive mb-2">{t("errors", { count: importResult.errors.length })}</p>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {importResult.errors.map((error, i) => (
                                        <p key={i} className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded">
                                            {error}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                        <Button onClick={handleReset} className="gap-2">
                            <Upload className="w-4 h-4" />
                            {t("importMore")}
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    )
}
