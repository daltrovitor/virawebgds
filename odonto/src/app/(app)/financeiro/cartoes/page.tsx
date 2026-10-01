// Hello World
import type { Metadata } from "next";
import { CardReceivablesTable } from "@/components/finance/card-receivables";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { listAccounts, listCardFeeRules } from "@/server/services/finance-setup";
import { listCardReceivables } from "@/server/services/titles";
import { getRequestContext } from "@/server/session";
import { FIN_TABS } from "../tabs";

export const metadata: Metadata = { title: "Cartões" };

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.view")) return <NoAccess what="o financeiro" />;
  const sp = await searchParams;
  const [rows, accounts, rules] = await Promise.all([listCardReceivables(ctx, { status: sp.todos ? "all" : "pending" }), listAccounts(ctx), listCardFeeRules(ctx)]);
  const pending = rows.filter((r) => r.receivable.status === "pending");
  const gross = pending.reduce((s, r) => s + r.receivable.grossCents, 0);
  const fee = pending.reduce((s, r) => s + r.receivable.feeCents, 0);
  return (
    <>
      <PageHeader
        title="Recebíveis de cartão"
        description="A venda no cartão quita o título do paciente (receita contada uma vez). O banco só é movimentado quando a operadora liquida; taxas viram despesa."
      />
      <TabLinks label="Seções do financeiro" active="cartoes" tabs={FIN_TABS} />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Bruto a liquidar" value={formatBRL(gross)} />
        <Stat label="Taxas previstas" value={formatBRL(fee)} />
        <Stat label="Líquido previsto" value={formatBRL(gross - fee)} tone="accent" />
      </div>
      <CardReceivablesTable
        rows={rows.map((r) => ({
          id: r.receivable.id,
          acquirer: r.tx.acquirer,
          brand: r.tx.brand,
          paymentType: r.tx.paymentType,
          installmentNumber: r.receivable.installmentNumber,
          installments: r.tx.installments,
          transactionDate: r.tx.transactionDate,
          expectedDate: r.receivable.expectedDate,
          grossCents: r.receivable.grossCents,
          feeCents: r.receivable.feeCents,
          netCents: r.receivable.netCents,
          status: r.receivable.status,
          settledOn: r.receivable.settledOn,
          anticipationFeeCents: r.receivable.anticipationFeeCents,
        }))}
        banks={accounts.filter((a) => a.kind === "bank" || a.kind === "other").map((a) => ({ id: a.id, name: a.name }))}
        canSettle={ctx.permissions.has("finance.settle")}
        today={todayInTz(ctx.timezone)}
        showAll={Boolean(sp.todos)}
      />
      <Card className="mt-6">
        <CardHeader title="Taxas cadastradas" description="Usadas como referência; o valor real é confirmado em cada transação. Edite em Cadastros › Financeiro." />
        <ul className="divide-y divide-border">
          {rules.length === 0 ? <li className="px-5 py-3 text-sm text-muted">Nenhuma taxa cadastrada.</li> : null}
          {rules.map((r) => (
            <li key={r.id} className="px-4 py-2.5 text-sm sm:px-5">
              {r.acquirer} · {r.paymentType === "credit" ? "Crédito" : "Débito"} {r.installmentsFrom}–{r.installmentsTo}x · {(r.feeBasisPoints / 100).toFixed(2).replace(".", ",")}% · D+{r.settlementDays}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
