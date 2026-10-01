// Hello World
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  categoriesAction,
  createEntryFromBankAction,
  ignoreBankTxAction,
  openTitlesForBankAction,
  reconcileAction,
  settleFromBankAction,
  undoReconciliationAction,
  unignoreBankTxAction,
} from "@/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyState, Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import { cn } from "@/lib/cn";
import { BANK_TX_LABEL, BANK_TX_TONE } from "@/lib/status";

interface BankRow {
  id: string;
  postedOn: string;
  amountCents: number;
  openAmountCents: number;
  description: string;
  status: string;
  ambiguous: boolean;
  ignoreReason: string | null;
  suggestions: { movementId: string; score: number; reasons: string[] }[];
  reconciliationIds: string[];
}

interface MovementRow {
  id: string;
  occurredOn: string;
  amountCents: number;
  openAmountCents: number;
  description: string;
  kind: string;
}

interface OpenTitle {
  id: string;
  description: string;
  counterpart: string | null;
  dueDate: string;
  balanceCents: number;
}

/**
 * Duas colunas: movimentações do banco × lançamentos internos da conta.
 * Um vínculo pode envolver várias movimentações e vários lançamentos, sempre
 * com valores alocados que não excedem o saldo em aberto de cada lado.
 */
export function ReconciliationWorkspace({ accountId, bank, movements, canSettle, canCreate }: { accountId: string; bank: BankRow[]; movements: MovementRow[]; canSettle: boolean; canCreate: boolean }) {
  const [selectedBank, setSelectedBank] = useState<string[]>([]);
  const [alloc, setAlloc] = useState<Record<string, number | null>>({});
  const [dialog, setDialog] = useState<null | { kind: "settle" | "entry" | "ignore" | "undo"; bank: BankRow }>(null);
  const reconcile = useAction(reconcileAction, { success: "Conciliação registrada" });
  const unignore = useAction(unignoreBankTxAction, { success: "Movimentação reativada" });

  const bankSelected = bank.filter((b) => selectedBank.includes(b.id));
  const bankOpen = bankSelected.reduce((s, b) => s + b.openAmountCents, 0);
  const movementTotal = Object.values(alloc).reduce<number>((s, v) => s + (v ?? 0), 0);
  const sign = Math.sign(bankOpen) || 1;
  const suggested = useMemo(() => new Map(bankSelected.flatMap((b) => b.suggestions.map((s) => [s.movementId, s] as const))), [bankSelected]);
  const openMovements = movements.filter((m) => m.openAmountCents !== 0);
  const visibleMovements = [...openMovements].sort((a, b) => (suggested.get(b.id)?.score ?? 0) - (suggested.get(a.id)?.score ?? 0));

  const toggleBank = (b: BankRow) => {
    if (b.status !== "pending") return;
    setSelectedBank((s) => (s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id]));
  };
  const toggleMovement = (m: MovementRow) => {
    setAlloc((a) => {
      if (m.id in a) {
        const { [m.id]: _drop, ...rest } = a;
        void _drop;
        return rest;
      }
      const remaining = Math.abs(bankOpen) - Math.abs(Object.values(a).reduce<number>((s, v) => s + (v ?? 0), 0));
      return { ...a, [m.id]: Math.max(0, Math.min(Math.abs(m.openAmountCents), remaining)) };
    });
  };

  // Distribui as alocações de lançamentos pelas movimentações bancárias selecionadas, na ordem.
  const buildAllocations = () => {
    const out: { bankTransactionId: string; movementId: string; amountCents: number }[] = [];
    const bankLeft = bankSelected.map((b) => ({ id: b.id, left: Math.abs(b.openAmountCents) }));
    for (const [movementId, value] of Object.entries(alloc)) {
      let need = value ?? 0;
      for (const b of bankLeft) {
        if (need === 0) break;
        const take = Math.min(need, b.left);
        if (take > 0) {
          out.push({ bankTransactionId: b.id, movementId, amountCents: take * sign });
          b.left -= take;
          need -= take;
        }
      }
      if (need > 0) return null;
    }
    return out;
  };

  const canSubmit = bankSelected.length > 0 && Object.keys(alloc).length > 0 && movementTotal > 0 && movementTotal <= Math.abs(bankOpen);

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-sm">
          Extrato selecionado: <strong className="tabular">{formatBRL(bankOpen)}</strong> · Alocado: <strong className="tabular">{formatBRL(movementTotal * sign)}</strong>
          {bankSelected.length > 0 && movementTotal !== Math.abs(bankOpen) ? (
            <span className="ml-2 text-xs text-muted">Diferença {formatBRL((Math.abs(bankOpen) - movementTotal) * sign)} fica pendente (parcial)</span>
          ) : null}
        </p>
        <div className="flex gap-2">
          {bankSelected.length > 0 || Object.keys(alloc).length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => (setSelectedBank([]), setAlloc({}))}>
              Limpar
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            disabled={!canSubmit}
            loading={reconcile.pending}
            onClick={async () => {
              const allocations = buildAllocations();
              if (!allocations) return;
              const res = await reconcile.run({ accountId, allocations });
              if (res.ok) {
                setSelectedBank([]);
                setAlloc({});
              }
            }}
          >
            Conciliar selecionados
          </Button>
        </div>
      </div>
      {reconcile.error ? <Notice tone="danger">{reconcile.error}</Notice> : null}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Movimentações do banco" description="Selecione uma ou mais (mesmo sentido) para vincular." />
          {bank.length === 0 ? (
            <EmptyState title="Nenhuma movimentação" description="Importe um extrato OFX ou ajuste o filtro." />
          ) : (
            <ul className="max-h-[70dvh] divide-y divide-border overflow-y-auto" data-lenis-prevent>
              {bank.map((b) => {
                const selected = selectedBank.includes(b.id);
                return (
                  <li key={b.id} className={cn("px-4 py-3 sm:px-5", selected && "bg-accent-soft")}>
                    <div className="flex items-start gap-3">
                      {b.status === "pending" ? (
                        <input
                          type="checkbox"
                          className="mt-1 size-4 accent-accent"
                          aria-label={`Selecionar ${b.description}`}
                          checked={selected}
                          disabled={bankSelected.length > 0 && !selected && Math.sign(bankSelected[0]!.amountCents) !== Math.sign(b.amountCents)}
                          onChange={() => toggleBank(b)}
                        />
                      ) : (
                        <span className="w-4" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium tabular">{formatDateBR(b.postedOn)}</span>
                          <span className={cn("text-sm font-semibold tabular", b.amountCents < 0 ? "text-danger" : "text-success")}>{formatBRL(b.amountCents)}</span>
                        </div>
                        <p className="truncate text-sm text-muted" title={b.description}>
                          {b.description}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <Badge tone={BANK_TX_TONE[b.status] ?? "neutral"}>{BANK_TX_LABEL[b.status]}</Badge>
                          {b.status === "pending" && b.openAmountCents !== b.amountCents ? <Badge tone="warning">Em aberto {formatBRL(b.openAmountCents)}</Badge> : null}
                          {b.ambiguous ? <Badge tone="warning">Sem ID do banco: conferir</Badge> : null}
                          {b.ignoreReason ? <span className="text-xs text-subtle">Motivo: {b.ignoreReason}</span> : null}
                        </div>
                        {selected && b.suggestions.length > 0 ? (
                          <p className="mt-1 text-xs text-accent-strong">Sugestões destacadas na coluna ao lado.</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {b.status === "pending" && canSettle ? (
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "settle", bank: b })}>
                              Dar baixa em título
                            </Button>
                          ) : null}
                          {b.status === "pending" && canCreate ? (
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "entry", bank: b })}>
                              Criar lançamento
                            </Button>
                          ) : null}
                          {b.status === "pending" && b.openAmountCents === b.amountCents ? (
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "ignore", bank: b })}>
                              Ignorar
                            </Button>
                          ) : null}
                          {b.status === "ignored" ? (
                            <Button size="sm" variant="ghost" loading={unignore.pending} onClick={() => unignore.run(b.id)}>
                              Reativar
                            </Button>
                          ) : null}
                          {b.reconciliationIds.length > 0 ? (
                            <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: "undo", bank: b })}>
                              Desfazer conciliação
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Lançamentos internos da conta" description="Baixas, transferências e repasses ainda não conciliados (±10 dias do período)." />
          {visibleMovements.length === 0 ? (
            <EmptyState title="Nenhum lançamento em aberto" description="Use “Dar baixa em título” ou “Criar lançamento” a partir do extrato." />
          ) : (
            <ul className="max-h-[70dvh] divide-y divide-border overflow-y-auto" data-lenis-prevent>
              {visibleMovements.map((m) => {
                const sug = suggested.get(m.id);
                const chosen = m.id in alloc;
                const compatible = bankSelected.length === 0 || Math.sign(m.amountCents) === sign;
                return (
                  <li key={m.id} className={cn("px-4 py-3 sm:px-5", chosen && "bg-accent-soft", !compatible && "opacity-50")}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-accent"
                        aria-label={`Vincular ${m.description}`}
                        checked={chosen}
                        disabled={bankSelected.length === 0 || !compatible}
                        onChange={() => toggleMovement(m)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium tabular">{formatDateBR(m.occurredOn)}</span>
                          <span className={cn("text-sm font-semibold tabular", m.amountCents < 0 ? "text-danger" : "text-success")}>{formatBRL(m.amountCents)}</span>
                        </div>
                        <p className="truncate text-sm text-muted" title={m.description}>
                          {m.description}
                        </p>
                        {m.openAmountCents !== m.amountCents ? <p className="text-xs text-subtle">Em aberto: {formatBRL(m.openAmountCents)}</p> : null}
                        {sug ? (
                          <p className="mt-1 text-xs text-accent-strong">
                            Sugestão ({sug.score} pts): {sug.reasons.join(" · ")}
                          </p>
                        ) : null}
                        {chosen ? (
                          <div className="mt-2 w-44">
                            <MoneyInput aria-label="Valor alocado" value={alloc[m.id] ?? null} onChange={(v) => setAlloc((a) => ({ ...a, [m.id]: v }))} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      {dialog?.kind === "settle" ? <SettleFromBankDialog bank={dialog.bank} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "entry" ? <EntryFromBankDialog bank={dialog.bank} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "ignore" ? <IgnoreDialog bank={dialog.bank} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "undo" ? <UndoDialog bank={dialog.bank} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function SettleFromBankDialog({ bank, onClose }: { bank: BankRow; onClose: () => void }) {
  const kind = bank.amountCents > 0 ? "receivable" : "payable";
  const [q, setQ] = useState("");
  const [titles, setTitles] = useState<OpenTitle[]>([]);
  const [chosen, setChosen] = useState<Record<string, number | null>>({});
  const [method, setMethod] = useState<"pix" | "cash" | "boleto" | "transfer" | "other">("pix");
  const settle = useAction(settleFromBankAction, { success: "Baixa registrada e conciliada" });
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await openTitlesForBankAction(kind, q);
      if (res.ok) setTitles(res.data);
    }, 250);
    return () => clearTimeout(t);
  }, [q, kind]);
  const total = Object.values(chosen).reduce<number>((s, v) => s + (v ?? 0), 0);
  return (
    <Dialog
      open
      onClose={onClose}
      title={kind === "receivable" ? "Dar baixa em recebimento a partir do extrato" : "Dar baixa em pagamento a partir do extrato"}
      description={`${formatDateBR(bank.postedOn)} · ${bank.description} · em aberto ${formatBRL(bank.openAmountCents)}. Confirme os títulos: a baixa é registrada na data do extrato.`}
      size="lg"
      footer={
        <>
          <span className="mr-auto text-sm">
            Selecionado: <strong className="tabular">{formatBRL(total)}</strong>
          </span>
          <Button
            variant="primary"
            loading={settle.pending}
            disabled={total === 0 || total > Math.abs(bank.openAmountCents)}
            onClick={async () => {
              const res = await settle.run({ bankTransactionId: bank.id, method, allocations: Object.entries(chosen).map(([titleId, v]) => ({ titleId, principalCents: v ?? 0 })) });
              if (res.ok) onClose();
            }}
          >
            Confirmar baixa
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {settle.error ? <Notice tone="danger">{settle.error}</Notice> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Buscar título" htmlFor="sb-q">
            <Input id="sb-q" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field>
          <Field label="Forma" htmlFor="sb-m">
            <Select id="sb-m" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="pix">Pix</option>
              <option value="transfer">Transferência</option>
              <option value="boleto">Boleto</option>
              <option value="cash">Dinheiro</option>
              <option value="other">Outra</option>
            </Select>
          </Field>
        </div>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border" data-lenis-prevent>
          {titles.length === 0 ? <li className="px-3 py-3 text-sm text-muted">Nenhum título em aberto encontrado.</li> : null}
          {titles.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-accent"
                aria-label={`Selecionar ${t.description}`}
                checked={t.id in chosen}
                onChange={(e) =>
                  setChosen((c) => {
                    if (!e.target.checked) {
                      const { [t.id]: _x, ...rest } = c;
                      void _x;
                      return rest;
                    }
                    return { ...c, [t.id]: Math.min(t.balanceCents, Math.abs(bank.openAmountCents) - total) };
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{t.description}</span>
                <span className="text-xs text-subtle">
                  {t.counterpart ?? "—"} · vence {formatDateBR(t.dueDate)} · saldo {formatBRL(t.balanceCents)}
                </span>
              </span>
              {t.id in chosen ? (
                <div className="w-36">
                  <MoneyInput aria-label="Valor da baixa" value={chosen[t.id] ?? null} onChange={(v) => setChosen((c) => ({ ...c, [t.id]: v }))} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

function EntryFromBankDialog({ bank, onClose }: { bank: BankRow; onClose: () => void }) {
  const type = bank.amountCents > 0 ? "income" : "expense";
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ description: bank.description.slice(0, 200), categoryId: "" });
  const create = useAction(createEntryFromBankAction, { success: "Lançamento criado, baixado e conciliado" });
  useEffect(() => {
    void categoriesAction(type).then((res) => {
      if (res.ok) {
        setCategories(res.data);
        setF((s) => ({ ...s, categoryId: s.categoryId || res.data[0]?.id || "" }));
      }
    });
  }, [type]);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Criar lançamento a partir do extrato"
      description={`Sem registro correspondente: ${formatBRL(bank.openAmountCents)} em ${formatDateBR(bank.postedOn)}. Revise categoria e descrição.`}
      footer={
        <Button
          variant="primary"
          loading={create.pending}
          disabled={!f.categoryId}
          onClick={async () => {
            const res = await create.run({ bankTransactionId: bank.id, description: f.description, categoryId: f.categoryId });
            if (res.ok) onClose();
          }}
        >
          Criar e conciliar
        </Button>
      }
    >
      <div className="space-y-4">
        {create.error ? <Notice tone="danger">{create.error}</Notice> : null}
        <Field label="Descrição" htmlFor="eb-desc">
          <Input id="eb-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Field label={type === "income" ? "Categoria de receita" : "Categoria de despesa"} htmlFor="eb-cat">
          <Select id="eb-cat" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

function IgnoreDialog({ bank, onClose }: { bank: BankRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const ignore = useAction(ignoreBankTxAction, { success: "Movimentação ignorada (continua no extrato e na divergência)" });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Ignorar movimentação"
      description="Ignorar não apaga o extrato nem elimina divergência de saldo. Exige justificativa."
      footer={
        <Button
          variant="primary"
          loading={ignore.pending}
          disabled={!reason.trim()}
          onClick={async () => {
            const res = await ignore.run({ bankTransactionId: bank.id, reason });
            if (res.ok) onClose();
          }}
        >
          Ignorar
        </Button>
      }
    >
      {ignore.error ? <Notice tone="danger" className="mb-3">{ignore.error}</Notice> : null}
      <Field label="Justificativa" htmlFor="ig-reason" required>
        <Textarea id="ig-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dialog>
  );
}

function UndoDialog({ bank, onClose }: { bank: BankRow; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const undo = useAction(undoReconciliationAction, { success: "Conciliação desfeita. A baixa continua registrada; estorne-a separadamente se necessário." });
  return (
    <Dialog
      open
      onClose={onClose}
      title="Desfazer conciliação"
      description="Remove o vínculo e preserva a trilha. Não estorna a baixa do título: isso é uma ação separada."
      footer={
        <Button
          variant="danger"
          loading={undo.pending}
          disabled={!reason.trim()}
          onClick={async () => {
            for (const id of bank.reconciliationIds) {
              const res = await undo.run({ reconciliationId: id, reason });
              if (!res.ok) return;
            }
            onClose();
          }}
        >
          Desfazer
        </Button>
      }
    >
      {undo.error ? <Notice tone="danger" className="mb-3">{undo.error}</Notice> : null}
      <Field label="Motivo" htmlFor="ud-reason" required>
        <Textarea id="ud-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Dialog>
  );
}
