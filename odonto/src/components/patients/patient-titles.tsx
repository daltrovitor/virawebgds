// Hello World
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateReceiptAction, reverseSettlementAction } from "@/actions/finance";
import { SettleDialog, type SettleTitle } from "@/components/finance/settle-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/payment-plan";
import { TITLE_LABEL, TITLE_TONE } from "@/lib/status";

interface TitleRow {
  id: string;
  description: string;
  dueDate: string;
  originalCents: number;
  balanceCents: number;
  status: string;
  overdue: boolean;
  expectedMethod: string | null;
  budgetId: string | null;
}

interface HistoryRow {
  settlementId: string;
  settledOn: string;
  method: string;
  status: string;
  accountName: string;
  principalCents: number;
  interestCents: number;
  fineCents: number;
  discountCents: number;
  receivableId: string | null;
}

export function PatientTitles({
  titles,
  history,
  accounts,
  canSettle,
  canReverse,
  totals,
  today,
}: {
  titles: TitleRow[];
  history: HistoryRow[];
  accounts: { id: string; name: string; kind: string }[];
  canSettle: boolean;
  canReverse: boolean;
  totals: { openCents: number; overdueCents: number; receivedCents: number };
  today: string;
}) {
  const router = useRouter();
  const [settling, setSettling] = useState<SettleTitle[] | null>(null);
  const reverse = useAction(reverseSettlementAction, { success: "Baixa estornada" });
  const receipt = useAction(generateReceiptAction, { success: "Recibo gerado" });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Em aberto" value={formatBRL(totals.openCents)} />
        <Stat label="Vencido" value={formatBRL(totals.overdueCents)} tone={totals.overdueCents > 0 ? "danger" : "default"} />
        <Stat label="Recebido (efetivo)" value={formatBRL(totals.receivedCents)} tone="accent" />
      </div>
      <Card>
        <CardHeader title="Títulos a receber" description="Entrada e parcelas de orçamentos aprovados e lançamentos avulsos identificados." />
        {titles.length === 0 ? (
          <EmptyState title="Nenhum título" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Descrição</Th>
                  <Th>Vencimento</Th>
                  <Th>Forma prevista</Th>
                  <Th align="right">Valor</Th>
                  <Th align="right">Saldo</Th>
                  <Th>Situação</Th>
                  <Th align="right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {titles.map((t) => (
                  <Tr key={t.id}>
                    <Td>{t.description}</Td>
                    <Td className={t.overdue ? "tabular font-medium text-danger" : "tabular"}>{formatDateBR(t.dueDate)}</Td>
                    <Td>{t.expectedMethod ? PAYMENT_METHOD_LABEL[t.expectedMethod as PaymentMethod] : "—"}</Td>
                    <Td align="right">{formatBRL(t.originalCents)}</Td>
                    <Td align="right">{formatBRL(t.balanceCents)}</Td>
                    <Td>
                      <Badge tone={t.overdue ? "danger" : (TITLE_TONE[t.status] ?? "neutral")}>{t.overdue ? "Vencido" : (TITLE_LABEL[t.status] ?? t.status)}</Badge>
                    </Td>
                    <Td align="right">
                      {canSettle && (t.status === "open" || t.status === "partial") ? (
                        <Button size="sm" onClick={() => setSettling([{ id: t.id, description: t.description, balanceCents: t.balanceCents, expectedMethod: t.expectedMethod }])}>
                          Receber
                        </Button>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
      <Card>
        <CardHeader title="Recebimentos registrados" description="Estorno cria movimento reverso; o registro original é mantido." />
        {history.length === 0 ? (
          <EmptyState title="Nenhum recebimento" />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Título</Th>
                  <Th>Forma / conta</Th>
                  <Th align="right">Recebido</Th>
                  <Th align="right">Desconto</Th>
                  <Th>Situação</Th>
                  <Th align="right">Ações</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <Tr key={`${h.settlementId}-${i}`}>
                    <Td className="tabular">{formatDateBR(h.settledOn)}</Td>
                    <Td className="max-w-[16rem] truncate">{titles.find((t) => t.id === h.receivableId)?.description ?? "—"}</Td>
                    <Td>
                      {PAYMENT_METHOD_LABEL[h.method as PaymentMethod] ?? h.method}
                      <span className="block text-xs text-subtle">{h.accountName}</span>
                    </Td>
                    <Td align="right">{formatBRL(h.principalCents + h.interestCents + h.fineCents)}</Td>
                    <Td align="right">{h.discountCents ? formatBRL(h.discountCents) : "—"}</Td>
                    <Td>{h.status === "reversed" ? <Badge tone="neutral">Estornado</Badge> : <Badge tone="success">Efetivo</Badge>}</Td>
                    <Td align="right">
                      {h.status === "active" ? (
                        <div className="flex justify-end gap-1">
                          {canSettle ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={receipt.pending}
                              onClick={async () => {
                                const res = await receipt.run(h.settlementId);
                                if (res.ok) router.push(`/documentos/${res.data.id}`);
                              }}
                            >
                              Recibo
                            </Button>
                          ) : null}
                          {canReverse ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={reverse.pending}
                              onClick={() => {
                                const reason = window.prompt("Motivo do estorno");
                                if (reason) void reverse.run({ settlementId: h.settlementId, reason });
                              }}
                            >
                              Estornar
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
      <p className="text-xs text-subtle">
        Para conciliar com o extrato bancário, use <Link href="/financeiro/conciliacao" className="text-accent hover:underline cursor-pointer">Financeiro › Conciliação</Link>.
      </p>
      {settling ? <SettleDialog open onClose={() => setSettling(null)} kind="receivable" titles={settling} accounts={accounts} today={today} /> : null}
    </div>
  );
}
