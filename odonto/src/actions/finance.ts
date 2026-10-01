"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action-result";
import { ValidationError } from "@/server/errors";
import { getRequestContext } from "@/server/session";
import {
  confirmOfxImport,
  createEntryFromBankTransaction,
  discardOfxImport,
  ignoreBankTransaction,
  previewOfxImport,
  reconcile,
  settleFromBankTransaction,
  undoReconciliation,
  unignoreBankTransaction,
} from "@/server/services/bank";
import { generateReceipt } from "@/server/services/documents";
import { listCategories, saveAccount, saveCardFeeRule, saveCategory, saveCostCenter, saveSupplier } from "@/server/services/finance-setup";
import {
  cancelTitle,
  createPayable,
  createReceivable,
  createRecurrence,
  createTransfer,
  generateRecurringPayables,
  listTitles,
  recordCardPayment,
  reverseSettlement,
  reverseTransfer,
  settleCardReceivable,
  settleTitles,
  suspendRecurrence,
  updateTitleDue,
} from "@/server/services/titles";

type In<F extends (...args: never[]) => unknown> = Parameters<F>[1];

function done() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/visao-geral");
}

export async function settleTitlesAction(input: In<typeof settleTitles>) {
  return runAction(async () => {
    const res = await settleTitles(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function recordCardPaymentAction(input: In<typeof recordCardPayment>) {
  return runAction(async () => {
    const res = await recordCardPayment(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function settleCardReceivableAction(input: In<typeof settleCardReceivable>) {
  return runAction(async () => {
    await settleCardReceivable(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function reverseSettlementAction(input: In<typeof reverseSettlement>) {
  return runAction(async () => {
    await reverseSettlement(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function createReceivableAction(input: In<typeof createReceivable>) {
  return runAction(async () => {
    const res = await createReceivable(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function createPayableAction(input: In<typeof createPayable>) {
  return runAction(async () => {
    const res = await createPayable(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function updateTitleDueAction(input: In<typeof updateTitleDue>) {
  return runAction(async () => {
    await updateTitleDue(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function cancelTitleAction(input: In<typeof cancelTitle>) {
  return runAction(async () => {
    await cancelTitle(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function createRecurrenceAction(input: In<typeof createRecurrence>) {
  return runAction(async () => createRecurrence(await getRequestContext(), input));
}

export async function generateRecurringAction(until: string) {
  return runAction(async () => {
    const res = await generateRecurringPayables(await getRequestContext(), until);
    done();
    return res;
  });
}

export async function suspendRecurrenceAction(id: string) {
  return runAction(async () => {
    await suspendRecurrence(await getRequestContext(), id);
    done();
    return null;
  });
}

export async function createTransferAction(input: In<typeof createTransfer>) {
  return runAction(async () => {
    const res = await createTransfer(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function reverseTransferAction(id: string, reason: string) {
  return runAction(async () => {
    await reverseTransfer(await getRequestContext(), id, reason);
    done();
    return null;
  });
}

export async function generateReceiptAction(settlementId: string) {
  return runAction(async () => generateReceipt(await getRequestContext(), settlementId));
}

export async function saveAccountAction(input: In<typeof saveAccount>) {
  return runAction(async () => saveAccount(await getRequestContext(), input));
}
export async function saveCategoryAction(input: In<typeof saveCategory>) {
  return runAction(async () => saveCategory(await getRequestContext(), input));
}
export async function saveCostCenterAction(input: In<typeof saveCostCenter>) {
  return runAction(async () => saveCostCenter(await getRequestContext(), input));
}
export async function saveSupplierAction(input: In<typeof saveSupplier>) {
  return runAction(async () => saveSupplier(await getRequestContext(), input));
}
export async function saveCardFeeRuleAction(input: In<typeof saveCardFeeRule>) {
  return runAction(async () => saveCardFeeRule(await getRequestContext(), input));
}

// Extratos e conciliação
export async function previewOfxAction(form: FormData) {
  return runAction(async () => {
    const file = form.get("file");
    const accountId = form.get("accountId");
    if (!(file instanceof File)) throw new ValidationError("Selecione o arquivo OFX");
    if (typeof accountId !== "string" || !accountId) throw new ValidationError("Escolha a conta");
    const res = await previewOfxImport(await getRequestContext(), { accountId, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    return { batchId: res.batchId };
  });
}

export async function confirmOfxAction(input: In<typeof confirmOfxImport>) {
  return runAction(async () => {
    const res = await confirmOfxImport(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function discardOfxAction(batchId: string) {
  return runAction(async () => {
    await discardOfxImport(await getRequestContext(), batchId);
    return null;
  });
}

export async function reconcileAction(input: In<typeof reconcile>) {
  return runAction(async () => {
    const res = await reconcile(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function undoReconciliationAction(input: In<typeof undoReconciliation>) {
  return runAction(async () => {
    await undoReconciliation(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function ignoreBankTxAction(input: In<typeof ignoreBankTransaction>) {
  return runAction(async () => {
    await ignoreBankTransaction(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function unignoreBankTxAction(id: string) {
  return runAction(async () => {
    await unignoreBankTransaction(await getRequestContext(), id);
    done();
    return null;
  });
}

export async function settleFromBankAction(input: In<typeof settleFromBankTransaction>) {
  return runAction(async () => {
    const res = await settleFromBankTransaction(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function createEntryFromBankAction(input: In<typeof createEntryFromBankTransaction>) {
  return runAction(async () => {
    const res = await createEntryFromBankTransaction(await getRequestContext(), input);
    done();
    return res;
  });
}

/** Títulos em aberto para dar baixa a partir de uma movimentação do extrato. */
export async function openTitlesForBankAction(kind: "receivable" | "payable", q: string) {
  return runAction(async () => {
    const res = await listTitles(await getRequestContext(), { kind, status: "open_all", q, pageSize: 50 });
    return res.items.map((t) => ({ id: t.id, description: t.description, counterpart: t.counterpart, dueDate: t.dueDate, balanceCents: t.balanceCents }));
  });
}

export async function categoriesAction(type: "income" | "expense") {
  return runAction(async () => (await listCategories(await getRequestContext(), type)).filter((c) => c.active).map((c) => ({ id: c.id, name: c.name })));
}
