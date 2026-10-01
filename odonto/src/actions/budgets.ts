"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action-result";
import { getRequestContext } from "@/server/session";
import {
  addItems,
  approveBudget,
  changeBudgetStatus,
  createBudget,
  discardRevision,
  removeItem,
  saveNegotiation,
  startRevision,
  updateItem,
} from "@/server/services/budgets";
import { generateContract } from "@/server/services/documents";
import { cancelTreatmentItem, recordProgress, resolveFinancialReview } from "@/server/services/treatments";

type In<F extends (...args: never[]) => unknown> = Parameters<F>[1];

export async function createBudgetAction(input: In<typeof createBudget>) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    const res = await createBudget(ctx, input);
    revalidatePath("/orcamentos");
    return res;
  });
}

export async function addItemsAction(input: In<typeof addItems>) {
  return runAction(async () => addItems(await getRequestContext(), input));
}

export async function updateItemAction(input: In<typeof updateItem>) {
  return runAction(async () => {
    await updateItem(await getRequestContext(), input);
    return null;
  });
}

export async function removeItemAction(itemId: string) {
  return runAction(async () => {
    await removeItem(await getRequestContext(), itemId);
    return null;
  });
}

export async function saveNegotiationAction(input: In<typeof saveNegotiation>) {
  return runAction(async () => {
    await saveNegotiation(await getRequestContext(), input);
    return null;
  });
}

export async function approveBudgetAction(input: In<typeof approveBudget>) {
  return runAction(async () => {
    const res = await approveBudget(await getRequestContext(), input);
    revalidatePath("/orcamentos");
    revalidatePath("/financeiro");
    return res;
  });
}

export async function changeBudgetStatusAction(input: In<typeof changeBudgetStatus>) {
  return runAction(async () => {
    await changeBudgetStatus(await getRequestContext(), input);
    return null;
  });
}

export async function startRevisionAction(input: In<typeof startRevision>) {
  return runAction(async () => startRevision(await getRequestContext(), input));
}

export async function discardRevisionAction(budgetId: string) {
  return runAction(async () => {
    await discardRevision(await getRequestContext(), budgetId);
    return null;
  });
}

export async function generateContractAction(budgetId: string) {
  return runAction(async () => generateContract(await getRequestContext(), budgetId));
}

export async function recordProgressAction(input: In<typeof recordProgress>) {
  return runAction(async () => {
    await recordProgress(await getRequestContext(), input);
    return null;
  });
}

export async function cancelTreatmentItemAction(input: In<typeof cancelTreatmentItem>) {
  return runAction(async () => {
    await cancelTreatmentItem(await getRequestContext(), input);
    return null;
  });
}

export async function resolveFinancialReviewAction(treatmentItemId: string, note: string) {
  return runAction(async () => {
    await resolveFinancialReview(await getRequestContext(), treatmentItemId, note);
    return null;
  });
}
