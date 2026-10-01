// Hello World
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createAppointmentAction, loadPatientTreatmentItemsAction, moveAppointmentAction, updateAppointmentDetailsAction } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDuration, REMINDER_PREFERENCE_LABEL, REMINDER_PREFERENCES, whatsappLink, type ReminderPreference } from "@/domain/appointments";
import { minutesToHHMM } from "@/domain/dates";
import { CLINICAL_LABEL } from "@/lib/status";
import { PatientPicker, type PickedPatient } from "./patient-picker";

export interface FormInitial {
  mode: "create" | "edit";
  appointmentId?: string;
  version?: number;
  patient: PickedPatient | null;
  professionalId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  isFirstVisit?: boolean;
  planned?: string | null;
  notes?: string | null;
  reminderPreference?: ReminderPreference;
  treatmentItemIds?: string[];
  schedulingTaskId?: string | null;
}

interface TreatmentOption {
  id: string;
  procedureName: string;
  locationLabel: string;
  clinicalStatus: string;
  budgetNumber: number;
}

interface Conflict {
  kind: string;
  description: string;
}

export function AppointmentForm({
  initial,
  onClose,
  professionals,
  slotMinutes,
  canOverbook,
  canClinical,
  canCreatePatient,
}: {
  initial: FormInitial;
  onClose: () => void;
  professionals: { id: string; name: string }[];
  slotMinutes: number;
  canOverbook: boolean;
  canClinical: boolean;
  canCreatePatient: boolean;
}) {
  const [patient, setPatient] = useState<PickedPatient | null>(initial.patient);
  const [professionalId, setProfessionalId] = useState(initial.professionalId);
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState(initial.startMinute);
  const [end, setEnd] = useState(initial.endMinute);
  const [isFirstVisit, setIsFirstVisit] = useState(initial.isFirstVisit ?? false);
  const [status, setStatus] = useState<"scheduled" | "confirmed">("scheduled");
  const [planned, setPlanned] = useState(initial.planned ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [reminder, setReminder] = useState<ReminderPreference>(initial.reminderPreference ?? "none");
  const [selectedItems, setSelectedItems] = useState<string[]>(initial.treatmentItemIds ?? []);
  const [loadedItems, setLoadedItems] = useState<{ patientId: string | null; items: TreatmentOption[] }>({ patientId: null, items: [] });
  const [itemFilter, setItemFilter] = useState<"pending" | "not_started" | "in_progress" | "completed" | "all">("pending");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [overbookAllowed, setOverbookAllowed] = useState(canOverbook);
  const [confirmOverbook, setConfirmOverbook] = useState(false);
  const [overbookReason, setOverbookReason] = useState("");
  const [confirmOutside, setConfirmOutside] = useState(false);
  const [dirty, setDirty] = useState(false);
  const create = useAction(createAppointmentAction, { success: (d) => `Consulta agendada (${formatDuration(d.durationMinutes)})${d.isOverbook ? " como encaixe" : ""}` });
  const move = useAction(moveAppointmentAction, { success: "Horário atualizado" });
  const update = useAction(updateAppointmentDetailsAction, { success: "Consulta atualizada" });
  const pending = create.pending || move.pending || update.pending;
  const error = create.error ?? move.error ?? update.error;

  const patientId = patient?.id ?? null;
  useEffect(() => {
    if (!patientId) return;
    let alive = true;
    void loadPatientTreatmentItemsAction(patientId).then((res) => {
      if (alive && res.ok)
        setLoadedItems({
          patientId,
          items: res.data.map((i) => ({ id: i.id, procedureName: i.procedureName, locationLabel: i.locationLabel, clinicalStatus: i.clinicalStatus, budgetNumber: i.budgetNumber })),
        });
    });
    return () => {
      alive = false;
    };
  }, [patientId]);
  // Itens valem apenas para o paciente selecionado (estado derivado).
  const items = loadedItems.patientId === patientId ? loadedItems.items : [];

  const times = useMemo(() => Array.from({ length: Math.floor(1440 / slotMinutes) + 1 }, (_, i) => i * slotMinutes), [slotMinutes]);
  const visibleItems = items.filter((i) =>
    itemFilter === "all" ? i.clinicalStatus !== "cancelled" : itemFilter === "pending" ? i.clinicalStatus === "not_started" || i.clinicalStatus === "in_progress" : i.clinicalStatus === itemFilter,
  );
  const duration = end - start;
  const wa = whatsappLink(patient?.phone);
  const touched = () => setDirty(true);

  const handleConflict = (res: { ok: false; code?: string; details?: unknown }) => {
    if (res.code === "conflict" && res.details && typeof res.details === "object" && "conflicts" in res.details) {
      const d = res.details as { conflicts: Conflict[]; overbookAllowed?: boolean };
      setConflicts(d.conflicts);
      setOverbookAllowed(Boolean(d.overbookAllowed));
    }
  };

  const submit = async () => {
    if (!patient) return;
    const timeFields = {
      professionalId,
      date,
      startMinute: start,
      endMinute: end,
      confirmOverbook,
      overbookReason: overbookReason || null,
      confirmOutsideHours: confirmOutside,
    };
    if (initial.mode === "create") {
      const res = await create.run({
        patientId: patient.id,
        ...timeFields,
        status,
        isFirstVisit,
        planned: planned || null,
        notes: notes || null,
        reminderPreference: reminder,
        treatmentItemIds: selectedItems,
        schedulingTaskId: initial.schedulingTaskId ?? null,
      });
      if (res.ok) onClose();
      else handleConflict(res);
      return;
    }
    let version = initial.version!;
    const timeChanged = date !== initial.date || start !== initial.startMinute || end !== initial.endMinute || professionalId !== initial.professionalId;
    if (timeChanged) {
      const res = await move.run({ appointmentId: initial.appointmentId!, expectedVersion: version, ...timeFields });
      if (!res.ok) {
        handleConflict(res);
        return;
      }
      version += 1;
    }
    const res = await update.run({
      appointmentId: initial.appointmentId!,
      expectedVersion: version,
      isFirstVisit,
      planned: planned || null,
      notes: notes || null,
      reminderPreference: reminder,
      treatmentItemIds: selectedItems,
    });
    if (res.ok) onClose();
  };

  return (
    <Dialog
      open
      onClose={() => {
        if (dirty && !window.confirm("Descartar as alterações desta consulta?")) return;
        onClose();
      }}
      title={initial.mode === "create" ? "Nova consulta" : "Editar consulta"}
      description={initial.mode === "edit" ? "Mudanças de horário ficam registradas como correção. Para consulta já comunicada ao paciente, use Remarcar." : undefined}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-sm text-muted">
            Duração: <strong className="tabular text-fg">{duration > 0 ? formatDuration(duration) : "inválida"}</strong>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} disabled={!patient || duration <= 0} onClick={() => void submit()}>
            {initial.mode === "create" ? "Agendar" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && !conflicts ? <Notice tone="danger">{error}</Notice> : null}
        {conflicts ? (
          <Notice tone="warning" title="Conflito de agenda">
            <ul className="list-inside list-disc">
              {conflicts.map((c, i) => (
                <li key={i}>{c.description}</li>
              ))}
            </ul>
            {conflicts.some((c) => c.kind !== "outside_hours") ? (
              overbookAllowed ? (
                <div className="mt-2 space-y-2">
                  <Checkbox label="Confirmo o encaixe sobreposto" checked={confirmOverbook} onChange={(e) => setConfirmOverbook(e.target.checked)} />
                  <input
                    aria-label="Motivo do encaixe"
                    placeholder="Motivo do encaixe"
                    value={overbookReason}
                    onChange={(e) => setOverbookReason(e.target.value)}
                    className="h-10 w-full rounded-md border border-border-strong bg-white px-3 text-sm text-fg"
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs">Seu papel não permite encaixe sobreposto. Escolha outro horário.</p>
              )
            ) : null}
            {conflicts.some((c) => c.kind === "outside_hours") ? <Checkbox className="mt-1" label="Confirmo agendar fora do expediente" checked={confirmOutside} onChange={(e) => setConfirmOutside(e.target.checked)} /> : null}
          </Notice>
        ) : null}

        <div>
          <p className="mb-1.5 text-sm font-medium">Paciente</p>
          {initial.mode === "edit" ? (
            <p className="text-sm">{patient?.name}</p>
          ) : (
            <PatientPicker value={patient} onChange={(p) => (setPatient(p), setSelectedItems([]), touched())} canCreate={canCreatePatient} />
          )}
          {patient ? (
            <p className="mt-2 flex flex-wrap gap-3 text-sm">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-accent hover:underline cursor-pointer">
                  Abrir WhatsApp (não envia nada sozinho)
                </a>
              ) : null}
              <Link href={`/pacientes/${patient.id}`} className="inline-flex min-h-10 items-center text-accent hover:underline cursor-pointer" target="_blank">
                Abrir ficha
              </Link>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Profissional" htmlFor="ap-prof" className="sm:col-span-2 lg:col-span-1">
            <Select id="ap-prof" value={professionalId} onChange={(e) => (setProfessionalId(e.target.value), setConflicts(null), touched())}>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data" htmlFor="ap-date">
            <Input id="ap-date" type="date" value={date} onChange={(e) => (setDate(e.target.value), setConflicts(null), touched())} />
          </Field>
          <Field label="Início" htmlFor="ap-start">
            <Select
              id="ap-start"
              value={start}
              onChange={(e) => {
                const s = Number(e.target.value);
                setEnd(s + Math.max(slotMinutes, end - start));
                setStart(s);
                setConflicts(null);
                touched();
              }}
            >
              {times.slice(0, -1).map((m) => (
                <option key={m} value={m}>
                  {minutesToHHMM(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Fim" htmlFor="ap-end" error={duration <= 0 ? "Fim deve ser após o início" : undefined}>
            <Select id="ap-end" value={end} onChange={(e) => (setEnd(Number(e.target.value)), setConflicts(null), touched())}>
              {times
                .filter((m) => m > start)
                .map((m) => (
                  <option key={m} value={m}>
                    {minutesToHHMM(m)} ({formatDuration(m - start)})
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Checkbox label="Primeira consulta" checked={isFirstVisit} onChange={(e) => (setIsFirstVisit(e.target.checked), touched())} />
          {initial.mode === "create" ? (
            <Field label="Situação inicial" htmlFor="ap-status" hint="Confirmado só com confirmação explícita do paciente">
              <Select id="ap-status" value={status} onChange={(e) => setStatus(e.target.value as "scheduled" | "confirmed")}>
                <option value="scheduled">Agendado</option>
                <option value="confirmed">Confirmado</option>
              </Select>
            </Field>
          ) : (
            <div />
          )}
          <Field label="Lembrete" htmlFor="ap-rem" hint="Envio automático só com integração configurada">
            <Select id="ap-rem" value={reminder} onChange={(e) => (setReminder(e.target.value as ReminderPreference), touched())}>
              {REMINDER_PREFERENCES.map((r) => (
                <option key={r} value={r}>
                  {REMINDER_PREFERENCE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {patient ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Procedimentos programados</legend>
            <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Filtrar procedimentos">
              {(["pending", "not_started", "in_progress", "completed", "all"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={itemFilter === f}
                  onClick={() => setItemFilter(f)}
                  className={`min-h-9 rounded-md px-2.5 text-xs cursor-pointer ${itemFilter === f ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-surface-2"}`}
                >
                  {f === "pending" ? "Pendentes" : f === "all" ? "Todos" : CLINICAL_LABEL[f]}
                </button>
              ))}
            </div>
            {visibleItems.length === 0 ? (
              <p className="text-sm text-muted">Nenhum procedimento aprovado neste filtro.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto" data-lenis-prevent>
                {visibleItems.map((i) => (
                  <li key={i.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-surface">
                      <input
                        type="checkbox"
                        className="size-4 accent-accent"
                        checked={selectedItems.includes(i.id)}
                        onChange={(e) => (setSelectedItems((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id))), touched())}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {i.procedureName} · {i.locationLabel}
                      </span>
                      <span className="text-xs text-subtle">
                        orç. {i.budgetNumber} · {CLINICAL_LABEL[i.clinicalStatus]}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-subtle">Selecionar para a consulta não marca a execução; o desfecho é registrado no atendimento.</p>
          </fieldset>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {canClinical ? (
            <Field label="Previsto" htmlFor="ap-planned">
              <Textarea id="ap-planned" className="min-h-16" value={planned} onChange={(e) => (setPlanned(e.target.value), touched())} />
            </Field>
          ) : null}
          <Field label="Observações" htmlFor="ap-notes" hint="Administrativas">
            <Textarea id="ap-notes" className="min-h-16" value={notes} onChange={(e) => (setNotes(e.target.value), touched())} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
