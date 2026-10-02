// Hello World
"use client"

import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { odontogramRows, toothName, type Dentition, type Hemiarch } from "@/lib/teeth"
import { HEMIARCH_SHORT, type DentalRegion } from "@/lib/dental-regions"

/* ------------------------------------------------------------------ */
/* Glifos de dente (traço fino): raiz para cima na arcada superior.     */
/* ------------------------------------------------------------------ */

type ToothKind = "incisor" | "canine" | "premolar" | "molar"

function toothKind(fdi: number): ToothKind {
  const pos = fdi % 10
  const deciduous = fdi >= 51
  if (pos <= 2) return "incisor"
  if (pos === 3) return "canine"
  if (deciduous) return "molar"
  return pos <= 5 ? "premolar" : "molar"
}

const CROWN_WIDTH: Record<ToothKind, number> = { incisor: 17, canine: 19, premolar: 22, molar: 30 }

function crownPath(kind: ToothKind): string {
  const w = CROWN_WIDTH[kind]
  const x0 = 20 - w / 2
  const x1 = 20 + w / 2
  if (kind === "molar") {
    return `M${x0},56 C${x0},74 ${x0 + 1},86 ${x0 + 6},89 Q14,92.5 20,88.5 Q26,92.5 ${x1 - 6},89 C${x1 - 1},86 ${x1},74 ${x1},56 Z`
  }
  if (kind === "canine") {
    return `M${x0},56 C${x0},72 ${x0 + 3},84 20,92 C${x1 - 3},84 ${x1},72 ${x1},56 Z`
  }
  if (kind === "premolar") {
    return `M${x0},56 C${x0},74 ${x0 + 2},87 ${x0 + 7},89.5 Q20,93 ${x1 - 7},89.5 C${x1 - 2},87 ${x1},74 ${x1},56 Z`
  }
  return `M${x0},56 C${x0},76 ${x0 + 1},89 ${x0 + 4},90.5 L${x1 - 4},90.5 C${x1 - 1},89 ${x1},76 ${x1},56 Z`
}

function rootPaths(kind: ToothKind): string[] {
  if (kind === "molar") {
    return [
      "M7.5,57 C6,42 6.5,24 10.5,10 C13,18 15.5,36 18.5,57 Z",
      "M21.5,57 C24.5,36 27,18 29.5,10 C33.5,24 34,42 32.5,57 Z",
    ]
  }
  const r = kind === "canine" ? 6.6 : kind === "premolar" ? 6.4 : 5.4
  const top = kind === "canine" ? 2 : 8
  return [`M${20 - r},57 C${20 - r},40 ${20 - r * 0.55},${top + 10} 20,${top} C${20 + r * 0.55},${top + 10} ${20 + r},40 ${20 + r},57 Z`]
}

export interface ToothGlyphProps {
  fdi: number
  lower: boolean
  state: "idle" | "selected" | "covered"
}

export function ToothGlyph({ fdi, lower, state }: ToothGlyphProps) {
  const kind = toothKind(fdi)
  const stroke = state === "selected" ? "var(--primary)" : state === "covered" ? "#7aa7c7" : "#9aa8b8"
  const crownFill = state === "selected" ? "color-mix(in oklab, var(--primary) 18%, white)" : state === "covered" ? "#eef5fa" : "#ffffff"
  const rootFill = state === "selected" ? "color-mix(in oklab, var(--primary) 9%, white)" : "#f4f6f9"
  return (
    <svg viewBox="0 0 40 96" className="h-full w-full" aria-hidden focusable="false">
      <g transform={lower ? "translate(0 96) scale(1 -1)" : undefined}>
        {rootPaths(kind).map((d, i) => (
          <path key={i} d={d} fill={rootFill} stroke={stroke} strokeWidth={1.1} strokeLinejoin="round" />
        ))}
        <path d={crownPath(kind)} fill={crownFill} stroke={stroke} strokeWidth={1.3} strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */

export interface ArchChartProps {
  value: DentalRegion[]
  onChange: (value: DentalRegion[]) => void
  /** Quantidade de procedimentos já vinculados por dente (marcador discreto). */
  coverage?: Record<number, number>
  className?: string
}

const sameRegion = (a: DentalRegion, b: DentalRegion) => {
  if (a.kind !== b.kind) return false
  if (a.kind === "tooth" && b.kind === "tooth") return a.tooth === b.tooth
  if (a.kind === "hemiarch" && b.kind === "hemiarch") return a.hemiarch === b.hemiarch
  if (a.kind === "arch" && b.kind === "arch") return a.arch === b.arch
  return true
}

/**
 * Seleção de região do procedimento: dentes (múltiplos), hemiarcos, arcada inteira ou "sem região".
 * "Sem região" é exclusivo; qualquer outra escolha o desmarca.
 */
export function ArchChart({ value, onChange, coverage = {}, className }: ArchChartProps) {
  const [dentition, setDentition] = useState<Dentition>("permanent")
  const rows = useMemo(() => odontogramRows(dentition), [dentition])
  const half = rows.upper.length / 2

  const isSelected = (region: DentalRegion) => value.some((v) => sameRegion(v, region))
  const toggle = (region: DentalRegion) => {
    if (region.kind === "none") {
      onChange(isSelected(region) ? [] : [region])
      return
    }
    const withoutNone = value.filter((v) => v.kind !== "none")
    onChange(isSelected(region) ? withoutNone.filter((v) => !sameRegion(v, region)) : [...withoutNone, region])
  }

  const selectedTeeth = value.filter((v): v is { kind: "tooth"; tooth: number } => v.kind === "tooth").map((v) => v.tooth)

  const renderTooth = (fdi: number, lower: boolean) => {
    const selected = selectedTeeth.includes(fdi)
    const covered = (coverage[fdi] || 0) > 0
    return (
      <button
        key={fdi}
        type="button"
        onClick={() => toggle({ kind: "tooth", tooth: fdi })}
        aria-pressed={selected}
        aria-label={`Dente ${fdi} — ${toothName(fdi)}${covered ? ` (${coverage[fdi]} procedimento(s))` : ""}`}
        title={`${fdi} · ${toothName(fdi)}`}
        className={cn(
          "group relative flex min-w-0 flex-1 flex-col items-center rounded-sm px-0.5 pb-1 pt-1 transition-colors",
          lower && "flex-col-reverse",
          selected ? "bg-accent" : "hover:bg-surface",
        )}
      >
        <span
          className={cn(
            "font-display text-[11px] font-semibold tabular-nums sm:text-xs",
            selected ? "text-primary" : "text-ink-soft",
          )}
        >
          {fdi}
        </span>
        <motion.span
          className="block h-16 w-full max-w-[38px] sm:h-[76px]"
          animate={{ y: selected ? (lower ? -3 : 3) : 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
        >
          <ToothGlyph fdi={fdi} lower={lower} state={selected ? "selected" : covered ? "covered" : "idle"} />
        </motion.span>
        {covered && (
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary/70" aria-hidden />
        )}
      </button>
    )
  }

  const renderHemi = (h: Hemiarch) => {
    const region: DentalRegion = { kind: "hemiarch", hemiarch: h }
    const active = isSelected(region)
    return (
      <button
        key={`hemi-${h}`}
        type="button"
        onClick={() => toggle(region)}
        aria-pressed={active}
        className={cn(
          "min-h-10 flex-1 rounded-sm border px-2 text-[12px] font-medium transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-ink-soft hover:border-primary/50 hover:text-ink",
        )}
      >
        {HEMIARCH_SHORT[h]}
      </button>
    )
  }

  const renderArch = (arch: "upper" | "lower", label: string) => {
    const region: DentalRegion = { kind: "arch", arch }
    const active = isSelected(region)
    return (
      <button
        type="button"
        onClick={() => toggle(region)}
        aria-pressed={active}
        className={cn(
          "min-h-10 w-full rounded-sm border px-3 font-display text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors",
          active ? "border-primary bg-primary text-primary-foreground" : "border-transparent bg-[#0f1f33] text-white hover:bg-[#1b2f48]",
        )}
      >
        {label}
      </button>
    )
  }

  const noneActive = isSelected({ kind: "none" })

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2.5 sm:px-4">
        <div className="inline-flex rounded-sm border border-border p-0.5" role="group" aria-label="Dentição">
          {(["permanent", "deciduous"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDentition(d)}
              aria-pressed={dentition === d}
              className={cn(
                "min-h-9 rounded-xs px-3 text-[12px] font-medium transition-colors",
                dentition === d ? "bg-secondary text-ink" : "text-muted-foreground hover:text-ink",
              )}
            >
              {d === "permanent" ? "Permanente" : "Decídua"}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground" aria-live="polite">
          {value.length === 0
            ? "Selecione dentes, hemiarco, arcada ou “sem região”."
            : noneActive
              ? "Procedimento sem região"
              : `${value.length} região(ões) selecionada(s)`}
        </p>
      </div>

      <div className="overflow-x-auto px-2 py-3 sm:px-3" data-lenis-prevent>
        <div className="min-w-[580px] space-y-2">
          {renderArch("upper", "Arcada superior")}
          <div className="flex items-end gap-1">
            <div className="flex flex-1 gap-0.5">{rows.upper.slice(0, half).map((t) => renderTooth(t, false))}</div>
            <div className="h-16 w-px self-center bg-border" aria-hidden />
            <div className="flex flex-1 gap-0.5">{rows.upper.slice(half).map((t) => renderTooth(t, false))}</div>
          </div>
          <div className="flex gap-2">
            {renderHemi(1)}
            {renderHemi(2)}
          </div>

          <div className="flex items-center gap-3 py-1.5">
            <span className="h-px flex-1 bg-hairline" aria-hidden />
            <button
              type="button"
              onClick={() => toggle({ kind: "none" })}
              aria-pressed={noneActive}
              className={cn(
                "min-h-10 rounded-sm border px-4 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors",
                noneActive ? "border-primary bg-primary text-primary-foreground" : "border-border text-ink-soft hover:border-primary/50 hover:text-ink",
              )}
            >
              Procedimento sem região
            </button>
            <span className="h-px flex-1 bg-hairline" aria-hidden />
          </div>

          <div className="flex gap-2">
            {renderHemi(4)}
            {renderHemi(3)}
          </div>
          <div className="flex items-start gap-1">
            <div className="flex flex-1 gap-0.5">{rows.lower.slice(0, half).map((t) => renderTooth(t, true))}</div>
            <div className="h-16 w-px self-center bg-border" aria-hidden />
            <div className="flex flex-1 gap-0.5">{rows.lower.slice(half).map((t) => renderTooth(t, true))}</div>
          </div>
          {renderArch("lower", "Arcada inferior")}
        </div>
      </div>
    </div>
  )
}

export default ArchChart
