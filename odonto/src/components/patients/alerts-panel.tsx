// Hello World
"use client";

import { useState } from "react";
import { createAlertAction, resolveAlertAction } from "@/actions/patients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

interface AlertRow {
  id: string;
  kind: string;
  priority: string;
  text: string;
  createdAt: Date;
  authorName: string | null;
}

export function AlertsPanel({ patientId, alerts, canCreateAdmin, canCreateClinical }: { patientId: string; alerts: AlertRow[]; canCreateAdmin: boolean; canCreateClinical: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"administrative" | "clinical">(canCreateAdmin ? "administrative" : "clinical");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [text, setText] = useState("");
  const create = useAction(createAlertAction, { success: "Alerta registrado" });
  const resolve = useAction((id: string) => resolveAlertAction(id, null), { success: "Alerta resolvido" });
  return (
    <Card>
      <CardHeader
        title="Alertas"
        description="Administrativos e clínicos são separados por permissão."
        actions={canCreateAdmin || canCreateClinical ? <Button size="sm" onClick={() => setOpen(true)}>Novo alerta</Button> : null}
      />
      <CardBody>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">Nenhum alerta ativo.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.kind === "clinical" ? "accent" : "neutral"}>{a.kind === "clinical" ? "Clínico" : "Administrativo"}</Badge>
                  {a.priority === "high" ? <Badge tone="danger">Prioridade alta</Badge> : null}
                </div>
                <p className="mt-2 text-sm">{a.text}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-subtle">
                    {a.authorName ?? "—"} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                  {(a.kind === "clinical" ? canCreateClinical : canCreateAdmin) ? (
                    <Button size="sm" variant="ghost" loading={resolve.pending} onClick={() => resolve.run(a.id)}>
                      Resolver
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Novo alerta"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={create.pending}
              onClick={async () => {
                const res = await create.run({ patientId, kind, priority, text });
                if (res.ok) {
                  setOpen(false);
                  setText("");
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" htmlFor="al-kind">
              <Select id="al-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                {canCreateAdmin ? <option value="administrative">Administrativo</option> : null}
                {canCreateClinical ? <option value="clinical">Clínico</option> : null}
              </Select>
            </Field>
            <Field label="Prioridade" htmlFor="al-priority">
              <Select id="al-priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="low">Baixa</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
              </Select>
            </Field>
          </div>
          <Field label="Texto" htmlFor="al-text" error={create.fieldErrors.text}>
            <Textarea id="al-text" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
