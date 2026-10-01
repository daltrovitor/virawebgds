// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBudgetAction } from "@/actions/budgets";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function NewBudgetButton({ patientId, professionals }: { patientId: string; professionals: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const [origin, setOrigin] = useState("");
  const { run, pending, error } = useAction(createBudgetAction, { success: (d) => `Orçamento nº ${d.number} criado` });
  return (
    <>
      <Button onClick={() => setOpen(true)}>Novo orçamento</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Novo orçamento"
        description="Usa a tabela de preços padrão. Os itens são incluídos na próxima tela."
        footer={
          <Button
            variant="primary"
            loading={pending}
            onClick={async () => {
              const res = await run({ patientId, professionalId: professionalId || null, origin: origin || null });
              if (res.ok) router.push(`/pacientes/${patientId}/orcamentos/${res.data.id}`);
            }}
          >
            Criar e montar
          </Button>
        }
      >
        <div className="space-y-4">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          <Field label="Responsável" htmlFor="nb-prof">
            <Select id="nb-prof" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Não definido</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Origem / campanha (opcional)" htmlFor="nb-origin">
            <Input id="nb-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
