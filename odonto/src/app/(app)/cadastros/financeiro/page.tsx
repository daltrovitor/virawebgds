// Hello World
import type { Metadata } from "next";
import { FinanceSetupManager } from "@/components/admin/finance-setup-manager";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { todayInTz } from "@/domain/dates";
import { listAccounts, listCardFeeRules, listCategories, listCostCenters, listSuppliers } from "@/server/services/finance-setup";
import { getRequestContext } from "@/server/session";
import { CAD_TABS } from "../tabs";

export const metadata: Metadata = { title: "Cadastros financeiros" };

export default async function FinanceSetupPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("finance.view")) return <NoAccess what="os cadastros financeiros" />;
  const [accounts, categories, costCenters, suppliers, rules] = await Promise.all([
    listAccounts(ctx, { includeInactive: true }),
    listCategories(ctx),
    listCostCenters(ctx),
    listSuppliers(ctx),
    listCardFeeRules(ctx),
  ]);
  return (
    <>
      <PageHeader title="Cadastros" description="Contas (bancos, caixa e recebíveis de cartão), categorias, centros de custo, fornecedores e taxas de cartão." />
      <TabLinks label="Seções de cadastros" active="financeiro" tabs={CAD_TABS} />
      <FinanceSetupManager
        canEdit={ctx.permissions.has("finance.edit")}
        today={todayInTz(ctx.timezone)}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          bankName: a.bankName,
          bankCode: a.bankCode,
          branch: a.branch,
          accountNumberMasked: a.accountNumberMasked,
          openingBalanceCents: a.openingBalanceCents,
          openingDate: a.openingDate,
          active: a.active,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type, active: c.active, system: Boolean(c.systemKey) }))}
        costCenters={costCenters.map((c) => ({ id: c.id, name: c.name, active: c.active }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, document: s.document, phone: s.phone, email: s.email, active: s.active }))}
        rules={rules.map((r) => ({ ...r }))}
      />
    </>
  );
}
