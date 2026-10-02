// Hello World
"use client"

import type React from "react"
import { forwardRef } from "react"
import { ArrowLeft } from "lucide-react"
import { useTranslations } from "next-intl"
import LanguageToggle from "@/components/language-toggle"
import { VwoLogo } from "@/components/brand/vwo-logo"
import { VwoMark } from "@/components/brand/vwo-mark"
import { cn } from "@/lib/utils"
import { KineticLine } from "./kinetic-title"

/**
 * Moldura de autenticação em Proporção Áurea: 61,8% para a marca (símbolo monumental e promessa),
 * 38,2% para o formulário. No celular, apenas o formulário com a assinatura no topo.
 */
export function AuthShell({
  title,
  subtitle,
  backLabel,
  onBack,
  children,
}: {
  title: string
  subtitle: string
  backLabel: string
  onBack: () => void
  children: React.ReactNode
}) {
  const t = useTranslations("vwo.hero")
  return (
    <div className="grid min-h-[100svh] bg-background lg:grid-cols-[1.618fr_1fr]">
      {/* Plano da marca */}
      <aside className="paper-grain relative hidden overflow-hidden border-r border-hairline bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16" aria-hidden>
        <VwoLogo variant="stacked" animate="mount" markClassName="w-9" />
        <div className="relative">
          <VwoMark animate="mount" delay={0.2} decorative className="absolute -right-16 -top-[22rem] w-[min(34rem,60%)] opacity-90" />
          <p className="relative max-w-xl font-display text-[clamp(2.4rem,4.4vw,4.4rem)] font-bold leading-[0.98] tracking-[-0.045em] text-ink">
            <KineticLine text={t("titleA")} className="block" delay={0.3} />
            <KineticLine text={t("titleB")} className="block font-light text-primary" delay={0.5} />
          </p>
          <p className="relative mt-6 max-w-md text-[15px] leading-relaxed text-ink-soft">{t("lead")}</p>
        </div>
        <ul className="flex gap-6 text-[12px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <li>{t("meta1")}</li>
          <li>{t("meta2")}</li>
          <li>{t("meta3")}</li>
        </ul>
      </aside>

      {/* Plano da ação */}
      <main className="flex flex-col px-4 py-6 sm:px-10 lg:px-12 xl:px-16">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onBack} className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-[14px] font-medium text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </button>
          <LanguageToggle variant="compact" />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <div className="mb-8 lg:hidden">
            <VwoLogo variant="stacked" animate="mount" />
          </div>
          <h1 className="font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-ink">{title}</h1>
          <p className="mt-1.5 text-[14.5px] text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

export const AuthInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label: string; aside?: React.ReactNode }>(
  function AuthInput({ label, aside, id, className, ...props }, ref) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-[13px] font-medium text-ink">
            {label}
          </label>
          {aside}
        </div>
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-12 w-full rounded-sm border border-input bg-background px-3.5 text-[15px] text-ink transition-colors placeholder:text-muted-foreground/70 hover:border-ink-soft/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)

export function AuthTerms({ id, checked, onChange, labels }: { id: string; checked: boolean; onChange: (v: boolean) => void; labels: { agree: string; terms: string; privacy: string; lgpd: string; and: string } }) {
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--primary)]" />
      <label htmlFor={id} className="text-[13px] leading-snug text-ink-soft">
        {labels.agree}{" "}
        <a href="/termos" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          {labels.terms}
        </a>
        ,{" "}
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          {labels.privacy}
        </a>{" "}
        {labels.and}{" "}
        <a href="/lgpd" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          {labels.lgpd}
        </a>
        .
      </label>
    </div>
  )
}
