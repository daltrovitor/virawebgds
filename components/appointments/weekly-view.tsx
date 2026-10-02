// Hello World
"use client"

import React, { useEffect, useMemo, useState } from "react"
import { motion } from "motion/react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useLocale } from "next-intl"
import { cn } from "@/lib/utils"
import { CLINICAL_STATUS, CLINICAL_STATUS_ORDER, clinicalStatusOf } from "@/lib/appointment-status"
import { NativeSelect } from "@/components/dental/form-primitives"

export interface Appointment {
  id: string
  user_id: string
  patient_id: string
  professional_id: string
  appointment_date: string
  appointment_time: string
  duration_minutes: number
  status: string
  clinical_status?: string | null
  first_visit?: boolean | null
  notes: string | null
  planned_procedure?: string | null
  occurrence?: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyViewProps {
  appointments: Appointment[]
  professionals: Array<{ id: string; name: string }>
  patients?: Array<{ id: string; name: string }>
  selectedProfessional: string
  onSelectProfessional: (value: string) => void
  onOpenAppointment: (appointment: Appointment) => void
  onSlotClick?: (date: string, time: string) => void
}

const START_HOUR = 7
const END_HOUR = 20
const SLOT_MINUTES = 30
const ROW_PX = 30
const SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}
const fmtTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`

function mondayOf(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

/** Distribui consultas sobrepostas em faixas lado a lado. */
function layoutDay(items: Appointment[]) {
  const sorted = [...items].sort((a, b) => minutesOf(a.appointment_time) - minutesOf(b.appointment_time))
  const placed: Array<{ apt: Appointment; start: number; end: number; lane: number; lanes: number }> = []
  let cluster: typeof placed = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    cluster.forEach((c) => (c.lanes = lanes))
    cluster = []
  }
  for (const apt of sorted) {
    const start = minutesOf(apt.appointment_time)
    const end = start + Math.max(15, apt.duration_minutes || 30)
    if (start >= clusterEnd) flush()
    const used = new Set(cluster.filter((c) => c.end > start).map((c) => c.lane))
    let lane = 0
    while (used.has(lane)) lane++
    const entry = { apt, start, end, lane, lanes: 1 }
    cluster.push(entry)
    placed.push(entry)
    clusterEnd = Math.max(clusterEnd, end)
  }
  flush()
  return placed
}

export function WeeklyView({
  appointments,
  professionals,
  patients = [],
  selectedProfessional,
  onSelectProfessional,
  onOpenAppointment,
  onSlotClick,
}: WeeklyViewProps): React.ReactElement {
  const locale = useLocale()
  const [anchor, setAnchor] = useState(() => new Date())
  const [mode, setMode] = useState<"week" | "day">("week")
  const [now, setNow] = useState<Date | null>(null)

  // Hora atual apenas no cliente (evita divergência de hidratação) e atualizada por minuto
  useEffect(() => {
    setNow(new Date())
    if (window.matchMedia("(max-width: 767px)").matches) setMode("day")
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const monday = useMemo(() => mondayOf(anchor), [anchor])
  const patientName = useMemo(() => new Map(patients.map((p) => [p.id, p.name])), [patients])
  const profName = useMemo(() => new Map(professionals.map((p) => [p.id, p.name])), [professionals])

  const visible = useMemo(
    () => appointments.filter((a) => selectedProfessional === "all" || a.professional_id === selectedProfessional),
    [appointments, selectedProfessional],
  )

  const days = useMemo(() => {
    if (mode === "day") {
      const d = new Date(anchor)
      d.setHours(0, 0, 0, 0)
      return [d]
    }
    const list = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
    const sundayISO = toISO(list[6])
    const hasSunday = visible.some((a) => a.appointment_date === sundayISO)
    return hasSunday ? list : list.slice(0, 6)
  }, [mode, anchor, monday, visible])

  const byDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutDay>>()
    days.forEach((d) => {
      const key = toISO(d)
      map.set(key, layoutDay(visible.filter((a) => a.appointment_date === key)))
    })
    return map
  }, [days, visible])

  const shift = (dir: -1 | 1) => {
    const d = new Date(anchor)
    d.setDate(d.getDate() + dir * (mode === "week" ? 7 : 1))
    setAnchor(d)
  }

  const rangeLabel = useMemo(() => {
    const fmt = (d: Date, withYear = false) =>
      d.toLocaleDateString(locale, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) })
    if (mode === "day") return days[0].toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })
    return `${fmt(days[0])} — ${fmt(days[days.length - 1], true)}`
  }, [mode, days, locale])

  const todayISO = now ? toISO(now) : ""
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : -1
  const nowTop = ((nowMinutes - START_HOUR * 60) / SLOT_MINUTES) * ROW_PX

  return (
    <div className="w-full space-y-3">
      {/* Controles */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-full sm:w-60">
            <NativeSelect aria-label="Dentista" value={selectedProfessional} onChange={(e) => onSelectProfessional(e.target.value)}>
              <option value="all">Todos os dentistas</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <div className="flex items-center rounded-sm border border-border">
            <button type="button" onClick={() => shift(-1)} className="flex h-11 w-11 items-center justify-center text-ink-soft hover:bg-surface" aria-label={mode === "week" ? "Semana anterior" : "Dia anterior"}>
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setAnchor(new Date())} className="h-11 border-x border-border px-3 text-[13px] font-semibold text-ink hover:bg-surface">
              Hoje
            </button>
            <button type="button" onClick={() => shift(1)} className="flex h-11 w-11 items-center justify-center text-ink-soft hover:bg-surface" aria-label={mode === "week" ? "Próxima semana" : "Próximo dia"}>
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="min-w-0 truncate px-1 font-display text-[14px] font-semibold text-ink first-letter:uppercase" aria-live="polite">
            {rangeLabel}
          </p>
          <div className="flex rounded-sm border border-border p-0.5" role="group" aria-label="Visualização">
            {(["week", "day"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("min-h-10 rounded-xs px-3 text-[13px] font-medium", mode === m ? "bg-secondary text-ink" : "text-muted-foreground hover:text-ink")}
              >
                {m === "week" ? "Semana" : "Dia"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grade */}
      <div className="overflow-x-auto rounded-md border border-border bg-background" data-lenis-prevent>
        <div className={cn(mode === "week" ? "min-w-[780px]" : "min-w-0")}>
          {/* Cabeçalho dos dias */}
          <div className="sticky top-0 z-10 grid border-b border-border bg-background" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((d) => {
              const iso = toISO(d)
              const isToday = iso === todayISO
              const count = byDay.get(iso)?.length || 0
              return (
                <div key={iso} className={cn("border-l border-hairline px-2 py-2.5 text-center", isToday && "bg-accent/60")}>
                  <p className={cn("text-[11px] font-medium uppercase tracking-[0.12em]", isToday ? "text-primary" : "text-muted-foreground")}>
                    {d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")}
                  </p>
                  <p className={cn("font-display text-lg font-semibold leading-tight tabular", isToday ? "text-primary" : "text-ink")}>{d.getDate()}</p>
                  <p className="text-[11px] text-muted-foreground">{count ? `${count} consulta${count > 1 ? "s" : ""}` : "—"}</p>
                </div>
              )
            })}
          </div>

          {/* Corpo */}
          <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
            {/* Régua de horários */}
            <div className="relative" style={{ height: SLOTS * ROW_PX }}>
              {Array.from({ length: SLOTS }, (_, i) => {
                const mins = START_HOUR * 60 + i * SLOT_MINUTES
                return (
                  <div key={i} className="absolute right-2 -translate-y-1/2 text-[11px] tabular text-muted-foreground" style={{ top: i * ROW_PX }}>
                    {i === 0 ? "" : mins % 60 === 0 ? fmtTime(mins) : <span className="opacity-60">{fmtTime(mins)}</span>}
                  </div>
                )
              })}
            </div>

            {days.map((d) => {
              const iso = toISO(d)
              const isToday = iso === todayISO
              const placed = byDay.get(iso) || []
              return (
                <div key={iso} className={cn("relative border-l border-hairline", isToday && "bg-accent/30")} style={{ height: SLOTS * ROW_PX }}>
                  {/* Linhas e slots clicáveis */}
                  {Array.from({ length: SLOTS }, (_, i) => {
                    const mins = START_HOUR * 60 + i * SLOT_MINUTES
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onSlotClick?.(iso, fmtTime(mins))}
                        className={cn(
                          "group absolute inset-x-0 flex items-center justify-center text-[11px] font-medium text-primary/0 transition-colors hover:bg-primary/[0.04] hover:text-primary/80",
                          mins % 60 === 0 ? "border-t border-hairline" : "border-t border-dashed border-hairline/70",
                        )}
                        style={{ top: i * ROW_PX, height: ROW_PX }}
                        aria-label={`Agendar ${d.toLocaleDateString(locale)} às ${fmtTime(mins)}`}
                        tabIndex={-1}
                      >
                        <Plus className="mr-1 h-3 w-3" aria-hidden />
                        {fmtTime(mins)}
                      </button>
                    )
                  })}

                  {/* Consultas */}
                  {placed.map(({ apt, start, end, lane, lanes }, idx) => {
                    const status = clinicalStatusOf(apt)
                    const meta = CLINICAL_STATUS[status]
                    const top = ((Math.max(start, START_HOUR * 60) - START_HOUR * 60) / SLOT_MINUTES) * ROW_PX
                    const height = Math.max(ROW_PX - 2, ((Math.min(end, END_HOUR * 60) - Math.max(start, START_HOUR * 60)) / SLOT_MINUTES) * ROW_PX - 2)
                    const compact = height < ROW_PX * 2
                    return (
                      <motion.button
                        key={apt.id}
                        type="button"
                        onClick={() => onOpenAppointment(apt)}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28, delay: Math.min(idx, 8) * 0.03 }}
                        whileHover={{ y: -1 }}
                        className={cn(
                          "absolute overflow-hidden rounded-sm border border-black/[0.06] text-left shadow-[0_1px_0_rgba(15,31,51,0.04)] transition-colors focus-visible:z-20",
                          meta.block,
                        )}
                        style={{ top: top + 1, height, left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` }}
                        aria-label={`${patientName.get(apt.patient_id) || "Paciente"}, ${apt.appointment_time.slice(0, 5)} às ${fmtTime(end)}, ${meta.label}`}
                      >
                        <span className={cn("absolute inset-y-0 left-0 w-[3px]", meta.rail)} aria-hidden />
                        <span className={cn("block pl-2.5 pr-1.5", compact ? "py-0.5" : "py-1.5")}>
                          <span className="block text-[10.5px] font-medium tabular opacity-80">
                            {fmtTime(start)}–{fmtTime(end)}
                            {apt.first_visit ? " · 1ª consulta" : ""}
                          </span>
                          <span className={cn("block font-semibold leading-tight", compact ? "truncate text-[12px]" : "line-clamp-2 text-[13px]")}>
                            {patientName.get(apt.patient_id) || "Paciente"}
                          </span>
                          {!compact && (
                            <span className="mt-0.5 block truncate text-[11px] opacity-75">
                              {meta.label}
                              {selectedProfessional === "all" && profName.get(apt.professional_id) ? ` · ${profName.get(apt.professional_id)}` : ""}
                            </span>
                          )}
                        </span>
                      </motion.button>
                    )
                  })}

                  {/* Linha do agora */}
                  {isToday && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }} aria-hidden>
                      <div className="relative h-px bg-rose-600">
                        <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-rose-600" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-1" aria-label="Legenda de status">
        {CLINICAL_STATUS_ORDER.filter((s) => !s.endsWith("rescheduled")).map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span className={cn("h-2.5 w-2.5 rounded-xs", CLINICAL_STATUS[s].rail)} aria-hidden />
            {CLINICAL_STATUS[s].label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default WeeklyView
