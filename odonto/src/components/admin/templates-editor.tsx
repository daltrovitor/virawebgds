// Hello World
"use client";

import { useState } from "react";
import { updateTemplateAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

const FIELDS: Record<string, string[]> = {
  contract: ["clinica.nome", "clinica.documento", "clinica.endereco", "cidade", "data", "paciente.nome", "responsavel.nome", "orcamento.numero", "acordo.data", "acordo.total", "acordo.itens", "acordo.parcelas"],
  receipt: ["clinica.nome", "paciente.nome", "recibo.valor", "recibo.forma", "recibo.referencia", "recibo.data", "cidade", "data"],
};

export function TemplatesEditor({ templates }: { templates: { id: string; kind: string; name: string; body: string; version: number }[] }) {
  const [bodies, setBodies] = useState<Record<string, string>>(Object.fromEntries(templates.map((t) => [t.id, t.body])));
  const save = useAction(updateTemplateAction, { success: "Nova versão do modelo salva" });
  return (
    <div className="space-y-6">
      {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
      {templates.map((t) => (
        <Card key={t.id}>
          <CardHeader title={`${t.name} (versão ${t.version})`} description={`Campos disponíveis: ${(FIELDS[t.kind] ?? []).map((f) => `{{${f}}}`).join(" ")}`} />
          <CardBody className="space-y-3">
            <Textarea aria-label={`Texto do modelo ${t.name}`} className="min-h-72 font-mono text-xs" value={bodies[t.id] ?? ""} onChange={(e) => setBodies({ ...bodies, [t.id]: e.target.value })} />
            <div className="flex justify-end">
              <Button variant="primary" disabled={bodies[t.id] === t.body} loading={save.pending} onClick={() => save.run({ id: t.id, body: bodies[t.id] ?? "" })}>
                Salvar nova versão
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
