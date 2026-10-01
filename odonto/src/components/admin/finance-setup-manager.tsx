// Hello World
"use client";

import { useState } from "react";
import { saveAccountAction, saveCardFeeRuleAction, saveCategoryAction, saveCostCenterAction, saveSupplierAction } from "@/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { MoneyInput } from "@/components/ui/money-input";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";

const KIND_LABEL: Record<string, string> = { bank: "Conta bancária", cash: "Caixa", card_clearing: "Recebíveis de cartão", other: "Outra" };

interface Account {
  id: string | null;
  name: string;
  kind: string;
  bankName: string | null;
  bankCode: string | null;
  branch: string | null;
  accountNumberMasked: string | null;
  openingBalanceCents: number;
  openingDate: string;
  active: boolean;
}
interface Rule {
  id: string | null;
  acquirer: string;
  brand: string | null;
  paymentType: string;
  installmentsFrom: number;
  installmentsTo: number;
  feeBasisPoints: number;
  fixedFeeCents: number;
  settlementDays: number;
  active: boolean;
}

export function FinanceSetupManager({
  canEdit,
  today,
  accounts,
  categories,
  costCenters,
  suppliers,
  rules,
}: {
  canEdit: boolean;
  today: string;
  accounts: Account[];
  categories: { id: string; name: string; type: string; active: boolean; system: boolean }[];
  costCenters: { id: string; name: string; active: boolean }[];
  suppliers: { id: string; name: string; document: string | null; phone: string | null; email: string | null; active: boolean }[];
  rules: Rule[];
}) {
  const [account, setAccount] = useState<Account | null>(null);
  const [simple, setSimple] = useState<null | { kind: "category" | "cost_center" | "supplier"; id: string | null; name: string; type?: string; document?: string; phone?: string; email?: string; active: boolean }>(null);
  const [rule, setRule] = useState<Rule | null>(null);
  const saveAccount = useAction(saveAccountAction, { success: "Conta salva" });
  const saveCategory = useAction(saveCategoryAction, { success: "Categoria salva" });
  const saveCc = useAction(saveCostCenterAction, { success: "Centro de custo salvo" });
  const saveSupplier = useAction(saveSupplierAction, { success: "Fornecedor salvo" });
  const saveRule = useAction(saveCardFeeRuleAction, { success: "Taxa salva" });
  const simpleError = saveCategory.error ?? saveCc.error ?? saveSupplier.error;
  const edit = (label: string, onClick: () => void) =>
    canEdit ? (
      <Button size="sm" variant="ghost" onClick={onClick}>
        {label}
      </Button>
    ) : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card className="xl:col-span-2">
        <CardHeader
          title="Contas financeiras"
          description="Saldo inicial e data de referência não mudam depois que houver movimentos (use ajustes)."
          actions={edit("Nova conta", () => setAccount({ id: null, name: "", kind: "bank", bankName: "", bankCode: "", branch: "", accountNumberMasked: "", openingBalanceCents: 0, openingDate: today, active: true }))}
        />
        <ul className="divide-y divide-border">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
              <span>
                {a.name} {!a.active ? <Badge>Inativa</Badge> : null}
                <span className="block text-xs text-subtle">
                  {KIND_LABEL[a.kind]} {a.bankCode ? `· banco ${a.bankCode}` : ""} {a.accountNumberMasked ? `· ${a.accountNumberMasked}` : ""} · saldo inicial {formatBRL(a.openingBalanceCents)} em {formatDateBR(a.openingDate)}
                </span>
              </span>
              {edit("Editar", () => setAccount({ ...a }))}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader
          title="Categorias"
          description="Categorias do sistema (taxas de cartão, tarifas) são usadas automaticamente."
          actions={edit("Nova categoria", () => setSimple({ kind: "category", id: null, name: "", type: "expense", active: true }))}
        />
        <ul className="divide-y divide-border">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm sm:px-5">
              <span>
                {c.name} <Badge tone={c.type === "income" ? "success" : "neutral"}>{c.type === "income" ? "Receita" : "Despesa"}</Badge> {c.system ? <Badge tone="info">Sistema</Badge> : null} {!c.active ? <Badge>Inativa</Badge> : null}
              </span>
              {edit("Editar", () => setSimple({ kind: "category", id: c.id, name: c.name, type: c.type, active: c.active }))}
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Centros de custo" actions={edit("Novo", () => setSimple({ kind: "cost_center", id: null, name: "", active: true }))} />
          <ul className="divide-y divide-border">
            {costCenters.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm sm:px-5">
                <span>
                  {c.name} {!c.active ? <Badge>Inativo</Badge> : null}
                </span>
                {edit("Editar", () => setSimple({ kind: "cost_center", id: c.id, name: c.name, active: c.active }))}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Fornecedores" actions={edit("Novo", () => setSimple({ kind: "supplier", id: null, name: "", document: "", phone: "", email: "", active: true }))} />
          <ul className="divide-y divide-border">
            {suppliers.length === 0 ? <li className="px-5 py-3 text-sm text-muted">Nenhum fornecedor.</li> : null}
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm sm:px-5">
                <span>
                  {s.name} {!s.active ? <Badge>Inativo</Badge> : null}
                  <span className="block text-xs text-subtle">{[s.document, s.phone, s.email].filter(Boolean).join(" · ")}</span>
                </span>
                {edit("Editar", () => setSimple({ kind: "supplier", id: s.id, name: s.name, document: s.document ?? "", phone: s.phone ?? "", email: s.email ?? "", active: s.active }))}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Card className="xl:col-span-2">
        <CardHeader
          title="Taxas de cartão (referência)"
          description="O valor real da taxa é confirmado em cada transação."
          actions={edit("Nova taxa", () => setRule({ id: null, acquirer: "", brand: "", paymentType: "credit", installmentsFrom: 1, installmentsTo: 1, feeBasisPoints: 0, fixedFeeCents: 0, settlementDays: 30, active: true }))}
        />
        <ul className="divide-y divide-border">
          {rules.length === 0 ? <li className="px-5 py-3 text-sm text-muted">Nenhuma taxa cadastrada.</li> : null}
          {rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm sm:px-5">
              <span>
                {r.acquirer} {r.brand ? `· ${r.brand}` : ""} · {r.paymentType === "credit" ? "Crédito" : "Débito"} {r.installmentsFrom}–{r.installmentsTo}x · {(r.feeBasisPoints / 100).toFixed(2).replace(".", ",")}% · D+{r.settlementDays}
              </span>
              {edit("Editar", () => setRule({ ...r }))}
            </li>
          ))}
        </ul>
      </Card>

      {account ? (
        <Dialog
          open
          onClose={() => setAccount(null)}
          title={account.id ? "Editar conta" : "Nova conta"}
          size="lg"
          footer={
            <Button
              variant="primary"
              loading={saveAccount.pending}
              onClick={async () => {
                const res = await saveAccount.run({
                  ...account,
                  kind: account.kind as "bank" | "cash" | "card_clearing" | "other",
                  bankName: account.bankName || null,
                  bankCode: account.bankCode || null,
                  branch: account.branch || null,
                  accountNumberMasked: account.accountNumberMasked || null,
                });
                if (res.ok) setAccount(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {saveAccount.error ? <Notice tone="danger" className="sm:col-span-2">{saveAccount.error}</Notice> : null}
            <Field label="Nome" htmlFor="ac-name" required>
              <Input id="ac-name" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
            </Field>
            <Field label="Tipo" htmlFor="ac-kind">
              <Select id="ac-kind" value={account.kind} onChange={(e) => setAccount({ ...account, kind: e.target.value })}>
                {Object.entries(KIND_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Banco" htmlFor="ac-bank">
              <Input id="ac-bank" value={account.bankName ?? ""} onChange={(e) => setAccount({ ...account, bankName: e.target.value })} />
            </Field>
            <Field label="Código do banco" htmlFor="ac-code" hint="Usado para validar o OFX">
              <Input id="ac-code" value={account.bankCode ?? ""} onChange={(e) => setAccount({ ...account, bankCode: e.target.value })} />
            </Field>
            <Field label="Agência" htmlFor="ac-branch">
              <Input id="ac-branch" value={account.branch ?? ""} onChange={(e) => setAccount({ ...account, branch: e.target.value })} />
            </Field>
            <Field label="Conta (final)" htmlFor="ac-number" hint="Guarde apenas o necessário para identificar">
              <Input id="ac-number" value={account.accountNumberMasked ?? ""} onChange={(e) => setAccount({ ...account, accountNumberMasked: e.target.value })} />
            </Field>
            <Field label="Saldo inicial" htmlFor="ac-open">
              <MoneyInput id="ac-open" allowNegative value={account.openingBalanceCents} onChange={(v) => setAccount({ ...account, openingBalanceCents: v ?? 0 })} />
            </Field>
            <Field label="Data de referência do saldo" htmlFor="ac-date">
              <Input id="ac-date" type="date" value={account.openingDate} onChange={(e) => setAccount({ ...account, openingDate: e.target.value })} />
            </Field>
            <Checkbox label="Ativa" checked={account.active} onChange={(e) => setAccount({ ...account, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}

      {simple ? (
        <Dialog
          open
          onClose={() => setSimple(null)}
          title={simple.kind === "category" ? "Categoria" : simple.kind === "cost_center" ? "Centro de custo" : "Fornecedor"}
          footer={
            <Button
              variant="primary"
              loading={saveCategory.pending || saveCc.pending || saveSupplier.pending}
              onClick={async () => {
                const res =
                  simple.kind === "category"
                    ? await saveCategory.run({ id: simple.id, name: simple.name, type: (simple.type ?? "expense") as "income" | "expense", active: simple.active })
                    : simple.kind === "cost_center"
                      ? await saveCc.run({ id: simple.id, name: simple.name, active: simple.active })
                      : await saveSupplier.run({ id: simple.id, name: simple.name, document: simple.document || null, phone: simple.phone || null, email: simple.email || null, active: simple.active });
                if (res.ok) setSimple(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="space-y-4">
            {simpleError ? <Notice tone="danger">{simpleError}</Notice> : null}
            <Field label="Nome" htmlFor="sm-name" required>
              <Input id="sm-name" value={simple.name} onChange={(e) => setSimple({ ...simple, name: e.target.value })} />
            </Field>
            {simple.kind === "category" && !simple.id ? (
              <Field label="Tipo" htmlFor="sm-type">
                <Select id="sm-type" value={simple.type} onChange={(e) => setSimple({ ...simple, type: e.target.value })}>
                  <option value="income">Receita</option>
                  <option value="expense">Despesa</option>
                </Select>
              </Field>
            ) : null}
            {simple.kind === "supplier" ? (
              <>
                <Field label="CNPJ/CPF" htmlFor="sm-doc">
                  <Input id="sm-doc" value={simple.document} onChange={(e) => setSimple({ ...simple, document: e.target.value })} />
                </Field>
                <Field label="Telefone" htmlFor="sm-phone">
                  <Input id="sm-phone" value={simple.phone} onChange={(e) => setSimple({ ...simple, phone: e.target.value })} />
                </Field>
                <Field label="E-mail" htmlFor="sm-email">
                  <Input id="sm-email" value={simple.email} onChange={(e) => setSimple({ ...simple, email: e.target.value })} />
                </Field>
              </>
            ) : null}
            <Checkbox label="Ativo" checked={simple.active} onChange={(e) => setSimple({ ...simple, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}

      {rule ? (
        <Dialog
          open
          onClose={() => setRule(null)}
          title="Taxa de cartão"
          footer={
            <Button
              variant="primary"
              loading={saveRule.pending}
              onClick={async () => {
                const res = await saveRule.run({ ...rule, brand: rule.brand || null, paymentType: rule.paymentType as "credit" | "debit" });
                if (res.ok) setRule(null);
              }}
            >
              Salvar
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {saveRule.error ? <Notice tone="danger" className="sm:col-span-2">{saveRule.error}</Notice> : null}
            <Field label="Operadora" htmlFor="rl-acq" required>
              <Input id="rl-acq" value={rule.acquirer} onChange={(e) => setRule({ ...rule, acquirer: e.target.value })} />
            </Field>
            <Field label="Bandeira (opcional)" htmlFor="rl-brand">
              <Input id="rl-brand" value={rule.brand ?? ""} onChange={(e) => setRule({ ...rule, brand: e.target.value })} />
            </Field>
            <Field label="Tipo" htmlFor="rl-type">
              <Select id="rl-type" value={rule.paymentType} onChange={(e) => setRule({ ...rule, paymentType: e.target.value })}>
                <option value="credit">Crédito</option>
                <option value="debit">Débito</option>
              </Select>
            </Field>
            <Field label="Taxa (%)" htmlFor="rl-fee" hint="Ex.: 2,99">
              <Input id="rl-fee" inputMode="decimal" value={(rule.feeBasisPoints / 100).toString().replace(".", ",")} onChange={(e) => setRule({ ...rule, feeBasisPoints: Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0 })} />
            </Field>
            <Field label="Parcelas de" htmlFor="rl-from">
              <Input id="rl-from" type="number" min={1} max={24} value={rule.installmentsFrom} onChange={(e) => setRule({ ...rule, installmentsFrom: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="até" htmlFor="rl-to">
              <Input id="rl-to" type="number" min={1} max={24} value={rule.installmentsTo} onChange={(e) => setRule({ ...rule, installmentsTo: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Prazo de liquidação (dias)" htmlFor="rl-days">
              <Input id="rl-days" type="number" min={0} max={120} value={rule.settlementDays} onChange={(e) => setRule({ ...rule, settlementDays: Number(e.target.value) || 0 })} />
            </Field>
            <Checkbox label="Ativa" checked={rule.active} onChange={(e) => setRule({ ...rule, active: e.target.checked })} />
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
