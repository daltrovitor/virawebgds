// Hello World
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { moveAppointmentAction } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { APPOINTMENT_STATUS_LABEL, formatDuration, OCCUPYING_STATUSES, snapToSlot, type AppointmentStatus } from "@/domain/appointments";
import { addDays, formatDateBR, instantToZoned, minutesToHHMM, startOfWeekMonday, weekdayNamePT, weekdayOf } from "@/domain/dates";
import { cn } from "@/lib/cn";
import { APPOINTMENT_TONE } from "@/lib/status";
import type { AgendaData } from "@/server/services/appointments";
import { AppointmentDetails } from "./appointment-details";
import { AppointmentForm, type FormInitial } from "./appointment-form";

type Appt = AgendaData["appointments"][number];

interface Column {
  key: string;
  date: string;
  professionalId: string | null;
  label: string;
  sublabel?: string;
}

const PX_PER_MIN = 64 / 60;

const TONE_CARD: Record<string, string> = {
  neutral: "border-l-zinc-400 bg-white",
  info: "border-l-blue-600 bg-blue-50/60",
  warning: "border-l-yellow-600 bg-yellow-50/70",
  accent: "border-l-teal-700 bg-teal-50/70",
  success: "border-l-green-700 bg-green-50/60",
  danger: "border-l-red-700 bg-red-50/60",
};

/** Distribui consultas sobrepostas em faixas lado a lado dentro da coluna. */
function lanes(list: Appt[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...list].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: Appt[] = [];
  let groupEnd = -1;
  const flush = () => {
    const laneEnds: number[] = [];
    for (const a of group) {
      let lane = laneEnds.findIndex((end) => end <= a.startMinute);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(a.endMinute);
      } else laneEnds[lane] = a.endMinute;
      out.set(a.id, { lane, lanes: 0 });
    }
    for (const a of group) out.get(a.id)!.lanes = laneEnds.length;
    group = [];
  };
  for (const a of sorted) {
    if (a.startMinute >= groupEnd && group.length > 0) flush();
    group.push(a);
    groupEnd = Math.max(groupEnd, a.endMinute);
  }
  if (group.length > 0) flush();
  return out;
}

export function AgendaView({
  data,
  mode,
  date,
  today,
  professionalFilter,
  professionals,
  canEdit,
  canOverbook,
  canClinical,
  canCreatePatient,
  timezone,
  openCreate,
  openAppointmentId,
}: {
  data: AgendaData;
  mode: "dia" | "semana";
  date: string;
  today: string;
  professionalFilter: string;
  professionals: { id: string; name: string; color: string }[];
  canEdit: boolean;
  canOverbook: boolean;
  canClinical: boolean;
  canCreatePatient: boolean;
  timezone: string;
  openCreate: FormInitial | null;
  openAppointmentId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const toast = useToast();
  const [form, setForm] = useState<FormInitial | null>(openCreate);
  const [detailsId, setDetailsId] = useState<string | null>(openAppointmentId);
  const [nowMin, setNowMin] = useState<{ date: string; minutes: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; startX: number; startY: number; moved: boolean; deltaMin: number; colKey: string } | null>(null);
  const [pendingMove, setPendingMove] = useState<{ appt: Appt; date: string; professionalId: string; start: number; end: number; conflicts?: { kind: string; description: string }[]; overbookAllowed?: boolean } | null>(null);
  const [confirmOverbook, setConfirmOverbook] = useState(false);
  const [confirmOutside, setConfirmOutside] = useState(false);
  const [overbookReason, setOverbookReason] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const columnRefs = useRef(new Map<string, HTMLDivElement>());
  const slot = data.slotMinutes;

  // Hora atual só no cliente (evita divergência de hidratação).
  useEffect(() => {
    const tick = () => setNowMin(instantToZoned(new Date(), timezone));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [timezone]);

  const navigate = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) params.delete(k);
        else params.set(k, v);
      }
      params.delete("nova");
      params.delete("consulta");
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, search],
  );

  const columns: Column[] = useMemo(() => {
    if (mode === "dia") {
      if (professionalFilter === "all") {
        return professionals.map((p) => ({ key: `${date}|${p.id}`, date, professionalId: p.id, label: p.name }));
      }
      const p = professionals.find((x) => x.id === professionalFilter);
      return [{ key: `${date}|${professionalFilter}`, date, professionalId: professionalFilter, label: p?.name ?? "Profissional", sublabel: formatDateBR(date) }];
    }
    const monday = startOfWeekMonday(date);
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const visible = days.filter((d) => (data.businessHours.days[weekdayOf(d)]?.length ?? 0) > 0 || data.appointments.some((a) => a.date === d));
    return visible.map((d) => ({
      key: `${d}|${professionalFilter === "all" ? "all" : professionalFilter}`,
      date: d,
      professionalId: professionalFilter === "all" ? null : professionalFilter,
      label: `${weekdayNamePT(d, true)} ${d.slice(8, 10)}/${d.slice(5, 7)}`,
    }));
  }, [mode, date, professionalFilter, professionals, data]);

  const [dayStart, dayEnd] = useMemo(() => {
    let s = 24 * 60;
    let e = 0;
    for (const c of columns) {
      for (const p of data.businessHours.days[weekdayOf(c.date)] ?? []) {
        s = Math.min(s, p.start);
        e = Math.max(e, p.end);
      }
    }
    for (const a of data.appointments) {
      s = Math.min(s, a.startMinute);
      e = Math.max(e, a.endMinute);
    }
    if (s >= e) [s, e] = [7 * 60, 19 * 60];
    return [Math.max(0, Math.floor((s - 60) / 60) * 60), Math.min(1440, Math.ceil((e + 60) / 60) * 60)];
  }, [columns, data]);

  const apptsFor = (c: Column) => data.appointments.filter((a) => a.date === c.date && (c.professionalId === null || a.professionalId === c.professionalId));
  const blocksFor = (c: Column) => data.blocks.filter((b) => b.date === c.date && (b.professionalId === null || c.professionalId === null || b.professionalId === c.professionalId));
  const height = (dayEnd - dayStart) * PX_PER_MIN;

  const openCreateAt = (c: Column, minute: number) => {
    if (!canEdit) return;
    const start = Math.max(dayStart, Math.min(snapToSlot(minute - slot / 2, slot), 1440 - slot));
    setForm({
      mode: "create",
      patient: null,
      professionalId: c.professionalId ?? (professionalFilter !== "all" ? professionalFilter : (professionals[0]?.id ?? "")),
      date: c.date,
      startMinute: start,
      endMinute: Math.min(1440, start + 30),
    });
  };

  const commitMove = async (input: { appt: Appt; date: string; professionalId: string; start: number; end: number }, extra?: { confirmOverbook: boolean; confirmOutsideHours: boolean; overbookReason: string | null }) => {
    setMoveError(null);
    const res = await moveAppointmentAction({
      appointmentId: input.appt.id,
      expectedVersion: input.appt.version,
      professionalId: input.professionalId,
      date: input.date,
      startMinute: input.start,
      endMinute: input.end,
      confirmOverbook: extra?.confirmOverbook ?? false,
      confirmOutsideHours: extra?.confirmOutsideHours ?? false,
      overbookReason: extra?.overbookReason ?? null,
    });
    if (res.ok) {
      setPendingMove(null);
      toast.push("success", `Horário corrigido para ${formatDateBR(input.date)} ${minutesToHHMM(input.start)}–${minutesToHHMM(input.end)}`);
      router.refresh();
      return;
    }
    if (res.code === "conflict" && res.details && typeof res.details === "object" && "conflicts" in res.details) {
      const d = res.details as { conflicts: { kind: string; description: string }[]; overbookAllowed?: boolean };
      setConfirmOverbook(false);
      setConfirmOutside(false);
      setOverbookReason("");
      setPendingMove({ ...input, conflicts: d.conflicts, overbookAllowed: d.overbookAllowed });
      return;
    }
    toast.push("error", res.error);
    router.refresh();
  };

  const onPointerDown = (e: React.PointerEvent, a: Appt, dragMode: "move" | "resize", colKey: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const draggable = canEdit && (a.status === "scheduled" || a.status === "confirmed");
    if (!draggable) {
      if (dragMode === "move") setDetailsId(a.id);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: a.id, mode: dragMode, startX: e.clientX, startY: e.clientY, moved: false, deltaMin: 0, colKey });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const dx = e.clientX - drag.startX;
    const moved = drag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 4;
    let colKey = drag.colKey;
    if (drag.mode === "move") {
      for (const [k, el] of columnRefs.current) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right) colKey = k;
      }
    }
    setDrag({ ...drag, moved, deltaMin: Math.round(dy / PX_PER_MIN / slot) * slot, colKey });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const a = data.appointments.find((x) => x.id === drag.id);
    setDrag(null);
    if (!a) return;
    if (!drag.moved) {
      setDetailsId(a.id);
      return;
    }
    const col = columns.find((c) => c.key === drag.colKey);
    const date = col?.date ?? a.date;
    const professionalId = col?.professionalId ?? a.professionalId;
    let start = a.startMinute;
    let end = a.endMinute;
    if (drag.mode === "move") {
      start = Math.max(0, Math.min(1440 - (a.endMinute - a.startMinute), a.startMinute + drag.deltaMin));
      end = start + (a.endMinute - a.startMinute);
    } else {
      end = Math.max(a.startMinute + slot, Math.min(1440, a.endMinute + drag.deltaMin));
    }
    if (start === a.startMinute && end === a.endMinute && date === a.date && professionalId === a.professionalId) return;
    void commitMove({ appt: a, date, professionalId, start, end });
  };

  const title =
    mode === "dia"
      ? `${weekdayNamePT(date).charAt(0).toUpperCase()}${weekdayNamePT(date).slice(1)}, ${formatDateBR(date)}`
      : `Semana de ${formatDateBR(startOfWeekMonday(date))} a ${formatDateBR(addDays(startOfWeekMonday(date), 6))}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => navigate({ data: today })}>
            Hoje
          </Button>
          <div className="flex">
            <button type="button" aria-label={mode === "dia" ? "Dia anterior" : "Semana anterior"} className="inline-flex size-10 items-center justify-center rounded-md hover:bg-surface-2 cursor-pointer" onClick={() => navigate({ data: addDays(date, mode === "dia" ? -1 : -7) })}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label={mode === "dia" ? "Próximo dia" : "Próxima semana"} className="inline-flex size-10 items-center justify-center rounded-md hover:bg-surface-2 cursor-pointer" onClick={() => navigate({ data: addDays(date, mode === "dia" ? 1 : 7) })}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <label htmlFor="ag-date" className="sr-only">
            Ir para a data
          </label>
          <input id="ag-date" type="date" value={date} onChange={(e) => e.target.value && navigate({ data: e.target.value })} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
          <h2 className="ml-1 text-sm font-semibold" aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Modo de visualização">
            {(["dia", "semana"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => navigate({ modo: m })}
                className={cn("min-h-9 rounded-sm px-3 text-sm capitalize cursor-pointer", mode === m ? "bg-surface-2 font-medium" : "text-muted hover:text-fg")}
              >
                {m}
              </button>
            ))}
          </div>
          <label htmlFor="ag-prof" className="sr-only">
            Profissional
          </label>
          <select id="ag-prof" value={professionalFilter} onChange={(e) => navigate({ profissional: e.target.value })} className="h-10 rounded-md border border-border-strong px-2 text-sm">
            <option value="all">{mode === "dia" ? "Todos (lado a lado)" : "Todos os profissionais"}</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {canEdit ? (
            <Button
              variant="primary"
              onClick={() =>
                setForm({
                  mode: "create",
                  patient: null,
                  professionalId: professionalFilter !== "all" ? professionalFilter : (professionals[0]?.id ?? ""),
                  date,
                  startMinute: 9 * 60,
                  endMinute: 9 * 60 + 30,
                })
              }
            >
              Nova consulta
            </Button>
          ) : null}
        </div>
      </div>

      {professionals.length === 0 ? <Notice tone="warning">Cadastre ao menos um profissional ativo em Cadastros › Profissionais.</Notice> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        <div className="max-h-[calc(100dvh-14rem)] overflow-auto" data-lenis-prevent>
          <div className="flex min-w-max">
            <div className="sticky left-0 z-20 w-14 shrink-0 border-r border-border bg-white">
              <div className="sticky top-0 z-10 h-12 border-b border-border bg-white" />
              <div className="relative" style={{ height }}>
                {Array.from({ length: (dayEnd - dayStart) / 60 }, (_, i) => (
                  <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-subtle tabular" style={{ top: i * 60 * PX_PER_MIN }}>
                    {i === 0 ? "" : minutesToHHMM(dayStart + i * 60)}
                  </span>
                ))}
              </div>
            </div>
            {columns.map((c) => {
              const list = apptsFor(c);
              const laneMap = lanes(list.filter((a) => OCCUPYING_STATUSES.includes(a.status)));
              const hours = data.businessHours.days[weekdayOf(c.date)] ?? [];
              const isToday = c.date === today;
              return (
                <div key={c.key} className={cn("min-w-[180px] flex-1 border-r border-border last:border-r-0", columns.length === 1 && "min-w-[320px]")}>
                  <div className={cn("sticky top-0 z-10 flex h-12 flex-col justify-center border-b border-border bg-white px-2 text-center", isToday && "bg-accent-soft")}>
                    <span className={cn("text-sm font-medium capitalize", isToday && "text-accent-strong")}>{c.label}</span>
                    {c.sublabel ? <span className="text-[11px] text-subtle">{c.sublabel}</span> : null}
                  </div>
                  <div
                    ref={(el) => {
                      if (el) columnRefs.current.set(c.key, el);
                      else columnRefs.current.delete(c.key);
                    }}
                    className={cn("relative", canEdit && "cursor-cell")}
                    style={{
                      height,
                      backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${slot * PX_PER_MIN}px)`,
                      backgroundColor: "var(--surface-2)",
                    }}
                    onClick={(e) => {
                      if (e.target !== e.currentTarget) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      openCreateAt(c, dayStart + (e.clientY - r.top) / PX_PER_MIN);
                    }}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    role="presentation"
                  >
                    {/* Expediente em branco; fora dele permanece sombreado. */}
                    {hours.map((p, i) => (
                      <div
                        key={i}
                        className="pointer-events-none absolute inset-x-0 bg-white"
                        style={{
                          top: (Math.max(p.start, dayStart) - dayStart) * PX_PER_MIN,
                          height: (Math.min(p.end, dayEnd) - Math.max(p.start, dayStart)) * PX_PER_MIN,
                          backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${slot * PX_PER_MIN}px)`,
                        }}
                      />
                    ))}
                    {Array.from({ length: (dayEnd - dayStart) / 60 }, (_, i) => (
                      <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-border-strong/70" style={{ top: i * 60 * PX_PER_MIN }} />
                    ))}
                    {blocksFor(c).map((b, i) => (
                      <div
                        key={`${b.id}-${i}`}
                        className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-sm border border-dashed border-zinc-300 bg-zinc-100/90 px-1.5 py-0.5 text-[11px] text-muted"
                        style={{ top: (b.startMinute - dayStart) * PX_PER_MIN, height: (b.endMinute - b.startMinute) * PX_PER_MIN }}
                      >
                        Bloqueado: {b.reason}
                      </div>
                    ))}
                    {isToday && nowMin && nowMin.date === c.date && nowMin.minutes >= dayStart && nowMin.minutes <= dayEnd ? (
                      <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: (nowMin.minutes - dayStart) * PX_PER_MIN }} aria-hidden="true">
                        <span className="absolute -left-1 -top-1.5 size-2.5 rounded-full bg-danger" />
                      </div>
                    ) : null}
                    {list.map((a) => {
                      const occupying = OCCUPYING_STATUSES.includes(a.status);
                      const lane = laneMap.get(a.id) ?? { lane: 0, lanes: 1 };
                      const isDragging = drag?.id === a.id && drag.moved;
                      const start = isDragging && drag.mode === "move" ? a.startMinute + drag.deltaMin : a.startMinute;
                      const end = isDragging ? (drag.mode === "move" ? a.endMinute + drag.deltaMin : Math.max(a.startMinute + slot, a.endMinute + drag.deltaMin)) : a.endMinute;
                      const tone = APPOINTMENT_TONE[a.status];
                      const width = occupying ? 100 / lane.lanes : 100;
                      return (
                        <div
                          key={a.id}
                          className={cn(
                            "group absolute overflow-hidden rounded-sm border border-border border-l-4 px-1.5 py-1 text-left text-xs shadow-sm transition-shadow hover:shadow-md",
                            TONE_CARD[tone],
                            !occupying && "opacity-60",
                            isDragging && "z-30 opacity-90 shadow-lg ring-2 ring-accent",
                          )}
                          style={{
                            top: (start - dayStart) * PX_PER_MIN + 1,
                            height: Math.max(18, (end - start) * PX_PER_MIN - 2),
                            left: `calc(${lane.lane * width}% + 2px)`,
                            width: `calc(${width}% - 4px)`,
                            touchAction: "none",
                          }}
                        >
                          <button
                            type="button"
                            className="block h-full w-full cursor-pointer text-left"
                            onPointerDown={(e) => onPointerDown(e, a, "move", c.key)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDetailsId(a.id);
                              }
                            }}
                            aria-label={`${a.patientName}, ${minutesToHHMM(a.startMinute)} a ${minutesToHHMM(a.endMinute)}, ${APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}${a.professionalName ? `, ${a.professionalName}` : ""}`}
                          >
                            {end - start <= 30 ? (
                              <span className="block truncate">
                                <span className="font-medium tabular">{minutesToHHMM(start)}</span> <span className="font-medium text-fg">{a.patientName}</span>
                                <span className="text-[11px] text-muted"> · {APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}</span>
                              </span>
                            ) : (
                              <>
                                <span className="block truncate font-medium tabular">
                                  {minutesToHHMM(start)}–{minutesToHHMM(end)}
                                  {isDragging ? ` · ${formatDuration(end - start)}` : ""}
                                </span>
                                <span className="block truncate font-medium text-fg">{a.patientName}</span>
                                <span className="block truncate text-[11px] text-muted">
                                  {APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}
                                  {a.isOverbook ? " · encaixe" : ""}
                                  {a.isFirstVisit ? " · 1ª consulta" : ""}
                                  {professionalFilter === "all" && mode === "semana" ? ` · ${a.professionalName}` : ""}
                                </span>
                              </>
                            )}
                            {a.planned && end - start >= 45 ? <span className="mt-0.5 block truncate text-[11px] text-muted">{a.planned}</span> : null}
                          </button>
                          {canEdit && (a.status === "scheduled" || a.status === "confirmed") ? (
                            <span
                              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize bg-black/5 opacity-0 group-hover:opacity-100"
                              onPointerDown={(e) => onPointerDown(e, a, "resize", c.key)}
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-xs text-subtle">
        Grade de {slot} minutos. Clique em um horário livre para agendar; arraste a consulta para mover ou a borda inferior para mudar a duração. Pelo teclado, abra a consulta e use “Editar”.
      </p>

      {form ? (
        <AppointmentForm
          initial={form}
          onClose={() => {
            setForm(null);
            router.refresh();
          }}
          professionals={professionals}
          slotMinutes={slot}
          canOverbook={canOverbook}
          canClinical={canClinical}
          canCreatePatient={canCreatePatient}
        />
      ) : null}
      {detailsId ? (
        <AppointmentDetails
          appointmentId={detailsId}
          onClose={() => {
            setDetailsId(null);
            router.refresh();
          }}
          onEdit={(initial) => {
            setDetailsId(null);
            setForm(initial);
          }}
          professionals={professionals}
          slotMinutes={slot}
          canEdit={canEdit}
          canClinical={canClinical}
          timezone={timezone}
        />
      ) : null}
      {pendingMove?.conflicts ? (
        <Dialog
          open
          onClose={() => setPendingMove(null)}
          title="Conflito ao mover"
          footer={
            <>
              <Button variant="ghost" onClick={() => setPendingMove(null)}>
                Desfazer
              </Button>
              <Button
                variant="primary"
                disabled={
                  (pendingMove.conflicts.some((c) => c.kind !== "outside_hours") && (!confirmOverbook || !pendingMove.overbookAllowed || !overbookReason.trim())) ||
                  (pendingMove.conflicts.some((c) => c.kind === "outside_hours") && !confirmOutside)
                }
                onClick={() => void commitMove(pendingMove, { confirmOverbook, confirmOutsideHours: confirmOutside, overbookReason: overbookReason || null })}
              >
                Confirmar mesmo assim
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            {moveError ? <Notice tone="danger">{moveError}</Notice> : null}
            <ul className="list-inside list-disc">
              {pendingMove.conflicts.map((c, i) => (
                <li key={i}>{c.description}</li>
              ))}
            </ul>
            {pendingMove.conflicts.some((c) => c.kind !== "outside_hours") ? (
              pendingMove.overbookAllowed ? (
                <>
                  <Checkbox label="Confirmo o encaixe sobreposto" checked={confirmOverbook} onChange={(e) => setConfirmOverbook(e.target.checked)} />
                  <input aria-label="Motivo do encaixe" placeholder="Motivo do encaixe" value={overbookReason} onChange={(e) => setOverbookReason(e.target.value)} className="h-10 w-full rounded-md border border-border-strong px-3" />
                </>
              ) : (
                <p className="text-muted">Seu papel não permite encaixe. A consulta permanece no horário original.</p>
              )
            ) : null}
            {pendingMove.conflicts.some((c) => c.kind === "outside_hours") ? <Checkbox label="Confirmo fora do expediente" checked={confirmOutside} onChange={(e) => setConfirmOutside(e.target.checked)} /> : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
