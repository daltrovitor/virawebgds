"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, FileText, Image, Table2, ArrowRight } from "lucide-react"
import { TUTORIAL_VIDEO_URL } from "@/lib/tutorial-config"

function getEmbedUrl(url: string) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch (e) {}
  return url
}

interface TutorialModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function TutorialModal({ open, onOpenChange }: TutorialModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Bem-vindo ao ViraWeb!</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <Card className="relative p-6 overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 border-primary/20">
            <div className="flex items-center justify-center gap-4 py-8">
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
            
            <div className="space-y-2 text-center pb-6">
                <p className="text-foreground leading-relaxed text-lg">
                    Agora você pode importar clientes e pacientes automaticamente usando{" "}
                    <strong>imagens, PDFs ou planilhas</strong>. Os dados são extraídos
                    e adicionados ao seu banco de dados em segundos!
                </p>
                <p className="text-sm text-muted-foreground pt-2">
                    Nossa inteligência artificial cuida de tudo para você.
                </p>
            </div>
            
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Entendi
              </Button>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
