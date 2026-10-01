import { NextResponse } from "next/server";
import { BUDGET_STATUS_LABEL } from "@/domain/budget";
import { formatDateBR } from "@/domain/dates";
import { formatBRL, formatBasisPoints } from "@/domain/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/payment-plan";
import { can } from "@/server/context";
import { PdfWriter } from "@/server/pdf";
import { getBudget } from "@/server/services/budgets";
import { getSettings } from "@/server/services/organizations";
import { getRequestContext } from "@/server/session";

interface NegotiationDraft {
  approvedItemIds?: string[];
  discount?: { type: string; cents?: number; basisPoints?: number };
  plan?: { downPayment: { amountCents: number; dueDate: string; method: string } | null; installments: { amountCents: number; dueDate: string; method: string }[] };
}

/** PDF legível do orçamento: identificação, itens, regiões, valores e condições. Sem conteúdo clínico. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  const { id } = await params;
  const b = await getBudget(ctx, id);
  const settings = await getSettings(ctx);
  const pdf = await PdfWriter.create();
  pdf.text(settings.displayName, { size: 13, bold: true, gap: 0 });
  const contact = [settings.address, settings.city && settings.state ? `${settings.city}/${settings.state}` : settings.city, settings.phone, settings.email].filter(Boolean).join(" · ");
  if (contact) pdf.text(contact, { size: 8.5, color: [0.4, 0.4, 0.43] });
  pdf.space(8);
  pdf.text(`Orçamento nº ${b.budget.number}${b.currentRevision && b.currentRevision.number > 1 ? ` (versão ${b.currentRevision.number})` : ""}`, { size: 16, bold: true, gap: 2 });
  pdf.text(
    `Paciente: ${b.patient.fullName}  ·  Data: ${formatDateBR(b.budget.budgetDate)}${b.budget.validUntil ? `  ·  Válido até ${formatDateBR(b.budget.validUntil)}` : ""}  ·  Situação: ${BUDGET_STATUS_LABEL[b.budget.status]}`,
    { size: 9.5 },
  );
  if (b.professional) pdf.text(`Responsável: ${b.professional.name}  ·  Tabela: ${b.priceTable?.name ?? "—"}`, { size: 9.5 });
  pdf.space(10);

  const items = b.items.filter((i) => i.approvalStatus !== "rejected");
  const w = pdf.width;
  const cols = [w * 0.17, w * 0.3, w * 0.2, w * 0.07, w * 0.13, w * 0.13];
  pdf.row(
    [
      { text: "Especialidade", width: cols[0]! },
      { text: "Procedimento", width: cols[1]! },
      { text: "Região", width: cols[2]! },
      { text: "Qtd", width: cols[3]!, align: "right" },
      { text: "Unitário", width: cols[4]!, align: "right" },
      { text: "Subtotal", width: cols[5]!, align: "right" },
    ],
    { bold: true, shade: true },
  );
  for (const i of items) {
    pdf.row([
      { text: i.specialtyName, width: cols[0]! },
      { text: i.procedureName, width: cols[1]! },
      { text: i.locationLabel, width: cols[2]! },
      { text: String(i.quantity), width: cols[3]!, align: "right" },
      { text: formatBRL(i.unitPriceCents), width: cols[4]!, align: "right" },
      { text: formatBRL(i.subtotalCents), width: cols[5]!, align: "right" },
    ]);
  }
  pdf.space(6);
  pdf.text(`Subtotal: ${formatBRL(items.reduce((s, i) => s + i.subtotalCents, 0))}`, { size: 10.5, bold: true });

  const showConditions = can(ctx, "budgets.approve") || can(ctx, "finance.view") || can(ctx, "budgets.edit");
  const agreement = b.activeAgreement && !("hidden" in b.activeAgreement) ? b.activeAgreement : null;
  if (showConditions && agreement) {
    if (agreement.discountCents > 0) {
      const label = agreement.discountType === "percent" ? ` (${formatBasisPoints(agreement.discountValue)})` : "";
      pdf.text(`Desconto${label}: ${formatBRL(agreement.discountCents)}`, { size: 10.5 });
    }
    pdf.text(`Total negociado: ${formatBRL(agreement.totalCents)}`, { size: 12, bold: true, gap: 8 });
    pdf.text("Condições de pagamento", { size: 11, bold: true });
    for (const r of b.receivables.filter((x) => x.status !== "cancelled")) {
      pdf.text(`• ${r.description}: ${formatBRL(r.originalCents + r.adjustmentCents)} — vencimento ${formatDateBR(r.dueDate)}${r.expectedMethod ? ` (${PAYMENT_METHOD_LABEL[r.expectedMethod as PaymentMethod]})` : ""}`, { size: 9.5, gap: 1 });
    }
  } else if (showConditions && b.currentRevision?.negotiation) {
    const neg = b.currentRevision.negotiation as NegotiationDraft;
    if (neg.plan) {
      pdf.space(4);
      pdf.text("Condições propostas (simulação, sujeitas a aprovação)", { size: 11, bold: true });
      const lines = [...(neg.plan.downPayment ? [{ ...neg.plan.downPayment, label: "Entrada" }] : []), ...neg.plan.installments.map((l, i) => ({ ...l, label: `Parcela ${i + 1}/${neg.plan!.installments.length}` }))];
      for (const l of lines) {
        pdf.text(`• ${l.label}: ${formatBRL(l.amountCents)} — ${formatDateBR(l.dueDate)} (${PAYMENT_METHOD_LABEL[l.method as PaymentMethod] ?? l.method})`, { size: 9.5, gap: 1 });
      }
    }
  }
  if (b.budget.notes) {
    pdf.space(8);
    pdf.text("Observações", { size: 11, bold: true });
    pdf.text(b.budget.notes, { size: 9.5 });
  }
  pdf.space(14);
  pdf.text("Valores sujeitos à avaliação clínica. Este orçamento não constitui contrato nem documento fiscal.", { size: 8, color: [0.45, 0.45, 0.48] });
  const bytes = await pdf.bytes();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orcamento-${b.budget.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
