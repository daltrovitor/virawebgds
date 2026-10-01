"use server";

import { revalidatePath } from "next/cache";
import { appUrl, sendEmail } from "@/server/email";
import { runAction } from "@/server/action-result";
import { getRequestContext } from "@/server/session";
import { savePriceTable, saveProcedure, saveSpecialty, setPrice } from "@/server/services/catalog";
import { updateTemplate } from "@/server/services/documents";
import { updateSettings } from "@/server/services/organizations";
import { saveProfessional } from "@/server/services/professionals";
import { adminResetLink, createRole, inviteMember, revokeInvitation, updateMember, updateRolePermissions } from "@/server/services/users";
import { PRODUCT_NAME } from "@/lib/product";

type In<F extends (...args: never[]) => unknown> = Parameters<F>[1];

export async function saveSpecialtyAction(input: In<typeof saveSpecialty>) {
  return runAction(async () => saveSpecialty(await getRequestContext(), input));
}
export async function saveProcedureAction(input: In<typeof saveProcedure>) {
  return runAction(async () => saveProcedure(await getRequestContext(), input));
}
export async function savePriceTableAction(input: In<typeof savePriceTable>) {
  return runAction(async () => savePriceTable(await getRequestContext(), input));
}
export async function setPriceAction(input: In<typeof setPrice>) {
  return runAction(async () => {
    await setPrice(await getRequestContext(), input);
    return null;
  });
}
export async function saveProfessionalAction(input: In<typeof saveProfessional>) {
  return runAction(async () => saveProfessional(await getRequestContext(), input));
}
export async function updateSettingsAction(input: In<typeof updateSettings>) {
  return runAction(async () => {
    await updateSettings(await getRequestContext(), input);
    revalidatePath("/", "layout");
    return null;
  });
}
export async function updateTemplateAction(input: In<typeof updateTemplate>) {
  return runAction(async () => updateTemplate(await getRequestContext(), input));
}
export async function updateRolePermissionsAction(input: In<typeof updateRolePermissions>) {
  return runAction(async () => {
    await updateRolePermissions(await getRequestContext(), input);
    return null;
  });
}
export async function createRoleAction(input: In<typeof createRole>) {
  return runAction(async () => createRole(await getRequestContext(), input));
}
export async function updateMemberAction(input: In<typeof updateMember>) {
  return runAction(async () => {
    await updateMember(await getRequestContext(), input);
    return null;
  });
}

/** Convite: envia e-mail se configurado; sempre devolve o link para compartilhamento manual. */
export async function inviteMemberAction(input: In<typeof inviteMember>) {
  return runAction(async () => {
    const ctx = await getRequestContext();
    const { token } = await inviteMember(ctx, input);
    const link = appUrl(`/convite/${token}`);
    const mail = await sendEmail({
      to: input.email,
      subject: `${PRODUCT_NAME}: convite para ${ctx.clinicName}`,
      text: `Você foi convidado(a) para acessar ${ctx.clinicName}.\n\nAceite em até 7 dias: ${link}`,
    });
    return { link, emailSent: mail.sent };
  });
}

export async function revokeInvitationAction(id: string) {
  return runAction(async () => {
    await revokeInvitation(await getRequestContext(), id);
    return null;
  });
}

export async function adminResetLinkAction(membershipId: string) {
  return runAction(async () => {
    const { token } = await adminResetLink(await getRequestContext(), membershipId);
    return { link: appUrl(`/redefinir-senha/${token}`) };
  });
}
