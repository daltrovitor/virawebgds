// Hello World
import type { Metadata } from "next";
import { RecurrencesPanel } from "@/components/finance/recurrences-panel";
import { TitleFilters } from "@/components/finance/title-filters";
import { TitlesManager } from "@/components/finance/titles-manager";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { isValidCivil, todayInTz } from "@/domain/dates";
import { listAccounts, listCategories, listCostCenters, listSuppliers } from "@/server/services/finance-setup";
import { listRecurrences, listTitles } from "@/server/services/titles";
import { getRequestContext } from "@/server/session";
import { FIN_TABS } from "../tabs";

export const metadata: Metadata = { title: "Contas a pagar" };

const STATUSES = ["open_all", "overdue", "paid", "cancelled", "all"] as const;

export default async function PayablesPage({ searchParams }: { searchParams: Promise<{ status?: string; from?: string; to?: string; q?: string; page?: string }> }) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.view")) return <NoAccess what="o financeiro" />;
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : "open_all";
  const from = sp.from && isValidCivil(sp.from) ? sp.from : undefined;
  const to = sp.to && isValidCivil(sp.to) ? sp.to : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const [list, accounts, categories, costCenters, suppliers, recurrences] = await Promise.all([
    listTitles(ctx, { kind: "payable", status, from, to, q: sp.q ?? "", page, pageSize: 50 }),
    listAccounts(ctx),
    listCategories(ctx, "expense"),
    listCostCenters(ctx),
    listSuppliers(ctx),
    listRecurrences(ctx),
  ]);
  const baseQuery = new URLSearchParams({ status, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(sp.q ? { q: sp.q } : {}) }).toString();
  const today = todayInTz(ctx.timezone);
  const cats = categories.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHeader title="Contas a pagar" description="Competência, vencimento e pagamento são datas distintas. Recorrências futuras não alteram o saldo realizado." />
      <TabLinks label="Seções do financeiro" active="pagar" tabs={FIN_TABS} />
      <TitleFilters status={status} from={from} to={to} q={sp.q} />
      <TitlesManager
        kind="payable"
        items={list.items.map((t) => ({
          id: t.id,
          description: t.description,
          counterpart: t.counterpart,
          categoryName: t.categoryName,
          dueDate: t.dueDate,
          competenceDate: t.competenceDate,
          totalCents: t.originalCents + t.adjustmentCents,
          balanceCents: t.balanceCents,
          status: t.status,
          overdue: t.overdue,
          expectedMethod: null,
        }))}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        baseQuery={baseQuery}
        accounts={accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
        categories={cats}
        costCenters={costCenters.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
        suppliers={suppliers.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
        canSettle={ctx.permissions.has("finance.settle")}
        canEdit={ctx.permissions.has("finance.edit")}
        canExport={ctx.permissions.has("finance.export")}
        today={today}
      />
      <div className="mt-6">
        <RecurrencesPanel
          canEdit={ctx.permissions.has("finance.edit")}
          today={today}
          categories={cats}
          suppliers={suppliers.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))}
          recurrences={recurrences.map((r) => ({
            id: r.recurrence.id,
            description: r.recurrence.description,
            amountCents: r.recurrence.amountCents,
            dayOfMonth: r.recurrence.dayOfMonth,
            startDate: r.recurrence.startDate,
            endDate: r.recurrence.endDate,
            suspended: Boolean(r.recurrence.suspendedAt),
            supplierName: r.supplierName,
            categoryName: r.categoryName,
          }))}
        />
      </div>
    </>
  );
}
