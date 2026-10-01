// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { formatLongDatePT, minutesToHHMM } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { ACCOUNT_KIND_LABEL } from "@/server/services/finance-setup";
import { overview } from "@/server/services/reports";
import { getRequestContext } from "@/server/session";
import { appointmentBadge } from "@/lib/status";

export const metadata: Metadata = { title: "Visão geral" };

export default async function OverviewPage() {
  const ctx = await getRequestContext();
  const data = await overview(ctx);
  const s = data.schedule;
  const waiting = s ? s.byStatus.scheduled + s.byStatus.confirmed + s.byStatus.arrived : 0;
  const totalToday = s ? s.list.length : 0;
  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`${formatLongDatePT(data.today)} · ${ctx.clinicName}`}
        actions={
          ctx.permissions.has("schedule.edit") ? (
            <ButtonLink href="/agenda?nova=1" variant="primary">
              Agendar consulta
            </ButtonLink>
          ) : null
        }
      />

      {/* Topo da pirâmide: indicadores críticos */}
      <section aria-label="Indicadores do dia" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {s ? (
          <>
            <Stat label="Consultas hoje" value={totalToday} hint={`${s.byStatus.finished} finalizada(s)`} href="/agenda" />
            <Stat label="Aguardando" value={waiting} hint={`${s.byStatus.confirmed} confirmada(s) · ${s.byStatus.arrived} na recepção`} />
            <Stat label="Em atendimento" value={s.byStatus.in_progress} tone="accent" />
            <Stat label="Pendências" value={s.pendingClosure + s.openTasks} hint={`${s.pendingClosure} sem desfecho · ${s.openTasks} a agendar`} tone={s.pendingClosure > 0 ? "warning" : "default"} href="/agenda/pendencias" />
          </>
        ) : null}
        {data.budgets ? (
          <Stat label="Em negociação" value={data.budgets.negotiatingCount} hint={formatBRL(data.budgets.negotiatingValueCents)} href="/orcamentos?status=negotiating" />
        ) : null}
        {data.finance ? (
          <Stat
            label="Recebimentos vencidos"
            value={formatBRL(data.finance.receivableOverdueCents)}
            hint={`${data.finance.receivableOverdueCount} título(s)`}
            tone={data.finance.receivableOverdueCents > 0 ? "danger" : "default"}
            href="/financeiro/receber?status=overdue"
          />
        ) : null}
      </section>

      {/* Meio: análise do dia e posição financeira */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.618fr_1fr]">
        {s ? (
          <Card>
            <CardHeader title="Agenda de hoje" description="Ordem por horário. Situação sempre com texto." actions={<ButtonLink href="/agenda" size="sm">Abrir agenda</ButtonLink>} />
            {s.list.length === 0 ? (
              <EmptyState title="Nenhuma consulta hoje" description="Os horários livres aparecem na agenda." />
            ) : (
              <ol className="divide-y divide-border">
                {s.list.map((a) => {
                  const b = appointmentBadge(a.status);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                      <span className="w-24 shrink-0 text-sm font-medium tabular">
                        {minutesToHHMM(a.startMinute)}–{minutesToHHMM(a.endMinute)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <Link href={`/pacientes/${a.patientId}`} className="block truncate text-sm font-medium text-fg hover:underline cursor-pointer">
                          {a.patientName}
                        </Link>
                        <span className="block truncate text-xs text-muted">{a.professionalName}</span>
                      </span>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        ) : null}

        <div className="space-y-6">
          {data.finance ? (
            <Card>
              <CardHeader title="Financeiro de hoje" description="Realizado e previsto aparecem separados." actions={<ButtonLink href="/financeiro" size="sm">Abrir</ButtonLink>} />
              <CardBody>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-subtle">A receber hoje</dt>
                    <dd className="mt-0.5 font-medium tabular">{formatBRL(data.finance.receivableDueTodayCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">A pagar hoje</dt>
                    <dd className="mt-0.5 font-medium tabular">{formatBRL(data.finance.payableDueTodayCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Recebido no mês</dt>
                    <dd className="mt-0.5 font-medium tabular text-success">{formatBRL(data.finance.receivedMonthCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Pago no mês</dt>
                    <dd className="mt-0.5 font-medium tabular">{formatBRL(data.finance.paidMonthCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Contas a pagar vencidas</dt>
                    <dd className="mt-0.5 font-medium tabular text-danger">{formatBRL(data.finance.payableOverdueCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Extrato a conciliar</dt>
                    <dd className="mt-0.5 font-medium tabular">
                      <Link href="/financeiro/conciliacao" className="hover:underline cursor-pointer">
                        {data.finance.pendingBankTx} movimentação(ões)
                      </Link>
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          ) : null}
          {data.finance ? (
            <Card>
              <CardHeader title="Saldos realizados por conta" description="Saldo inicial + movimentos efetivos até hoje." />
              <ul className="divide-y divide-border">
                {data.finance.accounts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate">{a.name}</span>
                      <span className="block text-xs text-subtle">{ACCOUNT_KIND_LABEL[a.kind as keyof typeof ACCOUNT_KIND_LABEL]}</span>
                    </span>
                    <span className={a.balanceCents < 0 ? "font-medium tabular text-danger" : "font-medium tabular"}>{formatBRL(a.balanceCents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {data.unscheduledItems !== null ? (
            <Card>
              <CardHeader title="Procedimentos aprovados sem agendamento" />
              <CardBody>
                <p className="text-2xl font-semibold tabular">{data.unscheduledItems}</p>
                <Link href="/orcamentos/nao-agendados" className="mt-2 inline-flex min-h-10 items-center text-sm text-accent hover:underline cursor-pointer">
                  Ver lista
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
