// Hello World
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { changeAppointmentStatusAction, loadAppointmentAction, recordOutcomeAction, rescheduleAppointmentAction } from "@/actions/schedule";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { DescList, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import {
  allowedTransitions,
  APPOINTMENT_STATUS_LABEL,
  formatDuration,
  REMINDER_PREFERENCE_LABEL,
  requiresReason,
  whatsappLink,
  type AppointmentStatus,
  type ReminderPreference,
} from "@/domain/appointments";
import { formatDateBR, minutesToHHMM } from "@/domain/dates";
import { formatPhone } from "@/domain/text";
import { appointmentBadge, CLINICAL_LABEL } from "@/lib/status";
import type { FormInitial } from "./appointment-form";

type Loaded = Extract<Awaited<ReturnType<typeof loadAppointmentAction>>, { ok: true }>["data"];

const HISTORY_KIND: Record<string, string> = { created: "Criação", status: "Situação", time_change: "Correção de horário", reschedule: "Remarcação", edit: "Edição" };

export function AppointmentDetails({
  appointmentId,
  onClose,
  onEdit,
  professionals,
  slotMinutes,
  canEdit,
  canClinical,
  timezone,
}: {
  appointmentId: string;
  onClose: () => void;
  onEdit: (initial: FormInitial) => void;
  professionals: { id: string; name: string }[];
  slotMinutes: number;
  canEdit: boolean;
  canClinical: boolean;
  timezone: string;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"info" | "reason" | "reschedule" | "outcome">("info");
  const [target, setTarget] = useState<AppointmentStatus | null>(null);
  const [reason, setReason] = useState("");
  const [rs, setRs] = useState({ date: "", start: 0, end: 0, professionalId: "", requestedBy: "patient" as "patient" | "clinic", confirmOverbook: false, overbookReason: "", confirmOutsideHours: false });
  const [outcome, setOutcome] = useState<{ performed: string; finish: boolean; procedures: Record<string, { outcome: "performed" | "partial" | "not_performed"; resultingStatus: "not_started" | "in_progress" | "completed"; sessionLabel: string; note: string }> }>({ performed: "", finish: true, procedures: {} });
  const status = useAction(changeAppointmentStatusAction, { success: "Situação atualizada" });
  const reschedule = useAction(rescheduleAppointmentAction, { success: "Consulta remarcada; a anterior foi preservada e vinculada" });
  const record = useAction(recordOutcomeAction, { success: "Atendimento registrado" });

  const apply = useCallback((res: Awaited<ReturnType<typeof loadAppointmentAction>>) => {
    if (res.ok) {
      setData(res.data);
      const a = res.data.appointment;
      setRs({ date: a.localDate, start: a.startMinute, end: a.endMinute, professionalId: a.professionalId, requestedBy: "patient", confirmOverbook: false, overbookReason: "", confirmOutsideHours: false });
      setOutcome({
        performed: a.performed ?? "",
        finish: true,
        procedures: Object.fromEntries(
          a.procedures.map((p) => [p.treatmentItemId, { outcome: "performed" as const, resultingStatus: (p.clinicalStatus === "completed" ? "completed" : "in_progress") as "in_progress" | "completed", sessionLabel: "", note: "" }]),
        ),
      });
    } else setLoadError(res.error);
  }, []);
  // Recarrega após ações (chamado por manipuladores de evento).
  const load = async () => apply(await loadAppointmentAction(appointmentId));
  useEffect(() => {
    let alive = true;
    void loadAppointmentAction(appointmentId).then((res) => {
      if (alive) apply(res);
    });
    return () => {
      alive = false;
    };
  }, [appointmentId, apply]);

  const a = data?.appointment;
  const times = Array.from({ length: Math.floor(1440 / slotMinutes) + 1 }, (_, i) => i * slotMinutes);

  const applyStatus = async (to: AppointmentStatus, why?: string) => {
    if (!a) return;
    const res = await status.run({ appointmentId: a.id, expectedVersion: a.version, to, reason: why ?? null });
    if (res.ok) {
      setView("info");
      setReason("");
      await load();
    }
  };

  return (
    <Dialog open onClose={onClose} title={a ? `${a.patientName}` : "Consulta"} description={a ? `${formatDateBR(a.localDate)} · ${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)} · ${a.professionalName}` : undefined} size="lg">
      {loadError ? <Notice tone="danger">{loadError}</Notice> : null}
      {!a ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : view === "info" ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={appointmentBadge(a.status).tone}>{appointmentBadge(a.status).label}</Badge>
            {a.isFirstVisit ? <Badge tone="info">Primeira consulta</Badge> : null}
            {a.isOverbook ? <Badge tone="warning">Encaixe: {a.overbookReason}</Badge> : null}
            <span className="text-sm text-muted">{formatDuration(a.endMinute - a.startMinute)}</span>
          </div>
          <DescList
            items={[
              { label: "Telefone", value: a.patientPhone ? formatPhone(a.patientPhone) : "—" },
              { label: "Lembrete", value: REMINDER_PREFERENCE_LABEL[a.reminderPreference as ReminderPreference] },
              ...(canClinical ? [{ label: "Previsto", value: a.planned ?? "—" }, { label: "Realizado", value: a.performed ?? "—" }] : []),
              { label: "Observações", value: a.notes ?? "—" },
              { label: "Criado por", value: `${a.createdByName ?? "—"} em ${new Date(a.createdAt).toLocaleString("pt-BR", { timeZone: timezone })}` },
              ...(a.cancelReason ? [{ label: "Motivo", value: a.cancelReason }] : []),
              ...(a.rescheduledTo ? [{ label: "Remarcada para", value: `${formatDateBR(a.rescheduledTo.localDate)} ${minutesToHHMM(a.rescheduledTo.startMinute)}` }] : []),
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <Link href={`/pacientes/${a.patientId}`} className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-sm hover:bg-surface-2 cursor-pointer">
              Abrir ficha
            </Link>
            {whatsappLink(a.patientPhone) ? (
              <a href={whatsappLink(a.patientPhone)!} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-sm hover:bg-surface-2 cursor-pointer">
                WhatsApp
              </a>
            ) : null}
          </div>
          <section>
            <h3 className="mb-2 text-sm font-semibold">Procedimentos programados</h3>
            {a.procedures.length === 0 ? (
              <p className="text-sm text-muted">Nenhum procedimento vinculado.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {a.procedures.map((p) => (
                  <li key={p.treatmentItemId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                    <span>
                      {p.procedureName} · {p.locationLabel}
                    </span>
                    <span className="flex gap-1">
                      <Badge>{CLINICAL_LABEL[p.clinicalStatus]}</Badge>
                      {p.outcome ? <Badge tone="info">{{ performed: "Realizado", partial: "Parcial", not_performed: "Não realizado" }[p.outcome]}</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {status.error ? <Notice tone="danger">{status.error}</Notice> : null}
          {canEdit ? (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Ações</h3>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions(a.status).map((to) => (
                  <Button
                    key={to}
                    size="sm"
                    variant={to === "confirmed" || to === "arrived" || to === "in_progress" ? "secondary" : "ghost"}
                    loading={status.pending && target === to}
                    onClick={() => {
                      setTarget(to);
                      if (requiresReason(to)) {
                        setReason("");
                        setView("reason");
                      } else void applyStatus(to);
                    }}
                  >
                    {APPOINTMENT_STATUS_LABEL[to]}
                  </Button>
                ))}
                {["scheduled", "confirmed", "no_show", "cancelled_by_patient", "cancelled_by_clinic"].includes(a.status) && !a.rescheduledTo ? (
                  <Button size="sm" onClick={() => setView("reschedule")}>
                    Remarcar
                  </Button>
                ) : null}
                {["scheduled", "confirmed"].includes(a.status) ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      onEdit({
                        mode: "edit",
                        appointmentId: a.id,
                        version: a.version,
                        patient: { id: a.patientId, name: a.patientName, phone: a.patientPhone },
                        professionalId: a.professionalId,
                        date: a.localDate,
                        startMinute: a.startMinute,
                        endMinute: a.endMinute,
                        isFirstVisit: a.isFirstVisit,
                        planned: a.planned,
                        notes: a.notes,
                        reminderPreference: a.reminderPreference as ReminderPreference,
                        treatmentItemIds: a.procedures.map((p) => p.treatmentItemId),
                      })
                    }
                  >
                    Editar
                  </Button>
                ) : null}
                {canClinical && ["arrived", "in_progress", "finished", "confirmed", "scheduled"].includes(a.status) ? (
                  <Button size="sm" variant="primary" onClick={() => setView("outcome")}>
                    Registrar atendimento
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
          <section>
            <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
            <ol className="space-y-1 text-xs text-muted">
              {a.history.map((h) => (
                <li key={h.id}>
                  {new Date(h.changedAt).toLocaleString("pt-BR", { timeZone: timezone })} · {HISTORY_KIND[h.kind] ?? h.kind}
                  {h.toStatus ? `: ${APPOINTMENT_STATUS_LABEL[h.toStatus as AppointmentStatus] ?? h.toStatus}` : ""}
                  {h.reason ? ` — ${h.reason}` : ""} · {h.userName ?? "—"}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : view === "reason" && target ? (
        <div className="space-y-4">
          <p className="text-sm">
            Mudar para <strong>{APPOINTMENT_STATUS_LABEL[target]}</strong>. O motivo e a autoria ficam registrados; lembretes pendentes são cancelados.
          </p>
          {status.error ? <Notice tone="danger">{status.error}</Notice> : null}
          <Field label="Motivo" htmlFor="st-reason" required>
            <Textarea id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setView("info")}>
              Voltar
            </Button>
            <Button variant="primary" loading={status.pending} disabled={!reason.trim()} onClick={() => void applyStatus(target, reason)}>
              Confirmar
            </Button>
          </div>
        </div>
      ) : view === "reschedule" ? (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await reschedule.run({
              appointmentId: a.id,
              reason,
              requestedBy: rs.requestedBy,
              professionalId: rs.professionalId,
              date: rs.date,
              startMinute: rs.start,
              endMinute: rs.end,
              confirmOverbook: rs.confirmOverbook,
              overbookReason: rs.overbookReason || null,
              confirmOutsideHours: rs.confirmOutsideHours,
            });
            if (res.ok) onClose();
          }}
        >
          <p className="text-sm text-muted">A consulta atual fica registrada como desmarcada/remarcada e vinculada à nova. Lembretes pendentes da atual são cancelados.</p>
          {reschedule.error ? <Notice tone="danger">{reschedule.error}</Notice> : null}
          {reschedule.lastFailure?.details ? (
            <div className="space-y-1">
              <Checkbox label="Confirmo o encaixe (exige permissão)" checked={rs.confirmOverbook} onChange={(e) => setRs({ ...rs, confirmOverbook: e.target.checked })} />
              <Checkbox label="Confirmo fora do expediente" checked={rs.confirmOutsideHours} onChange={(e) => setRs({ ...rs, confirmOutsideHours: e.target.checked })} />
              {rs.confirmOverbook ? <Input aria-label="Motivo do encaixe" placeholder="Motivo do encaixe" value={rs.overbookReason} onChange={(e) => setRs({ ...rs, overbookReason: e.target.value })} /> : null}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Pedido de" htmlFor="rs-by">
              <Select id="rs-by" value={rs.requestedBy} onChange={(e) => setRs({ ...rs, requestedBy: e.target.value as "patient" | "clinic" })}>
                <option value="patient">Paciente</option>
                <option value="clinic">Clínica</option>
              </Select>
            </Field>
            <Field label="Profissional" htmlFor="rs-prof">
              <Select id="rs-prof" value={rs.professionalId} onChange={(e) => setRs({ ...rs, professionalId: e.target.value })}>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nova data" htmlFor="rs-date">
              <Input id="rs-date" type="date" value={rs.date} onChange={(e) => setRs({ ...rs, date: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Início" htmlFor="rs-start">
                <Select id="rs-start" value={rs.start} onChange={(e) => setRs({ ...rs, start: Number(e.target.value), end: Number(e.target.value) + (rs.end - rs.start) })}>
                  {times.slice(0, -1).map((m) => (
                    <option key={m} value={m}>
                      {minutesToHHMM(m)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fim" htmlFor="rs-end">
                <Select id="rs-end" value={rs.end} onChange={(e) => setRs({ ...rs, end: Number(e.target.value) })}>
                  {times
                    .filter((m) => m > rs.start)
                    .map((m) => (
                      <option key={m} value={m}>
                        {minutesToHHMM(m)}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
          </div>
          <Field label="Motivo da remarcação" htmlFor="rs-reason" required>
            <Textarea id="rs-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setView("info")}>
              Voltar
            </Button>
            <Button type="submit" variant="primary" loading={reschedule.pending} disabled={!reason.trim()}>
              Remarcar
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await record.run({
              appointmentId: a.id,
              performed: outcome.performed || null,
              finish: outcome.finish,
              procedures: Object.entries(outcome.procedures).map(([treatmentItemId, p]) => ({
                treatmentItemId,
                outcome: p.outcome,
                resultingStatus: p.resultingStatus,
                sessionLabel: p.sessionLabel || null,
                note: p.note || null,
              })),
            });
            if (res.ok) {
              setView("info");
              await load();
            }
          }}
        >
          <p className="text-sm text-muted">Registre o que foi realizado e a situação resultante de cada procedimento. Finalizar a consulta não conclui itens nem altera o financeiro.</p>
          {record.error ? <Notice tone="danger">{record.error}</Notice> : null}
          {a.procedures.map((p) => {
            const v = outcome.procedures[p.treatmentItemId]!;
            const set = (patch: Partial<typeof v>) => setOutcome((o) => ({ ...o, procedures: { ...o.procedures, [p.treatmentItemId]: { ...v, ...patch } } }));
            return (
              <fieldset key={p.treatmentItemId} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
                <legend className="px-1 text-sm font-medium">
                  {p.procedureName} · {p.locationLabel}
                </legend>
                <Field label="Nesta consulta" htmlFor={`oc-${p.treatmentItemId}`}>
                  <Select id={`oc-${p.treatmentItemId}`} value={v.outcome} onChange={(e) => set({ outcome: e.target.value as typeof v.outcome })}>
                    <option value="performed">Realizado</option>
                    <option value="partial">Realizado parcialmente</option>
                    <option value="not_performed">Não realizado</option>
                  </Select>
                </Field>
                <Field label="Situação do procedimento" htmlFor={`rs-${p.treatmentItemId}`}>
                  <Select id={`rs-${p.treatmentItemId}`} value={v.resultingStatus} onChange={(e) => set({ resultingStatus: e.target.value as typeof v.resultingStatus })}>
                    <option value="not_started">Não realizado</option>
                    <option value="in_progress">Em andamento</option>
                    <option value="completed">Concluído</option>
                  </Select>
                </Field>
                <Field label="Sessão" htmlFor={`sl-${p.treatmentItemId}`} hint="Ex.: preparo, prova">
                  <Input id={`sl-${p.treatmentItemId}`} value={v.sessionLabel} onChange={(e) => set({ sessionLabel: e.target.value })} />
                </Field>
                <Field label="Evolução" htmlFor={`nt-${p.treatmentItemId}`} className="sm:col-span-3">
                  <Textarea id={`nt-${p.treatmentItemId}`} className="min-h-14" value={v.note} onChange={(e) => set({ note: e.target.value })} />
                </Field>
              </fieldset>
            );
          })}
          <Field label="Realizado (resumo do atendimento)" htmlFor="oc-performed">
            <Textarea id="oc-performed" value={outcome.performed} onChange={(e) => setOutcome({ ...outcome, performed: e.target.value })} />
          </Field>
          <Checkbox label="Finalizar a consulta" checked={outcome.finish} onChange={(e) => setOutcome({ ...outcome, finish: e.target.checked })} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setView("info")}>
              Voltar
            </Button>
            <Button type="submit" variant="primary" loading={record.pending}>
              Salvar atendimento
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
