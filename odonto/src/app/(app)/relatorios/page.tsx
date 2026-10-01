// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, Notice, PageHeader } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_STATUSES } from "@/domain/appointments";
import { BUDGET_STATUS_LABEL, BUDGET_STATUSES } from "@/domain/budget";
import { endOfMonth, formatDateBR, isValidCivil, minutesToHHMM, startOfMonth, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { appointmentBadge } from "@/lib/status";
import { budgetReport, cashByCategory, receivablesPosition, reconciliationReport, scheduleReport } from "@/server/services/reports";
import { listUnscheduledItems } from "@/server/services/treatments";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("reports.view")) return <NoAccess what="relatórios" />;
  const sp = await searchParams;
  const today = todayInTz(ctx.timezone);
  const from = sp.from && isValidCivil(sp.from) ? sp.from : startOfMonth(today);
  const to = sp.to && isValidCivil(sp.to) && sp.to >= from ? sp.to : endOfMonth(today);
  const fin = ctx.permissions.has("finance.view");
  const [sched, budgets, position, byCategory, recon, unscheduled] = await Promise.all([
    scheduleReport(ctx, from, to),
    budgetReport(ctx, from, to),
    fin ? receivablesPosition(ctx, from, to) : null,
    fin ? cashByCategory(ctx, from, to) : null,
    fin ? reconciliationReport(ctx) : null,
    listUnscheduledItems(ctx),
  ]);
  const period = `${formatDateBR(from)} a ${formatDateBR(to)}`;
  return (
    <>
      <PageHeader title="Relatórios" description={`Período: ${period}. Cada indicador informa sua base; valores de bases diferentes não são somados.`} />
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-white px-4 py-3 sm:px-5">
        <div>
          <label htmlFor="from" className="mb-1.5 block text-sm font-medium">
            De
          </label>
          <input id="from" name="from" type="date" defaultValue={from} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
        </div>
        <div>
          <label htmlFor="to" className="mb-1.5 block text-sm font-medium">
            Até
          </label>
          <input id="to" name="to" type="date" defaultValue={to} className="h-10 rounded-md border border-border-strong px-2 text-sm" />
        </div>
        <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
          Aplicar
        </button>
      </form>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Consultas no período" value={sched.total} hint={`${sched.byStatus.finished} finalizada(s)`} />
        <Stat
          label="Taxa de faltas"
          value={sched.noShowRate ? `${String(sched.noShowRate.percent).replace(".", ",")}%` : "—"}
          hint={sched.noShowRate ? `${sched.noShowRate.numerator} de ${sched.noShowRate.denominator} consultas agendadas no período` : "Sem consultas"}
        />
        <Stat label="Valor orçado" value={formatBRL(budgets.quotedCents)} hint="Versão inicial dos orçamentos com data no período" />
        <Stat label="Valor aprovado" value={formatBRL(budgets.approvedCents)} hint={`${budgets.approvedCount} acordo(s) inicial(is) criados no período`} />
        <Stat
          label="Conversão"
          value={budgets.conversion ? `${String(budgets.conversion.percent).replace(".", ",")}%` : "—"}
          hint={budgets.conversion ? `${budgets.conversion.numerator} de ${budgets.conversion.denominator} orçamentos (coorte do período)` : "Sem orçamentos no período"}
        />
        {position ? <Stat label="Recebido no período" value={formatBRL(position.receivedCents)} hint="Baixas efetivas, sem estornos" tone="accent" /> : null}
      </section>
      {budgets.conversion ? <p className="mt-2 text-xs text-subtle">Base da conversão: {budgets.conversion.basis}</p> : null}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Consultas por situação" description={period} />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Situação</Th>
                  <Th align="right">Quantidade</Th>
                </tr>
              </thead>
              <tbody>
                {APPOINTMENT_STATUSES.map((s) => (
                  <Tr key={s}>
                    <Td>{APPOINTMENT_STATUS_LABEL[s]}</Td>
                    <Td align="right">{sched.byStatus[s]}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
        <Card>
          <CardHeader title="Orçamentos por situação atual" description="Orçamentos com data no período" />
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Situação</Th>
                  <Th align="right">Quantidade</Th>
                  <Th align="right">Valor orçado</Th>
                </tr>
              </thead>
              <tbody>
                {BUDGET_STATUSES.map((s) => (
                  <Tr key={s}>
                    <Td>{BUDGET_STATUS_LABEL[s]}</Td>
                    <Td align="right">{budgets.byStatus[s].count}</Td>
                    <Td align="right">{formatBRL(budgets.byStatus[s].quotedCents)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <CardBody>
            <p className="text-xs text-muted">Ajustes de revisões aprovadas no período: {formatBRL(budgets.revisionAdjustmentCents)}.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Faltas e desmarcações" description={`${sched.missed.length} no período`} />
        {sched.missed.length === 0 ? (
          <EmptyState title="Nenhuma falta ou desmarcação" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Paciente</Th>
                  <Th>Profissional</Th>
                  <Th>Situação</Th>
                  <Th>Motivo</Th>
                </tr>
              </thead>
              <tbody>
                {sched.missed.map((m) => {
                  const b = appointmentBadge(m.appointment.status as Parameters<typeof appointmentBadge>[0]);
                  return (
                    <Tr key={m.appointment.id}>
                      <Td className="tabular">
                        {formatDateBR(m.appointment.localDate)} {minutesToHHMM(m.appointment.startMinute)}
                      </Td>
                      <Td>
                        <Link href={`/pacientes/${m.appointment.patientId}`} className="hover:underline cursor-pointer">
                          {m.patientName}
                        </Link>
                      </Td>
                      <Td>{m.professionalName}</Td>
                      <Td>
                        <Badge tone={b.tone}>{b.label}</Badge>
                      </Td>
                      <Td className="max-w-xs truncate text-muted">{m.appointment.cancelReason ?? "—"}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Procedimentos aprovados ainda não agendados" description={`${unscheduled.length} item(ns), situação atual`} actions={<Link href="/orcamentos/nao-agendados" className="text-sm text-accent hover:underline cursor-pointer">Abrir lista</Link>} />
      </Card>

      {fin && position && byCategory ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="A receber em aberto" value={formatBRL(position.openCents)} hint={`Posição em ${formatDateBR(position.asOf)}`} />
            <Stat label="A receber vencido" value={formatBRL(position.overdueCents)} hint={`Posição em ${formatDateBR(position.asOf)}`} tone={position.overdueCents > 0 ? "danger" : "default"} />
            <Stat label="Resultado de caixa no período" value={formatBRL(byCategory.totalIncome + byCategory.totalExpense)} hint="Receitas − despesas pagas" />
          </div>
          <Notice tone="info" className="mt-4">
            {byCategory.basis}
          </Notice>
          <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Receitas por categoria (caixa)" description={`Total ${formatBRL(byCategory.totalIncome)}`} />
              {byCategory.income.length === 0 ? (
                <EmptyState title="Sem receitas no período" />
              ) : (
                <TableWrap>
                  <Table>
                    <tbody>
                      {byCategory.income.map((l) => (
                        <Tr key={l.categoryId}>
                          <Td>{l.name}</Td>
                          <Td align="right">{formatBRL(l.cents)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
            <Card>
              <CardHeader title="Despesas por categoria (caixa)" description={`Total ${formatBRL(byCategory.totalExpense)}`} />
              {byCategory.expense.length === 0 ? (
                <EmptyState title="Sem despesas no período" />
              ) : (
                <TableWrap>
                  <Table>
                    <tbody>
                      {byCategory.expense.map((l) => (
                        <Tr key={l.categoryId}>
                          <Td>{l.name}</Td>
                          <Td align="right">{formatBRL(l.cents)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>
          </div>
          {recon && recon.length > 0 ? (
            <Card className="mt-6">
              <CardHeader title="Pendências de conciliação por conta" description="Situação atual" />
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>Conta</Th>
                      <Th align="right">Extrato pendente</Th>
                      <Th align="right">Valor pendente</Th>
                      <Th align="right">Lançamentos sem vínculo</Th>
                      <Th align="right">Ignoradas</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon.map((r) => (
                      <Tr key={r.accountId}>
                        <Td>{r.name}</Td>
                        <Td align="right">{r.pendingCount}</Td>
                        <Td align="right">{formatBRL(Number(r.pendingCents))}</Td>
                        <Td align="right">{r.unreconciledMovements}</Td>
                        <Td align="right">{r.ignoredCount}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            </Card>
          ) : null}
          {ctx.permissions.has("finance.export") ? (
            <p className="mt-4 flex flex-wrap gap-4 text-sm">
              <a className="text-accent hover:underline cursor-pointer" href={`/api/exportar/receber?status=all&from=${from}&to=${to}`}>
                Exportar contas a receber (CSV)
              </a>
              <a className="text-accent hover:underline cursor-pointer" href={`/api/exportar/pagar?status=all&from=${from}&to=${to}`}>
                Exportar contas a pagar (CSV)
              </a>
              <a className="text-accent hover:underline cursor-pointer" href={`/api/exportar/movimentos?from=${from}&to=${to}`}>
                Exportar movimentos (CSV)
              </a>
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}
