import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { formatDateBR, formatLongDatePT, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/payment-plan";
import { audit } from "../audit";
import { assertCan, type Ctx } from "../context";
import {
  agreementItemAllocations,
  budgetItems,
  budgets,
  documentTemplates,
  generatedDocuments,
  organizationSettings,
  patientResponsibles,
  patients,
  paymentAgreements,
  receivables,
  settlementAllocations,
  settlements,
} from "../db/schema";
import { BusinessRuleError, NotFoundError } from "../errors";
import { parseInput, zId, zRequiredText } from "../validation";

/** Substitui {{chave}} por valores; chaves desconhecidas ficam visíveis para revisão. */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => (key in vars ? vars[key]! : match));
}

export async function listTemplates(ctx: Ctx) {
  return ctx.db
    .select()
    .from(documentTemplates)
    .where(and(eq(documentTemplates.organizationId, ctx.orgId), eq(documentTemplates.active, true)))
    .orderBy(asc(documentTemplates.kind), asc(documentTemplates.name));
}

const templateSchema = z.object({ id: zId, body: zRequiredText("Texto do modelo", 50000) });

/** Editar cria nova versão; documentos já gerados guardam o texto da época. */
export async function updateTemplate(ctx: Ctx, input: z.input<typeof templateSchema>) {
  assertCan(ctx, "settings.manage");
  const data = parseInput(templateSchema, input);
  return ctx.db.transaction(async (tx) => {
    const [tpl] = await tx
      .select()
      .from(documentTemplates)
      .where(and(eq(documentTemplates.organizationId, ctx.orgId), eq(documentTemplates.id, data.id)));
    if (!tpl) throw new NotFoundError("Modelo");
    await tx.update(documentTemplates).set({ active: false }).where(eq(documentTemplates.id, tpl.id));
    const [row] = await tx
      .insert(documentTemplates)
      .values({ organizationId: ctx.orgId, kind: tpl.kind, name: tpl.name, body: data.body, version: tpl.version + 1, createdBy: ctx.userId })
      .returning({ id: documentTemplates.id });
    await audit(tx, ctx, { action: "document_template.version", entityType: "document_template", entityId: row!.id, summary: `Modelo "${tpl.name}" versão ${tpl.version + 1}` });
    return { id: row!.id };
  });
}

async function clinicVars(ctx: Ctx) {
  const [s] = await ctx.db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, ctx.orgId));
  const today = todayInTz(ctx.timezone);
  return {
    "clinica.nome": s?.displayName ?? "",
    "clinica.documento": s?.document ?? "",
    "clinica.endereco": s?.address ?? "",
    cidade: s?.city ?? "",
    data: formatLongDatePT(today),
  };
}

async function activeTemplate(ctx: Ctx, kind: "contract" | "receipt") {
  const [tpl] = await ctx.db
    .select()
    .from(documentTemplates)
    .where(and(eq(documentTemplates.organizationId, ctx.orgId), eq(documentTemplates.kind, kind), eq(documentTemplates.active, true)))
    .orderBy(desc(documentTemplates.version))
    .limit(1);
  if (!tpl) throw new NotFoundError("Modelo de documento");
  return tpl;
}

/** Contrato a partir do acordo vigente. Não implica assinatura nem validade jurídica automática. */
export async function generateContract(ctx: Ctx, budgetId: string) {
  assertCan(ctx, "budgets.approve");
  const [budget] = await ctx.db.select().from(budgets).where(and(eq(budgets.organizationId, ctx.orgId), eq(budgets.id, budgetId)));
  if (!budget) throw new NotFoundError("Orçamento");
  const [agreement] = await ctx.db
    .select()
    .from(paymentAgreements)
    .where(and(eq(paymentAgreements.organizationId, ctx.orgId), eq(paymentAgreements.budgetId, budgetId), eq(paymentAgreements.status, "active")));
  if (!agreement) throw new BusinessRuleError("Contrato depende de orçamento aprovado");
  const [patient] = await ctx.db.select().from(patients).where(eq(patients.id, budget.patientId));
  const [responsible] = await ctx.db
    .select()
    .from(patientResponsibles)
    .where(and(eq(patientResponsibles.organizationId, ctx.orgId), eq(patientResponsibles.patientId, budget.patientId), eq(patientResponsibles.isFinancialResponsible, true)));
  const items = await ctx.db
    .select({ item: budgetItems, alloc: agreementItemAllocations })
    .from(agreementItemAllocations)
    .innerJoin(budgetItems, eq(budgetItems.id, agreementItemAllocations.budgetItemId))
    .where(eq(agreementItemAllocations.agreementId, agreement.id))
    .orderBy(asc(budgetItems.sortOrder));
  const titles = await ctx.db
    .select()
    .from(receivables)
    .where(and(eq(receivables.organizationId, ctx.orgId), eq(receivables.budgetId, budgetId)))
    .orderBy(asc(receivables.dueDate));
  const vars = {
    ...(await clinicVars(ctx)),
    "paciente.nome": patient!.fullName,
    "responsavel.nome": responsible?.name ?? patient!.fullName,
    "orcamento.numero": String(budget.number),
    "acordo.data": formatDateBR(agreement.createdAt.toISOString().slice(0, 10)),
    "acordo.total": formatBRL(agreement.totalCents),
    "acordo.itens": items.map((i) => `- ${i.item.procedureName} (${i.item.locationLabel}): ${formatBRL(i.alloc.netCents)}`).join("\n"),
    "acordo.parcelas": titles
      .filter((t) => t.status !== "cancelled")
      .map((t) => `- ${t.description}: ${formatBRL(t.originalCents + t.adjustmentCents)} com vencimento em ${formatDateBR(t.dueDate)} (${t.expectedMethod ? PAYMENT_METHOD_LABEL[t.expectedMethod as PaymentMethod] : "a combinar"})`)
      .join("\n"),
  };
  const tpl = await activeTemplate(ctx, "contract");
  const [doc] = await ctx.db
    .insert(generatedDocuments)
    .values({
      organizationId: ctx.orgId,
      patientId: budget.patientId,
      templateId: tpl.id,
      templateVersion: tpl.version,
      kind: "contract",
      title: `Contrato — orçamento nº ${budget.number}`,
      body: renderTemplate(tpl.body, vars),
      budgetId,
      createdBy: ctx.userId,
    })
    .returning({ id: generatedDocuments.id });
  await audit(ctx.db, ctx, { action: "document.contract", entityType: "generated_document", entityId: doc!.id, summary: `Contrato gerado para orçamento nº ${budget.number}` });
  return { id: doc!.id };
}

/** Recibo somente do valor efetivamente recebido em uma baixa ativa. */
export async function generateReceipt(ctx: Ctx, settlementId: string) {
  assertCan(ctx, "finance.settle");
  const [s] = await ctx.db.select().from(settlements).where(and(eq(settlements.organizationId, ctx.orgId), eq(settlements.id, settlementId)));
  if (!s) throw new NotFoundError("Baixa");
  if (s.status !== "active" || s.direction !== "in") throw new BusinessRuleError("Recibo só para recebimentos ativos (não estornados)");
  if (s.amountCents <= 0) throw new BusinessRuleError("Não há valor recebido para emitir recibo");
  const allocs = await ctx.db
    .select({ alloc: settlementAllocations, title: receivables })
    .from(settlementAllocations)
    .innerJoin(receivables, eq(receivables.id, settlementAllocations.receivableId))
    .where(eq(settlementAllocations.settlementId, s.id));
  const patientId = allocs.find((a) => a.title.patientId)?.title.patientId;
  if (!patientId) throw new BusinessRuleError("Recebimento sem paciente vinculado");
  const [patient] = await ctx.db.select().from(patients).where(eq(patients.id, patientId));
  const vars = {
    ...(await clinicVars(ctx)),
    "paciente.nome": patient!.fullName,
    "recibo.valor": formatBRL(s.amountCents),
    "recibo.forma": PAYMENT_METHOD_LABEL[s.method as PaymentMethod] ?? s.method,
    "recibo.referencia": allocs.map((a) => a.title.description).join("; "),
    "recibo.data": formatDateBR(s.settledOn),
  };
  const tpl = await activeTemplate(ctx, "receipt");
  const [doc] = await ctx.db
    .insert(generatedDocuments)
    .values({
      organizationId: ctx.orgId,
      patientId,
      templateId: tpl.id,
      templateVersion: tpl.version,
      kind: "receipt",
      title: `Recibo ${formatBRL(s.amountCents)} — ${formatDateBR(s.settledOn)}`,
      body: renderTemplate(tpl.body, vars),
      settlementId: s.id,
      createdBy: ctx.userId,
    })
    .returning({ id: generatedDocuments.id });
  await audit(ctx.db, ctx, { action: "document.receipt", entityType: "generated_document", entityId: doc!.id, summary: `Recibo de ${formatBRL(s.amountCents)} gerado` });
  return { id: doc!.id };
}

export async function listDocuments(ctx: Ctx, patientId: string) {
  assertCan(ctx, "patients.view");
  return ctx.db
    .select({ id: generatedDocuments.id, kind: generatedDocuments.kind, title: generatedDocuments.title, createdAt: generatedDocuments.createdAt, templateVersion: generatedDocuments.templateVersion })
    .from(generatedDocuments)
    .where(and(eq(generatedDocuments.organizationId, ctx.orgId), eq(generatedDocuments.patientId, patientId)))
    .orderBy(desc(generatedDocuments.createdAt));
}

export async function getDocument(ctx: Ctx, id: string) {
  assertCan(ctx, "patients.view");
  const [doc] = await ctx.db.select().from(generatedDocuments).where(and(eq(generatedDocuments.organizationId, ctx.orgId), eq(generatedDocuments.id, id)));
  if (!doc) throw new NotFoundError("Documento");
  if (doc.kind === "receipt") assertCan(ctx, "finance.view");
  return doc;
}
