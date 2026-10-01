// Hello World
"use client";

import { useState } from "react";
import { deleteResponsibleAction, saveResponsibleAction } from "@/actions/patients";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatPhone } from "@/domain/text";

interface Responsible {
  id: string;
  name: string;
  relationship: string | null;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  isFinancialResponsible: boolean;
}

export function ResponsiblesPanel({ patientId, responsibles, canEdit }: { patientId: string; responsibles: Responsible[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", cpf: "", phone: "", email: "", isFinancialResponsible: false });
  const save = useAction(saveResponsibleAction, { success: "Responsável salvo" });
  const remove = useAction((id: string) => deleteResponsibleAction(patientId, id), { success: "Responsável removido" });
  return (
    <Card>
      <CardHeader title="Responsáveis" description="Quando aplicável (menores, responsável financeiro)." actions={canEdit ? <Button size="sm" onClick={() => setOpen(true)}>Adicionar</Button> : null} />
      <CardBody>
        {responsibles.length === 0 ? (
          <p className="text-sm text-muted">Nenhum responsável cadastrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {responsibles.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                <div className="text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    {[r.relationship, r.phone ? formatPhone(r.phone) : null, r.email, r.cpf].filter(Boolean).join(" · ")}
                  </p>
                  {r.isFinancialResponsible ? <Badge tone="info" className="mt-1">Responsável financeiro</Badge> : null}
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Remover ${r.name}?`)) void remove.run(r.id);
                    }}
                  >
                    Remover
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Novo responsável"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={save.pending}
              onClick={async () => {
                const res = await save.run({ patientId, ...form });
                if (res.ok) {
                  setOpen(false);
                  setForm({ name: "", relationship: "", cpf: "", phone: "", email: "", isFinancialResponsible: false });
                }
              }}
            >
              Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {save.error ? <Notice tone="danger" className="sm:col-span-2">{save.error}</Notice> : null}
          <Field label="Nome" htmlFor="r-name" required error={save.fieldErrors.name} className="sm:col-span-2">
            <Input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Parentesco / relação" htmlFor="r-rel">
            <Input id="r-rel" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
          </Field>
          <Field label="CPF" htmlFor="r-cpf" error={save.fieldErrors.cpf}>
            <Input id="r-cpf" inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          </Field>
          <Field label="Telefone" htmlFor="r-phone" error={save.fieldErrors.phone}>
            <Input id="r-phone" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="E-mail" htmlFor="r-email" error={save.fieldErrors.email}>
            <Input id="r-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Checkbox label="Responsável financeiro" checked={form.isFinancialResponsible} onChange={(e) => setForm({ ...form, isFinancialResponsible: e.target.checked })} />
        </div>
      </Dialog>
    </Card>
  );
}
