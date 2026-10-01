// Hello World
"use client";

import { useMemo, useState } from "react";
import { approveBudgetAction, saveNegotiationAction } from "@/actions/budgets";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { addDays } from "@/domain/dates";
import { formatBRL, MoneyError, parsePercentToBasisPoints, sumCents, type DiscountInput } from "@/domain/money";
import { buildDefaultPlan, computeAgreementTotals, PAYMENT_METHODS, PAYMENT_METHOD_LABEL, PlanError, validatePlan, type PaymentMethod, type PlanLine } from "@/domain/payment-plan";
import type { ItemRow } from "./items-table";

interface Draft {
  approvedItemIds?: string[];
  discount?: DiscountInput;
  plan?: { downPayment: PlanLine | null; installments: PlanLine[] };
}

export function NegotiationPanel({
  budgetId,
  version,
  items,
  canApprove,
  canSimulate,
  previousTotalCents,
  today,
  draft,
}: {
  budgetId: string;
  version: number;
  items: ItemRow[];
  canApprove: boolean;
  canSimulate: boolean;
  /** Total do acordo vigente quando é revisão; null na primeira aprovação. */
  previousTotalCents: number | null;
  today: string;
  draft: Draft | null;
}) {
  const selectable = items.filter((i) => i.approvalStatus !== "rejected" || previousTotalCents !== null);
  const [approved, setApproved] = useState<string[]>(() => {
    const fromDraft = draft?.approvedItemIds?.filter((id) => items.some((i) => i.id === id));
    return fromDraft && fromDraft.length > 0 ? fromDraft : items.filter((i) => i.approvalStatus !== "rejected").map((i) => i.id);
  });
  const [discountType, setDiscountType] = useState<DiscountInput["type"]>(draft?.discount?.type ?? "none");
  const [discountCents, setDiscountCents] = useState<number | null>(draft?.discount?.type === "amount" ? draft.discount.cents : null);
  const [discountPct, setDiscountPct] = useState(draft?.discount?.type === "percent" ? String(draft.discount.basisPoints / 100).replace(".", ",") : "");
  const [downCents, setDownCents] = useState<number | null>(draft?.plan?.downPayment?.amountCents ?? 0);
  const [downDate, setDownDate] = useState(draft?.plan?.downPayment?.dueDate ?? today);
  const [downMethod, setDownMethod] = useState<PaymentMethod>(draft?.plan?.downPayment?.method ?? "pix");
  const [count, setCount] = useState(Math.max(1, draft?.plan?.installments.length ?? 1));
  const [firstDue, setFirstDue] = useState(draft?.plan?.installments[0]?.dueDate ?? addDays(today, 30));
  const [method, setMethod] = useState<PaymentMethod>(draft?.plan?.installments[0]?.method ?? "boleto");
  const [lines, setLines] = useState<PlanLine[]>(draft?.plan?.installments ?? []);
  const [planError, setPlanError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const simulate = useAction(saveNegotiationAction, { success: "Simulação salva (não gera cobrança)" });
  const approve = useAction(approveBudgetAction, { success: (d) => (d.replayed ? "Aprovação já registrada" : "Orçamento aprovado: tratamento e títulos gerados") });

  const discount = useMemo<DiscountInput>(
    () =>
      discountType === "amount"
        ? { type: "amount", cents: discountCents ?? 0 }
        : discountType === "percent"
          ? { type: "percent", basisPoints: parsePercentToBasisPoints(discountPct) ?? 0 }
          : { type: "none" },
    [discountType, discountCents, discountPct],
  );

  const totals = useMemo(() => {
    try {
      const sel = items.filter((i) => approved.includes(i.id));
      return { ...computeAgreementTotals(sel.map((i) => i.subtotalCents), discount), error: null as string | null };
    } catch (err) {
      return { subtotalCents: 0, discountCents: 0, totalCents: 0, itemDiscounts: [], error: err instanceof MoneyError ? err.message : "Valores inválidos" };
    }
  }, [items, approved, discount]);

  const isRevision = previousTotalCents !== null;
  const delta = isRevision ? totals.totalCents - previousTotalCents : totals.totalCents;
  const target = Math.max(delta, 0);
  const plan = { downPayment: (downCents ?? 0) > 0 ? { amountCents: downCents ?? 0, dueDate: downDate, method: downMethod } : null, installments: lines };
  const planSum = sumCents([plan.downPayment?.amountCents ?? 0, ...lines.map((l) => l.amountCents)]);
  const planErrors = validatePlan(plan, target);

  const generate = () => {
    try {
      const p = buildDefaultPlan({
        totalCents: target,
        downPaymentCents: downCents ?? 0,
        downPaymentDate: downDate,
        downPaymentMethod: downMethod,
        installmentsCount: count,
        firstDueDate: firstDue,
        installmentMethod: method,
      });
      setLines(p.installments);
      setPlanError(null);
    } catch (err) {
      setPlanError(err instanceof PlanError ? err.message : "Não foi possível gerar as parcelas");
    }
  };

  const payload = { budgetId, approvedItemIds: approved, discount, plan };

  return (
    <Card>
      <CardHeader
        title={isRevision ? "Negociação da revisão" : "Negociação e plano de pagamento"}
        description={
          isRevision
            ? "Pagamentos já feitos são preservados. A diferença gera novos títulos (para mais) ou ajuste/crédito explícito (para menos)."
            : "Simular não cria dívida nem receita. Aprovar cria tratamento e títulos uma única vez."
        }
      />
      <CardBody className="space-y-6">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Itens aceitos pelo paciente</legend>
          <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
            {selectable.map((i) => (
              <li key={i.id}>
                <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm hover:bg-surface">
                  <input type="checkbox" className="size-4 accent-accent" checked={approved.includes(i.id)} onChange={(e) => setApproved((s) => (e.target.checked ? [...s, i.id] : s.filter((x) => x !== i.id)))} />
                  <span className="min-w-0 flex-1 truncate">
                    {i.procedureName} · {i.locationLabel}
                  </span>
                  <span className="tabular text-muted">{formatBRL(i.subtotalCents)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Itens desmarcados ficam como recusados; aprovação parcial gera tratamento e títulos só do aceito.</p>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Desconto global" htmlFor="ng-dtype">
            <Select id="ng-dtype" value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountInput["type"])}>
              <option value="none">Sem desconto</option>
              <option value="amount">Em reais</option>
              <option value="percent">Percentual</option>
            </Select>
          </Field>
          {discountType === "amount" ? (
            <Field label="Valor do desconto" htmlFor="ng-dcents">
              <MoneyInput id="ng-dcents" value={discountCents} onChange={setDiscountCents} />
            </Field>
          ) : discountType === "percent" ? (
            <Field label="Percentual (%)" htmlFor="ng-dpct" hint="Ex.: 10 ou 7,5">
              <Input id="ng-dpct" inputMode="decimal" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} />
            </Field>
          ) : (
            <div />
          )}
          <dl className="grid grid-cols-3 gap-2 rounded-md border border-border bg-surface p-3 text-sm md:col-span-1">
            <div>
              <dt className="text-xs text-subtle">Subtotal</dt>
              <dd className="tabular">{formatBRL(totals.subtotalCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Desconto</dt>
              <dd className="tabular">{formatBRL(totals.discountCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Total</dt>
              <dd className="font-semibold tabular">{formatBRL(totals.totalCents)}</dd>
            </div>
          </dl>
        </div>
        {totals.error ? <Notice tone="danger">{totals.error}</Notice> : null}
        {isRevision ? (
          <Notice tone={delta === 0 ? "info" : delta > 0 ? "warning" : "info"}>
            Acordo vigente: {formatBRL(previousTotalCents)}. Diferença desta revisão: <strong className="tabular">{formatBRL(delta)}</strong>.{" "}
            {delta > 0 ? "Monte abaixo o plano apenas da diferença." : delta < 0 ? "O saldo em aberto será reduzido; se já houver pagamento acima do novo total, nasce um crédito pendente de decisão." : "Sem efeito financeiro."}
          </Notice>
        ) : null}

        {target > 0 ? (
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">Plano de pagamento {isRevision ? "(diferença)" : ""}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Entrada" htmlFor="ng-down">
                <MoneyInput id="ng-down" value={downCents} onChange={setDownCents} />
              </Field>
              <Field label="Data da entrada" htmlFor="ng-downdate">
                <Input id="ng-downdate" type="date" value={downDate} onChange={(e) => setDownDate(e.target.value)} />
              </Field>
              <Field label="Forma da entrada" htmlFor="ng-downm">
                <Select id="ng-downm" value={downMethod} onChange={(e) => setDownMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Quantidade de parcelas" htmlFor="ng-count">
                <Input id="ng-count" type="number" min={1} max={120} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
              <Field label="Primeiro vencimento" htmlFor="ng-first" hint="Meses seguintes preservam o dia (ex.: 30 → 28/02 → 30/03)">
                <Input id="ng-first" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
              </Field>
              <Field label="Forma padrão das parcelas" htmlFor="ng-method">
                <Select id="ng-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABEL[m]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={generate}>Gerar parcelas</Button>
              <span className="text-xs text-muted">Centavos restantes vão para as primeiras parcelas. Cada linha pode ser editada.</span>
            </div>
            {planError ? <Notice tone="danger">{planError}</Notice> : null}
            {lines.length > 0 ? (
              <TableWrap label="Parcelas">
                <Table>
                  <thead>
                    <tr>
                      <Th>Parcela</Th>
                      <Th>Vencimento</Th>
                      <Th align="right">Valor</Th>
                      <Th>Forma</Th>
                      <Th align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <Td className="tabular">
                          {i + 1}/{lines.length}
                        </Td>
                        <Td>
                          <Input aria-label={`Vencimento da parcela ${i + 1}`} type="date" value={l.dueDate} onChange={(e) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, dueDate: e.target.value } : x)))} />
                        </Td>
                        <Td align="right">
                          <div className="ml-auto w-36">
                            <MoneyInput aria-label={`Valor da parcela ${i + 1}`} value={l.amountCents} onChange={(v) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, amountCents: v ?? 0 } : x)))} />
                          </div>
                        </Td>
                        <Td>
                          <Select aria-label={`Forma da parcela ${i + 1}`} value={l.method} onChange={(e) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}>
                            {PAYMENT_METHODS.map((m) => (
                              <option key={m} value={m}>
                                {PAYMENT_METHOD_LABEL[m]}
                              </option>
                            ))}
                          </Select>
                          {l.method === "other" ? (
                            <Input className="mt-1" aria-label="Identifique a forma" placeholder="Identifique a forma" value={l.methodNote ?? ""} onChange={(e) => setLines((ls) => ls.map((x, k) => (k === i ? { ...x, methodNote: e.target.value } : x)))} />
                          ) : null}
                        </Td>
                        <Td align="right">
                          <Button size="sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, k) => k !== i))}>
                            Remover
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : null}
            <p className={planSum === target ? "text-sm text-success" : "text-sm text-danger"} aria-live="polite">
              Entrada + parcelas: <strong className="tabular">{formatBRL(planSum)}</strong> de <strong className="tabular">{formatBRL(target)}</strong>
              {planSum === target ? " — fecha o total." : ` — faltam ${formatBRL(target - planSum)}.`}
            </p>
          </fieldset>
        ) : (
          <Notice tone="info">{isRevision ? "Não há valor a parcelar nesta revisão." : "Total zero: a aprovação registra a gratuidade/desconto e não gera títulos."}</Notice>
        )}
        {simulate.error ? <Notice tone="danger">{simulate.error}</Notice> : null}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          {canSimulate ? (
            <Button loading={simulate.pending} onClick={() => simulate.run(payload)}>
              Salvar simulação
            </Button>
          ) : null}
          {canApprove ? (
            <Button
              variant="primary"
              disabled={approved.length === 0 || Boolean(totals.error) || (target > 0 ? planErrors.length > 0 : plan.downPayment !== null || lines.length > 0)}
              onClick={() => {
                setIdemKey(crypto.randomUUID());
                setConfirm(true);
              }}
            >
              {isRevision ? "Aprovar revisão" : "Aprovar orçamento"}
            </Button>
          ) : null}
        </div>
      </CardBody>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={isRevision ? "Confirmar aprovação da revisão" : "Confirmar aprovação"}
        description="Esta ação gera os itens de tratamento e os títulos a receber. Ela pode ser revisada depois, sem apagar pagamentos."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Voltar
            </Button>
            <Button
              variant="primary"
              loading={approve.pending}
              onClick={async () => {
                const res = await approve.run({ ...payload, expectedVersion: version, idempotencyKey: idemKey, plan: target > 0 ? plan : { downPayment: null, installments: [] } });
                if (res.ok) setConfirm(false);
              }}
            >
              Confirmar aprovação
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm">
          {approve.error ? <Notice tone="danger">{approve.error}</Notice> : null}
          <p>
            {approved.length} de {items.length} item(ns) aprovados · total {formatBRL(totals.totalCents)}
            {isRevision ? ` · diferença ${formatBRL(delta)}` : ""}
          </p>
          {target > 0 ? (
            <ul className="list-inside list-disc text-muted">
              {plan.downPayment ? (
                <li>
                  Entrada {formatBRL(plan.downPayment.amountCents)} em {plan.downPayment.dueDate.split("-").reverse().join("/")} ({PAYMENT_METHOD_LABEL[plan.downPayment.method]})
                </li>
              ) : null}
              {lines.map((l, i) => (
                <li key={i}>
                  Parcela {i + 1}: {formatBRL(l.amountCents)} em {l.dueDate.split("-").reverse().join("/")} ({PAYMENT_METHOD_LABEL[l.method]})
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Dialog>
    </Card>
  );
}
