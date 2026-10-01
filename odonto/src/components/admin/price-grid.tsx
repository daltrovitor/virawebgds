// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { savePriceTableAction, setPriceAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { formatBRL } from "@/domain/money";

export function PriceGrid({
  tables,
  tableId,
  procedures,
  prices,
}: {
  tables: { id: string; name: string; isDefault: boolean; active: boolean }[];
  tableId: string | null;
  procedures: { id: string; code: string; name: string; specialtyName: string }[];
  prices: Record<string, number>;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [tableDialog, setTableDialog] = useState<{ id: string | null; name: string; isDefault: boolean; active: boolean } | null>(null);
  const setPrice = useAction(setPriceAction, { success: "Preço atualizado na tabela" });
  const saveTable = useAction(savePriceTableAction, { success: "Tabela salva" });
  const current = tables.find((t) => t.id === tableId);
  return (
    <Card>
      <CardHeader
        title={current ? `Tabela: ${current.name}` : "Tabelas de preço"}
        description={current?.isDefault ? "Tabela padrão dos novos orçamentos" : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="tb" className="sr-only">
              Tabela
            </label>
            <select id="tb" value={tableId ?? ""} onChange={(e) => router.push(`/cadastros/precos?tabela=${e.target.value}`)} className="h-9 rounded-md border border-border-strong px-2 text-sm">
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? " (padrão)" : ""}
                  {!t.active ? " (inativa)" : ""}
                </option>
              ))}
            </select>
            {current ? (
              <Button size="sm" variant="ghost" onClick={() => setTableDialog({ ...current })}>
                Editar tabela
              </Button>
            ) : null}
            <Button size="sm" onClick={() => setTableDialog({ id: null, name: "", isDefault: false, active: true })}>
              Nova tabela
            </Button>
          </div>
        }
      />
      {setPrice.error ? <Notice tone="danger" className="m-4">{setPrice.error}</Notice> : null}
      {procedures.length === 0 || !tableId ? (
        <EmptyState title="Nenhum procedimento ativo" description="Cadastre procedimentos primeiro." />
      ) : (
        <TableWrap label="Preços por procedimento">
          <Table>
            <thead>
              <tr>
                <Th>Especialidade</Th>
                <Th>Código</Th>
                <Th>Procedimento</Th>
                <Th align="right">Preço vigente</Th>
                <Th align="right">Novo preço</Th>
                <Th align="right" />
              </tr>
            </thead>
            <tbody>
              {procedures.map((p) => {
                const value = p.id in draft ? draft[p.id]! : (prices[p.id] ?? null);
                const changed = p.id in draft && draft[p.id] !== (prices[p.id] ?? null);
                return (
                  <Tr key={p.id}>
                    <Td className="text-muted">{p.specialtyName}</Td>
                    <Td className="tabular text-muted">{p.code}</Td>
                    <Td>{p.name}</Td>
                    <Td align="right">{p.id in prices ? formatBRL(prices[p.id]!) : <Badge tone="warning">Não cadastrado</Badge>}</Td>
                    <Td align="right">
                      <div className="ml-auto w-36">
                        <MoneyInput aria-label={`Preço de ${p.name}`} value={value} onChange={(v) => setDraft((d) => ({ ...d, [p.id]: v }))} />
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant={changed ? "primary" : "ghost"}
                          disabled={!changed}
                          loading={setPrice.pending}
                          onClick={async () => {
                            const res = await setPrice.run({ priceTableId: tableId, procedureId: p.id, priceCents: draft[p.id] ?? null });
                            if (res.ok)
                              setDraft((d) => {
                                const { [p.id]: _x, ...rest } = d;
                                void _x;
                                return rest;
                              });
                          }}
                        >
                          Salvar
                        </Button>
                        {p.id in prices ? (
                          <Button size="sm" variant="ghost" onClick={() => window.confirm("Remover o preço (volta a 'não cadastrado')?") && setPrice.run({ priceTableId: tableId, procedureId: p.id, priceCents: null })}>
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
      {tableDialog ? (
        <Dialog
          open
          onClose={() => setTableDialog(null)}
          title={tableDialog.id ? "Editar tabela" : "Nova tabela"}
          footer={
            <Button
              variant="primary"
              loading={saveTable.pending}
              onClick={async () => {
                const res = await saveTable.run(tableDialog);
                if (res.ok) {
                  setTableDialog(null);
                  router.push(`/cadastros/precos?tabela=${res.data.id}`);
                }
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="space-y-4">
            {saveTable.error ? <Notice tone="danger">{saveTable.error}</Notice> : null}
            <Field label="Nome" htmlFor="tb-name" required>
              <Input id="tb-name" value={tableDialog.name} onChange={(e) => setTableDialog({ ...tableDialog, name: e.target.value })} />
            </Field>
            <Checkbox label="Tabela padrão" checked={tableDialog.isDefault} onChange={(e) => setTableDialog({ ...tableDialog, isDefault: e.target.checked })} />
            <Checkbox label="Ativa" checked={tableDialog.active} onChange={(e) => setTableDialog({ ...tableDialog, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}
    </Card>
  );
}
