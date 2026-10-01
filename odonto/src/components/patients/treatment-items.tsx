// Hello World
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cancelTreatmentItemAction, recordProgressAction, resolveFinancialReviewAction } from "@/actions/budgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { CLINICAL_LABEL, CLINICAL_TONE } from "@/lib/status";

interface Item {
  id: string;
  procedureName: string;
  specialtyName: string;
  locationLabel: string;
  clinicalStatus: string;
  budgetNumber: number;
  budgetId: string;
  nextAppointmentAt: string | null;
  sessions: number;
  financialReviewPending: boolean;
  cancelledReason: string | null;
}

const FILTERS = [
  { key: "pending", label: "Pendentes" },
  { key: "not_started", label: "Não realizado" },
  { key: "in_progress", label: "Em andamento" },
  { key: "completed", label: "Concluído" },
  { key: "all", label: "Todos" },
] as const;

export function TreatmentItemsPanel({
  patientId,
  items,
  canProgress,
  canCancel,
  canResolveFinance,
  summaryLabel,
}: {
  patientId: string;
  items: Item[];
  canProgress: boolean;
  canCancel: boolean;
  canResolveFinance: boolean;
  summaryLabel: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const [progressFor, setProgressFor] = useState<Item | null>(null);
  const [cancelFor, setCancelFor] = useState<Item | null>(null);
  const [status, setStatus] = useState<"not_started" | "in_progress" | "completed">("in_progress");
  const [description, setDescription] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");
  const [reason, setReason] = useState("");
  const progress = useAction(recordProgressAction, { success: "Evolução registrada" });
  const cancel = useAction(cancelTreatmentItemAction, { success: "Item cancelado clinicamente" });
  const review = useAction((id: string) => resolveFinancialReviewAction(id, "Analisado pelo financeiro"), { success: "Análise financeira registrada" });
  const visible = useMemo(
    () =>
      items.filter((i) =>
        filter === "all" ? true : filter === "pending" ? i.clinicalStatus === "not_started" || i.clinicalStatus === "in_progress" : i.clinicalStatus === filter,
      ),
    [items, filter],
  );
  return (
    <Card>
      <CardHeader title="Itens de tratamento" description={`Evolução: ${summaryLabel}. Pagamento não conclui procedimento e vice-versa.`} />
      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2 sm:px-5" role="group" aria-label="Filtrar por situação">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-10 rounded-md px-3 text-sm cursor-pointer ${filter === f.key ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-surface-2"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Nenhum item nesta situação" description="Itens surgem quando um orçamento é aprovado." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Procedimento</Th>
                <Th>Região</Th>
                <Th>Orçamento</Th>
                <Th>Situação</Th>
                <Th>Sessões</Th>
                <Th>Próxima consulta</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <span className="font-medium">{i.procedureName}</span>
                    <span className="block text-xs text-subtle">{i.specialtyName}</span>
                  </Td>
                  <Td>{i.locationLabel}</Td>
                  <Td>
                    <Link href={`/pacientes/${patientId}/orcamentos/${i.budgetId}`} className="tabular hover:underline cursor-pointer">
                      nº {i.budgetNumber}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={CLINICAL_TONE[i.clinicalStatus] ?? "neutral"}>{CLINICAL_LABEL[i.clinicalStatus] ?? i.clinicalStatus}</Badge>
                    {i.financialReviewPending ? <Badge tone="warning" className="ml-1">Ajuste financeiro pendente</Badge> : null}
                    {i.cancelledReason ? <span className="block text-xs text-subtle">{i.cancelledReason}</span> : null}
                  </Td>
                  <Td className="tabular">{i.sessions}</Td>
                  <Td className="tabular">{i.nextAppointmentAt ? new Date(i.nextAppointmentAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : <span className="text-subtle">Não agendado</span>}</Td>
                  <Td align="right">
                    <div className="flex justify-end gap-1">
                      {canProgress && i.clinicalStatus !== "cancelled" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setProgressFor(i);
                            setStatus(i.clinicalStatus === "not_started" ? "in_progress" : (i.clinicalStatus as "in_progress" | "completed"));
                            setDescription("");
                            setSessionLabel("");
                          }}
                        >
                          Evolução
                        </Button>
                      ) : null}
                      {canCancel && (i.clinicalStatus === "not_started" || i.clinicalStatus === "in_progress") ? (
                        <Button size="sm" variant="ghost" onClick={() => (setCancelFor(i), setReason(""))}>
                          Cancelar
                        </Button>
                      ) : null}
                      {canResolveFinance && i.financialReviewPending ? (
                        <Button size="sm" variant="ghost" loading={review.pending} onClick={() => review.run(i.id)}>
                          Marcar analisado
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
      <Dialog
        open={progressFor !== null}
        onClose={() => setProgressFor(null)}
        title="Registrar evolução"
        description={progressFor ? `${progressFor.procedureName} — ${progressFor.locationLabel}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setProgressFor(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={progress.pending}
              onClick={async () => {
                if (!progressFor) return;
                const res = await progress.run({ treatmentItemId: progressFor.id, status, description, sessionLabel: sessionLabel || null });
                if (res.ok) setProgressFor(null);
              }}
            >
              Salvar evolução
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {progress.error ? <Notice tone="danger">{progress.error}</Notice> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Situação resultante" htmlFor="pg-status">
              <Select id="pg-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="not_started">Não realizado</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Concluído</option>
              </Select>
            </Field>
            <Field label="Sessão (opcional)" htmlFor="pg-session" hint="Ex.: preparo, prova, instalação">
              <Input id="pg-session" value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)} />
            </Field>
          </div>
          <Field label="Descrição" htmlFor="pg-desc" required error={progress.fieldErrors.description}>
            <Textarea id="pg-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
      </Dialog>
      <Dialog
        open={cancelFor !== null}
        onClose={() => setCancelFor(null)}
        title="Cancelar item clinicamente"
        description="O histórico é preservado. O ajuste financeiro é analisado separadamente pelo financeiro."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelFor(null)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              loading={cancel.pending}
              onClick={async () => {
                if (!cancelFor) return;
                const res = await cancel.run({ treatmentItemId: cancelFor.id, reason });
                if (res.ok) setCancelFor(null);
              }}
            >
              Confirmar cancelamento
            </Button>
          </>
        }
      >
        {cancel.error ? <Notice tone="danger" className="mb-3">{cancel.error}</Notice> : null}
        <Field label="Motivo" htmlFor="cn-reason" required error={cancel.fieldErrors.reason}>
          <Textarea id="cn-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </Card>
  );
}
