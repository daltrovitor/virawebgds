// Hello World
"use client";

import { useState } from "react";
import { recordAnamnesisAction, reviewAnamnesisAction } from "@/actions/clinical";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";

interface Question {
  id: string;
  label: string;
  type: "yes_no" | "text" | "yes_no_details";
  alertOnYes?: boolean;
}

interface Response {
  id: string;
  answeredOn: string;
  respondentName: string;
  respondentRelation: string | null;
  answers: Record<string, { answer: string; details?: string }>;
  templateVersion: number;
  questions: Question[];
  recordedByName: string | null;
  reviewerName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export function AnamnesisPanel({
  patientId,
  patientName,
  template,
  history,
  canEdit,
  canReview,
}: {
  patientId: string;
  patientName: string;
  template: { id: string; version: number; questions: Question[] } | null;
  history: Response[];
  canEdit: boolean;
  canReview: boolean;
}) {
  const [filling, setFilling] = useState(false);
  const [answers, setAnswers] = useState<Record<string, { answer: string; details?: string }>>({});
  const [respondentName, setRespondentName] = useState(patientName);
  const [relation, setRelation] = useState("");
  const [answeredOn, setAnsweredOn] = useState(new Date().toISOString().slice(0, 10));
  const save = useAction(recordAnamnesisAction, { success: (d) => (d.alerts > 0 ? `Anamnese salva; ${d.alerts} alerta(s) para revisão do profissional` : "Anamnese salva") });
  const review = useAction((id: string) => reviewAnamnesisAction(id, null), { success: "Revisão registrada" });
  const setA = (id: string, patch: { answer?: string; details?: string }) => setAnswers((s) => ({ ...s, [id]: { answer: s[id]?.answer ?? "", ...s[id], ...patch } }));
  return (
    <div className="space-y-6">
      {canEdit && template ? (
        <Card>
          <CardHeader
            title="Preencher anamnese"
            description={`Questionário versão ${template.version}. Cada preenchimento gera uma nova versão datada; as anteriores são preservadas.`}
            actions={!filling ? <Button size="sm" variant="primary" onClick={() => setFilling(true)}>Novo preenchimento</Button> : null}
          />
          {filling ? (
            <CardBody>
              <form
                className="space-y-5"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await save.run({ patientId, templateId: template.id, answeredOn, respondentName, respondentRelation: relation || null, answers });
                  if (res.ok) {
                    setFilling(false);
                    setAnswers({});
                  }
                }}
              >
                {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Quem respondeu" htmlFor="an-who" required>
                    <Input id="an-who" value={respondentName} onChange={(e) => setRespondentName(e.target.value)} />
                  </Field>
                  <Field label="Relação com o paciente" htmlFor="an-rel" hint="Deixe vazio se for o próprio paciente">
                    <Input id="an-rel" value={relation} onChange={(e) => setRelation(e.target.value)} />
                  </Field>
                  <Field label="Data" htmlFor="an-date">
                    <Input id="an-date" type="date" value={answeredOn} onChange={(e) => setAnsweredOn(e.target.value)} />
                  </Field>
                </div>
                <ol className="space-y-4">
                  {template.questions.map((q, i) => (
                    <li key={q.id} className="rounded-md border border-border p-3">
                      <fieldset>
                        <legend className="text-sm font-medium">
                          {i + 1}. {q.label}
                        </legend>
                        {q.type !== "text" ? (
                          <div className="mt-2 flex gap-4" role="radiogroup">
                            {["sim", "não"].map((opt) => (
                              <label key={opt} className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                                <input type="radio" name={`q-${q.id}`} className="size-4 accent-accent" checked={answers[q.id]?.answer === opt} onChange={() => setA(q.id, { answer: opt })} />
                                {opt === "sim" ? "Sim" : "Não"}
                              </label>
                            ))}
                          </div>
                        ) : null}
                        {q.type === "text" || (q.type === "yes_no_details" && answers[q.id]?.answer === "sim") ? (
                          <Textarea
                            aria-label={q.type === "text" ? q.label : `Detalhes: ${q.label}`}
                            className="mt-2 min-h-16"
                            value={q.type === "text" ? (answers[q.id]?.answer ?? "") : (answers[q.id]?.details ?? "")}
                            onChange={(e) => setA(q.id, q.type === "text" ? { answer: e.target.value } : { details: e.target.value })}
                          />
                        ) : null}
                      </fieldset>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-subtle">Respostas positivas em perguntas marcadas geram alerta clínico para revisão. O sistema não conclui condições clínicas.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => (window.confirm("Descartar o preenchimento?") ? setFilling(false) : null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" loading={save.pending}>
                    Salvar anamnese
                  </Button>
                </div>
              </form>
            </CardBody>
          ) : null}
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Versões registradas" />
        {history.length === 0 ? (
          <EmptyState title="Nenhuma anamnese registrada" />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="px-4 py-4 sm:px-5">
                <details>
                  <summary className="flex min-h-10 cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium tabular">{formatDateBR(h.answeredOn)}</span>
                    <span className="text-muted">
                      {h.respondentName}
                      {h.respondentRelation ? ` (${h.respondentRelation})` : ""} · versão {h.templateVersion} · registrado por {h.recordedByName ?? "—"}
                    </span>
                    {h.reviewedAt ? <Badge tone="success">Revisada por {h.reviewerName}</Badge> : <Badge tone="warning">Aguardando revisão</Badge>}
                  </summary>
                  <dl className="mt-3 space-y-2 text-sm">
                    {h.questions.map((q) => (
                      <div key={q.id} className="grid grid-cols-1 gap-1 sm:grid-cols-[1.618fr_1fr]">
                        <dt className="text-muted">{q.label}</dt>
                        <dd className={h.answers[q.id]?.answer === "sim" && q.alertOnYes ? "font-medium text-danger" : ""}>
                          {h.answers[q.id]?.answer || "—"}
                          {h.answers[q.id]?.details ? ` — ${h.answers[q.id]!.details}` : ""}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {!h.reviewedAt && canReview ? (
                    <Button size="sm" className="mt-3" loading={review.pending} onClick={() => review.run(h.id)}>
                      Marcar como revisada
                    </Button>
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
