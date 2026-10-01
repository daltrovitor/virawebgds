// Hello World
"use client";

import { useState } from "react";
import { addNoteAddendumAction, deleteDraftNoteAction, saveClinicalNoteAction } from "@/actions/clinical";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateTimeBR } from "@/domain/dates";
import { CLINICAL_LABEL } from "@/lib/status";
import type { TimelineEntry } from "@/server/services/clinical";

export function ClinicalTimeline({ patientId, entries, canEdit, timezone }: { patientId: string; entries: TimelineEntry[]; canEdit: boolean; currentUserId: string; timezone: string }) {
  const [editing, setEditing] = useState<{ id: string | null; title: string; body: string } | null>(null);
  const [addendumFor, setAddendumFor] = useState<string | null>(null);
  const [addendum, setAddendum] = useState({ kind: "addendum" as "addendum" | "correction", body: "" });
  const save = useAction(saveClinicalNoteAction, { success: "Registro salvo" });
  const add = useAction(addNoteAddendumAction, { success: "Adendo registrado" });
  const discard = useAction(deleteDraftNoteAction, { success: "Rascunho descartado" });
  const submit = async (finalize: boolean) => {
    if (!editing) return;
    if (finalize && !window.confirm("Finalizar o registro? Depois disso, alterações só como adendo ou correção.")) return;
    const res = await save.run({ id: editing.id, patientId, title: editing.title, body: editing.body, finalize });
    if (res.ok) setEditing(null);
  };
  return (
    <Card>
      <CardHeader
        title="Histórico clínico"
        description="Linha do tempo de consultas finalizadas, evoluções e anotações. Registros finalizados não são sobrescritos."
        actions={canEdit ? <Button size="sm" variant="primary" onClick={() => setEditing({ id: null, title: "", body: "" })}>Nova anotação</Button> : null}
      />
      <CardBody>
        {entries.length === 0 ? (
          <EmptyState title="Sem registros clínicos" description="Consultas finalizadas e evoluções aparecem aqui automaticamente." />
        ) : (
          <ol className="relative space-y-5 border-l border-border pl-5">
            {entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="relative">
                <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-white bg-accent" aria-hidden="true" />
                <p className="text-xs text-subtle tabular">{formatDateTimeBR(e.at, timezone)}</p>
                {e.kind === "note" ? (
                  <div className="mt-1 rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{e.title}</p>
                      <Badge tone={e.status === "final" ? "success" : "warning"}>{e.status === "final" ? "Finalizado" : "Rascunho"}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{e.body}</p>
                    <p className="mt-2 text-xs text-subtle">
                      {e.professionalName ?? e.authorName ?? "—"}
                    </p>
                    {e.addenda.length > 0 ? (
                      <ul className="mt-3 space-y-2 border-t border-border pt-3">
                        {e.addenda.map((a, i) => (
                          <li key={i} className="text-sm">
                            <Badge tone={a.kind === "correction" ? "warning" : "info"}>{a.kind === "correction" ? "Correção" : "Adendo"}</Badge>{" "}
                            <span className="text-xs text-subtle">
                              {formatDateTimeBR(a.at, timezone)} · {a.authorName ?? "—"}
                            </span>
                            <p className="mt-1 whitespace-pre-wrap">{a.body}</p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canEdit ? (
                      <div className="mt-3 flex gap-2">
                        {e.status === "draft" ? (
                          <>
                            <Button size="sm" onClick={() => setEditing({ id: e.id, title: e.title, body: e.body })}>
                              Continuar editando
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => window.confirm("Descartar o rascunho?") && discard.run(e.id)}>
                              Descartar
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={() => (setAddendumFor(e.id), setAddendum({ kind: "addendum", body: "" }))}>
                            Adendo / correção
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : e.kind === "progress" ? (
                  <div className="mt-1 text-sm">
                    <p>
                      <span className="font-medium">{e.procedureName}</span> · {e.locationLabel}
                      {e.sessionLabel ? ` · ${e.sessionLabel}` : ""} — <Badge tone="accent">{CLINICAL_LABEL[e.resultingStatus] ?? e.resultingStatus}</Badge>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted">{e.description}</p>
                    <p className="text-xs text-subtle">{e.professionalName ?? ""}</p>
                  </div>
                ) : (
                  <div className="mt-1 text-sm">
                    <p className="font-medium">Consulta finalizada · {e.professionalName}</p>
                    {e.planned ? <p className="text-muted">Previsto: {e.planned}</p> : null}
                    {e.performed ? <p className="text-muted">Realizado: {e.performed}</p> : null}
                    {e.attachments > 0 ? <p className="text-xs text-subtle">{e.attachments} arquivo(s) vinculado(s)</p> : null}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
      <Dialog
        open={editing !== null}
        onClose={() => {
          if (editing && (editing.title || editing.body) && !window.confirm("Descartar o texto não salvo?")) return;
          setEditing(null);
        }}
        title={editing?.id ? "Editar rascunho" : "Nova anotação clínica"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => void submit(false)} loading={save.pending}>
              Salvar rascunho
            </Button>
            <Button variant="primary" onClick={() => void submit(true)} loading={save.pending}>
              Finalizar registro
            </Button>
          </>
        }
      >
        {editing ? (
          <div className="space-y-4">
            {save.error ? <Notice tone="danger">{save.error}</Notice> : null}
            <Field label="Título" htmlFor="nt-title" required error={save.fieldErrors.title}>
              <Input id="nt-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </Field>
            <Field label="Texto" htmlFor="nt-body" required error={save.fieldErrors.body} hint="O sistema não produz diagnósticos; registre o que foi observado e realizado.">
              <Textarea id="nt-body" className="min-h-48" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Dialog>
      <Dialog
        open={addendumFor !== null}
        onClose={() => setAddendumFor(null)}
        title="Adendo ou correção"
        description="O texto original permanece; o adendo fica registrado com autoria e data."
        footer={
          <Button
            variant="primary"
            loading={add.pending}
            onClick={async () => {
              if (!addendumFor) return;
              const res = await add.run({ noteId: addendumFor, kind: addendum.kind, body: addendum.body });
              if (res.ok) setAddendumFor(null);
            }}
          >
            Registrar
          </Button>
        }
      >
        <div className="space-y-4">
          {add.error ? <Notice tone="danger">{add.error}</Notice> : null}
          <Field label="Tipo" htmlFor="ad-kind">
            <Select id="ad-kind" value={addendum.kind} onChange={(e) => setAddendum({ ...addendum, kind: e.target.value as "addendum" | "correction" })}>
              <option value="addendum">Adendo</option>
              <option value="correction">Correção</option>
            </Select>
          </Field>
          <Field label="Texto" htmlFor="ad-body" required>
            <Textarea id="ad-body" value={addendum.body} onChange={(e) => setAddendum({ ...addendum, body: e.target.value })} />
          </Field>
        </div>
      </Dialog>
    </Card>
  );
}
