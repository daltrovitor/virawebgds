// Hello World
"use client";

import { useState } from "react";
import { createBlockAction, deactivateBlockAction } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR, hhmmToMinutes, minutesToHHMM } from "@/domain/dates";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface Block {
  id: string;
  professionalId: string | null;
  professionalName: string | null;
  kind: string;
  localDate: string | null;
  weekday: number | null;
  startMinute: number;
  endMinute: number;
  startDate: string | null;
  untilDate: string | null;
  reason: string;
}

export function BlocksManager({ blocks, professionals, today }: { blocks: Block[]; professionals: { id: string; name: string }[]; today: string }) {
  const [f, setF] = useState({ professionalId: "", kind: "single" as "single" | "weekly", date: today, weekday: 1, startDate: today, untilDate: "", start: "12:00", end: "13:00", reason: "" });
  const create = useAction(createBlockAction, { success: "Bloqueio criado" });
  const remove = useAction(deactivateBlockAction, { success: "Bloqueio removido" });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.618fr]">
      <Card>
        <CardHeader title="Novo bloqueio" />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await create.run({
                professionalId: f.professionalId || null,
                kind: f.kind,
                date: f.kind === "single" ? f.date : null,
                weekday: f.kind === "weekly" ? f.weekday : null,
                startDate: f.kind === "weekly" ? f.startDate : null,
                untilDate: f.kind === "weekly" && f.untilDate ? f.untilDate : null,
                startMinute: hhmmToMinutes(f.start) ?? 0,
                endMinute: hhmmToMinutes(f.end) ?? 0,
                reason: f.reason,
              });
              if (res.ok) setF({ ...f, reason: "" });
            }}
          >
            {create.error ? <Notice tone="danger">{create.error}</Notice> : null}
            <Field label="Profissional" htmlFor="bl-prof">
              <Select id="bl-prof" value={f.professionalId} onChange={(e) => setF({ ...f, professionalId: e.target.value })}>
                <option value="">Clínica toda</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo" htmlFor="bl-kind">
              <Select id="bl-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "single" | "weekly" })}>
                <option value="single">Único</option>
                <option value="weekly">Semanal recorrente</option>
              </Select>
            </Field>
            {f.kind === "single" ? (
              <Field label="Data" htmlFor="bl-date">
                <Input id="bl-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
              </Field>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Dia da semana" htmlFor="bl-wd">
                  <Select id="bl-wd" value={f.weekday} onChange={(e) => setF({ ...f, weekday: Number(e.target.value) })}>
                    {WEEKDAYS.map((w, i) => (
                      <option key={w} value={i}>
                        {w}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="A partir de" htmlFor="bl-from">
                  <Input id="bl-from" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
                </Field>
                <Field label="Até (opcional)" htmlFor="bl-until">
                  <Input id="bl-until" type="date" value={f.untilDate} onChange={(e) => setF({ ...f, untilDate: e.target.value })} />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início" htmlFor="bl-start">
                <Input id="bl-start" type="time" step={900} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
              </Field>
              <Field label="Fim" htmlFor="bl-end">
                <Input id="bl-end" type="time" step={900} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
              </Field>
            </div>
            <Field label="Motivo" htmlFor="bl-reason" required error={create.fieldErrors.reason}>
              <Input id="bl-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" loading={create.pending}>
              Criar bloqueio
            </Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Bloqueios ativos" />
        {blocks.length === 0 ? (
          <EmptyState title="Nenhum bloqueio" />
        ) : (
          <ul className="divide-y divide-border">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <span>
                  <span className="font-medium">{b.reason}</span>
                  <span className="block text-xs text-muted">
                    {b.professionalName ?? "Clínica toda"} ·{" "}
                    {b.kind === "single" ? formatDateBR(b.localDate) : `toda ${WEEKDAYS[b.weekday ?? 0]?.toLowerCase()} desde ${formatDateBR(b.startDate)}${b.untilDate ? ` até ${formatDateBR(b.untilDate)}` : ""}`} ·{" "}
                    {minutesToHHMM(b.startMinute)}–{minutesToHHMM(b.endMinute)}
                  </span>
                </span>
                <Button size="sm" variant="ghost" loading={remove.pending} onClick={() => window.confirm("Remover este bloqueio?") && remove.run(b.id)}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
