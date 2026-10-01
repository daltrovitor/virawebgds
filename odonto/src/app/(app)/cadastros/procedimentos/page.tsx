// Hello World
import type { Metadata } from "next";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import type { BillingUnit, LocationKind } from "@/domain/budget";
import { listProcedures, listSpecialties } from "@/server/services/catalog";
import { getRequestContext } from "@/server/session";
import { CAD_TABS } from "../tabs";

export const metadata: Metadata = { title: "Especialidades e procedimentos" };

export default async function ProceduresPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("catalog.manage")) return <NoAccess what="o catálogo de procedimentos" />;
  const [specialties, procedures] = await Promise.all([listSpecialties(ctx, { includeInactive: true }), listProcedures(ctx, { includeInactive: true })]);
  return (
    <>
      <PageHeader title="Cadastros" description="Especialidade → procedimentos → preço nas tabelas. Inativar preserva o histórico; nada é apagado." />
      <TabLinks label="Seções de cadastros" active="procedimentos" tabs={CAD_TABS} />
      <CatalogManager
        specialties={specialties.map((s) => ({ id: s.id, name: s.name, active: s.active }))}
        procedures={procedures.map(({ procedure: p, specialtyName }) => ({
          id: p.id,
          specialtyId: p.specialtyId,
          specialtyName,
          code: p.code,
          name: p.name,
          description: p.description,
          billingUnit: p.billingUnit as BillingUnit,
          allowedLocations: p.allowedLocations as LocationKind[],
          suggestedMinutes: p.suggestedMinutes,
          active: p.active,
        }))}
      />
    </>
  );
}
