// Hello World
import type { Metadata } from "next";
import { MovementsActions } from "@/components/finance/movements-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDateBR, isValidCivil, startOfMonth, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { ACCOUNT_KIND_LABEL, listAccounts } from "@/server/services/finance-setup";
import { listMovements } from "@/server/services/titles";
import { getRequestContext } from "@/server/session";
import { FIN_TABS } from "../tabs";

export const metadata: Metadata = { title: "Contas e movimentos" };

const KIND_LABEL: Record<string, string> = {
  settlement: "Liquidação",
  settlement_reversal: "Estorno",
  transfer_out: "Transferência (saída)",
  transfer_in: "Transferência (entrada)",
  transfer_reversal: "Estorno de transferência",
  card_settlement_out: "Repasse do cartão (saída)",
  card_settlement_in: "Repasse do cartão (entrada)",
  card_fee: "Taxa de cartão",
  card_anticipation_fee: "Encargo de antecipação",
  bank_fee: "Tarifa bancária",
  bank_adjustment: "Ajuste bancário",
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ conta?: string; from?: string; to?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.view")) return <NoAccess what="o financeiro" />;
  const sp = await searchParams;
  const today = todayInTz(ctx.timezone);
  const from = sp.from && isValidCivil(sp.from) ? sp.from : startOfMonth(today);
  const to = sp.to && isValidCivil(sp.to) ? sp.to : today;
  const accounts = await listAccounts(ctx, { includeInactive: true });
  const accountId = accounts.some((a) => a.id === sp.conta) ? sp.conta : undefined;
  const movements = await listMovements(ctx, { accountId, from, to });
  const inSum = movements.filter((m) => m.movement.amountCents > 0).reduce((s, m) => s + m.movement.amountCents, 0);
  const outSum = movements.filter((m) => m.movement.amountCents < 0).reduce((s, m) => s + m.movement.amountCents, 0);
  return (
    <>
      <PageHeader title="Contas e movimentos" description="Extrato interno: cada movimento efetivo. Estornos aparecem como movimentos reversos; nada é apagado." />
      <TabLinks label="Seções do financeiro" active="contas" tabs={FIN_TABS} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.map((a) => (
          <a key={a.id} href={`/financeiro/contas?conta=${a.id}&from=${from}&to=${to}`} className={`rounded-lg border bg-white px-4 py-3 transition-colors hover:border-zinc-400 cursor-pointer ${accountId === a.id ? "border-accent" : "border-border"}`}>
            <p className="text-xs text-subtle">{ACCOUNT_KIND_LABEL[a.kind as keyof typeof ACCOUNT_KIND_LABEL]}</p>
            <p className="truncate text-sm font-medium">{a.name}</p>
            <p className="mt-1 text-xl font-semibold tabular">{formatBRL(a.balanceCents)}</p>
            <p className="text-xs text-muted">
              Saldo inicial {formatBRL(a.openingBalanceCents)} em {formatDateBR(a.openingDate)}
              {!a.active ? " · inativa" : ""}
            </p>
          </a>
        ))}
      </div>
      <Card>
        <CardHeader
          title={accountId ? `Movimentos de ${accounts.find((a) => a.id === accountId)?.name}` : "Movimentos de todas as contas"}
          description={`${formatDateBR(from)} a ${formatDateBR(to)} · entradas ${formatBRL(inSum)} · saídas ${formatBRL(outSum)}`}
          actions={
            <MovementsActions
              accounts={accounts.filter((a) => a.active).map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
              canTransfer={ctx.permissions.has("finance.settle")}
              canExport={ctx.permissions.has("finance.export")}
              exportHref={`/api/exportar/movimentos?from=${from}&to=${to}${accountId ? `&conta=${accountId}` : ""}`}
              today={today}
            />
          }
        />
        <form className="grid grid-cols-1 gap-3 border-b border-border px-4 py-3 sm:grid-cols-4 sm:items-end sm:px-5">
          <input type="hidden" name="conta" value={accountId ?? ""} />
          <div>
            <label htmlFor="from" className="mb-1.5 block text-sm font-medium">
              De
            </label>
            <input id="from" name="from" type="date" defaultValue={from} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm" />
          </div>
          <div>
            <label htmlFor="to" className="mb-1.5 block text-sm font-medium">
              Até
            </label>
            <input id="to" name="to" type="date" defaultValue={to} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm" />
          </div>
          <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
            Filtrar
          </button>
        </form>
        {movements.length === 0 ? (
          <EmptyState title="Nenhum movimento no período" />
        ) : (
          <TableWrap label="Movimentos">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Conta</Th>
                  <Th>Descrição</Th>
                  <Th>Tipo</Th>
                  <Th align="right">Valor</Th>
                  <Th>Conciliação</Th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <Tr key={m.movement.id}>
                    <Td className="tabular">{formatDateBR(m.movement.occurredOn)}</Td>
                    <Td>{m.accountName}</Td>
                    <Td className="max-w-sm">
                      <span className="block truncate">{m.movement.description}</span>
                      {m.categoryName ? <span className="text-xs text-subtle">{m.categoryName}</span> : null}
                    </Td>
                    <Td className="text-muted">{KIND_LABEL[m.movement.kind] ?? m.movement.kind}</Td>
                    <Td align="right" className={m.movement.amountCents < 0 ? "text-danger" : "text-success"}>
                      {formatBRL(m.movement.amountCents)}
                    </Td>
                    <Td>
                      {m.movement.reconciledCents === m.movement.amountCents ? (
                        <Badge tone="success">Conciliado</Badge>
                      ) : m.movement.reconciledCents !== 0 ? (
                        <Badge tone="warning">Parcial</Badge>
                      ) : (
                        <Badge>Pendente</Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
