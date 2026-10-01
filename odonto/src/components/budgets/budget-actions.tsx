// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { changeBudgetStatusAction, discardRevisionAction, generateContractAction, startRevisionAction } from "@/actions/budgets";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import type { BudgetStatus } from "@/domain/budget";

export function BudgetActions({
  budgetId,
  status,
  hasAgreement,
  revisionInProgress,
  canEdit,
  canRevise,
  canApprove,
}: {
  budgetId: string;
  status: BudgetStatus;
  hasAgreement: boolean;
  revisionInProgress: boolean;
  canEdit: boolean;
  canRevise: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "rejected" | "cancelled" | "revision">(null);
  const [reason, setReason] = useState("");
  const change = useAction(changeBudgetStatusAction, { success: "Situação atualizada" });
  const revise = useAction(startRevisionAction, { success: (d) => `Revisão ${d.number} iniciada; a versão aprovada continua vigente até a nova aprovação` });
  const discard = useAction(discardRevisionAction, { success: "Revisão descartada" });
  const contract = useAction(generateContractAction, { success: "Contrato gerado a partir do modelo", refresh: false });
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/api/orcamentos/${budgetId}/pdf`} className="inline-flex h-10 items-center rounded-md border border-border-strong bg-white px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
        PDF
      </a>
      {canEdit && !hasAgreement && (status === "draft" || status === "negotiating") ? (
        <>
          <Button variant="ghost" onClick={() => (setDialog("rejected"), setReason(""))}>
            Recusar
          </Button>
          <Button variant="ghost" onClick={() => (setDialog("cancelled"), setReason(""))}>
            Cancelar
          </Button>
        </>
      ) : null}
      {canEdit && !hasAgreement && (status === "rejected" || status === "cancelled") ? (
        <Button loading={change.pending} onClick={() => change.run({ budgetId, status: "negotiating" })}>
          Reabrir negociação
        </Button>
      ) : null}
      {canRevise && hasAgreement && !revisionInProgress ? (
        <Button onClick={() => (setDialog("revision"), setReason(""))}>Revisar orçamento aprovado</Button>
      ) : null}
      {canRevise && revisionInProgress ? (
        <Button variant="ghost" loading={discard.pending} onClick={() => window.confirm("Descartar a revisão em andamento? A versão aprovada continua vigente.") && discard.run(budgetId)}>
          Descartar revisão
        </Button>
      ) : null}
      {canApprove && hasAgreement ? (
        <Button
          loading={contract.pending}
          onClick={async () => {
            const res = await contract.run(budgetId);
            if (res.ok) router.push(`/documentos/${res.data.id}`);
          }}
        >
          Gerar contrato
        </Button>
      ) : null}
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog === "revision" ? "Iniciar revisão" : dialog === "rejected" ? "Recusar orçamento" : "Cancelar orçamento"}
        description={
          dialog === "revision"
            ? "A versão aprovada é preservada com autor e motivo. Pagamentos já feitos não são alterados."
            : "O motivo fica registrado no histórico do orçamento."
        }
        footer={
          <Button
            variant={dialog === "revision" ? "primary" : "danger"}
            loading={change.pending || revise.pending}
            onClick={async () => {
              const res = dialog === "revision" ? await revise.run({ budgetId, reason }) : await change.run({ budgetId, status: dialog!, reason });
              if (res.ok) setDialog(null);
            }}
          >
            Confirmar
          </Button>
        }
      >
        {change.error || revise.error ? <Notice tone="danger" className="mb-3">{change.error ?? revise.error}</Notice> : null}
        <Field label="Motivo" htmlFor="ba-reason" required>
          <Textarea id="ba-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
