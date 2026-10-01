// Hello World
"use client";

import { useState } from "react";
import { createRecurrenceAction, generateRecurringAction, suspendRecurrenceAction } from "@/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { addDays, formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";

interface Rec {
  id: string;
  description: string;
  amountCents: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  suspended: boolean;
  supplierName: string | null;
  categoryName: string | null;
}

export function RecurrencesPanel({
  recurrences,
  canEdit,
  today,
  categories,
  suppliers,
}: {
  recurrences: Rec[];
  canEdit: boolean;
  today: string;
  categories: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [until, setUntil] = useState(addDays(today, 90));
  const [f, setF] = useState({ description: "", supplierId: "", categoryId: categories[0]?.id ?? "", amount: null as number | null, dayOfMonth: 10, startDate: today, endDate: "" });
  const create = useAction(createRecurrenceAction, { success: "Recorrência criada" });
  const generate = useAction(generateRecurringAction, { success: (d) => (d.created > 0 ? `${d.created} ocorrência(s) gerada(s)` : "Nenhuma ocorrência nova (geração idempotente)") });
  const suspend = useAction(suspendRecurrenceAction, { success: "Recorrência suspensa; ocorrências futuras sem pagamento foram canceladas" });
  return (
    <Card>
      <CardHeader
        title="Despesas recorrentes"
        description="A geração é idempotente: repetir não duplica contas. Suspender interrompe as futuras."
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="rc-until" className="sr-only">
                Gerar até
              </label>
              <input id="rc-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-9 rounded-md border border-border-strong px-2 text-sm" />
              <Button size="sm" loading={generate.pending} onClick={() => generate.run(until)}>
                Gerar ocorrências
              </Button>
              <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                Nova recorrência
              </Button>
            </div>
          ) : null
        }
      />
      {recurrences.length === 0 ? (
        <EmptyState title="Nenhuma despesa recorrente" />
      ) : (
        <ul className="divide-y divide-border">
          {recurrences.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
              <span>
                <span className="font-medium">{r.description}</span> · <span className="tabular">{formatBRL(r.amountCents)}</span>
                <span className="block text-xs text-muted">
                  Todo dia {r.dayOfMonth} · desde {formatDateBR(r.startDate)}
                  {r.endDate ? ` até ${formatDateBR(r.endDate)}` : ""} · {r.categoryName ?? "—"}
                  {r.supplierName ? ` · ${r.supplierName}` : ""}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {r.suspended ? <Badge>Suspensa</Badge> : <Badge tone="success">Ativa</Badge>}
                {canEdit && !r.suspended ? (
                  <Button size="sm" variant="ghost" loading={suspend.pending} onClick={() => window.confirm("Suspender esta recorrência? Ocorrências futuras sem pagamento serão canceladas.") && suspend.run(r.id)}>
                    Suspender
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nova despesa recorrente"
        footer={
          <Button
            variant="primary"
            loading={create.pending}
            onClick={async () => {
              const res = await create.run({
                description: f.description,
                supplierId: f.supplierId || null,
                categoryId: f.categoryId,
                amountCents: f.amount ?? 0,
                dayOfMonth: f.dayOfMonth,
                startDate: f.startDate,
                endDate: f.endDate || null,
              });
              if (res.ok) setOpen(false);
            }}
          >
            Criar
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {create.error ? <Notice tone="danger" className="sm:col-span-2">{create.error}</Notice> : null}
          <Field label="Descrição" htmlFor="rc-desc" required className="sm:col-span-2">
            <Input id="rc-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Field label="Fornecedor" htmlFor="rc-sup">
            <Select id="rc-sup" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
              <option value="">Não informado</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria" htmlFor="rc-cat">
            <Select id="rc-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor" htmlFor="rc-amount">
            <MoneyInput id="rc-amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
          </Field>
          <Field label="Dia do vencimento" htmlFor="rc-day" hint="Dia 31 vira o último dia em meses curtos">
            <Input id="rc-day" type="number" min={1} max={31} value={f.dayOfMonth} onChange={(e) => setF({ ...f, dayOfMonth: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })} />
          </Field>
          <Field label="Início" htmlFor="rc-start">
            <Input id="rc-start" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </Field>
          <Field label="Fim (opcional)" htmlFor="rc-end">
            <Input id="rc-end" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
