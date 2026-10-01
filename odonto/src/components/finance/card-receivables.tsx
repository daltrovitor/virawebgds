// Hello World
"use client";

import Link from "next/link";
import { useState } from "react";
import { settleCardReceivableAction } from "@/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";

interface Row {
  id: string;
  acquirer: string;
  brand: string | null;
  paymentType: string;
  installmentNumber: number;
  installments: number;
  transactionDate: string;
  expectedDate: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  status: string;
  settledOn: string | null;
  anticipationFeeCents: number;
}

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "info" | "neutral" }> = {
  pending: { label: "A liquidar", tone: "warning" },
  settled: { label: "Liquidado", tone: "success" },
  anticipated: { label: "Antecipado", tone: "info" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export function CardReceivablesTable({ rows, banks, canSettle, today, showAll }: { rows: Row[]; banks: { id: string; name: string }[]; canSettle: boolean; today: string; showAll: boolean }) {
  const [settling, setSettling] = useState<Row | null>(null);
  const [f, setF] = useState({ bankAccountId: banks[0]?.id ?? "", settledOn: today, anticipation: 0 as number | null });
  const settle = useAction(settleCardReceivableAction, { success: "Liquidação registrada: repasse no banco e taxa como despesa" });
  return (
    <Card>
      <CardHeader
        title={showAll ? "Todos os recebíveis" : "A liquidar"}
        actions={
          <Link href={showAll ? "/financeiro/cartoes" : "/financeiro/cartoes?todos=1"} className="text-sm text-accent hover:underline cursor-pointer">
            {showAll ? "Somente a liquidar" : "Ver todos"}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Nenhum recebível" description="Pagamentos de pacientes com cartão aparecem aqui ao serem registrados." />
      ) : (
        <TableWrap label="Recebíveis de cartão">
          <Table>
            <thead>
              <tr>
                <Th>Previsão</Th>
                <Th>Operadora</Th>
                <Th>Parcela</Th>
                <Th align="right">Bruto</Th>
                <Th align="right">Taxa</Th>
                <Th align="right">Líquido</Th>
                <Th>Situação</Th>
                <Th align="right">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="tabular">{formatDateBR(r.expectedDate)}</Td>
                  <Td>
                    {r.acquirer} {r.brand ? `· ${r.brand}` : ""}
                    <span className="block text-xs text-subtle">
                      {r.paymentType === "credit" ? "Crédito" : "Débito"} · venda em {formatDateBR(r.transactionDate)}
                    </span>
                  </Td>
                  <Td className="tabular">
                    {r.installmentNumber}/{r.installments}
                  </Td>
                  <Td align="right">{formatBRL(r.grossCents)}</Td>
                  <Td align="right">{formatBRL(r.feeCents)}</Td>
                  <Td align="right" className="font-medium">
                    {formatBRL(r.netCents)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    {r.settledOn ? <span className="block text-xs text-subtle">em {formatDateBR(r.settledOn)}</span> : null}
                  </Td>
                  <Td align="right">
                    {canSettle && r.status === "pending" ? (
                      <Button size="sm" onClick={() => (setSettling(r), setF({ ...f, settledOn: r.expectedDate < today ? today : r.expectedDate, anticipation: 0 }))}>
                        Registrar liquidação
                      </Button>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {settling ? (
        <Dialog
          open
          onClose={() => setSettling(null)}
          title="Liquidação pela operadora"
          description={`Bruto ${formatBRL(settling.grossCents)} · taxa ${formatBRL(settling.feeCents)} · líquido ${formatBRL(settling.netCents)}`}
          footer={
            <Button
              variant="primary"
              loading={settle.pending}
              onClick={async () => {
                const res = await settle.run({ cardReceivableId: settling.id, bankAccountId: f.bankAccountId, settledOn: f.settledOn, anticipationFeeCents: f.anticipation ?? 0 });
                if (res.ok) setSettling(null);
              }}
            >
              Confirmar
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {settle.error ? <Notice tone="danger" className="sm:col-span-3">{settle.error}</Notice> : null}
            <Field label="Conta que recebeu" htmlFor="cr-bank">
              <Select id="cr-bank" value={f.bankAccountId} onChange={(e) => setF({ ...f, bankAccountId: e.target.value })}>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data do crédito" htmlFor="cr-date">
              <Input id="cr-date" type="date" value={f.settledOn} onChange={(e) => setF({ ...f, settledOn: e.target.value })} />
            </Field>
            <Field label="Encargo de antecipação" htmlFor="cr-ant" hint="Somente se antecipado">
              <MoneyInput id="cr-ant" value={f.anticipation} onChange={(v) => setF({ ...f, anticipation: v })} />
            </Field>
            <p className="text-sm sm:col-span-3">
              Valor que entra no banco: <strong className="tabular">{formatBRL(settling.netCents - (f.anticipation ?? 0))}</strong>
            </p>
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
