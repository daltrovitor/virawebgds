// Hello World
import type { Metadata } from "next";
import { PriceGrid } from "@/components/admin/price-grid";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { listPrices, listPriceTables, listProcedures } from "@/server/services/catalog";
import { getRequestContext } from "@/server/session";
import { CAD_TABS } from "../tabs";

export const metadata: Metadata = { title: "Tabelas de preço" };

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ tabela?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("catalog.manage")) return <NoAccess what="tabelas de preço" />;
  const sp = await searchParams;
  const tables = await listPriceTables(ctx, { includeInactive: true });
  const table = tables.find((t) => t.id === sp.tabela) ?? tables.find((t) => t.isDefault) ?? tables[0];
  const [procedures, prices] = await Promise.all([listProcedures(ctx), table ? listPrices(ctx, table.id) : []]);
  return (
    <>
      <PageHeader title="Cadastros" description="Alterar a tabela não recalcula orçamentos já salvos; novas inclusões usam o preço vigente. Sem linha = preço não cadastrado (diferente de R$ 0,00, que é gratuidade deliberada)." />
      <TabLinks label="Seções de cadastros" active="precos" tabs={CAD_TABS} />
      <PriceGrid
        tables={tables.map((t) => ({ id: t.id, name: t.name, isDefault: t.isDefault, active: t.active }))}
        tableId={table?.id ?? null}
        procedures={procedures.map(({ procedure: p, specialtyName }) => ({ id: p.id, code: p.code, name: p.name, specialtyName }))}
        prices={Object.fromEntries(prices.map((p) => [p.procedureId, p.priceCents]))}
      />
    </>
  );
}
