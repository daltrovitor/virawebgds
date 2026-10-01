// Hello World
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { Notice, PageHeader, TabLinks } from "@/components/ui/page";
import { formatDateTimeBR } from "@/domain/dates";
import { listIntegrations } from "@/server/services/integrations";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Integrações" };

export default async function IntegrationsPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("settings.manage")) return <NoAccess what="integrações" />;
  const list = await listIntegrations(ctx);
  return (
    <>
      <PageHeader title="Configurações" description="Integrações externas são etapas posteriores. Nenhuma aparece como conectada sem credenciais reais e teste autorizado." />
      <TabLinks label="Seções de configurações" active="integracoes" tabs={visibleCfgTabs(ctx.permissions)} />
      <Notice tone="info" className="mb-6">
        O núcleo financeiro funciona sem fornecedor externo: importação OFX e conciliação assistida já estão disponíveis. Lembretes ficam registrados como pendentes e não são enviados enquanto a integração de mensagens não estiver ativa.
      </Notice>
      <Card>
        <CardHeader title="Integrações" />
        <ul className="divide-y divide-border">
          {list.map((i) => (
            <li key={i.kind} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5">
              <span className="text-sm">
                <span className="font-medium">{i.name}</span>
                <span className="block text-xs text-muted">{i.description}</span>
                {i.lastSyncAt ? <span className="block text-xs text-subtle">Última sincronização: {formatDateTimeBR(i.lastSyncAt, ctx.timezone)}</span> : null}
              </span>
              <Badge tone={i.status === "active" ? "success" : i.status === "error" ? "danger" : "neutral"}>{i.statusLabel}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
