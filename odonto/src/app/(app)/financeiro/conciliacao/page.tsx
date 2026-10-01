// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { OfxUpload } from "@/components/finance/ofx-upload";
import { ReconciliationWorkspace } from "@/components/finance/reconciliation-workspace";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, Notice, PageHeader, TabLinks } from "@/components/ui/page";
import { addDays, formatDateBR, isValidCivil, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { listImportBatches, reconciliationWorkspace } from "@/server/services/bank";
import { listAccounts } from "@/server/services/finance-setup";
import { getRequestContext } from "@/server/session";
import { FIN_TABS } from "../tabs";

export const metadata: Metadata = { title: "Conciliação bancária" };

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ conta?: string; from?: string; to?: string; status?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.reconcile")) return <NoAccess what="a conciliação bancária" />;
  const sp = await searchParams;
  const today = todayInTz(ctx.timezone);
  const accounts = (await listAccounts(ctx)).filter((a) => a.kind !== "card_clearing");
  const accountId = accounts.find((a) => a.id === sp.conta)?.id ?? accounts.find((a) => a.kind === "bank")?.id ?? accounts[0]?.id;
  const from = sp.from && isValidCivil(sp.from) ? sp.from : addDays(today, -60);
  const to = sp.to && isValidCivil(sp.to) ? sp.to : today;
  const status = sp.status === "reconciled" || sp.status === "ignored" || sp.status === "all" ? sp.status : "pending";
  const [ws, batches] = await Promise.all([
    accountId ? reconciliationWorkspace(ctx, { accountId, from, to, status }) : null,
    listImportBatches(ctx, accountId),
  ]);
  const diff = ws?.bankKnown ? ws.bankKnown.bankBalanceCents - ws.bankKnown.internalBalanceCents : null;
  return (
    <>
      <PageHeader
        title="Conciliação bancária"
        description="O extrato importado não vira receita sozinho. Cada vínculo é confirmado por você; sugestões mostram o motivo. Conciliar não significa quitar tudo."
      />
      <TabLinks label="Seções do financeiro" active="conciliacao" tabs={FIN_TABS} />
      {accounts.length === 0 ? (
        <EmptyState title="Cadastre uma conta bancária" description="Em Cadastros › Financeiro › Contas." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.618fr_1fr]">
            <Card>
              <CardHeader title="Conta e período" />
              <CardBody>
                <form className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
                  <div className="sm:col-span-2">
                    <label htmlFor="conta" className="mb-1.5 block text-sm font-medium">
                      Conta
                    </label>
                    <select id="conta" name="conta" defaultValue={accountId} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm">
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                    <label htmlFor="status" className="mb-1.5 block text-sm font-medium">
                      Extrato
                    </label>
                    <select id="status" name="status" defaultValue={status} className="h-10 w-full rounded-md border border-border-strong px-2 text-sm">
                      <option value="pending">Pendentes</option>
                      <option value="reconciled">Conciliados</option>
                      <option value="ignored">Ignorados</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                  <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer sm:col-span-5 sm:justify-self-end">
                    Aplicar
                  </button>
                </form>
                {ws ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-subtle">Saldo bancário conhecido</p>
                      <p className="font-medium tabular">{ws.bankKnown ? `${formatBRL(ws.bankKnown.bankBalanceCents)} em ${formatDateBR(ws.bankKnown.date)}` : "Não informado pelo extrato"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">Saldo interno na mesma data</p>
                      <p className="font-medium tabular">{ws.bankKnown ? formatBRL(ws.bankKnown.internalBalanceCents) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-subtle">Divergência</p>
                      <p className={diff === null ? "font-medium" : diff === 0 ? "font-medium text-success" : "font-medium text-danger"}>
                        {diff === null ? "—" : diff === 0 ? "Sem divergência" : formatBRL(diff)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Importar extrato OFX" description="Prévia antes de confirmar. Reimportar não duplica." />
              <CardBody>
                <OfxUpload accountId={accountId!} />
                {batches.length > 0 ? (
                  <ul className="mt-4 space-y-1 text-xs text-muted">
                    {batches.slice(0, 5).map((b) => (
                      <li key={b.batch.id} className="flex flex-wrap items-center gap-2">
                        <Link href={`/financeiro/conciliacao/importacao/${b.batch.id}`} className="text-accent hover:underline cursor-pointer">
                          {b.batch.fileName}
                        </Link>
                        <Badge tone={b.batch.status === "confirmed" ? "success" : b.batch.status === "preview" ? "warning" : "neutral"}>
                          {b.batch.status === "confirmed" ? "Importado" : b.batch.status === "preview" ? "Aguardando confirmação" : "Descartado"}
                        </Badge>
                        {b.batch.status === "confirmed" ? `${b.batch.newCount} nova(s), ${b.batch.duplicateCount} ignorada(s)` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          </div>
          {ws && ws.bank.length === 0 && status === "pending" ? (
            <Notice tone="success" className="mb-6">
              Nenhuma movimentação pendente no período para esta conta.
            </Notice>
          ) : null}
          {ws ? (
            <ReconciliationWorkspace
              accountId={ws.account.id}
              bank={ws.bank.map((b) => ({
                id: b.id,
                postedOn: b.postedOn,
                amountCents: b.amountCents,
                openAmountCents: b.openAmountCents,
                description: b.description,
                status: b.status,
                ambiguous: b.ambiguous,
                ignoreReason: b.ignoreReason,
                suggestions: b.suggestions,
                reconciliationIds: [...new Set(ws.allocations.filter((a) => a.allocation.bankTransactionId === b.id && a.reconciliation.status === "active").map((a) => a.reconciliation.id))],
              }))}
              movements={ws.movements.map((m) => ({ id: m.id, occurredOn: m.occurredOn, amountCents: m.amountCents, openAmountCents: m.openAmountCents, description: m.description, kind: m.kind }))}
              canSettle={ctx.permissions.has("finance.settle")}
              canCreate={ctx.permissions.has("finance.edit")}
            />
          ) : null}
        </>
      )}
    </>
  );
}
