// Hello World
import type { Metadata } from "next";
import { AnamnesisEditor } from "@/components/admin/anamnesis-editor";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { activeAnamnesisTemplate } from "@/server/services/clinical";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Questionário de anamnese" };

export default async function AnamnesisSettingsPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("settings.manage")) return <NoAccess what="o questionário de anamnese" />;
  const tpl = await activeAnamnesisTemplate(ctx);
  return (
    <>
      <PageHeader title="Configurações" description="Editar cria uma nova versão; respostas antigas continuam ligadas à versão usada." />
      <TabLinks label="Seções de configurações" active="anamnese" tabs={visibleCfgTabs(ctx.permissions)} />
      <AnamnesisEditor version={tpl?.version ?? 0} questions={tpl?.questions ?? []} />
    </>
  );
}
