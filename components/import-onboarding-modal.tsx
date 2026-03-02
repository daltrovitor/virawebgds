"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Image, Table2, Sparkles, ArrowRight } from "lucide-react"

interface ImportOnboardingModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onNavigateToImport: () => void
    onDismiss: () => void
}

export default function ImportOnboardingModal({
    open,
    onOpenChange,
    onNavigateToImport,
    onDismiss,
}: ImportOnboardingModalProps) {
    const handleViewFeature = () => {
        onOpenChange(false)
        onDismiss()
        onNavigateToImport()
    }

    const handleLater = () => {
        onOpenChange(false)
        onDismiss()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
                        <Sparkles className="w-6 h-6 text-primary" />
                        Nova funcionalidade: Importação automática
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-2 space-y-6">
                    {/* Feature illustration */}
                    <Card className="relative p-6 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-primary/20">
                        <div className="flex items-center justify-center gap-4">
                            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 animate-pulse">
                                <Image className="w-7 h-7" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                            <div className="p-3 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 animate-pulse" style={{ animationDelay: "0.2s" }}>
                                <FileText className="w-7 h-7" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 animate-pulse" style={{ animationDelay: "0.4s" }}>
                                <Table2 className="w-7 h-7" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-muted-foreground" />
                            <div className="p-3 rounded-xl bg-primary/10 text-primary animate-pulse" style={{ animationDelay: "0.6s" }}>
                                <Upload className="w-7 h-7" />
                            </div>
                        </div>
                    </Card>

                    {/* Description */}
                    <div className="space-y-2">
                        <p className="text-foreground leading-relaxed">
                            Agora você pode importar clientes automaticamente usando{" "}
                            <strong>imagens, PDFs ou planilhas</strong>. Os dados são extraídos
                            automaticamente e adicionados ao seu banco de dados.
                        </p>
                        <p className="text-sm text-muted-foreground">
                            ⚠️ Essa funcionalidade <strong>não está incluída</strong> no tutorial em vídeo atual.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                            onClick={handleViewFeature}
                            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg"
                        >
                            <Upload className="w-4 h-4" />
                            Ver funcionalidade
                        </Button>
                        <Button
                            onClick={handleLater}
                            variant="outline"
                            className="flex-1"
                        >
                            Depois
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
