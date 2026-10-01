// Hello World
"use client";

import { useState } from "react";
import { saveAnamnesisTemplateAction } from "@/actions/clinical";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

interface Q {
  id: string;
  label: string;
  type: "yes_no" | "text" | "yes_no_details";
  alertOnYes?: boolean;
}

function slug(label: string, taken: string[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 30) || "pergunta";
  let id = base;
  let i = 2;
  while (taken.includes(id)) id = `${base}_${i++}`;
  return id;
}

export function AnamnesisEditor({ version, questions }: { version: number; questions: Q[] }) {
  const [list, setList] = useState<Q[]>(questions);
  const save = useAction(saveAnamnesisTemplateAction, { success: (d) => `Versão ${d.version} salva` });
  return (
    <Card>
      <CardHeader title={`Questionário (versão ${version})`} description="Perguntas marcadas geram alerta clínico para revisão quando respondidas com “sim”. O sistema não conclui condições clínicas." />
      <CardBody className="space-y-3">
        {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
        {list.map((q, i) => (
          <div key={q.id} className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 lg:grid-cols-[1fr_14rem_auto_auto]">
            <Input aria-label={`Pergunta ${i + 1}`} value={q.label} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
            <Select aria-label="Tipo de resposta" value={q.type} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, type: e.target.value as Q["type"] } : x)))}>
              <option value="yes_no">Sim/Não</option>
              <option value="yes_no_details">Sim/Não com detalhes</option>
              <option value="text">Texto livre</option>
            </Select>
            <Checkbox label="Alerta se “sim”" disabled={q.type === "text"} checked={Boolean(q.alertOnYes)} onChange={(e) => setList((l) => l.map((x, k) => (k === i ? { ...x, alertOnYes: e.target.checked } : x)))} />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={i === 0} aria-label="Mover para cima" onClick={() => setList((l) => { const c = [...l]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; return c; })}>
                ↑
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setList((l) => l.filter((_, k) => k !== i))}>
                Remover
              </Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap justify-between gap-2">
          <Button onClick={() => setList((l) => [...l, { id: slug(`pergunta ${l.length + 1}`, l.map((x) => x.id)), label: "", type: "yes_no" }])}>Adicionar pergunta</Button>
          <Button
            variant="primary"
            loading={save.pending}
            onClick={() => save.run({ questions: list.map((q) => ({ ...q, id: q.id || slug(q.label, list.map((x) => x.id)), alertOnYes: q.type === "text" ? false : Boolean(q.alertOnYes) })) })}
          >
            Salvar nova versão
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
