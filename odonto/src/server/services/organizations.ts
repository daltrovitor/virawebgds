import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_BUSINESS_HOURS } from "@/domain/appointments";
import { DEFAULT_ROLE_PERMISSIONS, ROLE_LABEL, SYSTEM_ROLES } from "@/domain/permissions";
import { audit } from "../audit";
import { assertCan, type Ctx } from "../context";
import type { Db, Tx } from "../db/client";
import {
  anamnesisTemplates,
  costCenters,
  documentTemplates,
  financialAccounts,
  financialCategories,
  INTEGRATION_KINDS,
  integrationSettings,
  memberships,
  organizationSettings,
  organizations,
  priceTables,
  roles,
  specialties,
  type AnamnesisQuestion,
} from "../db/schema";
import { NotFoundError } from "../errors";
import { parseInput, zOptionalText, zRequiredText } from "../validation";

export const DEFAULT_SPECIALTIES = [
  "Prótese",
  "Dentística",
  "Implantodontia",
  "Endodontia",
  "Periodontia",
  "Ortodontia",
  "Radiologia",
  "Clínica geral",
];

export const DEFAULT_CATEGORIES: { name: string; type: "income" | "expense"; systemKey?: string }[] = [
  { name: "Tratamentos odontológicos", type: "income", systemKey: "treatment_revenue" },
  { name: "Outras receitas", type: "income", systemKey: "other_income" },
  { name: "Taxas de cartão", type: "expense", systemKey: "card_fees" },
  { name: "Encargos de antecipação", type: "expense", systemKey: "card_anticipation" },
  { name: "Tarifas bancárias", type: "expense", systemKey: "bank_fees" },
  { name: "Aluguel e condomínio", type: "expense" },
  { name: "Materiais odontológicos", type: "expense" },
  { name: "Laboratório de prótese", type: "expense" },
  { name: "Salários e encargos", type: "expense" },
  { name: "Impostos e taxas", type: "expense" },
  { name: "Outras despesas", type: "expense", systemKey: "other_expense" },
];

export const DEFAULT_ANAMNESIS: AnamnesisQuestion[] = [
  { id: "tratamento_medico", label: "Está em tratamento médico atualmente?", type: "yes_no_details", alertOnYes: true },
  { id: "medicamentos", label: "Faz uso contínuo de medicamentos?", type: "yes_no_details", alertOnYes: true },
  { id: "alergias", label: "Tem alergia a medicamentos, látex ou outros materiais?", type: "yes_no_details", alertOnYes: true },
  { id: "cardiaco", label: "Tem ou já teve problemas cardíacos?", type: "yes_no_details", alertOnYes: true },
  { id: "pressao", label: "Tem pressão alta?", type: "yes_no", alertOnYes: true },
  { id: "diabetes", label: "Tem diabetes?", type: "yes_no", alertOnYes: true },
  { id: "anestesia", label: "Já teve reação à anestesia odontológica?", type: "yes_no_details", alertOnYes: true },
  { id: "sangramento", label: "Tem tendência a sangramento ou usa anticoagulante?", type: "yes_no_details", alertOnYes: true },
  { id: "gestacao", label: "Está grávida ou amamentando?", type: "yes_no", alertOnYes: true },
  { id: "fumante", label: "Fuma?", type: "yes_no" },
  { id: "observacoes", label: "Outras informações de saúde que deseja registrar", type: "text" },
];

export const DEFAULT_CONTRACT = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS — MODELO EDITÁVEL

Clínica: {{clinica.nome}}
Paciente: {{paciente.nome}}
Responsável financeiro: {{responsavel.nome}}

Orçamento nº {{orcamento.numero}}, aprovado em {{acordo.data}}.
Procedimentos contratados:
{{acordo.itens}}

Valor total negociado: {{acordo.total}}
Condições de pagamento:
{{acordo.parcelas}}

Este texto é um modelo configurável pela clínica e deve ser revisado por assessoria jurídica antes do uso. A geração do documento não implica assinatura nem validade jurídica automática.

{{cidade}}, {{data}}.

______________________________          ______________________________
Paciente / responsável                   {{clinica.nome}}`;

export const DEFAULT_RECEIPT = `RECIBO

Recebemos de {{paciente.nome}} a quantia de {{recibo.valor}} ({{recibo.forma}}), referente a {{recibo.referencia}}, em {{recibo.data}}.

Este recibo reflete apenas valores efetivamente recebidos e não substitui documento fiscal.

{{clinica.nome}}`;

/** Razão de contraste WCAG entre a cor e o branco. */
export function contrastWithWhite(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  return 1.05 / (lum + 0.05);
}

const createOrgSchema = z.object({
  name: zRequiredText("Nome da clínica", 200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,60}$/, { message: "Use letras minúsculas, números e hífen (3–60)" }),
  timezone: z.string().default("America/Sao_Paulo"),
  isDemo: z.boolean().default(false),
  ownerUserId: z.uuid(),
});

/** Cria clínica com configuração inicial editável. Usado no onboarding e nos seeds. */
export async function createOrganization(db: Db, input: z.input<typeof createOrgSchema>): Promise<{ organizationId: string }> {
  const data = parseInput(createOrgSchema, input);
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ name: data.name, slug: data.slug, isDemo: data.isDemo })
      .returning({ id: organizations.id });
    const orgId = org!.id;
    await tx.insert(organizationSettings).values({
      organizationId: orgId,
      displayName: data.name,
      timezone: data.timezone,
      businessHours: DEFAULT_BUSINESS_HOURS,
    });
    const roleRows = await tx
      .insert(roles)
      .values(
        SYSTEM_ROLES.map((key) => ({
          organizationId: orgId,
          key,
          name: ROLE_LABEL[key],
          isSystem: true,
          permissions: [...DEFAULT_ROLE_PERMISSIONS[key]],
        })),
      )
      .returning({ id: roles.id, key: roles.key });
    const ownerRole = roleRows.find((r) => r.key === "owner")!;
    await tx.insert(memberships).values({ organizationId: orgId, userId: data.ownerUserId, roleId: ownerRole.id, createdBy: data.ownerUserId });
    await tx.insert(priceTables).values({ organizationId: orgId, name: "Particular", isDefault: true });
    await tx.insert(specialties).values(DEFAULT_SPECIALTIES.map((name, i) => ({ organizationId: orgId, name, sortOrder: i })));
    await tx.insert(financialCategories).values(DEFAULT_CATEGORIES.map((c) => ({ organizationId: orgId, ...c, systemKey: c.systemKey ?? null })));
    await tx.insert(costCenters).values({ organizationId: orgId, name: "Clínica" });
    await tx.insert(financialAccounts).values({
      organizationId: orgId,
      name: "Caixa da recepção",
      kind: "cash",
      openingBalanceCents: 0,
      openingDate: new Date().toISOString().slice(0, 10),
    });
    await tx.insert(anamnesisTemplates).values({
      organizationId: orgId,
      name: "Anamnese inicial",
      version: 1,
      questions: DEFAULT_ANAMNESIS,
      createdBy: data.ownerUserId,
    });
    await tx.insert(documentTemplates).values([
      { organizationId: orgId, kind: "contract", name: "Contrato de tratamento", body: DEFAULT_CONTRACT, createdBy: data.ownerUserId },
      { organizationId: orgId, kind: "receipt", name: "Recibo", body: DEFAULT_RECEIPT, createdBy: data.ownerUserId },
    ]);
    await tx.insert(integrationSettings).values(INTEGRATION_KINDS.map((kind) => ({ organizationId: orgId, kind })));
    await audit(tx, { orgId, userId: data.ownerUserId }, {
      action: "organization.create",
      entityType: "organization",
      entityId: orgId,
      summary: `Clínica criada: ${data.name}`,
    });
    return { organizationId: orgId };
  });
}

export async function getSettings(ctx: Ctx) {
  const [row] = await ctx.db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, ctx.orgId));
  if (!row) throw new NotFoundError("Configuração");
  return row;
}

const businessHoursSchema = z.object({
  days: z
    .array(
      z.array(
        z
          .object({ start: z.number().int().min(0).max(1440), end: z.number().int().min(0).max(1440) })
          .refine((p) => p.end > p.start, { message: "Fim do expediente deve ser após o início" }),
      ),
    )
    .length(7),
});

const settingsSchema = z.object({
  displayName: zRequiredText("Nome de exibição", 200),
  legalName: zOptionalText(200),
  document: zOptionalText(30),
  phone: zOptionalText(30),
  email: zOptionalText(200),
  address: zOptionalText(300),
  city: zOptionalText(120),
  state: zOptionalText(2),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "Cor inválida" })
    .refine((c) => contrastWithWhite(c) >= 4.5, { message: "A cor precisa de contraste mínimo 4,5:1 com o branco (texto e botões)" }),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("pt-BR", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, { message: "Fuso horário inválido" }),
  slotMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
  uploadMaxMb: z.number().int().min(1).max(25),
  budgetValidityDays: z.number().int().min(1).max(365),
  businessHours: businessHoursSchema,
});

export async function updateSettings(ctx: Ctx, input: z.input<typeof settingsSchema>) {
  assertCan(ctx, "settings.manage");
  const data = parseInput(settingsSchema, input);
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(organizationSettings)
      .set({ ...data, updatedAt: new Date(), updatedBy: ctx.userId })
      .where(eq(organizationSettings.organizationId, ctx.orgId));
    await audit(tx, ctx, {
      action: "settings.update",
      entityType: "organization_settings",
      entityId: ctx.orgId,
      summary: "Configurações da clínica atualizadas",
      changes: { displayName: data.displayName, timezone: data.timezone, slotMinutes: data.slotMinutes, businessHours: data.businessHours },
    });
  });
}

export async function systemCategoryId(tx: Tx | Db, orgId: string, systemKey: string): Promise<string | null> {
  const [row] = await tx
    .select({ id: financialCategories.id })
    .from(financialCategories)
    .where(and(eq(financialCategories.organizationId, orgId), eq(financialCategories.systemKey, systemKey)));
  return row?.id ?? null;
}
