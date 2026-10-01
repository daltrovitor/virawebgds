// Hello World
"use client";

import { useMemo, useState } from "react";
import { recordCardPaymentAction, settleTitlesAction } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatBRL } from "@/domain/money";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/payment-plan";

export interface SettleTitle {
  id: string;
  description: string;
  balanceCents: number;
  expectedMethod?: string | null;
}

interface Line {
  titleId: string;
  principalCents: number;
  interestCents: number;
  fineCents: number;
  discountCents: number;
}

/**
 * Baixa de um ou mais títulos: pagamento parcial, juros, multa e desconto
 * explícitos. Cartão (recebimento) segue o fluxo de recebíveis da operadora.
 */
export function SettleDialog({
  open,
  onClose,
  kind,
  titles,
  accounts,
  today,
}: {
  open: boolean;
  onClose: () => void;
  kind: "receivable" | "payable";
  titles: SettleTitle[];
  accounts: { id: string; name: string; kind: string }[];
  today: string;
}) {
  const firstMethod = (titles[0]?.expectedMethod as PaymentMethod | undefined) ?? "pix";
  // O diálogo é montado sob demanda pelos pais: o estado nasce com os títulos e uma
  // chave de idempotência nova a cada abertura.
  const [method, setMethod] = useState<PaymentMethod>(firstMethod);
  const [methodNote, setMethodNote] = useState("");
  const [chosenAccountId, setAccountId] = useState("");
  const [settledOn, setSettledOn] = useState(today);
  const [lines, setLines] = useState<Line[]>(() => titles.map((t) => ({ titleId: t.id, principalCents: t.balanceCents, interestCents: 0, fineCents: 0, discountCents: 0 })));
  const [card, setCard] = useState({ acquirer: "", brand: "", installments: 1, feeCents: 0 as number | null, settlementDays: 30 });
  const [key] = useState(() => crypto.randomUUID());
  const isCard = kind === "receivable" && (method === "credit" || method === "debit");
  const eligibleAccounts = accounts.filter((a) => (isCard ? a.kind === "card_clearing" : a.kind !== "card_clearing"));
  // Conta efetiva derivada: se a escolhida não serve para a forma atual, usa a primeira elegível.
  const accountId = eligibleAccounts.some((a) => a.id === chosenAccountId) ? chosenAccountId : (eligibleAccounts[0]?.id ?? "");
  const total = useMemo(() => lines.reduce((s, l) => s + l.principalCents + l.interestCents + l.fineCents, 0), [lines]);
  const settle = useAction(settleTitlesAction, { success: kind === "receivable" ? "Recebimento registrado" : "Pagamento registrado" });
  const cardPay = useAction(recordCardPaymentAction, { success: "Pagamento em cartão registrado; recebíveis da operadora criados" });
  const pending = settle.pending || cardPay.pending;
  const error = settle.error ?? cardPay.error;
  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    const allocations = lines.filter((l) => l.principalCents + l.interestCents + l.fineCents + l.discountCents > 0);
    if (isCard) {
      const res = await cardPay.run({
        clearingAccountId: accountId,
        acquirer: card.acquirer,
        brand: card.brand || null,
        paymentType: method as "credit" | "debit",
        installments: card.installments,
        transactionDate: settledOn,
        feeCents: card.feeCents ?? 0,
        settlementDays: card.settlementDays,
        allocations,
        idempotencyKey: key,
      });
      if (res.ok) onClose();
      return;
    }
    const res = await settle.run({ kind, accountId, method, methodNote: methodNote || null, settledOn, allocations, idempotencyKey: key });
    if (res.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={kind === "receivable" ? "Registrar recebimento" : "Registrar pagamento"}
      description="Recebimento parcial é permitido. Juros, multa e desconto ficam registrados separadamente."
      size="lg"
      footer={
        <>
          <span className="mr-auto text-sm">
            Valor movimentado: <strong className="tabular">{formatBRL(total)}</strong>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" loading={pending} disabled={!accountId || lines.length === 0} onClick={() => void submit()}>
            Confirmar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Forma" htmlFor="st-method">
            <Select id="st-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABEL[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={isCard ? "Conta de recebíveis de cartão" : "Conta"} htmlFor="st-account" hint={eligibleAccounts.length === 0 ? (isCard ? "Cadastre uma conta do tipo recebíveis de cartão" : "Cadastre uma conta") : undefined}>
            <Select id="st-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {eligibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data" htmlFor="st-date">
            <Input id="st-date" type="date" value={settledOn} onChange={(e) => setSettledOn(e.target.value)} />
          </Field>
          {method === "other" ? (
            <Field label="Identifique a forma" htmlFor="st-note" className="sm:col-span-3">
              <Input id="st-note" value={methodNote} onChange={(e) => setMethodNote(e.target.value)} />
            </Field>
          ) : null}
        </div>
        {isCard ? (
          <fieldset className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-5">
            <legend className="px-1 text-xs font-medium text-muted">Transação de cartão (sem número do cartão)</legend>
            <Field label="Operadora" htmlFor="cd-acq" className="sm:col-span-2">
              <Input id="cd-acq" value={card.acquirer} onChange={(e) => setCard({ ...card, acquirer: e.target.value })} />
            </Field>
            <Field label="Bandeira" htmlFor="cd-brand">
              <Input id="cd-brand" value={card.brand} onChange={(e) => setCard({ ...card, brand: e.target.value })} />
            </Field>
            <Field label="Parcelas" htmlFor="cd-inst">
              <Input id="cd-inst" type="number" min={1} max={24} value={card.installments} onChange={(e) => setCard({ ...card, installments: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Dias p/ liquidar" htmlFor="cd-days">
              <Input id="cd-days" type="number" min={0} max={120} value={card.settlementDays} onChange={(e) => setCard({ ...card, settlementDays: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Taxa da operadora" htmlFor="cd-fee" className="sm:col-span-2" hint={`Líquido previsto: ${formatBRL(total - (card.feeCents ?? 0))}`}>
              <MoneyInput id="cd-fee" value={card.feeCents} onChange={(v) => setCard({ ...card, feeCents: v })} />
            </Field>
          </fieldset>
        ) : null}
        <div className="space-y-3">
          {lines.map((l, i) => {
            const t = titles[i]!;
            return (
              <fieldset key={l.titleId} className="rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium">
                  {t.description} — saldo {formatBRL(t.balanceCents)}
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Principal" htmlFor={`p-${i}`}>
                    <MoneyInput id={`p-${i}`} value={l.principalCents} onChange={(v) => setLine(i, { principalCents: v ?? 0 })} />
                  </Field>
                  <Field label="Juros" htmlFor={`j-${i}`}>
                    <MoneyInput id={`j-${i}`} value={l.interestCents} onChange={(v) => setLine(i, { interestCents: v ?? 0 })} />
                  </Field>
                  <Field label="Multa" htmlFor={`m-${i}`}>
                    <MoneyInput id={`m-${i}`} value={l.fineCents} onChange={(v) => setLine(i, { fineCents: v ?? 0 })} />
                  </Field>
                  <Field label="Desconto" htmlFor={`d-${i}`}>
                    <MoneyInput id={`d-${i}`} value={l.discountCents} onChange={(v) => setLine(i, { discountCents: v ?? 0 })} />
                  </Field>
                </div>
                {l.principalCents + l.discountCents > t.balanceCents ? <p className="mt-2 text-xs text-danger">Principal + desconto excede o saldo.</p> : null}
                {l.principalCents + l.discountCents < t.balanceCents ? (
                  <p className="mt-2 text-xs text-muted">Restará {formatBRL(t.balanceCents - l.principalCents - l.discountCents)} em aberto.</p>
                ) : null}
              </fieldset>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
