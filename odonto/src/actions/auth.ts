"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { PRODUCT_NAME } from "@/lib/product";
import { runAction, type ActionResult } from "@/server/action-result";
import { newTotpSecret, totpUri, verifyTotp } from "@/server/auth/crypto";
import {
  changePassword,
  createSession,
  login,
  requestPasswordReset,
  resetPassword,
  revokeSession,
  selectOrganization,
  verifySessionMfa,
} from "@/server/auth/service";
import { getDb } from "@/server/db/client";
import { sessions, users } from "@/server/db/schema";
import { appUrl, sendEmail } from "@/server/email";
import { BusinessRuleError, UnauthenticatedError, ValidationError } from "@/server/errors";
import { decryptSecret, encryptSecret } from "@/server/secrets";
import { clearSessionCookie, getCurrentSession, getSessionToken, requestMeta, setSessionCookie } from "@/server/session";
import { acceptInvitation } from "@/server/services/users";

function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/visao-geral";
}

const loginSchema = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200), next: z.string().optional() });

export async function loginAction(input: z.input<typeof loginSchema>): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const data = loginSchema.safeParse(input);
    if (!data.success) throw new ValidationError("Informe e-mail e senha");
    const result = await login(getDb(), data.data.email, data.data.password, await requestMeta());
    if (!result.ok) {
      if (result.reason === "locked") throw new BusinessRuleError("Muitas tentativas sem sucesso. Aguarde 15 minutos ou redefina sua senha.");
      throw new ValidationError("E-mail ou senha incorretos.");
    }
    await setSessionCookie(result.token);
    if (result.mfaRequired) return { redirectTo: "/entrar/verificacao" };
    const session = await getCurrentSession();
    return { redirectTo: session?.activeOrganizationId ? safeNext(data.data.next) : "/selecionar-clinica" };
  });
}

export async function logoutAction(): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const token = await getSessionToken();
    if (token) await revokeSession(getDb(), token);
    await clearSessionCookie();
    return { redirectTo: "/entrar" };
  });
}

export async function verifyMfaAction(code: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const session = await getCurrentSession();
    if (!session) throw new UnauthenticatedError();
    const ok = await verifySessionMfa(getDb(), session, String(code));
    if (!ok) throw new ValidationError("Código inválido ou expirado");
    return { redirectTo: session.activeOrganizationId ? "/visao-geral" : "/selecionar-clinica" };
  });
}

export async function selectOrganizationAction(organizationId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const session = await getCurrentSession();
    if (!session || session.mfaPending) throw new UnauthenticatedError();
    await selectOrganization(getDb(), session, z.uuid().parse(organizationId));
    return { redirectTo: "/visao-geral" };
  });
}

export async function requestResetAction(email: string): Promise<ActionResult<{ message: string }>> {
  return runAction(async () => {
    const parsed = z.email().safeParse(String(email).trim());
    if (parsed.success) {
      const res = await requestPasswordReset(getDb(), parsed.data, await requestMeta());
      if (res) {
        await sendEmail({
          to: parsed.data,
          subject: `${PRODUCT_NAME}: redefinição de senha`,
          text: `Olá, ${res.userName}.\n\nPara criar uma nova senha, acesse (válido por 1 hora):\n${appUrl(`/redefinir-senha/${res.token}`)}\n\nSe você não pediu, ignore esta mensagem.`,
        });
      }
    }
    // Mesma resposta exista ou não o e-mail.
    return { message: "Se o e-mail estiver cadastrado, enviaremos as instruções. Sem e-mail configurado na clínica, peça ao administrador um link de redefinição." };
  });
}

export async function resetPasswordAction(token: string, password: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    await resetPassword(getDb(), String(token), String(password));
    return { redirectTo: "/entrar?redefinida=1" };
  });
}

export async function acceptInviteAction(token: string, name: string, password: string): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const db = getDb();
    const { userId, organizationId } = await acceptInvitation(db, String(token), { name: String(name), password: String(password) });
    const sessionToken = await createSession(db, userId, await requestMeta(), organizationId);
    await setSessionCookie(sessionToken);
    return { redirectTo: "/visao-geral" };
  });
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await getCurrentSession();
    if (!session) throw new UnauthenticatedError();
    await changePassword(getDb(), session.userId, String(current), String(next));
    return null;
  });
}

/** MFA (TOTP): gera segredo, confirma com um código e só então ativa. */
export async function startMfaSetupAction(): Promise<ActionResult<{ secret: string; uri: string }>> {
  return runAction(async () => {
    const session = await getCurrentSession();
    if (!session) throw new UnauthenticatedError();
    const secret = newTotpSecret();
    await getDb().update(users).set({ mfaSecret: encryptSecret(secret), mfaEnabled: false }).where(eq(users.id, session.userId));
    return { secret, uri: totpUri(secret, session.email, PRODUCT_NAME) };
  });
}

export async function confirmMfaSetupAction(code: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const session = await getCurrentSession();
    if (!session) throw new UnauthenticatedError();
    const db = getDb();
    const [user] = await db.select({ secret: users.mfaSecret }).from(users).where(eq(users.id, session.userId));
    if (!user?.secret || !verifyTotp(decryptSecret(user.secret), String(code))) throw new ValidationError("Código inválido");
    await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, session.userId));
    // A sessão atual já comprovou o código; as próximas exigirão verificação.
    await db.update(sessions).set({ mfaVerifiedAt: new Date() }).where(eq(sessions.id, session.sessionId));
    return null;
  });
}
