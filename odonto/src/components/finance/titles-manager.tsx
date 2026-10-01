// Hello World
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cancelTitleAction, createPayableAction, createReceivableAction, updateTitleDueAction } from "@/actions/finance";
import { PatientPicker, type PickedPatient } from "@/components/agenda/patient-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Notice, Pagination } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { formatBRL, sumCents } from "@/domain/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/payment-plan";
import { TITLE_LABEL, TITLE_TONE } from "@/lib/status";
import { SettleDialog, type SettleTitle } from "./settle-dialog";

export interface TitleItem {
  id: string;
  description: string;
  counterpart: string | null;
  categoryName: string | null;
  dueDate: string;
  competenceDate: string;
  totalCents: number;
  balanceCents: number;
  status: string;
  overdue: boolean;
  expectedMethod: string | null;
  patientId?: string | null;
  fromAgreement?: boolean;
}

interface Option {
  id: string;
  name: string;
}

export function TitlesManager({
  kind,
  items,
  total,
  page,
  pageSize,
  baseQuery,
  accounts,
  categories,
  costCenters,
  suppliers,
  canSettle,
  canEdit,
  canExport,
  today,
}: {
  kind: "receivable" | "payable";
  items: TitleItem[];
  total: number;
  page: number;
  pageSize: number;
  baseQuery: string;
  accounts: { id: string; name: string; kind: string }[];
  categories: Option[];
  costCenters: Option[];
  suppliers: Option[];
  canSettle: boolean;
  canEdit: boolean;
  canExport: boolean;
  today: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [settling, setSettling] = useState<SettleTitle[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [dueFor, setDueFor] = useState<TitleItem | null>(null);
  const [newDue, setNewDue] = useState("");
  const updateDue = useAction(updateTitleDueAction, { success: "Vencimento alterado" });
  const cancel = useAction(cancelTitleAction, { success: "Título cancelado" });
  const open = items.filter((i) => i.status === "open" || i.status === "partial");
  const selectedItems = items.filter((i) => selected.includes(i.id));
  const isRec = kind === "receivable";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <p className="text-sm text-muted">
          {selected.length > 0 ? `${selected.length} selecionado(s) · saldo ${formatBRL(sumCents(selectedItems.map((i) => i.balanceCents)))}` : `${total} título(s)`}
        </p>
        <div className="flex flex-wrap gap-2">
          {canSettle && selected.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSettling(selectedItems.filter((i) => i.status === "open" || i.status === "partial").map((i) => ({ id: i.id, description: i.description, balanceCents: i.balanceCents, expectedMethod: i.expectedMethod })))}
            >
              {isRec ? "Receber selecionados" : "Pagar selecionados"}
            </Button>
          ) : null}
          {canExport ? (
            <a href={`/api/exportar/${isRec ? "receber" : "pagar"}?${baseQuery}`} className="inline-flex h-9 items-center rounded-md border border-border-strong px-3 text-sm hover:bg-surface-2 cursor-pointer">
              Exportar CSV
            </a>
          ) : null}
          {canEdit ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              {isRec ? "Lançamento avulso" : "Nova conta a pagar"}
            </Button>
          ) : null}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Nenhum título neste filtro" />
      ) : (
        <TableWrap label={isRec ? "Contas a receber" : "Contas a pagar"}>
          <Table>
            <thead>
              <tr>
                {canSettle ? (
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos em aberto"
                      className="size-4 accent-accent"
                      checked={open.length > 0 && open.every((i) => selected.includes(i.id))}
                      onChange={(e) => setSelected(e.target.checked ? open.map((i) => i.id) : [])}
                    />
                  </Th>
                ) : null}
                <Th>Vencimento</Th>
                <Th>Descrição</Th>
                <Th>{isRec ? "Paciente" : "Fornecedor"}</Th>
                <Th>Categoria</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Saldo</Th>
                <Th>Situação</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const isOpen = t.status === "open" || t.status === "partial";
                return (
                  <Tr key={t.id}>
                    {canSettle ? (
                      <Td>
                        {isOpen ? (
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${t.description}`}
                            className="size-4 accent-accent"
                            checked={selected.includes(t.id)}
                            onChange={(e) => setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))}
                          />
                        ) : null}
                      </Td>
                    ) : null}
                    <Td className={t.overdue ? "tabular font-medium text-danger" : "tabular"}>{formatDateBR(t.dueDate)}</Td>
                    <Td className="max-w-xs">
                      <span className="block truncate">{t.description}</span>
                      {t.expectedMethod ? <span className="text-xs text-subtle">{PAYMENT_METHOD_LABEL[t.expectedMethod as PaymentMethod]}</span> : null}
                    </Td>
                    <Td>
                      {isRec && t.patientId ? (
                        <Link href={`/pacientes/${t.patientId}?aba=financeiro`} className="hover:underline cursor-pointer">
                          {t.counterpart}
                        </Link>
                      ) : (
                        (t.counterpart ?? "—")
                      )}
                    </Td>
                    <Td className="text-muted">{t.categoryName ?? "—"}</Td>
                    <Td align="right">{formatBRL(t.totalCents)}</Td>
                    <Td align="right" className="font-medium">
                      {formatBRL(t.balanceCents)}
                    </Td>
                    <Td>
                      <Badge tone={t.overdue ? "danger" : (TITLE_TONE[t.status] ?? "neutral")}>{t.overdue ? "Vencido" : (TITLE_LABEL[t.status] ?? t.status)}</Badge>
                    </Td>
                    <Td align="right">
                      <div className="flex justify-end gap-1">
                        {canSettle && isOpen ? (
                          <Button size="sm" onClick={() => setSettling([{ id: t.id, description: t.description, balanceCents: t.balanceCents, expectedMethod: t.expectedMethod }])}>
                            {isRec ? "Receber" : "Pagar"}
                          </Button>
                        ) : null}
                        {canEdit && isOpen ? (
                          <Button size="sm" variant="ghost" onClick={() => (setDueFor(t), setNewDue(t.dueDate))}>
                            Vencimento
                          </Button>
                        ) : null}
                        {canEdit && t.status === "open" && !t.fromAgreement ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={cancel.pending}
                            onClick={() => {
                              const reason = window.prompt("Motivo do cancelamento");
                              if (reason) void cancel.run({ kind, id: t.id, reason });
                            }}
                          >
                            Cancelar
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
      <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => `?${baseQuery}&page=${p}`} />
      {settling && settling.length > 0 ? (
        <SettleDialog
          open
          onClose={() => {
            setSettling(null);
            setSelected([]);
          }}
          kind={kind}
          titles={settling}
          accounts={accounts}
          today={today}
        />
      ) : null}
      {dueFor ? (
        <Dialog
          open
          onClose={() => setDueFor(null)}
          title="Alterar vencimento"
          description={dueFor.description}
          footer={
            <Button
              variant="primary"
              loading={updateDue.pending}
              onClick={async () => {
                const res = await updateDue.run({ kind, id: dueFor.id, dueDate: newDue });
                if (res.ok) setDueFor(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          {updateDue.error ? <Notice tone="danger" className="mb-3">{updateDue.error}</Notice> : null}
          <Field label="Novo vencimento" htmlFor="nd">
            <Input id="nd" type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
          </Field>
        </Dialog>
      ) : null}
      {creating ? (
        isRec ? (
          <NewReceivableDialog onClose={() => setCreating(false)} categories={categories} costCenters={costCenters} today={today} />
        ) : (
          <NewPayableDialog onClose={() => setCreating(false)} categories={categories} costCenters={costCenters} suppliers={suppliers} accounts={accounts} today={today} />
        )
      ) : null}
    </Card>
  );
}

function NewReceivableDialog({ onClose, categories, costCenters, today }: { onClose: () => void; categories: Option[]; costCenters: Option[]; today: string }) {
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [f, setF] = useState({ description: "", categoryId: categories[0]?.id ?? "", costCenterId: "", competenceDate: today, dueDate: today, amount: null as number | null, method: "" as PaymentMethod | "", notes: "" });
  const create = useAction(createReceivableAction, { success: "Lançamento a receber criado" });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Lançamento avulso a receber"
      description="Use para receitas fora de orçamento, sempre identificadas. Orçamentos aprovados geram seus títulos automaticamente."
      size="lg"
      footer={
        <Button
          variant="primary"
          loading={create.pending}
          onClick={async () => {
            const res = await create.run({
              patientId: patient?.id ?? null,
              description: f.description,
              categoryId: f.categoryId,
              costCenterId: f.costCenterId || null,
              competenceDate: f.competenceDate,
              dueDate: f.dueDate,
              amountCents: f.amount ?? 0,
              expectedMethod: f.method || null,
              notes: f.notes || null,
            });
            if (res.ok) onClose();
          }}
        >
          Criar
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {create.error ? <Notice tone="danger" className="sm:col-span-2">{create.error}</Notice> : null}
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">Paciente (opcional)</p>
          <PatientPicker value={patient} onChange={setPatient} canCreate={false} />
        </div>
        <Field label="Descrição" htmlFor="nr-desc" required error={create.fieldErrors.description} className="sm:col-span-2">
          <Input id="nr-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Categoria de receita" htmlFor="nr-cat">
          <Select id="nr-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Centro de custo" htmlFor="nr-cc">
          <Select id="nr-cc" value={f.costCenterId} onChange={(e) => setF({ ...f, costCenterId: e.target.value })}>
            <option value="">Nenhum</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Competência" htmlFor="nr-comp">
          <Input id="nr-comp" type="date" value={f.competenceDate} onChange={(e) => setF({ ...f, competenceDate: e.target.value })} />
        </Field>
        <Field label="Vencimento" htmlFor="nr-due">
          <Input id="nr-due" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Valor" htmlFor="nr-amount" error={create.fieldErrors.amountCents}>
          <MoneyInput id="nr-amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <Field label="Forma prevista" htmlFor="nr-method">
          <Select id="nr-method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaymentMethod | "" })}>
            <option value="">A definir</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Observações" htmlFor="nr-notes" className="sm:col-span-2">
          <Textarea id="nr-notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}

function NewPayableDialog({
  onClose,
  categories,
  costCenters,
  suppliers,
  accounts,
  today,
}: {
  onClose: () => void;
  categories: Option[];
  costCenters: Option[];
  suppliers: Option[];
  accounts: { id: string; name: string; kind: string }[];
  today: string;
}) {
  const [f, setF] = useState({
    supplierId: "",
    description: "",
    categoryId: categories[0]?.id ?? "",
    costCenterId: "",
    competenceDate: today,
    firstDueDate: today,
    amount: null as number | null,
    installments: 1,
    expectedAccountId: "",
    documentNumber: "",
    notes: "",
  });
  const [split, setSplit] = useState<{ categoryId: string; costCenterId: string; amount: number | null }[]>([]);
  const create = useAction(createPayableAction, { success: (d) => `${d.ids.length} conta(s) a pagar criada(s)` });
  const splitSum = useMemo(() => sumCents(split.map((s) => s.amount ?? 0)), [split]);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Nova conta a pagar"
      description="Parcelas mensais preservam o dia do primeiro vencimento. O rateio, quando usado, precisa fechar o valor total."
      size="lg"
      footer={
        <Button
          variant="primary"
          loading={create.pending}
          disabled={split.length > 0 && splitSum !== (f.amount ?? 0)}
          onClick={async () => {
            const res = await create.run({
              supplierId: f.supplierId || null,
              description: f.description,
              categoryId: f.categoryId,
              costCenterId: f.costCenterId || null,
              competenceDate: f.competenceDate,
              firstDueDate: f.firstDueDate,
              amountCents: f.amount ?? 0,
              installments: f.installments,
              expectedAccountId: f.expectedAccountId || null,
              documentNumber: f.documentNumber || null,
              notes: f.notes || null,
              allocations: split.map((s) => ({ categoryId: s.categoryId, costCenterId: s.costCenterId || null, amountCents: s.amount ?? 0 })),
            });
            if (res.ok) onClose();
          }}
        >
          Criar
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {create.error ? <Notice tone="danger" className="sm:col-span-2">{create.error}</Notice> : null}
        <Field label="Fornecedor" htmlFor="np-sup">
          <Select id="np-sup" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
            <option value="">Não informado</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nº do documento" htmlFor="np-doc">
          <Input id="np-doc" value={f.documentNumber} onChange={(e) => setF({ ...f, documentNumber: e.target.value })} />
        </Field>
        <Field label="Descrição" htmlFor="np-desc" required className="sm:col-span-2" error={create.fieldErrors.description}>
          <Input id="np-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label="Categoria de despesa" htmlFor="np-cat">
          <Select id="np-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Centro de custo" htmlFor="np-cc">
          <Select id="np-cc" value={f.costCenterId} onChange={(e) => setF({ ...f, costCenterId: e.target.value })}>
            <option value="">Nenhum</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Competência" htmlFor="np-comp">
          <Input id="np-comp" type="date" value={f.competenceDate} onChange={(e) => setF({ ...f, competenceDate: e.target.value })} />
        </Field>
        <Field label="Primeiro vencimento" htmlFor="np-due">
          <Input id="np-due" type="date" value={f.firstDueDate} onChange={(e) => setF({ ...f, firstDueDate: e.target.value })} />
        </Field>
        <Field label="Valor total" htmlFor="np-amount" error={create.fieldErrors.amountCents}>
          <MoneyInput id="np-amount" value={f.amount} onChange={(v) => setF({ ...f, amount: v })} />
        </Field>
        <Field label="Parcelas" htmlFor="np-inst">
          <Input id="np-inst" type="number" min={1} max={60} value={f.installments} onChange={(e) => setF({ ...f, installments: Math.max(1, Number(e.target.value) || 1) })} />
        </Field>
        <Field label="Conta prevista" htmlFor="np-acc">
          <Select id="np-acc" value={f.expectedAccountId} onChange={(e) => setF({ ...f, expectedAccountId: e.target.value })}>
            <option value="">Não definida</option>
            {accounts
              .filter((a) => a.kind !== "card_clearing")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Observações" htmlFor="np-notes">
          <Textarea id="np-notes" className="min-h-10" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <fieldset className="space-y-2 rounded-md border border-border p-3 sm:col-span-2">
          <legend className="px-1 text-sm font-medium">Rateio por categoria/centro de custo (opcional)</legend>
          {split.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_10rem_auto]">
              <Select aria-label="Categoria do rateio" value={s.categoryId} onChange={(e) => setSplit((l) => l.map((x, k) => (k === i ? { ...x, categoryId: e.target.value } : x)))}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Select aria-label="Centro de custo do rateio" value={s.costCenterId} onChange={(e) => setSplit((l) => l.map((x, k) => (k === i ? { ...x, costCenterId: e.target.value } : x)))}>
                <option value="">Sem centro de custo</option>
                {costCenters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <MoneyInput aria-label="Valor do rateio" value={s.amount} onChange={(v) => setSplit((l) => l.map((x, k) => (k === i ? { ...x, amount: v } : x)))} />
              <Button size="sm" variant="ghost" onClick={() => setSplit((l) => l.filter((_, k) => k !== i))}>
                Remover
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button size="sm" onClick={() => setSplit((l) => [...l, { categoryId: categories[0]?.id ?? "", costCenterId: "", amount: null }])}>
              Adicionar linha de rateio
            </Button>
            {split.length > 0 ? (
              <span className={splitSum === (f.amount ?? 0) ? "text-sm text-success" : "text-sm text-danger"}>
                Rateio: {formatBRL(splitSum)} de {formatBRL(f.amount ?? 0)}
              </span>
            ) : null}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
