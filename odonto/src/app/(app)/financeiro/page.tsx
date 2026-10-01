// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { addDays, formatDateBR, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { ACCOUNT_KIND_LABEL } from "@/server/services/finance-setup";
import { overview, reconciliationReport } from "@/server/services/reports";
import { listTitles } from "@/server/services/titles";
import { getRequestContext } from "@/server/session";
import { FIN_TABS } from "./tabs";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinancePage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.view")) return <NoAccess what="o financeiro" />;
  const today = todayInTz(ctx.timezone);
  const [ov, upcomingRec, upcomingPay, recon] = await Promise.all([
    overview(ctx),
    listTitles(ctx, { kind: "receivable", status: "open_all", from: today, to: addDays(today, 7), pageSize: 10 }),
    listTitles(ctx, { kind: "payable", status: "open_all", to: addDays(today, 7), pageSize: 10 }),
    ctx.permissions.has("finance.reconcile") || ctx.permissions.has("reports.view") ? reconciliationReport(ctx) : [],
  ]);
  const f = ov.finance!;
  const total = f.accounts.filter((a) => a.kind !== "card_clearing").reduce((s, a) => s + a.balanceCents, 0);
  const cardPending = f.accounts.filter((a) => a.kind === "card_clearing").reduce((s, a) => s + a.balanceCents, 0);
  return (
    <>
      <PageHeader title="Financeiro" description="Realizado (dinheiro que efetivamente movimentou) e previsto (títulos em aberto) aparecem sempre separados." />
      <TabLinks label="Seções do financeiro" active="painel" tabs={FIN_TABS} />
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Saldo em caixa e bancos" value={formatBRL(total)} hint="Realizado até hoje" tone="accent" />
        <Stat label="Cartões a liquidar" value={formatBRL(cardPending)} hint="Recebíveis da operadora" href="/financeiro/cartoes" />
        <Stat label="A receber vencido" value={formatBRL(f.receivableOverdueCents)} tone={f.receivableOverdueCents > 0 ? "danger" : "default"} href="/financeiro/receber?status=overdue" />
        <Stat label="A pagar vencido" value={formatBRL(f.payableOverdueCents)} tone={f.payableOverdueCents > 0 ? "danger" : "default"} href="/financeiro/pagar?status=overdue" />
        <Stat label="Recebido no mês" value={formatBRL(f.receivedMonthCents)} />
        <Stat label="Pago no mês" value={formatBRL(f.paidMonthCents)} />
      </section>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.618fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="A receber nos próximos 7 dias" actions={<Link href="/financeiro/receber" className="text-sm text-accent hover:underline cursor-pointer">Ver todos</Link>} />
            {upcomingRec.items.length === 0 ? (
              <EmptyState title="Nada previsto" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Vencimento</Th>
                      <Th>Descrição</Th>
                      <Th>Paciente</Th>
                      <Th align="right">Saldo</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingRec.items.map((t) => (
                      <Tr key={t.id}>
                        <Td className="tabular">{formatDateBR(t.dueDate)}</Td>
                        <Td>{t.description}</Td>
                        <Td>{t.counterpart ?? "—"}</Td>
                        <Td align="right">{formatBRL(t.balanceCents)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
          <Card>
            <CardHeader title="A pagar até 7 dias (inclui vencidas)" actions={<Link href="/financeiro/pagar" className="text-sm text-accent hover:underline cursor-pointer">Ver todas</Link>} />
            {upcomingPay.items.length === 0 ? (
              <EmptyState title="Nada previsto" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Vencimento</Th>
                      <Th>Descrição</Th>
                      <Th>Fornecedor</Th>
                      <Th align="right">Saldo</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingPay.items.map((t) => (
                      <Tr key={t.id}>
                        <Td className={t.overdue ? "tabular font-medium text-danger" : "tabular"}>{formatDateBR(t.dueDate)}</Td>
                        <Td>{t.description}</Td>
                        <Td>{t.counterpart ?? "—"}</Td>
                        <Td align="right">{formatBRL(t.balanceCents)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Saldos realizados" description="Inicial + movimentos efetivos (inclui transferências)." />
            <ul className="divide-y divide-border">
              {f.accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span>
                    {a.name}
                    <span className="block text-xs text-subtle">{ACCOUNT_KIND_LABEL[a.kind as keyof typeof ACCOUNT_KIND_LABEL]}</span>
                  </span>
                  <span className="font-medium tabular">{formatBRL(a.balanceCents)}</span>
                </li>
              ))}
            </ul>
          </Card>
          {recon.length > 0 ? (
            <Card>
              <CardHeader title="Conciliação pendente" actions={<Link href="/financeiro/conciliacao" className="text-sm text-accent hover:underline cursor-pointer">Conciliar</Link>} />
              <ul className="divide-y divide-border">
                {recon.map((r) => (
                  <li key={r.accountId} className="px-4 py-2.5 text-sm sm:px-5">
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-xs text-muted">
                      {r.pendingCount} do extrato pendente(s) ({formatBRL(Number(r.pendingCents))}) · {r.unreconciledMovements} lançamento(s) sem vínculo · {r.ignoredCount} ignorada(s)
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
