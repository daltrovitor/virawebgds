// Hello World
import type { Metadata } from "next";
import { CashflowChart } from "@/components/finance/cashflow-chart";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { Notice, PageHeader, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { addDays, compareCivil, formatDateBR, isValidCivil, todayInTz, weekdayNamePT } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { listAccounts } from "@/server/services/finance-setup";
import { cashflow } from "@/server/services/reports";
import { getRequestContext } from "@/server/session";
import { FIN_TABS } from "../tabs";

export const metadata: Metadata = { title: "Fluxo de caixa" };

export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; conta?: string; agrupar?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.view")) return <NoAccess what="o financeiro" />;
  const sp = await searchParams;
  const today = todayInTz(ctx.timezone);
  const from = sp.from && isValidCivil(sp.from) ? sp.from : addDays(today, -15);
  let to = sp.to && isValidCivil(sp.to) ? sp.to : addDays(today, 45);
  if (compareCivil(to, from) < 0) to = from;
  const accounts = (await listAccounts(ctx)).filter((a) => a.kind !== "card_clearing");
  const accountId = accounts.some((a) => a.id === sp.conta) ? sp.conta : null;
  const monthly = sp.agrupar === "mes";
  const { days, baseDate, pendingCardNetCents } = await cashflow(ctx, { from, to, accountId });
  const realizedIn = days.reduce((s, d) => s + d.realizedIn, 0);
  const realizedOut = days.reduce((s, d) => s + d.realizedOut, 0);
  const projIn = days.reduce((s, d) => s + d.projectedIn, 0);
  const projOut = days.reduce((s, d) => s + d.projectedOut, 0);
  const rows = monthly
    ? Object.values(
        days.reduce<Record<string, { key: string; realizedIn: number; realizedOut: number; projectedIn: number; projectedOut: number; end: (typeof days)[number] }>>((acc, d) => {
          const k = d.date.slice(0, 7);
          const e = (acc[k] ??= { key: k, realizedIn: 0, realizedOut: 0, projectedIn: 0, projectedOut: 0, end: d });
          e.realizedIn += d.realizedIn;
          e.realizedOut += d.realizedOut;
          e.projectedIn += d.projectedIn;
          e.projectedOut += d.projectedOut;
          e.end = d;
          return acc;
        }, {}),
      )
    : null;
  const q = (patch: Record<string, string>) => `?${new URLSearchParams({ from, to, ...(accountId ? { conta: accountId } : {}), ...(monthly ? { agrupar: "mes" } : {}), ...patch })}`;
  return (
    <>
      <PageHeader title="Fluxo de caixa" description="Realizado = saldo inicial + movimentos efetivos até a data (inclui transferências). Projetado = realizado na data-base + saldo restante dos títulos em aberto, sem duplicar o que já foi pago." />
      <TabLinks label="Seções do financeiro" active="fluxo" tabs={FIN_TABS} />
      <form className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-border bg-white px-4 py-3 sm:grid-cols-5 sm:items-end sm:px-5">
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
        <div>
          <label htmlFor="conta" className="mb-1.5 block text-sm font-medium">
            Conta
          </label>
          <select id="conta" name="conta" defaultValue={accountId ?? ""} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm">
            <option value="">Caixa e bancos (todas)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="agrupar" className="mb-1.5 block text-sm font-medium">
            Agrupar
          </label>
          <select id="agrupar" name="agrupar" defaultValue={monthly ? "mes" : "dia"} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm">
            <option value="dia">Diário</option>
            <option value="mes">Mensal</option>
          </select>
        </div>
        <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
          Atualizar
        </button>
      </form>
      {accountId ? <Notice tone="info" className="mb-4">Com uma conta específica, a projeção de títulos não é exibida (títulos não têm conta definitiva até a baixa).</Notice> : null}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Entradas realizadas" value={formatBRL(realizedIn)} />
        <Stat label="Saídas realizadas" value={formatBRL(Math.abs(realizedOut))} />
        <Stat label="A receber previsto" value={formatBRL(projIn)} />
        <Stat label="A pagar previsto" value={formatBRL(Math.abs(projOut))} />
        <Stat label="Cartões a liquidar (líquido)" value={formatBRL(pendingCardNetCents)} hint="Já incluídos no previsto pela data esperada" />
      </div>
      <Card>
        <CardHeader title="Saldo no período" description={`Data-base ${formatDateBR(baseDate)}. Vencidos e não pagos entram no dia seguinte à data-base.`} />
        <CardBody>
          <CashflowChart days={days} baseDate={baseDate} />
        </CardBody>
      </Card>
      <Card className="mt-6">
        <CardHeader title={monthly ? "Tabela mensal" : "Tabela diária"} actions={<a href={q({ agrupar: monthly ? "dia" : "mes" })} className="text-sm text-accent hover:underline cursor-pointer">{monthly ? "Ver diário" : "Ver mensal"}</a>} />
        <TableWrap label="Fluxo de caixa em tabela">
          <Table>
            <thead>
              <tr>
                <Th>{monthly ? "Mês" : "Data"}</Th>
                <Th align="right">Entradas realizadas</Th>
                <Th align="right">Saídas realizadas</Th>
                <Th align="right">Saldo realizado</Th>
                <Th align="right">A receber</Th>
                <Th align="right">A pagar</Th>
                <Th align="right">Saldo projetado</Th>
              </tr>
            </thead>
            <tbody>
              {monthly && rows
                ? rows.map((r) => (
                    <Tr key={r.key}>
                      <Td className="tabular">
                        {r.key.slice(5, 7)}/{r.key.slice(0, 4)}
                      </Td>
                      <Td align="right">{formatBRL(r.realizedIn)}</Td>
                      <Td align="right">{formatBRL(r.realizedOut)}</Td>
                      <Td align="right">{r.end.realizedBalance === null ? "—" : formatBRL(r.end.realizedBalance)}</Td>
                      <Td align="right">{formatBRL(r.projectedIn)}</Td>
                      <Td align="right">{formatBRL(r.projectedOut)}</Td>
                      <Td align="right" className="font-medium">
                        {formatBRL(r.end.projectedBalance)}
                      </Td>
                    </Tr>
                  ))
                : days.map((d) => (
                    <Tr key={d.date} className={d.date === baseDate ? "bg-accent-soft/60" : undefined}>
                      <Td className="tabular">
                        {formatDateBR(d.date)} <span className="text-xs text-subtle">{weekdayNamePT(d.date, true)}</span>
                      </Td>
                      <Td align="right">{d.realizedIn ? formatBRL(d.realizedIn) : "—"}</Td>
                      <Td align="right">{d.realizedOut ? formatBRL(d.realizedOut) : "—"}</Td>
                      <Td align="right">{d.realizedBalance === null ? "—" : formatBRL(d.realizedBalance)}</Td>
                      <Td align="right">{d.projectedIn ? formatBRL(d.projectedIn) : "—"}</Td>
                      <Td align="right">{d.projectedOut ? formatBRL(d.projectedOut) : "—"}</Td>
                      <Td align="right" className="font-medium">
                        {formatBRL(d.projectedBalance)}
                      </Td>
                    </Tr>
                  ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
