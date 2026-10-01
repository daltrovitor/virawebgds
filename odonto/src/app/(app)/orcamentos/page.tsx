// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, PageHeader, Pagination, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { BUDGET_STATUS_LABEL, BUDGET_STATUSES } from "@/domain/budget";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { budgetBadge } from "@/lib/status";
import { listBudgets } from "@/server/services/budgets";
import { getRequestContext } from "@/server/session";
import { ORC_TABS } from "./tabs";

export const metadata: Metadata = { title: "Orçamentos e tratamentos" };

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("budgets.view")) return <NoAccess what="orçamentos" />;
  const sp = await searchParams;
  const status = (BUDGET_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof BUDGET_STATUSES)[number]) : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const list = await listBudgets(ctx, { q: sp.q ?? "", status, page, pageSize: 25 });
  const showAgreed = ctx.permissions.has("finance.view") || ctx.permissions.has("budgets.approve");
  return (
    <>
      <PageHeader title="Orçamentos e tratamentos" description="Orçamentos são montados dentro da ficha do paciente. Aqui você acompanha todos." />
      <TabLinks label="Seções" active="orcamentos" tabs={ORC_TABS} />
      <Card>
        <form className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:px-5" role="search">
          <div className="flex-1">
            <label htmlFor="q" className="mb-1.5 block text-sm font-medium">
              Paciente ou número
            </label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} className="h-10 w-full rounded-md border border-border-strong px-3 text-sm focus:border-accent focus:outline-2 focus:outline-accent/30" />
          </div>
          <div className="sm:w-56">
            <label htmlFor="status" className="mb-1.5 block text-sm font-medium">
              Situação
            </label>
            <select id="status" name="status" defaultValue={status} className="h-10 w-full rounded-md border border-border-strong px-3 text-sm">
              <option value="all">Todas</option>
              {BUDGET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BUDGET_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
            Filtrar
          </button>
        </form>
        {list.items.length === 0 ? (
          <EmptyState title="Nenhum orçamento encontrado" description="Crie orçamentos pela ficha do paciente (botão “Novo orçamento”)." />
        ) : (
          <TableWrap label="Orçamentos">
            <Table>
              <thead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Paciente</Th>
                  <Th>Data</Th>
                  <Th>Responsável</Th>
                  <Th>Situação</Th>
                  <Th align="right">Orçado</Th>
                  {showAgreed ? <Th align="right">Acordo</Th> : null}
                </tr>
              </thead>
              <tbody>
                {list.items.map((b) => {
                  const badge = budgetBadge(b.status);
                  return (
                    <Tr key={b.id}>
                      <Td className="tabular">
                        <Link href={`/pacientes/${b.patientId}/orcamentos/${b.id}`} className="font-medium hover:underline cursor-pointer">
                          {b.number}
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/pacientes/${b.patientId}`} className="hover:underline cursor-pointer">
                          {b.patientName}
                        </Link>
                      </Td>
                      <Td className="tabular">{formatDateBR(b.budgetDate)}</Td>
                      <Td>{b.professionalName ?? "—"}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          {b.revisionOpen ? <Badge tone="warning">Em revisão</Badge> : null}
                        </div>
                      </Td>
                      <Td align="right">{formatBRL(b.subtotalCents)}</Td>
                      {showAgreed ? <Td align="right">{b.agreedTotalCents === null ? "—" : formatBRL(b.agreedTotalCents)}</Td> : null}
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination page={list.page} pageSize={list.pageSize} total={list.total} hrefFor={(p) => `/orcamentos?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), status, page: String(p) })}`} />
      </Card>
    </>
  );
}
