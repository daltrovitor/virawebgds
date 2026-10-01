"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action-result";
import { getRequestContext } from "@/server/session";
import {
  changeAppointmentStatus,
  createAppointment,
  createBlock,
  deactivateBlock,
  getAppointment,
  moveAppointment,
  recordAppointmentOutcome,
  rescheduleAppointment,
  updateAppointmentDetails,
} from "@/server/services/appointments";
import { listPatientTreatmentItems } from "@/server/services/treatments";

type In<F extends (...args: never[]) => unknown> = Parameters<F>[1];

function done() {
  revalidatePath("/agenda");
  revalidatePath("/visao-geral");
}

export async function createAppointmentAction(input: In<typeof createAppointment>) {
  return runAction(async () => {
    const res = await createAppointment(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function moveAppointmentAction(input: In<typeof moveAppointment>) {
  return runAction(async () => {
    const res = await moveAppointment(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function updateAppointmentDetailsAction(input: In<typeof updateAppointmentDetails>) {
  return runAction(async () => {
    await updateAppointmentDetails(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function changeAppointmentStatusAction(input: In<typeof changeAppointmentStatus>) {
  return runAction(async () => {
    await changeAppointmentStatus(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function rescheduleAppointmentAction(input: In<typeof rescheduleAppointment>) {
  return runAction(async () => {
    const res = await rescheduleAppointment(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function recordOutcomeAction(input: In<typeof recordAppointmentOutcome>) {
  return runAction(async () => {
    await recordAppointmentOutcome(await getRequestContext(), input);
    done();
    return null;
  });
}

export async function createBlockAction(input: In<typeof createBlock>) {
  return runAction(async () => {
    const res = await createBlock(await getRequestContext(), input);
    done();
    return res;
  });
}

export async function deactivateBlockAction(id: string) {
  return runAction(async () => {
    await deactivateBlock(await getRequestContext(), id);
    done();
    return null;
  });
}

/** Detalhes para o formulário (consulta + procedimentos do paciente). */
export async function loadAppointmentAction(id: string) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    const appt = await getAppointment(ctx, id);
    const items = await listPatientTreatmentItems(ctx, { patientId: appt.patientId, filter: "all" });
    return { appointment: appt, treatmentItems: items };
  });
}

export async function loadPatientTreatmentItemsAction(patientId: string) {
  return runAction(async () => listPatientTreatmentItems(await getRequestContext(), { patientId, filter: "all" }));
}
