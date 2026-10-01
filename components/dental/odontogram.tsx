// Hello World
"use client"

import React, { useState } from "react"
import {
  odontogramRows,
  parseTeethList,
  toothName,
  type Dentition,
  type ToothCondition,
  TOOTH_CONDITION_LABELS,
  TOOTH_CONDITION_COLORS,
} from "@/lib/teeth"
import { cn } from "@/lib/utils"

export interface ToothData {
  condition?: ToothCondition
  notes?: string
  procedures?: string[]
}

interface OdontogramProps {
  selectedTeeth: number[]
  onSelectionChange?: (teeth: number[]) => void
  teethData?: Record<number, ToothData>
  onToothClick?: (toothNumber: number) => void
  readOnly?: boolean
  className?: string
}

export default function Odontogram({
  selectedTeeth,
  onSelectionChange,
  teethData = {},
  onToothClick,
  readOnly = false,
  className,
}: OdontogramProps) {
  const [dentition, setDentition] = useState<Dentition>(
    selectedTeeth.some((t) => t >= 51) ? "deciduous" : "permanent"
  )
  const [textInput, setTextInput] = useState("")
  const [textError, setTextError] = useState<string | null>(null)

  const rows = odontogramRows(dentition)

  const toggleTooth = (t: number) => {
    if (onToothClick) {
      onToothClick(t)
    }
    if (onSelectionChange && !readOnly) {
      const isSelected = selectedTeeth.includes(t)
      const updated = isSelected
        ? selectedTeeth.filter((x) => x !== t)
        : [...selectedTeeth, t].sort((a, b) => a - b)
      onSelectionChange(updated)
    }
  }

  const renderTooth = (t: number) => {
    const isSelected = selectedTeeth.includes(t)
    const data = teethData[t]
    const condition = data?.condition || "healthy"
    const colorStyle = TOOTH_CONDITION_COLORS[condition] || TOOTH_CONDITION_COLORS.healthy

    return (
      <button
        key={t}
        type="button"
        aria-pressed={isSelected}
        aria-label={`Dente ${t}: ${toothName(t)} - ${TOOTH_CONDITION_LABELS[condition]}`}
        title={`${t}: ${toothName(t)} (${TOOTH_CONDITION_LABELS[condition]})${data?.notes ? ` - ${data.notes}` : ""}`}
        onClick={() => toggleTooth(t)}
        className={cn(
          "relative flex flex-col items-center justify-center p-1 rounded-sm border transition-all cursor-pointer h-14 min-w-[34px] sm:min-w-[42px] sm:h-16",
          isSelected
            ? "ring-2 ring-primary ring-offset-1 border-primary bg-primary/10 shadow-sm"
            : cn(colorStyle.bg, colorStyle.border, "hover:border-primary/60 hover:shadow-xs")
        )}
      >
        <span className={cn("text-xs sm:text-sm font-bold tabular-nums", isSelected ? "text-primary" : colorStyle.text)}>
          {t}
        </span>
        <span className="text-[9px] uppercase tracking-tighter truncate max-w-full font-medium text-muted-foreground mt-0.5">
          {condition !== "healthy" ? condition.slice(0, 4) : "ok"}
        </span>
        {data?.procedures && data.procedures.length > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
        )}
      </button>
    )
  }

  return (
    <div className={cn("space-y-4 bg-card rounded-md border border-border p-4 shadow-xs", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="inline-flex rounded-sm border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setDentition("permanent")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-xs cursor-pointer transition-colors",
              dentition === "permanent" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Adulto (Permanentes)
          </button>
          <button
            type="button"
            onClick={() => setDentition("deciduous")}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-xs cursor-pointer transition-colors",
              dentition === "deciduous" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Infantil (Decíduos)
          </button>
        </div>

        {selectedTeeth.length > 0 && onSelectionChange && !readOnly && (
          <button
            type="button"
            onClick={() => onSelectionChange([])}
            className="text-xs text-muted-foreground hover:text-destructive font-medium cursor-pointer transition-colors"
          >
            Limpar seleção ({selectedTeeth.length})
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-[11px] items-center text-muted-foreground pt-1 pb-1">
        <span className="font-semibold text-foreground text-xs mr-1">Legenda:</span>
        {(Object.keys(TOOTH_CONDITION_LABELS) as ToothCondition[]).map((cond) => {
          const c = TOOTH_CONDITION_COLORS[cond]
          return (
            <div key={cond} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs border border-border/40 bg-background">
              <span className={cn("w-2.5 h-2.5 rounded-xs border", c.bg, c.border)} />
              <span>{TOOTH_CONDITION_LABELS[cond]}</span>
            </div>
          )
        })}
      </div>

      {/* Visual Dental Arch */}
      <div className="overflow-x-auto pb-2" data-lenis-prevent>
        <div className="min-w-[620px] space-y-2 rounded-sm border border-border/80 bg-background/50 p-3">
          <div className="flex justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Direita do Paciente</span>
            <span className="text-primary font-bold">Arcada Superior</span>
            <span>Esquerda do Paciente</span>
          </div>

          {/* Upper teeth */}
          <div className="grid grid-flow-col auto-cols-fr gap-1 sm:gap-1.5">
            {rows.upper.map((t, idx) => (
              <React.Fragment key={t}>
                {idx === rows.upper.length / 2 && (
                  <div className="w-2 border-r border-dashed border-border/80 mx-0.5" />
                )}
                {renderTooth(t)}
              </React.Fragment>
            ))}
          </div>

          <div className="h-px bg-border/40 my-3" />

          {/* Lower teeth */}
          <div className="grid grid-flow-col auto-cols-fr gap-1 sm:gap-1.5">
            {rows.lower.map((t, idx) => (
              <React.Fragment key={t}>
                {idx === rows.lower.length / 2 && (
                  <div className="w-2 border-r border-dashed border-border/80 mx-0.5" />
                )}
                {renderTooth(t)}
              </React.Fragment>
            ))}
          </div>

          <div className="text-center text-[11px] font-semibold uppercase tracking-wider text-primary pt-1">
            Arcada Inferior
          </div>
        </div>
      </div>

      {/* Text input alternative */}
      {!readOnly && onSelectionChange && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center pt-2">
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Digitar dentes (ex: 11, 12, 21-24)"
              className="h-9 w-full rounded-sm border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-hidden"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const { teeth, invalid } = parseTeethList(textInput)
              if (invalid.length > 0) {
                setTextError(`Dentes inválidos (numeração FDI): ${invalid.join(", ")}`)
                return
              }
              setTextError(null)
              const updated = Array.from(new Set([...selectedTeeth, ...teeth])).sort((a, b) => a - b)
              onSelectionChange(updated)
              setTextInput("")
            }}
            className="h-9 px-4 rounded-sm bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-secondary/80 cursor-pointer transition-colors"
          >
            Adicionar à Seleção
          </button>
        </div>
      )}

      {textError && (
        <p className="text-xs text-destructive font-medium">{textError}</p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span>
          {selectedTeeth.length === 0
            ? "Nenhum dente selecionado."
            : `Dentes selecionados: ${selectedTeeth.join(", ")} (${selectedTeeth.length} dente${selectedTeeth.length > 1 ? "s" : ""})`}
        </span>
      </div>
    </div>
  )
}
