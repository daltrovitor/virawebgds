// Hello World
"use client";

import { useMemo, useRef, useState } from "react";
import { archiveAttachmentAction, setProfilePhotoAction, uploadAttachmentAction } from "@/actions/clinical";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { cn } from "@/lib/cn";

interface FileRow {
  id: string;
  kind: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  takenOn: string | null;
  createdAt: Date;
  description: string | null;
  uploaderName: string | null;
  thumbUrl: string | null;
  url: string;
  isProfilePhoto: boolean;
  links: { tooth: number | null; procedureName: string | null; locationLabel: string | null; treatmentItemId: string | null }[];
}

const KIND_LABEL: Record<string, string> = { photo: "Foto", radiograph: "Radiografia", document: "Documento", other: "Outro" };

function ZoomImage({ src, alt, zoom }: { src: string; alt: string; zoom: number }) {
  return (
    <div className="h-[60dvh] overflow-auto rounded-md border border-border bg-surface" data-lenis-prevent>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto block h-auto" />
    </div>
  );
}

export function GalleryPanel({
  patientId,
  files,
  canUpload,
  canSetPhoto,
  treatmentItems,
}: {
  patientId: string;
  files: FileRow[];
  canUpload: boolean;
  canSetPhoto: boolean;
  treatmentItems: { id: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [kindFilter, setKindFilter] = useState("all");
  const [itemFilter, setItemFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [viewing, setViewing] = useState<FileRow | null>(null);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const upload = useAction(uploadAttachmentAction, { success: "Arquivo enviado" });
  const archive = useAction((id: string) => archiveAttachmentAction(id, "Arquivado pela ficha"), { success: "Arquivo arquivado" });
  const profile = useAction(setProfilePhotoAction, { success: "Foto do paciente definida" });

  const visible = useMemo(
    () =>
      files.filter((f) => {
        if (kindFilter !== "all" && f.kind !== kindFilter) return false;
        if (itemFilter && !f.links.some((l) => l.treatmentItemId === itemFilter)) return false;
        const date = f.takenOn ?? new Date(f.createdAt).toISOString().slice(0, 10);
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      }),
    [files, kindFilter, itemFilter, from, to],
  );
  const images = visible.filter((f) => f.mimeType.startsWith("image/"));
  const documents = visible.filter((f) => !f.mimeType.startsWith("image/"));
  const compared = files.filter((f) => compare.includes(f.id));

  return (
    <div className="space-y-6">
      {canUpload ? (
        <Card>
          <CardHeader title="Enviar arquivo" description="Fotos, radiografias (JPEG, PNG, WEBP) e PDFs. O original é preservado; miniaturas são derivadas." />
          <CardBody>
            <form
              id="enviar"
              ref={formRef}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.set("patientId", patientId);
                const res = await upload.run(fd);
                if (res.ok) formRef.current?.reset();
              }}
            >
              {upload.error ? <Notice tone="danger" className="sm:col-span-2 lg:col-span-4">{upload.error}</Notice> : null}
              <Field label="Arquivo" htmlFor="up-file" required className="sm:col-span-2">
                <input id="up-file" name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-white file:px-3 file:text-sm" />
              </Field>
              <Field label="Tipo" htmlFor="up-kind">
                <Select id="up-kind" name="kind" defaultValue="photo">
                  <option value="photo">Foto</option>
                  <option value="radiograph">Radiografia</option>
                  <option value="document">Documento</option>
                  <option value="other">Outro</option>
                </Select>
              </Field>
              <Field label="Data do exame/foto" htmlFor="up-date">
                <Input id="up-date" name="takenOn" type="date" />
              </Field>
              <Field label="Dente (FDI, opcional)" htmlFor="up-tooth">
                <Input id="up-tooth" name="tooth" inputMode="numeric" pattern="[1-8][1-8]" />
              </Field>
              <Field label="Procedimento (opcional)" htmlFor="up-item" className="sm:col-span-2">
                <Select id="up-item" name="treatmentItemId" defaultValue="">
                  <option value="">Nenhum</option>
                  {treatmentItems.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Descrição" htmlFor="up-desc">
                <Textarea id="up-desc" name="description" className="min-h-10" />
              </Field>
              <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 lg:col-span-4">
                {canSetPhoto ? <Checkbox label="Usar como foto do paciente" name="isProfilePhoto" value="true" /> : <span />}
                <Button type="submit" variant="primary" loading={upload.pending}>
                  Enviar
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Galeria"
          description={`${images.length} imagem(ns) · ${documents.length} documento(s)`}
          actions={
            compare.length === 2 ? (
              <Button size="sm" variant="primary" onClick={() => (setComparing(true), setZoom(1))}>
                Comparar selecionadas
              </Button>
            ) : (
              <span className="text-xs text-subtle">Selecione 2 imagens para comparar</span>
            )
          }
        />
        <div className="grid grid-cols-1 gap-3 border-b border-border px-4 py-3 sm:grid-cols-4 sm:px-5">
          <Field label="Tipo" htmlFor="gf-kind">
            <Select id="gf-kind" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="all">Todos</option>
              <option value="photo">Fotos</option>
              <option value="radiograph">Radiografias</option>
              <option value="document">Documentos</option>
              <option value="other">Outros</option>
            </Select>
          </Field>
          <Field label="Tratamento" htmlFor="gf-item">
            <Select id="gf-item" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)}>
              <option value="">Todos</option>
              {treatmentItems.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="De" htmlFor="gf-from">
            <Input id="gf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Até" htmlFor="gf-to">
            <Input id="gf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        {visible.length === 0 ? (
          <EmptyState title="Nenhum arquivo" description="Ajuste os filtros ou envie um arquivo." />
        ) : (
          <CardBody className="space-y-6">
            {images.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {images.map((f) => {
                  const selected = compare.includes(f.id);
                  return (
                    <li key={f.id} className={cn("overflow-hidden rounded-md border", selected ? "border-accent ring-2 ring-accent/30" : "border-border")}>
                      <button type="button" className="block w-full cursor-pointer" onClick={() => (setViewing(f), setZoom(1))} aria-label={`Ampliar ${f.originalName}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={f.thumbUrl ?? f.url} alt={f.description ?? f.originalName} loading="lazy" width={240} height={180} className="aspect-[4/3] w-full bg-surface object-cover" />
                      </button>
                      <div className="space-y-1 p-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          <Badge>{KIND_LABEL[f.kind] ?? f.kind}</Badge>
                          {f.isProfilePhoto ? <Badge tone="accent">Foto do paciente</Badge> : null}
                        </div>
                        <p className="truncate text-muted" title={f.originalName}>
                          {f.takenOn ? formatDateBR(f.takenOn) : new Date(f.createdAt).toLocaleDateString("pt-BR")}
                          {f.links.some((l) => l.tooth) ? ` · dente ${f.links.find((l) => l.tooth)?.tooth}` : ""}
                        </p>
                        <label className="flex min-h-8 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4 accent-accent"
                            checked={selected}
                            onChange={(e) => setCompare((c) => (e.target.checked ? [...c.slice(-1), f.id] : c.filter((x) => x !== f.id)))}
                          />
                          Comparar
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {documents.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border">
                {documents.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{f.originalName}</span>
                      <span className="block text-xs text-subtle">
                        {KIND_LABEL[f.kind]} · {(f.sizeBytes / 1024).toFixed(0)} KB · {f.uploaderName ?? "—"}
                      </span>
                    </span>
                    <a href={f.url} className="inline-flex min-h-10 items-center text-accent hover:underline cursor-pointer">
                      Baixar
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        )}
      </Card>

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.originalName ?? ""}
        description={viewing ? `${KIND_LABEL[viewing.kind]} · ${viewing.takenOn ? formatDateBR(viewing.takenOn) : "sem data do exame"} · enviado por ${viewing.uploaderName ?? "—"}` : undefined}
        size="xl"
        footer={
          viewing ? (
            <>
              <div className="mr-auto flex items-center gap-1" role="group" aria-label="Zoom">
                <Button size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Diminuir zoom">
                  −
                </Button>
                <span className="w-14 text-center text-sm tabular">{Math.round(zoom * 100)}%</span>
                <Button size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Aumentar zoom">
                  +
                </Button>
              </div>
              {canSetPhoto && !viewing.isProfilePhoto ? (
                <Button size="sm" loading={profile.pending} onClick={() => profile.run(viewing.id)}>
                  Definir como foto do paciente
                </Button>
              ) : null}
              {canUpload ? (
                <Button
                  size="sm"
                  variant="ghost"
                  loading={archive.pending}
                  onClick={async () => {
                    if (!window.confirm("Arquivar este arquivo? Ele deixa de aparecer na galeria, mas não é apagado.")) return;
                    const res = await archive.run(viewing.id);
                    if (res.ok) setViewing(null);
                  }}
                >
                  Arquivar
                </Button>
              ) : null}
              <a href={viewing.url} className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-sm hover:bg-surface-2 cursor-pointer">
                Original
              </a>
            </>
          ) : null
        }
      >
        {viewing ? (
          <>
            <ZoomImage src={viewing.url} alt={viewing.description ?? viewing.originalName} zoom={zoom} />
            {viewing.description ? <p className="mt-3 text-sm">{viewing.description}</p> : null}
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={comparing}
        onClose={() => setComparing(false)}
        title="Comparar imagens"
        size="xl"
        footer={
          <div className="mr-auto flex items-center gap-1" role="group" aria-label="Zoom sincronizado">
            <Button size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Diminuir zoom">
              −
            </Button>
            <span className="w-14 text-center text-sm tabular">{Math.round(zoom * 100)}%</span>
            <Button size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} aria-label="Aumentar zoom">
              +
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {compared.map((f) => (
            <figure key={f.id}>
              <ZoomImage src={f.url} alt={f.description ?? f.originalName} zoom={zoom} />
              <figcaption className="mt-2 text-xs text-muted">
                {f.takenOn ? formatDateBR(f.takenOn) : new Date(f.createdAt).toLocaleDateString("pt-BR")} · {f.originalName}
              </figcaption>
            </figure>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
