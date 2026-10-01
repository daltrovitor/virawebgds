"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action-result";
import { getRequestContext } from "@/server/session";
import {
  cancelSchedulingTask,
  createAlert,
  createSchedulingTask,
  deleteResponsible,
  quickCreatePatient,
  resolveAlert,
  savePatient,
  saveResponsible,
  searchPatients,
  setPatientStatus,
} from "@/server/services/patients";

type In<F extends (...args: never[]) => unknown> = Parameters<F>[1];

export async function savePatientAction(input: In<typeof savePatient>) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    const res = await savePatient(ctx, input);
    if (res.status === "saved") revalidatePath("/pacientes");
    return res;
  });
}

export async function quickCreatePatientAction(input: In<typeof quickCreatePatient>) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    return quickCreatePatient(ctx, input);
  });
}

export async function setPatientStatusAction(patientId: string, status: "active" | "archived") {
  return runAction(async () => {
    const ctx = await getRequestContext();
    await setPatientStatus(ctx, patientId, status);
    revalidatePath(`/pacientes/${patientId}`);
    return null;
  });
}

export async function saveResponsibleAction(input: In<typeof saveResponsible>) {
  return runAction(async () => saveResponsible(await getRequestContext(), input));
}

export async function deleteResponsibleAction(patientId: string, id: string) {
  return runAction(async () => {
    await deleteResponsible(await getRequestContext(), patientId, id);
    return null;
  });
}

export async function createAlertAction(input: In<typeof createAlert>) {
  return runAction(async () => createAlert(await getRequestContext(), input));
}

export async function resolveAlertAction(alertId: string, note: string | null) {
  return runAction(async () => {
    await resolveAlert(await getRequestContext(), alertId, note);
    return null;
  });
}

export async function createSchedulingTaskAction(input: In<typeof createSchedulingTask>) {
  return runAction(async () => createSchedulingTask(await getRequestContext(), input));
}

export async function cancelSchedulingTaskAction(taskId: string) {
  return runAction(async () => {
    await cancelSchedulingTask(await getRequestContext(), taskId);
    return null;
  });
}

export async function searchPatientsAction(q: string) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    const res = await searchPatients(ctx, { q, pageSize: 10 });
    return res.items.map((p) => ({ id: p.id, name: p.socialName || p.fullName, phone: p.phone, code: p.code }));
  });
}
