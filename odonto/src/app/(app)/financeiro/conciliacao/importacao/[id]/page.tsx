// Hello World
import type { Metadata } from "next";
import { ImportPreview } from "@/components/finance/import-preview";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { getImportBatch } from "@/server/services/bank";
import { getAccount } from "@/server/services/finance-setup";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Prévia da importação" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.reconcile")) return <NoAccess what="a conciliação" />;
  const { id } = await params;
  const { batch, lines, errors, warnings } = await getImportBatch(ctx, id);
  const account = await getAccount(ctx.db, ctx.orgId, batch.accountId);
  return (
    <>
      <PageHeader
        title={`Importação: ${batch.fileName}`}
        back={{ href: `/financeiro/conciliacao?conta=${batch.accountId}`, label: "Conciliação" }}
        description={`Conta ${account.name} · arquivo ${batch.accountRefMasked ?? "sem identificação"} · período ${batch.periodStart ? formatDateBR(batch.periodStart) : "?"} a ${batch.periodEnd ? formatDateBR(batch.periodEnd) : "?"}${batch.ledgerBalanceCents !== null ? ` · saldo informado ${formatBRL(batch.ledgerBalanceCents)}${batch.ledgerBalanceDate ? ` em ${formatDateBR(batch.ledgerBalanceDate)}` : ""}` : ""}`}
      />
      <ImportPreview batchId={batch.id} accountId={batch.accountId} status={batch.status} lines={lines} errors={errors} warnings={warnings} />
    </>
  );
}
