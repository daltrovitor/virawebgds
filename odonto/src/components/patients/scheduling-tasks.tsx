// Hello World
"use client";

import { useState } from "react";
import { cancelSchedulingTaskAction, createSchedulingTaskAction } from "@/actions/patients";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";

interface Task {
  id: string;
  reason: string;
  dueDate: string | null;
  status: string;
  responsibleName: string | null;
  createdAt: Date;
}

const STATUS: Record<string, { label: string; tone: "warning" | "success" | "neutral" }> = {
  open: { label: "Aguardando data", tone: "warning" },
  scheduled: { label: "Agendado", tone: "success" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export function SchedulingTasksPanel({ patientId, tasks, canEdit }: { patientId: string; tasks: Task[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const create = useAction(createSchedulingTaskAction, { success: "Pendência registrada" });
  const cancel = useAction(cancelSchedulingTaskAction, { success: "Pendência cancelada" });
  return (
    <Card>
      <CardHeader
        title="Pendências de agendamento"
        description="Retornos e procedimentos aguardando data, com prazo sugerido."
        actions={canEdit ? <Button size="sm" onClick={() => setOpen(true)}>Nova pendência</Button> : null}
      />
      {tasks.length === 0 ? (
        <EmptyState title="Nenhuma pendência" />
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{t.reason}</p>
                <p className="text-xs text-muted">
                  Prazo sugerido: {t.dueDate ? formatDateBR(t.dueDate) : "sem prazo"} · Responsável: {t.responsibleName ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS[t.status]?.tone ?? "neutral"}>{STATUS[t.status]?.label ?? t.status}</Badge>
                {canEdit && t.status === "open" ? (
                  <>
                    <ButtonLink size="sm" href={`/agenda?nova=1&paciente=${patientId}&pendencia=${t.id}`}>
                      Agendar
                    </ButtonLink>
                    <Button size="sm" variant="ghost" loading={cancel.pending} onClick={() => window.confirm("Cancelar esta pendência?") && cancel.run(t.id)}>
                      Cancelar
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Nova pendência de agendamento"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={create.pending}
              onClick={async () => {
                const res = await create.run({ patientId, reason, dueDate: dueDate || null });
                if (res.ok) {
                  setOpen(false);
                  setReason("");
                  setDueDate("");
                }
              }}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {create.error ? <Notice tone="danger">{create.error}</Notice> : null}
          <Field label="Motivo" htmlFor="t-reason" required error={create.fieldErrors.reason}>
            <Input id="t-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: retorno de controle em 30 dias" />
          </Field>
          <Field label="Prazo sugerido" htmlFor="t-due">
            <Input id="t-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
