// Hello World
"use client";

import { useState } from "react";
import { createTransferAction } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function MovementsActions({
  accounts,
  canTransfer,
  canExport,
  exportHref,
  today,
}: {
  accounts: { id: string; name: string; kind: string }[];
  canTransfer: boolean;
  canExport: boolean;
  exportHref: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const own = accounts.filter((a) => a.kind !== "card_clearing");
  const [f, setF] = useState({ from: own[0]?.id ?? "", to: own[1]?.id ?? "", amount: null as number | null, date: today, description: "" });
  const transfer = useAction(createTransferAction, { success: "Transferência registrada (não é receita nem despesa)" });
  return (
    <div className="flex flex-wrap gap-2">
      {canExport ? (
        <a href={exportHref} className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-sm hover:bg-surface-2 cursor-pointer">
          Exportar CSV
        </a>
      ) : null}
      {canTransfer && own.length >= 2 ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          Transferência entre contas
        </Button>
      ) : null}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Transferência entre contas próprias"
        description="Gera um movimento de saída e um de entrada vinculados. Não altera receitas nem despesas."
        footer={
          <Button
            variant="primary"
            loading={transfer.pending}
            onClick={async () => {
              const res = await transfer.run({ fromAccountId: f.from, toAccountId: f.to, amountCents: f.amount ?? 0, occurredOn: f.date, description: f.description || null });
              if (res.ok) setOpen(false);
            }}
          >
            Transferir
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {transfer.error ? <Notice tone="danger" className="sm:col-span-2">{transfer.error}</Notice> : null}
          <Field label="De" htmlFor="tr-from">
            <Select id="tr-from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })}>
              {own.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Para" htmlFor="tr-to">
            <Select id="tr-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}>
              {own.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor" htmlFor="tr-amount">
            <MoneyInput id="tr-amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
          </Field>
          <Field label="Data" htmlFor="tr-date">
            <Input id="tr-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Descrição" htmlFor="tr-desc" className="sm:col-span-2">
            <Input id="tr-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: depósito do caixa" />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
