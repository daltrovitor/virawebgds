// Hello World
"use client";

import { useState } from "react";
import { saveProcedureAction, saveSpecialtyAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { BILLING_UNIT_LABEL, BILLING_UNITS, LOCATION_KIND_LABEL, LOCATION_KINDS, type BillingUnit, type LocationKind } from "@/domain/budget";

interface Specialty {
  id: string;
  name: string;
  active: boolean;
}
interface Procedure {
  id: string;
  specialtyId: string;
  specialtyName: string;
  code: string;
  name: string;
  description: string | null;
  billingUnit: BillingUnit;
  allowedLocations: LocationKind[];
  suggestedMinutes: number | null;
  active: boolean;
}

const REQUIRED: Partial<Record<BillingUnit, LocationKind>> = { tooth: "teeth", arch: "arches", hemiarch: "hemiarches" };

export function CatalogManager({ specialties, procedures }: { specialties: Specialty[]; procedures: Procedure[] }) {
  const [specDialog, setSpecDialog] = useState<Specialty | { id: null; name: string; active: boolean } | null>(null);
  const [procDialog, setProcDialog] = useState<(Omit<Procedure, "id" | "specialtyName"> & { id: string | null }) | null>(null);
  const [filter, setFilter] = useState("");
  const saveSpec = useAction(saveSpecialtyAction, { success: "Especialidade salva" });
  const saveProc = useAction(saveProcedureAction, { success: "Procedimento salvo" });
  const visible = procedures.filter((p) => !filter || p.specialtyId === filter);
  const setUnit = (u: BillingUnit) => {
    if (!procDialog) return;
    const req = REQUIRED[u];
    const wasRegion = Boolean(REQUIRED[procDialog.billingUnit]);
    // Unidades por região exigem a localização correspondente; ao sair delas, inclui "sem região".
    const allowedLocations: LocationKind[] = req ? [req] : wasRegion ? ["none", ...procDialog.allowedLocations.filter((l) => l !== "none")] : procDialog.allowedLocations;
    setProcDialog({ ...procDialog, billingUnit: u, allowedLocations });
  };
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.618fr]">
      <Card>
        <CardHeader title="Especialidades" description="Exemplos editáveis; não são listas fechadas." actions={<Button size="sm" onClick={() => setSpecDialog({ id: null, name: "", active: true })}>Nova</Button>} />
        <ul className="divide-y divide-border">
          {specialties.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
              <span>
                {s.name} {!s.active ? <Badge>Inativa</Badge> : null}
                <span className="block text-xs text-subtle">{procedures.filter((p) => p.specialtyId === s.id).length} procedimento(s)</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSpecDialog(s)}>
                Editar
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Procedimentos"
          actions={
            <div className="flex flex-wrap gap-2">
              <label htmlFor="pf" className="sr-only">
                Filtrar por especialidade
              </label>
              <select id="pf" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border border-border-strong px-2 text-sm">
                <option value="">Todas as especialidades</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="primary"
                disabled={specialties.length === 0}
                onClick={() =>
                  setProcDialog({ id: null, specialtyId: filter || specialties[0]!.id, code: "", name: "", description: "", billingUnit: "tooth", allowedLocations: ["teeth"], suggestedMinutes: 30, active: true })
                }
              >
                Novo procedimento
              </Button>
            </div>
          }
        />
        {visible.length === 0 ? (
          <EmptyState title="Nenhum procedimento" description="Cadastre procedimentos e depois defina os preços em Tabelas de preço." />
        ) : (
          <TableWrap label="Procedimentos">
            <Table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Nome</Th>
                  <Th>Especialidade</Th>
                  <Th>Cobrança</Th>
                  <Th>Localização</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <Tr key={p.id}>
                    <Td className="tabular text-muted">{p.code}</Td>
                    <Td>
                      {p.name} {!p.active ? <Badge>Inativo</Badge> : null}
                    </Td>
                    <Td>{p.specialtyName}</Td>
                    <Td>{BILLING_UNIT_LABEL[p.billingUnit]}</Td>
                    <Td className="text-muted">{p.allowedLocations.map((l) => LOCATION_KIND_LABEL[l]).join(", ")}</Td>
                    <Td align="right">
                      <Button size="sm" variant="ghost" onClick={() => setProcDialog({ ...p })}>
                        Editar
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
      {specDialog ? (
        <Dialog
          open
          onClose={() => setSpecDialog(null)}
          title={specDialog.id ? "Editar especialidade" : "Nova especialidade"}
          footer={
            <Button
              variant="primary"
              loading={saveSpec.pending}
              onClick={async () => {
                const res = await saveSpec.run({ id: specDialog.id, name: specDialog.name, active: specDialog.active });
                if (res.ok) setSpecDialog(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="space-y-4">
            {saveSpec.error ? <Notice tone="danger">{saveSpec.error}</Notice> : null}
            <Field label="Nome" htmlFor="sp-name" required>
              <Input id="sp-name" value={specDialog.name} onChange={(e) => setSpecDialog({ ...specDialog, name: e.target.value })} />
            </Field>
            <Checkbox label="Ativa" checked={specDialog.active} onChange={(e) => setSpecDialog({ ...specDialog, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}
      {procDialog ? (
        <Dialog
          open
          onClose={() => setProcDialog(null)}
          title={procDialog.id ? "Editar procedimento" : "Novo procedimento"}
          size="lg"
          footer={
            <Button
              variant="primary"
              loading={saveProc.pending}
              onClick={async () => {
                const res = await saveProc.run({
                  id: procDialog.id,
                  specialtyId: procDialog.specialtyId,
                  code: procDialog.code,
                  name: procDialog.name,
                  description: procDialog.description || null,
                  billingUnit: procDialog.billingUnit,
                  allowedLocations: procDialog.allowedLocations,
                  suggestedMinutes: procDialog.suggestedMinutes,
                  active: procDialog.active,
                });
                if (res.ok) setProcDialog(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {saveProc.error ? <Notice tone="danger" className="sm:col-span-2">{saveProc.error}</Notice> : null}
            <Field label="Especialidade" htmlFor="pr-spec">
              <Select id="pr-spec" value={procDialog.specialtyId} onChange={(e) => setProcDialog({ ...procDialog, specialtyId: e.target.value })}>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Código interno" htmlFor="pr-code" required error={saveProc.fieldErrors.code}>
              <Input id="pr-code" value={procDialog.code} onChange={(e) => setProcDialog({ ...procDialog, code: e.target.value })} />
            </Field>
            <Field label="Nome" htmlFor="pr-name" required className="sm:col-span-2" error={saveProc.fieldErrors.name}>
              <Input id="pr-name" value={procDialog.name} onChange={(e) => setProcDialog({ ...procDialog, name: e.target.value })} />
            </Field>
            <Field label="Unidade de cobrança" htmlFor="pr-unit">
              <Select id="pr-unit" value={procDialog.billingUnit} onChange={(e) => setUnit(e.target.value as BillingUnit)}>
                {BILLING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {BILLING_UNIT_LABEL[u]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duração sugerida (min)" htmlFor="pr-min">
              <Input id="pr-min" type="number" min={5} step={5} value={procDialog.suggestedMinutes ?? ""} onChange={(e) => setProcDialog({ ...procDialog, suggestedMinutes: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <fieldset className="sm:col-span-2" disabled={Boolean(REQUIRED[procDialog.billingUnit])}>
              <legend className="mb-2 text-sm font-medium">Localizações permitidas</legend>
              <div className="flex flex-wrap gap-3">
                {LOCATION_KINDS.map((k) => (
                  <Checkbox
                    key={k}
                    label={LOCATION_KIND_LABEL[k]}
                    checked={procDialog.allowedLocations.includes(k)}
                    onChange={(e) =>
                      setProcDialog({ ...procDialog, allowedLocations: e.target.checked ? [...procDialog.allowedLocations, k] : procDialog.allowedLocations.filter((x) => x !== k) })
                    }
                  />
                ))}
              </div>
              {REQUIRED[procDialog.billingUnit] ? <p className="mt-1 text-xs text-muted">Cobrança por região usa exatamente a localização correspondente.</p> : null}
              {saveProc.fieldErrors.allowedLocations ? <p className="mt-1 text-xs text-danger">{saveProc.fieldErrors.allowedLocations}</p> : null}
            </fieldset>
            <Field label="Descrição" htmlFor="pr-desc" className="sm:col-span-2">
              <Textarea id="pr-desc" value={procDialog.description ?? ""} onChange={(e) => setProcDialog({ ...procDialog, description: e.target.value })} />
            </Field>
            <Checkbox label="Ativo" checked={procDialog.active} onChange={(e) => setProcDialog({ ...procDialog, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
