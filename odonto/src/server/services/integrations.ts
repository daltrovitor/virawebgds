import { and, asc, eq } from "drizzle-orm";
import { audit } from "../audit";
import { assertCan, type Ctx } from "../context";
import { INTEGRATION_KINDS, integrationSettings, organizations } from "../db/schema";
import { BusinessRuleError } from "../errors";

/**
 * Contratos de integração substituíveis. Nenhuma integração é simulada como
 * ativa: sem provedor e credenciais válidas, o estado é sempre "não configurada".
 */
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];
export type IntegrationStatus = "not_configured" | "pending" | "active" | "error" | "revoked" | "expired";

export const INTEGRATION_LABEL: Record<IntegrationKind, { name: string; description: string }> = {
  open_finance: { name: "Conexão bancária (Open Finance)", description: "Sincronização automática de extratos. Até lá, use a importação OFX." },
  messaging: { name: "WhatsApp / SMS", description: "Envio automático de lembretes e confirmações de consulta." },
  email: { name: "E-mail transacional", description: "Convites de usuários e recuperação de senha." },
  payments: { name: "Cobrança (Pix, boleto, link de cartão)", description: "Emissão e confirmação de cobranças." },
  fiscal: { name: "Notas fiscais", description: "Emissão de NFS-e quando contratada." },
  esign: { name: "Assinatura eletrônica", description: "Assinatura de contratos e termos." },
  accounting: { name: "Contabilidade / ERP", description: "Exportação contábil ou integração com ERP externo." },
};

export const INTEGRATION_STATUS_LABEL: Record<IntegrationStatus, string> = {
  not_configured: "Não configurada",
  pending: "Aguardando autorização",
  active: "Ativa",
  error: "Com erro",
  revoked: "Revogada",
  expired: "Expirada",
};

/** Credenciais por ambiente: só e-mail tem provedor implementado (Resend); demais aguardam contratação. */
export function providerCredentialsPresent(kind: IntegrationKind): boolean {
  switch (kind) {
    case "email":
      return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    default:
      return false;
  }
}

export interface MessagingProvider {
  send(input: { to: string; body: string; channel: "whatsapp" | "sms" }): Promise<{ providerMessageId: string }>;
}

export interface BankSyncProvider {
  authorize(accountId: string): Promise<{ redirectUrl: string }>;
  sync(accountId: string, from: string, to: string): Promise<{ transactions: { externalId: string; postedOn: string; amountCents: number; description: string }[] }>;
}

export async function listIntegrations(ctx: Ctx) {
  assertCan(ctx, "settings.manage");
  const rows = await ctx.db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.organizationId, ctx.orgId))
    .orderBy(asc(integrationSettings.kind));
  return INTEGRATION_KINDS.map((kind) => {
    const row = rows.find((r) => r.kind === kind);
    const credentials = providerCredentialsPresent(kind);
    // Estado efetivo: sem credencial, nunca aparece como ativa ou sincronizada.
    const stored = (row?.status ?? "not_configured") as IntegrationStatus;
    const effective: IntegrationStatus = credentials ? stored : "not_configured";
    return {
      kind,
      ...INTEGRATION_LABEL[kind],
      status: effective,
      statusLabel: INTEGRATION_STATUS_LABEL[effective],
      provider: credentials ? (row?.provider ?? null) : null,
      lastSyncAt: credentials ? (row?.lastSyncAt ?? null) : null,
      lastError: row?.lastError ?? null,
      credentialsPresent: credentials,
    };
  });
}

export async function effectiveIntegrationStatus(ctx: Pick<Ctx, "db" | "orgId">, kind: IntegrationKind): Promise<IntegrationStatus> {
  if (!providerCredentialsPresent(kind)) return "not_configured";
  const [row] = await ctx.db
    .select({ status: integrationSettings.status })
    .from(integrationSettings)
    .where(and(eq(integrationSettings.organizationId, ctx.orgId), eq(integrationSettings.kind, kind)));
  return (row?.status ?? "not_configured") as IntegrationStatus;
}

/**
 * Ativação manual só é aceita quando há credenciais do provedor no ambiente e
 * nunca em clínica de demonstração (dados de teste não disparam envios reais).
 */
export async function setIntegrationStatus(ctx: Ctx, kind: IntegrationKind, status: IntegrationStatus, provider: string | null) {
  assertCan(ctx, "settings.manage");
  if (status === "active") {
    if (!providerCredentialsPresent(kind)) throw new BusinessRuleError("Integração sem credenciais configuradas não pode ser ativada");
    const [org] = await ctx.db.select({ isDemo: organizations.isDemo }).from(organizations).where(eq(organizations.id, ctx.orgId));
    if (org?.isDemo !== false) throw new BusinessRuleError("Clínica de demonstração não ativa integrações reais");
  }
  await ctx.db
    .update(integrationSettings)
    .set({ status, provider, updatedAt: new Date(), updatedBy: ctx.userId })
    .where(and(eq(integrationSettings.organizationId, ctx.orgId), eq(integrationSettings.kind, kind)));
  await audit(ctx.db, ctx, { action: "integration.status", entityType: "integration", entityId: kind, summary: `Integração ${INTEGRATION_LABEL[kind].name}: ${INTEGRATION_STATUS_LABEL[status]}` });
}
