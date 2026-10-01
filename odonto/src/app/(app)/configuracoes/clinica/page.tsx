// Hello World
import type { Metadata } from "next";
import { ClinicSettingsForm } from "@/components/admin/clinic-settings-form";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { getSettings } from "@/server/services/organizations";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Configurações da clínica" };

export default async function ClinicSettingsPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("settings.manage")) return <NoAccess what="as configurações" />;
  const s = await getSettings(ctx);
  return (
    <>
      <PageHeader title="Configurações" description="Identidade, contatos, fuso, grade da agenda e expediente. Tudo editável por clínica." />
      <TabLinks label="Seções de configurações" active="clinica" tabs={visibleCfgTabs(ctx.permissions)} />
      <ClinicSettingsForm
        initial={{
          displayName: s.displayName,
          legalName: s.legalName ?? "",
          document: s.document ?? "",
          phone: s.phone ?? "",
          email: s.email ?? "",
          address: s.address ?? "",
          city: s.city ?? "",
          state: s.state ?? "",
          brandColor: s.brandColor,
          timezone: s.timezone,
          slotMinutes: s.slotMinutes,
          uploadMaxMb: s.uploadMaxMb,
          budgetValidityDays: s.budgetValidityDays,
          businessHours: s.businessHours,
        }}
      />
    </>
  );
}
