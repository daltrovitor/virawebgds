// Hello World
"use client"

import { useLocale } from "next-intl"
import { ArrowLeft, ArrowRight } from "lucide-react"
import DemoDashboard from "@/components/demo-dashboard"
import { VwoMark } from "@/components/brand/vwo-mark"

/** Página /demo: a plataforma inteira com uma clínica fictícia, sem cadastro. */
export default function DemoExperience() {
  const locale = useLocale()
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <a
            href={`/${locale}`}
            className="flex h-11 w-11 items-center justify-center rounded-sm text-ink-soft hover:bg-surface hover:text-ink"
            aria-label="Voltar ao site"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </a>
          <VwoMark className="w-6" animate="mount" decorative />
          <h1 className="truncate font-display text-[14px] font-semibold text-ink">
            Demonstração <span className="hidden font-normal text-muted-foreground sm:inline">· clínica fictícia, dados de exemplo</span>
          </h1>
        </div>
        <a
          href={`/${locale}/free-trial/auth`}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-sm bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Criar conta grátis
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      </header>
      <main className="min-h-0 flex-1">
        <DemoDashboard className="h-full border-0" />
      </main>
    </div>
  )
}
