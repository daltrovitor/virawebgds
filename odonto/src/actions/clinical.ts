"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/action-result";
import { ValidationError } from "@/server/errors";
import { getRequestContext } from "@/server/session";
import { archiveAttachment, setProfilePhoto, uploadAttachment } from "@/server/services/attachments";
import {
  addNoteAddendum,
  deleteDraftNote,
  recordAnamnesis,
  reviewAnamnesis,
  saveAnamnesisTemplate,
  saveClinicalNote,
} from "@/server/services/clinical";

type In<F extends (...args: never[]) => unknown> = Parameters<F>[1];

export async function saveClinicalNoteAction(input: In<typeof saveClinicalNote>) {
  return runAction(async () => saveClinicalNote(await getRequestContext(), input));
}

export async function addNoteAddendumAction(input: In<typeof addNoteAddendum>) {
  return runAction(async () => addNoteAddendum(await getRequestContext(), input));
}

export async function deleteDraftNoteAction(noteId: string) {
  return runAction(async () => {
    await deleteDraftNote(await getRequestContext(), noteId);
    return null;
  });
}

export async function recordAnamnesisAction(input: In<typeof recordAnamnesis>) {
  return runAction(async () => recordAnamnesis(await getRequestContext(), input));
}

export async function reviewAnamnesisAction(responseId: string, note: string | null) {
  return runAction(async () => {
    await reviewAnamnesis(await getRequestContext(), responseId, note);
    return null;
  });
}

export async function saveAnamnesisTemplateAction(input: In<typeof saveAnamnesisTemplate>) {
  return runAction(async () => saveAnamnesisTemplate(await getRequestContext(), input));
}

/** Upload via FormData (Server Action). Tipo e tamanho são validados no servidor. */
export async function uploadAttachmentAction(form: FormData) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ValidationError("Selecione um arquivo");
    const str = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
    };
    const tooth = str("tooth");
    const res = await uploadAttachment(ctx, {
      patientId: str("patientId") ?? "",
      kind: (str("kind") ?? "photo") as "photo" | "radiograph" | "document" | "other",
      takenOn: str("takenOn"),
      description: str("description"),
      originalName: file.name || "arquivo",
      tooth: tooth ? Number(tooth) : null,
      treatmentItemId: str("treatmentItemId"),
      appointmentId: str("appointmentId"),
      isProfilePhoto: str("isProfilePhoto") === "true",
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    revalidatePath(`/pacientes/${str("patientId")}`);
    return res;
  });
}

export async function archiveAttachmentAction(attachmentId: string, reason: string) {
  return runAction(async () => {
    await archiveAttachment(await getRequestContext(), attachmentId, reason);
    return null;
  });
}

export async function setProfilePhotoAction(attachmentId: string) {
  return runAction(async () => {
    await setProfilePhoto(await getRequestContext(), attachmentId);
    return null;
  });
}
