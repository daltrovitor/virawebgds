// Hello World
"use client";

import { useState } from "react";
import { saveProfessionalAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { hhmmToMinutes, minutesToHHMM } from "@/domain/dates";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface Prof {
  id: string | null;
  name: string;
  council: string | null;
  councilNumber: string | null;
  councilState: string | null;
  color: string;
  active: boolean;
  userId: string | null;
  specialtyIds: string[];
  specialtyNames?: string[];
  availability: { weekday: number; startMinute: number; endMinute: number }[];
}

export function ProfessionalsManager({ professionals, specialties, users }: { professionals: Prof[]; specialties: { id: string; name: string }[]; users: { id: string; name: string }[] }) {
  const [edit, setEdit] = useState<Prof | null>(null);
  const save = useAction(saveProfessionalAction, { success: "Profissional salvo" });
  return (
    <Card>
      <CardHeader
        title="Profissionais"
        actions={
          <Button size="sm" variant="primary" onClick={() => setEdit({ id: null, name: "", council: "CRO", councilNumber: "", councilState: "", color: "#0f766e", active: true, userId: null, specialtyIds: [], availability: [] })}>
            Novo profissional
          </Button>
        }
      />
      {professionals.length === 0 ? (
        <EmptyState title="Nenhum profissional" />
      ) : (
        <ul className="divide-y divide-border">
          {professionals.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="text-sm">
                <span className="font-medium">{p.name}</span> {!p.active ? <Badge>Inativo</Badge> : null} {p.userId ? <Badge tone="info">Com acesso</Badge> : null}
                <span className="block text-xs text-muted">
                  {[p.council && p.councilNumber ? `${p.council} ${p.councilNumber}${p.councilState ? `/${p.councilState}` : ""}` : null, p.specialtyNames?.join(", ")].filter(Boolean).join(" · ") || "—"}
                </span>
                {p.availability.length > 0 ? (
                  <span className="block text-xs text-subtle">
                    {p.availability.map((a) => `${WEEKDAYS[a.weekday]} ${minutesToHHMM(a.startMinute)}–${minutesToHHMM(a.endMinute)}`).join(" · ")}
                  </span>
                ) : null}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEdit({ ...p })}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      )}
      {edit ? (
        <Dialog
          open
          onClose={() => setEdit(null)}
          title={edit.id ? "Editar profissional" : "Novo profissional"}
          size="lg"
          footer={
            <Button
              variant="primary"
              loading={save.pending}
              onClick={async () => {
                const res = await save.run({
                  id: edit.id,
                  name: edit.name,
                  council: edit.council,
                  councilNumber: edit.councilNumber,
                  councilState: edit.councilState,
                  color: edit.color,
                  active: edit.active,
                  userId: edit.userId,
                  specialtyIds: edit.specialtyIds,
                  availability: edit.availability,
                });
                if (res.ok) setEdit(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {save.error ? <Notice tone="danger" className="sm:col-span-3">{save.error}</Notice> : null}
            <Field label="Nome" htmlFor="pf-name" required className="sm:col-span-3">
              <Input id="pf-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Conselho" htmlFor="pf-c">
              <Input id="pf-c" value={edit.council ?? ""} onChange={(e) => setEdit({ ...edit, council: e.target.value })} />
            </Field>
            <Field label="Número" htmlFor="pf-n">
              <Input id="pf-n" value={edit.councilNumber ?? ""} onChange={(e) => setEdit({ ...edit, councilNumber: e.target.value })} />
            </Field>
            <Field label="UF" htmlFor="pf-uf">
              <Input id="pf-uf" maxLength={2} value={edit.councilState ?? ""} onChange={(e) => setEdit({ ...edit, councilState: e.target.value })} />
            </Field>
            <Field label="Usuário vinculado (login)" htmlFor="pf-user" className="sm:col-span-2">
              <Select id="pf-user" value={edit.userId ?? ""} onChange={(e) => setEdit({ ...edit, userId: e.target.value || null })}>
                <option value="">Sem acesso ao sistema</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cor na agenda" htmlFor="pf-color">
              <Input id="pf-color" type="color" className="h-10 p-1" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} />
            </Field>
            <fieldset className="sm:col-span-3">
              <legend className="mb-2 text-sm font-medium">Especialidades</legend>
              <div className="flex flex-wrap gap-x-4">
                {specialties.map((s) => (
                  <Checkbox
                    key={s.id}
                    label={s.name}
                    checked={edit.specialtyIds.includes(s.id)}
                    onChange={(e) => setEdit({ ...edit, specialtyIds: e.target.checked ? [...edit.specialtyIds, s.id] : edit.specialtyIds.filter((x) => x !== s.id) })}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="space-y-2 sm:col-span-3">
              <legend className="mb-1 text-sm font-medium">Horários de trabalho</legend>
              {edit.availability.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select aria-label="Dia" value={a.weekday} onChange={(e) => setEdit({ ...edit, availability: edit.availability.map((x, k) => (k === i ? { ...x, weekday: Number(e.target.value) } : x)) })} className="h-10 rounded-md border border-border-strong px-2 text-sm">
                    {WEEKDAYS.map((w, d) => (
                      <option key={w} value={d}>
                        {w}
                      </option>
                    ))}
                  </select>
                  <input aria-label="Início" type="time" step={900} value={minutesToHHMM(a.startMinute)} onChange={(e) => setEdit({ ...edit, availability: edit.availability.map((x, k) => (k === i ? { ...x, startMinute: hhmmToMinutes(e.target.value) ?? x.startMinute } : x)) })} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
                  <input aria-label="Fim" type="time" step={900} value={minutesToHHMM(a.endMinute)} onChange={(e) => setEdit({ ...edit, availability: edit.availability.map((x, k) => (k === i ? { ...x, endMinute: hhmmToMinutes(e.target.value) ?? x.endMinute } : x)) })} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ ...edit, availability: edit.availability.filter((_, k) => k !== i) })}>
                    Remover
                  </Button>
                </div>
              ))}
              <Button size="sm" onClick={() => setEdit({ ...edit, availability: [...edit.availability, { weekday: 1, startMinute: 480, endMinute: 1080 }] })}>
                Adicionar horário
              </Button>
            </fieldset>
            <Checkbox label="Ativo" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
