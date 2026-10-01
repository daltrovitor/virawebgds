// Hello World
import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, PageHeader, Pagination, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDateTimeBR } from "@/domain/dates";
import { listAuditLogs } from "@/server/audit";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Auditoria" };

const ENTITY: Record<string, string> = {
  patient: "Paciente",
  budget: "Orçamento",
  settlement: "Baixa",
  receivable: "A receber",
  payable: "A pagar",
  appointment: "Consulta",
  price_table_item: "Preço",
  procedure: "Procedimento",
  clinical_note: "Registro clínico",
  reconciliation: "Conciliação",
  role: "Permissões",
  membership: "Acesso",
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; tipo?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("audit.view")) return <NoAccess what="a auditoria" />;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await listAuditLogs(ctx, { page, entityType: sp.tipo && sp.tipo in ENTITY ? sp.tipo : null });
  return (
    <>
      <PageHeader title="Configurações" description="Registro somente de inclusão: preços, aprovações, registros clínicos, permissões, baixas, estornos e conciliações. Conteúdo clínico não é copiado para a auditoria." />
      <TabLinks label="Seções de configurações" active="auditoria" tabs={visibleCfgTabs(ctx.permissions)} />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <label htmlFor="tipo" className="mb-1.5 block text-sm font-medium">
              Tipo
            </label>
            <select id="tipo" name="tipo" defaultValue={sp.tipo ?? ""} className="h-10 rounded-md border border-border-strong px-2 text-sm">
              <option value="">Todos</option>
              {Object.entries(ENTITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
            Filtrar
          </button>
        </form>
        {res.items.length === 0 ? (
          <EmptyState title="Nenhum registro" />
        ) : (
          <TableWrap label="Auditoria">
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Usuário</Th>
                  <Th>Tipo</Th>
                  <Th>Ação</Th>
                  <Th>Resumo</Th>
                </tr>
              </thead>
              <tbody>
                {res.items.map((r) => (
                  <Tr key={r.log.id}>
                    <Td className="tabular whitespace-nowrap">{formatDateTimeBR(r.log.createdAt, ctx.timezone)}</Td>
                    <Td>{r.userName ?? "—"}</Td>
                    <Td>{ENTITY[r.log.entityType] ?? r.log.entityType}</Td>
                    <Td className="text-xs text-muted">{r.log.action}</Td>
                    <Td className="max-w-lg">{r.log.summary}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination page={res.page} pageSize={res.pageSize} total={res.total} hrefFor={(p) => `?${new URLSearchParams({ ...(sp.tipo ? { tipo: sp.tipo } : {}), page: String(p) })}`} />
      </Card>
    </>
  );
}
