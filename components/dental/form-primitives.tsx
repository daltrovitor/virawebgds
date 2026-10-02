// Hello World
"use client"

import type React from "react"
import { forwardRef, useId, useMemo, useState } from "react"
import { ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"

/* Primitivos de formulário do fluxo clínico: nativos (acessíveis e rápidos no celular), 44px de altura. */

export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

const controlBase =
  "h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3 text-[14px] text-ink transition-colors placeholder:text-muted-foreground/80 hover:border-ink-soft/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, className)} {...props} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(controlBase, "h-auto min-h-[88px] py-2.5 leading-relaxed", className)} {...props} />
})

export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function NativeSelect(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative min-w-0">
      <select ref={ref} className={cn(controlBase, "appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  )
})

/** Campo monetário em reais: aceita "3850", "3.850,00" ou "3850.00". */
export function parseBRL(input: string): number {
  const cleaned = input.replace(/[^\d,.-]/g, "")
  if (!cleaned) return 0
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

export function MoneyInput({
  value,
  onValueChange,
  id,
  ariaLabel,
  className,
  onBlur,
  onKeyDown,
}: {
  value: string
  onValueChange: (value: string) => void
  id?: string
  ariaLabel?: string
  className?: string
  onBlur?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">R$</span>
      <TextInput
        id={id}
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="pl-9 tabular"
      />
    </div>
  )
}

export interface PickerOption {
  id: string
  label: string
  meta?: string | null
}

/** Busca com lista (combobox simples) — usado para escolher paciente. */
export function SearchPicker({
  options,
  value,
  onChange,
  placeholder,
  label,
  emptyText = "Nenhum resultado",
}: {
  options: PickerOption[]
  value: string
  onChange: (id: string) => void
  placeholder: string
  label: string
  emptyText?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const listId = useId()
  const selected = options.find((o) => o.id === value)

  const matches = useMemo(() => {
    const q = query
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
    const pool = q
      ? options.filter((o) =>
          `${o.label} ${o.meta || ""}`
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
            .includes(q),
        )
      : options
    return pool.slice(0, 8)
  }, [options, query])

  if (selected) {
    return (
      <div className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-sm border border-input bg-accent/40 px-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{selected.label}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("")
            setQuery("")
            setOpen(true)
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-ink"
          aria-label={`Trocar ${label.toLowerCase()}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <TextInput
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="pl-9"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-sm border border-border bg-popover py-1 shadow-lg"
          data-lenis-prevent
        >
          {matches.length === 0 && <li className="px-3 py-2.5 text-[13px] text-muted-foreground">{emptyText}</li>}
          {matches.map((o) => (
            <li key={o.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className="flex min-h-11 w-full flex-col items-start justify-center px-3 py-1.5 text-left hover:bg-accent"
              >
                <span className="text-[14px] font-medium text-ink">{o.label}</span>
                {o.meta && <span className="text-[12px] text-muted-foreground">{o.meta}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Cabeçalho de painel no estilo Gestalt: título, contagem/ação à direita e régua fina. */
export function PanelHeader({ title, aside, className }: { title: string; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-12 items-center justify-between gap-3 border-b border-hairline px-4 sm:px-5", className)}>
      <h2 className="font-display text-[14px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
      {aside}
    </div>
  )
}
