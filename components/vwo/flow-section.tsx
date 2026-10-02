// Hello World
"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { CLINICAL_STATUS, type ClinicalStatus } from "@/lib/appointment-status"
import { ToothGlyph } from "@/components/dental/arch-chart"
import { addMonthsClamped } from "@/lib/payment-plan"
import { KineticLine, Reveal } from "./kinetic-title"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const fmtShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/* ------------------------------------------------------------ mocks */

const AGENDA: Array<{ day: number; start: number; span: number; name: string; status: ClinicalStatus }> = [
  { day: 0, start: 0, span: 2, name: "Beatriz V.", status: "finished" },
  { day: 0, start: 3, span: 2, name: "Otávio R.", status: "finished" },
  { day: 1, start: 1, span: 2, name: "Caio B.", status: "missed" },
  { day: 1, start: 4, span: 3, name: "Marina T.", status: "cancelled_patient" },
  { day: 2, start: 0, span: 2, name: "Henrique S.", status: "confirmed" },
  { day: 2, start: 2, span: 2, name: "Beatriz V.", status: "reception" },
  { day: 2, start: 5, span: 3, name: "Otávio R.", status: "in_care" },
  { day: 3, start: 1, span: 2, name: "Luíza F.", status: "confirmed" },
  { day: 3, start: 4, span: 3, name: "Caio B.", status: "scheduled" },
  { day: 4, start: 0, span: 4, name: "Marina T.", status: "scheduled" },
  { day: 4, start: 5, span: 2, name: "Henrique S.", status: "scheduled" },
]
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"]
const ROW = 40

function AgendaMock({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-4 grid grid-cols-[34px_repeat(5,minmax(0,1fr))] content-start gap-x-1.5">
        <div />
        {DAYS.map((d, i) => (
          <p key={d} className={cn("pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em]", i === 2 ? "text-primary" : "text-muted-foreground")}>
            {d}
          </p>
        ))}
        <div className="relative" style={{ height: ROW * 8 }}>
          {["08", "09", "10", "11"].map((h, i) => (
            <span key={h} className="absolute right-1 text-[10px] tabular text-muted-foreground" style={{ top: i * ROW * 2 - 6 }}>
              {h}h
            </span>
          ))}
        </div>
        {DAYS.map((d, dayIndex) => (
          <div key={d} className={cn("relative rounded-xs border border-hairline", dayIndex === 2 && "bg-accent/50")} style={{ height: ROW * 8 }}>
            {AGENDA.filter((a) => a.day === dayIndex).map((a, i) => {
              const meta = CLINICAL_STATUS[a.status]
              return (
                <div
                  key={i}
                  className={cn("absolute inset-x-1 overflow-hidden rounded-xs border border-black/[0.05] pl-2 pr-1 pt-1", meta.block)}
                  style={{ top: a.start * ROW + 2, height: a.span * ROW - 4 }}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-[3px]", meta.rail)} />
                  <p className="truncate text-[10.5px] font-semibold leading-tight">{a.name}</p>
                  {a.span > 2 && <p className="truncate text-[9.5px] opacity-75">{meta.label}</p>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-hairline pt-4">
        {(["confirmed", "reception", "in_care", "finished", "missed", "cancelled_patient"] as ClinicalStatus[]).map((st) => (
          <li key={st} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-xs", CLINICAL_STATUS[st].rail)} />
            {CLINICAL_STATUS[st].label}
          </li>
        ))}
      </ul>
    </div>
  )
}

const MOCK_TEETH = [15, 14, 13, 12, 11, 21, 22, 23, 24, 25]
const MOCK_SELECTED = [12, 11, 21, 22]

function BudgetMock({ label, procedure }: { label: string; procedure: string }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end gap-0.5">
        {MOCK_TEETH.map((tooth) => {
          const on = MOCK_SELECTED.includes(tooth)
          return (
            <div key={tooth} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="h-16 w-full max-w-[34px]">
                <ToothGlyph fdi={tooth} lower={false} state={on ? "selected" : "idle"} />
              </div>
              <span className={cn("mt-1 font-display text-[10px] font-semibold tabular", on ? "text-primary" : "text-muted-foreground")}>{tooth}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <ul className="mt-2 divide-y divide-hairline text-[12.5px]">
        {MOCK_SELECTED.map((tooth) => (
          <li key={tooth} className="flex items-center gap-2 py-2">
            <span className="rounded-xs bg-secondary px-1.5 py-0.5 font-display text-[10.5px] font-semibold tabular text-ink-soft">{tooth}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{procedure}</span>
            <span className="tabular text-ink-soft">{BRL.format(3850)}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 py-2">
          <span className="rounded-xs bg-secondary px-1.5 py-0.5 font-display text-[10.5px] font-semibold text-ink-soft">—</span>
          <span className="min-w-0 flex-1 truncate text-ink">Profilaxia + raspagem</span>
          <span className="tabular text-ink-soft">{BRL.format(300)}</span>
        </li>
      </ul>
      <div className="mt-auto flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Total</span>
        <span className="font-display text-lg font-semibold tabular text-ink">{BRL.format(15700)}</span>
      </div>
    </div>
  )
}

function PlanMock({ label, paid, due }: { label: string; paid: string; due: string }) {
  const start = "2026-09-30"
  const value = 15700 / 12
  const rows = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, date: addMonthsClamped(start, i), paid: i < 2 }))
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="text-[11px] tabular text-muted-foreground">12 × {BRL.format(value)}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full w-[16.66%] bg-emerald-600" />
      </div>
      <ul className="mt-3 divide-y divide-hairline text-[12.5px]">
        {rows.map((r) => (
          <li key={r.n} className="flex items-center gap-3 py-2.5">
            <span className="w-8 font-display text-[11px] font-semibold tabular text-ink-soft">{r.n}ª</span>
            <span className="flex-1 tabular text-ink">{BRL.format(value)}</span>
            {r.paid ? (
              <span className="rounded-xs bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">{paid}</span>
            ) : (
              <span className="text-[11.5px] tabular text-muted-foreground">
                {due} {fmtShort(r.date)}
              </span>
            )}
          </li>
        ))}
      </ul>
      <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-border pt-4">
        <div>
          <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Recebido</dt>
          <dd className="font-display text-[15px] font-semibold tabular text-emerald-700">{BRL.format(value * 2)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">A receber</dt>
          <dd className="font-display text-[15px] font-semibold tabular text-primary">{BRL.format(15700 - value * 2)}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Atrasado</dt>
          <dd className="font-display text-[15px] font-semibold tabular text-ink">{BRL.format(0)}</dd>
        </div>
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------ seção */

export function FlowSection() {
  const t = useTranslations("vwo.flow")
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)

  const steps = [
    { title: t("step1Title"), body: t("step1Body"), panel: <AgendaMock label={t("agendaLabel")} /> },
    { title: t("step2Title"), body: t("step2Body"), panel: <BudgetMock label={t("budgetLabel")} procedure="Faceta cerâmica E.max" /> },
    { title: t("step3Title"), body: t("step3Body"), panel: <PlanMock label={t("planLabel")} paid={t("paid")} due={t("due")} /> },
  ]

  // GSAP/ScrollTrigger sob demanda (fora do caminho crítico). gsap.context(scope) = mesma limpeza do useGSAP.
  useEffect(() => {
    let disposed = false
    let revert: (() => void) | undefined
    ;(async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      if (disposed || !root.current) return
      gsap.registerPlugin(ScrollTrigger)
      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia()
        mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
          const panels = gsap.utils.toArray<HTMLElement>("[data-flow-panel]")
          gsap.set(panels.slice(1), { autoAlpha: 0, yPercent: 10, scale: 0.96 })
          gsap.set("[data-flow-progress]", { scaleY: 1 / panels.length, transformOrigin: "top" })

          const tl = gsap.timeline({
            defaults: { ease: "power2.inOut" },
            scrollTrigger: {
              trigger: "[data-flow-stage]",
              start: "top top",
              end: `+=${(panels.length - 1) * 90 + 40}%`,
              pin: true,
              scrub: 0.7,
              anticipatePin: 1,
              // Passo ativo por cor (contraste AA), não por opacidade
              onUpdate: (self) => {
                const idx = Math.min(panels.length - 1, Math.floor(self.progress * panels.length))
                if (idx !== activeRef.current) {
                  activeRef.current = idx
                  setActive(idx)
                }
              },
            },
          })
          panels.forEach((panel, i) => {
            if (i === 0) return
            tl.to(panels[i - 1], { autoAlpha: 0, yPercent: -8, scale: 0.96, duration: 1 }, i - 0.5)
              .to(panel, { autoAlpha: 1, yPercent: 0, scale: 1, duration: 1 }, i - 0.5)
              .to("[data-flow-progress]", { scaleY: (i + 1) / panels.length, duration: 1 }, i - 0.5)
          })
          tl.to({}, { duration: 0.4 })
        })
      }, root)
      ScrollTrigger.refresh()
      revert = () => ctx.revert()
    })()
    return () => {
      disposed = true
      revert?.()
    }
  }, [])

  return (
    <section ref={root} id="fluxo" aria-labelledby="flow-title" className="relative border-t border-hairline bg-surface">
      <div data-flow-stage className="mx-auto grid max-w-[1320px] gap-10 px-4 py-20 sm:px-8 lg:h-[100svh] lg:grid-cols-[1fr_1.618fr] lg:items-center lg:gap-16 lg:py-0">
        {/* 38,2%: narrativa */}
        <div>
          <h2 id="flow-title" className="font-display text-[clamp(1.9rem,3.6vw,3.1rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ink text-balance">
            <KineticLine text={t("title")} trigger="inView" />
          </h2>
          <Reveal as="p" className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
            {t("lead")}
          </Reveal>

          <ol className="relative mt-10 hidden space-y-7 border-l border-border pl-6 lg:block">
            <span data-flow-progress className="absolute -left-px top-0 h-full w-[2px] bg-primary" aria-hidden />
            {steps.map((s, i) => {
              const on = i === active
              return (
                <li key={s.title} data-flow-step aria-current={on ? "step" : undefined}>
                  <p className={cn("font-display text-[12px] font-semibold tabular transition-colors duration-500", on ? "text-primary" : "text-muted-foreground")}>0{i + 1}</p>
                  <h3 className={cn("mt-1 font-display text-[19px] font-semibold tracking-[-0.01em] transition-colors duration-500", on ? "text-ink" : "text-muted-foreground")}>{s.title}</h3>
                  <p className={cn("mt-1.5 max-w-md text-[14.5px] leading-relaxed transition-colors duration-500", on ? "text-ink-soft" : "text-muted-foreground")}>{s.body}</p>
                </li>
              )
            })}
          </ol>
        </div>

        {/* 61,8%: palco com os painéis do produto */}
        <div className="relative">
          {/* Desktop: painéis empilhados no mesmo palco (animados pelo ScrollTrigger) */}
          <div className="relative hidden h-[min(560px,70svh)] lg:block">
            {steps.map((s, i) => (
              <div
                key={s.title}
                data-flow-panel
                className="absolute inset-0 rounded-md border border-border bg-background p-7 shadow-[0_40px_80px_-48px_rgba(15,31,51,0.45)]"
                aria-hidden
              >
                {s.panel}
              </div>
            ))}
          </div>

          {/* Mobile/tablet: passos em sequência, sem fixação */}
          <ol className="space-y-12 lg:hidden">
            {steps.map((s, i) => (
              <Reveal as="li" key={s.title}>
                <p className="font-display text-[12px] font-semibold tabular text-primary">0{i + 1}</p>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-[-0.01em] text-ink">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
                <div className="mt-5 rounded-md border border-border bg-background p-4 shadow-[0_30px_60px_-44px_rgba(15,31,51,0.45)] sm:p-6">{s.panel}</div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

export default FlowSection
