// Hello World
"use client";

import { Fragment, useState } from "react";
import { removeItemAction, updateItemAction } from "@/actions/budgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { APPROVAL_STATUS_LABEL, type ApprovalStatus, type BillingUnit } from "@/domain/budget";
import { formatBRL } from "@/domain/money";

export interface ItemRow {
  id: string;
  procedureCode: string;
  procedureName: string;
  specialtyName: string;
  billingUnit: BillingUnit;
  locationLabel: string;
  quantity: number;
  referencePriceCents: number | null;
  unitPriceCents: number;
  subtotalCents: number;
  approvalStatus: ApprovalStatus;
  duplicateJustification: string | null;
  notes: string | null;
}

export function ItemsTable({ items, editable, showApproval }: { items: ItemRow[]; editable: boolean; showApproval: boolean }) {
  const [editing, setEditing] = useState<{ id: string; price: number | null; quantity: number } | null>(null);
  const update = useAction(updateItemAction, { success: "Valor do item atualizado (a tabela de preços não muda)" });
  const remove = useAction(removeItemAction, { success: "Item removido" });
  const groups = items.reduce<Record<string, ItemRow[]>>((acc, i) => {
    (acc[i.specialtyName] ??= []).push(i);
    return acc;
  }, {});
  const total = items.filter((i) => i.approvalStatus !== "rejected").reduce((s, i) => s + i.subtotalCents, 0);
  return (
    <Card>
      <CardHeader title="Itens do orçamento" description="Valor de referência = tabela no momento da inclusão. Valor aplicado = negociado para este item." />
      {items.length === 0 ? (
        <EmptyState title="Nenhum item" description="Inclua procedimentos de qualquer especialidade; o mesmo dente admite vários procedimentos." />
      ) : (
        <TableWrap label="Itens do orçamento">
          <Table>
            <thead>
              <tr>
                <Th>Procedimento</Th>
                <Th>Região</Th>
                <Th align="right">Qtd</Th>
                <Th align="right">Referência</Th>
                <Th align="right">Valor aplicado</Th>
                <Th align="right">Subtotal</Th>
                {showApproval ? <Th>Aprovação</Th> : null}
                {editable ? <Th align="right">Ações</Th> : null}
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([specialty, rows]) => (
                <Fragment key={specialty}>
                  <tr>
                    <td colSpan={8} className="border-b border-border bg-surface/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted sm:px-5">
                      {specialty}
                    </td>
                  </tr>
                  {rows.map((i) => {
                    const isEditing = editing?.id === i.id;
                    const qtyEditable = i.billingUnit === "session" || i.billingUnit === "global";
                    return (
                      <Tr key={i.id} className={i.approvalStatus === "rejected" ? "text-subtle line-through decoration-zinc-300" : undefined}>
                        <Td>
                          <span className="font-medium">{i.procedureName}</span>
                          <span className="block text-xs text-subtle">{i.procedureCode}</span>
                          {i.duplicateJustification ? <span className="block text-xs text-warning">Repetido: {i.duplicateJustification}</span> : null}
                          {i.notes ? <span className="block text-xs text-muted">{i.notes}</span> : null}
                        </Td>
                        <Td>{i.locationLabel}</Td>
                        <Td align="right">
                          {isEditing && qtyEditable ? (
                            <input
                              type="number"
                              min={1}
                              aria-label="Quantidade"
                              className="h-9 w-16 rounded-md border border-border-strong px-2 text-right"
                              value={editing.quantity}
                              onChange={(e) => setEditing({ ...editing, quantity: Math.max(1, Number(e.target.value) || 1) })}
                            />
                          ) : (
                            i.quantity
                          )}
                        </Td>
                        <Td align="right" className="text-muted">
                          {i.referencePriceCents === null ? "Sem preço" : formatBRL(i.referencePriceCents)}
                        </Td>
                        <Td align="right">
                          {isEditing ? (
                            <div className="ml-auto w-36">
                              <MoneyInput aria-label="Valor aplicado" value={editing.price} onChange={(v) => setEditing({ ...editing, price: v })} />
                            </div>
                          ) : (
                            <span className={i.referencePriceCents !== null && i.unitPriceCents !== i.referencePriceCents ? "font-medium text-accent-strong" : undefined}>{formatBRL(i.unitPriceCents)}</span>
                          )}
                        </Td>
                        <Td align="right" className="font-medium">
                          {formatBRL(i.subtotalCents)}
                        </Td>
                        {showApproval ? (
                          <Td>
                            <Badge tone={i.approvalStatus === "approved" ? "success" : i.approvalStatus === "rejected" ? "danger" : "neutral"}>{APPROVAL_STATUS_LABEL[i.approvalStatus]}</Badge>
                          </Td>
                        ) : null}
                        {editable ? (
                          <Td align="right">
                            {isEditing ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  loading={update.pending}
                                  disabled={editing.price === null}
                                  onClick={async () => {
                                    const res = await update.run({ itemId: i.id, unitPriceCents: editing.price ?? 0, quantity: editing.quantity, notes: i.notes });
                                    if (res.ok) setEditing(null);
                                  }}
                                >
                                  Salvar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditing({ id: i.id, price: i.unitPriceCents, quantity: i.quantity })}>
                                  Editar valor
                                </Button>
                                <Button size="sm" variant="ghost" loading={remove.pending} onClick={() => window.confirm(`Remover "${i.procedureName}" (${i.locationLabel})?`) && remove.run(i.id)}>
                                  Remover
                                </Button>
                              </div>
                            )}
                          </Td>
                        ) : null}
                      </Tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right text-sm font-medium sm:px-5">
                  Subtotal (exceto recusados)
                </td>
                <td className="px-3 py-3 text-right text-base font-semibold tabular">{formatBRL(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </Table>
        </TableWrap>
      )}
      {update.error ? <p className="px-5 py-2 text-sm text-danger">{update.error}</p> : null}
    </Card>
  );
}
