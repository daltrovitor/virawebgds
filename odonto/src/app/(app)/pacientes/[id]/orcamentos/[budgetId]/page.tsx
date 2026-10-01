// Hello World
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BudgetActions } from "@/components/budgets/budget-actions";
import { ItemForm } from "@/components/budgets/item-form";
import { ItemsTable } from "@/components/budgets/items-table";
import { NegotiationPanel } from "@/components/budgets/negotiation-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescList, EmptyState, Notice, PageHeader } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDateBR, formatDateTimeBR, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/payment-plan";
import { budgetBadge, TITLE_LABEL, TITLE_TONE } from "@/lib/status";
import { can } from "@/server/context";
import { getBudget } from "@/server/services/budgets";
import { catalogForBudget } from "@/server/services/catalog";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Orçamento" };

export default async function BudgetPage({ params }: { params: Promise<{ id: string; budgetId: string }> }) {
  const ctx = await getRequestContext();
  const { id, budgetId } = await params;
  const b = await getBudget(ctx, budgetId);
  if (b.patient.id !== id) notFound();
  const catalog = b.editable && can(ctx, "budgets.edit") ? await catalogForBudget(ctx, b.budget.priceTableId) : null;
  const badge = budgetBadge(b.budget.status);
  const agreement = b.activeAgreement && !("hidden" in b.activeAgreement) ? b.activeAgreement : null;
  const hasAgreement = Boolean(b.activeAgreement);
  const draft = (b.currentRevision?.negotiation ?? null) as Parameters<typeof NegotiationPanel>[0]["draft"];
  const today = todayInTz(ctx.timezone);
  return (
    <>
      <PageHeader
        title={`Orçamento nº ${b.budget.number}`}
        description={`${b.patient.fullName} · ${formatDateBR(b.budget.budgetDate)}${b.budget.validUntil ? ` · válido até ${formatDateBR(b.budget.validUntil)}` : ""}`}
        back={{ href: `/pacientes/${id}?aba=orcamentos`, label: "Ficha do paciente" }}
        actions={
          <BudgetActions
            budgetId={budgetId}
            status={b.budget.status}
            hasAgreement={hasAgreement}
            revisionInProgress={b.revisionInProgress}
            canEdit={can(ctx, "budgets.edit")}
            canRevise={can(ctx, "budgets.revise")}
            canApprove={can(ctx, "budgets.approve")}
          />
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        {b.currentRevision ? <Badge>Versão {b.currentRevision.number}</Badge> : null}
        {b.revisionInProgress ? <Badge tone="warning">Revisão em andamento: o acordo anterior segue vigente até a aprovação</Badge> : null}
        <span className="text-sm text-muted">
          Tabela {b.priceTable?.name ?? "—"} · Responsável {b.professional?.name ?? "não definido"}
        </span>
      </div>
      {b.revisionInProgress && b.currentRevision?.reason ? (
        <Notice tone="info" className="mb-6">
          Motivo da revisão: {b.currentRevision.reason}
        </Notice>
      ) : null}

      <div className="space-y-6">
        {catalog ? (
          <ItemForm budgetId={budgetId} priceTableName={b.priceTable?.name ?? ""} specialties={catalog.specialties} procedures={catalog.procedures} />
        ) : null}
        <ItemsTable items={b.items} editable={b.editable && can(ctx, "budgets.edit")} showApproval={!b.editable || b.revisionInProgress} />
        {b.editable && b.items.length > 0 && (can(ctx, "budgets.edit") || can(ctx, "budgets.approve")) ? (
          <NegotiationPanel
            key={`${b.budget.version}`}
            budgetId={budgetId}
            version={b.budget.version}
            items={b.items}
            canApprove={can(ctx, "budgets.approve") && (!b.revisionInProgress || agreement !== null)}
            canSimulate={can(ctx, "budgets.edit")}
            previousTotalCents={b.revisionInProgress ? (agreement?.totalCents ?? null) : null}
            today={today}
            draft={draft}
          />
        ) : null}

        {agreement ? (
          <Card>
            <CardHeader title="Acordo de pagamento vigente" description={`Criado em ${formatDateTimeBR(agreement.createdAt, ctx.timezone)}. Aceitação, conclusão clínica e quitação são estados independentes.`} />
            <CardBody>
              <DescList
                items={[
                  { label: "Subtotal aprovado", value: formatBRL(agreement.subtotalCents) },
                  { label: "Desconto", value: formatBRL(agreement.discountCents) },
                  { label: "Total negociado", value: <strong>{formatBRL(agreement.totalCents)}</strong> },
                  { label: "Ajuste da última revisão", value: agreement.previousAgreementId ? formatBRL(agreement.adjustmentCents) : "—" },
                ]}
              />
            </CardBody>
            {b.receivables.length > 0 ? (
              <TableWrap label="Títulos do orçamento">
                <Table>
                  <thead>
                    <tr>
                      <Th>Título</Th>
                      <Th>Vencimento</Th>
                      <Th>Forma prevista</Th>
                      <Th align="right">Valor</Th>
                      <Th align="right">Saldo</Th>
                      <Th>Situação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.receivables.map((r) => (
                      <Tr key={r.id}>
                        <Td>{r.description}</Td>
                        <Td className="tabular">{formatDateBR(r.dueDate)}</Td>
                        <Td>{r.expectedMethod ? PAYMENT_METHOD_LABEL[r.expectedMethod as PaymentMethod] : "—"}</Td>
                        <Td align="right">{formatBRL(r.originalCents + r.adjustmentCents)}</Td>
                        <Td align="right">{formatBRL(r.balanceCents)}</Td>
                        <Td>
                          <Badge tone={TITLE_TONE[r.status] ?? "neutral"}>{TITLE_LABEL[r.status] ?? r.status}</Badge>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <CardBody>
                <p className="text-sm text-muted">Sem títulos (total zero ou ainda não gerados).</p>
              </CardBody>
            )}
            {b.credits.length > 0 ? (
              <CardBody>
                <Notice tone="warning" title="Crédito do paciente pendente de decisão">
                  {b.credits.map((c) => (
                    <p key={c.id}>
                      {formatBRL(c.amountCents)} — {c.reason}
                    </p>
                  ))}
                  <p className="mt-1 text-xs">Defina com o financeiro se o valor fica como crédito ou será reembolsado. Nada é devolvido automaticamente.</p>
                </Notice>
              </CardBody>
            ) : null}
          </Card>
        ) : hasAgreement ? (
          <Notice tone="info">Orçamento com acordo aprovado. Valores de pagamento visíveis apenas para quem tem permissão financeira.</Notice>
        ) : null}

        <Card>
          <CardHeader title="Histórico de versões" description="Versões aprovadas são preservadas com autor, data e motivo." />
          {b.revisions.length === 0 ? (
            <EmptyState title="Sem versões" />
          ) : (
            <ul className="divide-y divide-border">
              {b.revisions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm sm:px-5">
                  <span>
                    <strong>Versão {r.number}</strong> · {r.authorName ?? "—"} · {formatDateTimeBR(r.createdAt, ctx.timezone)}
                    {r.reason ? <span className="block text-xs text-muted">Motivo: {r.reason}</span> : null}
                  </span>
                  <Badge tone={r.status === "approved" ? "success" : r.status === "open" ? "info" : "neutral"}>
                    {{ open: "Em edição", approved: "Aprovada", superseded: "Substituída", discarded: "Descartada" }[r.status] ?? r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
