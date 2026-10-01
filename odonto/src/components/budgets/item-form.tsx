// Hello World
"use client";

import { useMemo, useState } from "react";
import { addItemsAction } from "@/actions/budgets";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import {
  BILLING_UNIT_LABEL,
  BudgetRuleError,
  expandItems,
  LOCATION_KIND_LABEL,
  previewTotal,
  type BillingUnit,
  type LocationKind,
  type LocationSelection,
} from "@/domain/budget";
import { formatBRL } from "@/domain/money";
import { HEMIARCH_LABEL, type Arch, type Hemiarch } from "@/domain/teeth";
import { cn } from "@/lib/cn";
import { Odontogram } from "./odontogram";

export interface CatalogProcedure {
  id: string;
  specialtyId: string;
  code: string;
  name: string;
  billingUnit: BillingUnit;
  allowedLocations: LocationKind[];
  referencePriceCents: number | null;
}

const UNIT_HELP: Record<BillingUnit, string> = {
  tooth: "Cada dente selecionado vira um item rastreável.",
  arch: "Cada arcada vira um item; ambas = duas unidades.",
  hemiarch: "Cada hemiarcada vira um item.",
  session: "Multiplica pela quantidade de sessões.",
  global: "Preço único para a região informada; não multiplica por dentes.",
};

export function ItemForm({
  budgetId,
  priceTableName,
  specialties,
  procedures,
}: {
  budgetId: string;
  priceTableName: string;
  specialties: { id: string; name: string }[];
  procedures: CatalogProcedure[];
}) {
  const [specialtyId, setSpecialtyId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [kind, setKind] = useState<LocationKind>("none");
  const [teeth, setTeeth] = useState<number[]>([]);
  const [arches, setArches] = useState<Arch[]>([]);
  const [hemi, setHemi] = useState<Hemiarch[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [justification, setJustification] = useState("");
  const [needsJustification, setNeedsJustification] = useState<string[] | null>(null);
  const add = useAction(addItemsAction, { success: (d) => `${d.itemIds.length} item(ns) incluído(s): ${formatBRL(d.totalCents)}` });

  const procOptions = procedures.filter((p) => p.specialtyId === specialtyId);
  const proc = procedures.find((p) => p.id === procedureId) ?? null;

  const selectProcedure = (id: string) => {
    setProcedureId(id);
    const p = procedures.find((x) => x.id === id);
    setPrice(p?.referencePriceCents ?? null);
    setKind(p?.allowedLocations[0] ?? "none");
    setQuantity(1);
    setNeedsJustification(null);
  };

  const selection = useMemo<LocationSelection>(
    () => (kind === "teeth" ? { kind, teeth } : kind === "arches" ? { kind, arches } : kind === "hemiarches" ? { kind, hemiarches: hemi } : { kind: "none" }),
    [kind, teeth, arches, hemi],
  );

  const preview = useMemo(() => {
    if (!proc || price === null) return null;
    try {
      const drafts = expandItems({ billingUnit: proc.billingUnit, allowedLocations: proc.allowedLocations, selection, quantity, unitPriceCents: price });
      return { count: drafts.length, total: previewTotal(drafts), error: null as string | null };
    } catch (err) {
      return { count: 0, total: 0, error: err instanceof BudgetRuleError ? err.message : "Seleção inválida" };
    }
  }, [proc, price, selection, quantity]);

  const reset = () => {
    setTeeth([]);
    setArches([]);
    setHemi([]);
    setQuantity(1);
    setNotes("");
    setJustification("");
    setNeedsJustification(null);
    if (proc) setPrice(proc.referencePriceCents);
  };

  const submit = async () => {
    if (!proc) return;
    const res = await add.run({
      budgetId,
      procedureId: proc.id,
      selection,
      quantity,
      unitPriceCents: price,
      notes: notes || null,
      duplicateJustification: needsJustification ? justification : null,
    });
    if (res.ok) reset();
    else if (res.code === "conflict" && res.details && typeof res.details === "object" && "duplicates" in res.details) {
      setNeedsJustification((res.details as { duplicates: string[] }).duplicates);
    }
  };

  return (
    <Card>
      <CardHeader title="Incluir procedimento" description={`Tabela: ${priceTableName}. O valor do item é editável e não altera a tabela.`} />
      <CardBody>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {add.error && !needsJustification ? <Notice tone="danger">{add.error}</Notice> : null}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Especialidade" htmlFor="it-spec">
              <Select
                id="it-spec"
                value={specialtyId}
                onChange={(e) => {
                  setSpecialtyId(e.target.value);
                  // Procedimento incompatível com a nova especialidade é limpo.
                  if (!procedures.some((p) => p.id === procedureId && p.specialtyId === e.target.value)) {
                    setProcedureId("");
                    setPrice(null);
                  }
                }}
              >
                <option value="">Selecione</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Procedimento" htmlFor="it-proc" hint={specialtyId && procOptions.length === 0 ? "Nenhum procedimento ativo nesta especialidade" : undefined}>
              <Select id="it-proc" value={procedureId} disabled={!specialtyId} onChange={(e) => selectProcedure(e.target.value)}>
                <option value="">{specialtyId ? "Selecione" : "Escolha a especialidade"}</option>
                {procOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {proc ? (
            <>
              <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
                <strong className="font-medium text-fg">{BILLING_UNIT_LABEL[proc.billingUnit]}.</strong> {UNIT_HELP[proc.billingUnit]}
              </div>
              {proc.allowedLocations.length > 1 ? (
                <div role="radiogroup" aria-label="Tipo de localização" className="flex flex-wrap gap-1">
                  {proc.allowedLocations.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={kind === k}
                      onClick={() => setKind(k)}
                      className={cn("min-h-10 rounded-md border px-3 text-sm cursor-pointer", kind === k ? "border-accent bg-accent-soft font-medium text-accent-strong" : "border-border-strong text-muted hover:text-fg")}
                    >
                      {LOCATION_KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              ) : null}
              {kind === "teeth" ? <Odontogram selected={teeth} onChange={setTeeth} /> : null}
              {kind === "arches" ? (
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="mb-2 text-sm font-medium">Arcadas</legend>
                  {(["upper", "lower"] as Arch[]).map((a) => (
                    <label key={a} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 text-sm">
                      <input type="checkbox" className="size-4 accent-accent" checked={arches.includes(a)} onChange={(e) => setArches((s) => (e.target.checked ? [...s, a] : s.filter((x) => x !== a)))} />
                      {a === "upper" ? "Superior" : "Inferior"}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {kind === "hemiarches" ? (
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="mb-2 text-sm font-medium">Hemiarcadas</legend>
                  {([1, 2, 3, 4] as Hemiarch[]).map((h) => (
                    <label key={h} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border-strong px-3 text-sm">
                      <input type="checkbox" className="size-4 accent-accent" checked={hemi.includes(h)} onChange={(e) => setHemi((s) => (e.target.checked ? [...s, h] : s.filter((x) => x !== h)))} />
                      {HEMIARCH_LABEL[h]}
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {proc.billingUnit === "session" || proc.billingUnit === "global" ? (
                  <Field label={proc.billingUnit === "session" ? "Sessões" : "Quantidade"} htmlFor="it-qty">
                    <Input id="it-qty" type="number" min={1} max={999} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
                  </Field>
                ) : null}
                <Field
                  label="Preço unitário"
                  htmlFor="it-price"
                  hint={proc.referencePriceCents === null ? "Sem preço cadastrado nesta tabela: informe o valor" : `Tabela: ${formatBRL(proc.referencePriceCents)}`}
                  error={add.fieldErrors.unitPriceCents}
                >
                  <MoneyInput id="it-price" value={price} onChange={setPrice} />
                </Field>
                <Field label="Observação do item" htmlFor="it-notes" className="sm:col-span-1">
                  <Textarea id="it-notes" className="min-h-10" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm" aria-live="polite">
                  {preview?.error ? (
                    <span className="text-danger">{preview.error}</span>
                  ) : preview ? (
                    <>
                      <strong className="tabular">{preview.count}</strong> item(ns) ×{" "}
                      <span className="tabular">{formatBRL(price)}</span>
                      {quantity > 1 ? ` × ${quantity}` : ""} = <strong className="tabular">{formatBRL(preview.total)}</strong>
                    </>
                  ) : (
                    <span className="text-muted">Informe o preço para ver o total.</span>
                  )}
                </p>
                <Button type="submit" variant="primary" loading={add.pending} disabled={!preview || Boolean(preview.error) || price === null}>
                  Incluir no orçamento
                </Button>
              </div>
              {needsJustification ? (
                <Notice tone="warning" title="Procedimento já incluído nesta localização">
                  <p>Para incluir novamente de forma deliberada, informe a justificativa.</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label="Justificativa da inclusão repetida"
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      className="h-10 flex-1 rounded-md border border-border-strong bg-white px-3 text-sm text-fg"
                    />
                    <Button size="md" onClick={() => void submit()} disabled={justification.trim().length < 3} loading={add.pending}>
                      Incluir com justificativa
                    </Button>
                    <Button size="md" variant="ghost" onClick={() => setNeedsJustification(null)}>
                      Não incluir
                    </Button>
                  </div>
                </Notice>
              ) : null}
            </>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
