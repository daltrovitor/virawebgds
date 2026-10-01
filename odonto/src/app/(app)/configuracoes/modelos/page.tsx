// Hello World
import type { Metadata } from "next";
import { TemplatesEditor } from "@/components/admin/templates-editor";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { listTemplates } from "@/server/services/documents";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Modelos de documento" };

export default async function TemplatesPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("settings.manage")) return <NoAccess what="modelos de documento" />;
  const templates = await listTemplates(ctx);
  return (
    <>
      <PageHeader title="Configurações" description="Modelos configuráveis com campos entre chaves duplas. Revise com assessoria jurídica; o sistema não declara validade jurídica automática." />
      <TabLinks label="Seções de configurações" active="modelos" tabs={visibleCfgTabs(ctx.permissions)} />
      <TemplatesEditor templates={templates.map((t) => ({ id: t.id, kind: t.kind, name: t.name, body: t.body, version: t.version }))} />
    </>
  );
}
