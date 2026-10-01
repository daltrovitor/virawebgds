// Hello World
"use client";

import { useState } from "react";
import { updateSettingsAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { hhmmToMinutes, minutesToHHMM } from "@/domain/dates";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const TIMEZONES = ["America/Sao_Paulo", "America/Bahia", "America/Fortaleza", "America/Recife", "America/Belem", "America/Manaus", "America/Cuiaba", "America/Campo_Grande", "America/Porto_Velho", "America/Boa_Vista", "America/Rio_Branco", "America/Noronha"];

interface Values {
  displayName: string;
  legalName: string;
  document: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  brandColor: string;
  timezone: string;
  slotMinutes: number;
  uploadMaxMb: number;
  budgetValidityDays: number;
  businessHours: { days: { start: number; end: number }[][] };
}

export function ClinicSettingsForm({ initial }: { initial: Values }) {
  const [v, setV] = useState(initial);
  const save = useAction(updateSettingsAction, { success: "Configurações salvas" });
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const setPeriod = (day: number, idx: number, patch: Partial<{ start: number; end: number }>) =>
    setV({ ...v, businessHours: { days: v.businessHours.days.map((periods, d) => (d === day ? periods.map((p, i) => (i === idx ? { ...p, ...patch } : p)) : periods)) } });
  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        await save.run({
          ...v,
          legalName: v.legalName || null,
          document: v.document || null,
          phone: v.phone || null,
          email: v.email || null,
          address: v.address || null,
          city: v.city || null,
          state: v.state || null,
          slotMinutes: v.slotMinutes as 5 | 10 | 15 | 20 | 30,
        });
      }}
    >
      {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
      <Card>
        <CardHeader title="Identidade e contato" description="Aparecem em orçamentos, contratos e recibos." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome de exibição" htmlFor="cs-name" required error={save.fieldErrors.displayName}>
            <Input id="cs-name" value={v.displayName} onChange={set("displayName")} />
          </Field>
          <Field label="Razão social" htmlFor="cs-legal">
            <Input id="cs-legal" value={v.legalName} onChange={set("legalName")} />
          </Field>
          <Field label="CNPJ/CPF" htmlFor="cs-doc">
            <Input id="cs-doc" value={v.document} onChange={set("document")} />
          </Field>
          <Field label="Telefone" htmlFor="cs-phone">
            <Input id="cs-phone" value={v.phone} onChange={set("phone")} />
          </Field>
          <Field label="E-mail" htmlFor="cs-email">
            <Input id="cs-email" type="email" value={v.email} onChange={set("email")} />
          </Field>
          <Field label="Endereço" htmlFor="cs-address">
            <Input id="cs-address" value={v.address} onChange={set("address")} />
          </Field>
          <Field label="Cidade" htmlFor="cs-city">
            <Input id="cs-city" value={v.city} onChange={set("city")} />
          </Field>
          <Field label="UF" htmlFor="cs-state">
            <Input id="cs-state" maxLength={2} value={v.state} onChange={set("state")} />
          </Field>
          <Field label="Cor da marca" htmlFor="cs-color" error={save.fieldErrors.brandColor} hint="Precisa de contraste 4,5:1 com o branco">
            <div className="flex items-center gap-2">
              <Input id="cs-color" type="color" className="h-10 w-16 p-1" value={v.brandColor} onChange={set("brandColor")} />
              <Input aria-label="Código da cor" value={v.brandColor} onChange={set("brandColor")} />
            </div>
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Regional e agenda" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fuso horário" htmlFor="cs-tz">
            <Select id="cs-tz" value={v.timezone} onChange={set("timezone")}>
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grade da agenda" htmlFor="cs-slot">
            <Select id="cs-slot" value={v.slotMinutes} onChange={(e) => setV({ ...v, slotMinutes: Number(e.target.value) })}>
              {[5, 10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Validade do orçamento (dias)" htmlFor="cs-valid">
            <Input id="cs-valid" type="number" min={1} max={365} value={v.budgetValidityDays} onChange={(e) => setV({ ...v, budgetValidityDays: Number(e.target.value) || 30 })} />
          </Field>
          <Field label="Limite por arquivo (MB)" htmlFor="cs-upload">
            <Input id="cs-upload" type="number" min={1} max={25} value={v.uploadMaxMb} onChange={(e) => setV({ ...v, uploadMaxMb: Number(e.target.value) || 20 })} />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Expediente" description="Dias e horários de funcionamento. Intervalos podem ser registrados como períodos separados ou bloqueios." />
        <CardBody className="space-y-3">
          {WEEKDAYS.map((w, d) => (
            <div key={w} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-0">
              <span className="w-24 text-sm font-medium">{w}</span>
              {(v.businessHours.days[d] ?? []).length === 0 ? <span className="text-sm text-muted">Fechado</span> : null}
              {(v.businessHours.days[d] ?? []).map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <input aria-label={`${w} início`} type="time" step={900} value={minutesToHHMM(p.start)} onChange={(e) => setPeriod(d, i, { start: hhmmToMinutes(e.target.value) ?? p.start })} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
                  <span aria-hidden="true">–</span>
                  <input aria-label={`${w} fim`} type="time" step={900} value={minutesToHHMM(p.end)} onChange={(e) => setPeriod(d, i, { end: hhmmToMinutes(e.target.value) ?? p.end })} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
                  <button
                    type="button"
                    className="min-h-10 px-2 text-xs text-muted hover:text-fg cursor-pointer"
                    onClick={() => setV({ ...v, businessHours: { days: v.businessHours.days.map((ps, k) => (k === d ? ps.filter((_, j) => j !== i) : ps)) } })}
                  >
                    Remover
                  </button>
                </span>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setV({ ...v, businessHours: { days: v.businessHours.days.map((ps, k) => (k === d ? [...ps, { start: 480, end: 1080 }] : ps)) } })}
              >
                Adicionar período
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={save.pending}>
          Salvar configurações
        </Button>
      </div>
    </form>
  );
}
