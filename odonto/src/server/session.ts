import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loadOrgAccess, resolveSession, SESSION_ABSOLUTE_MS, type SessionInfo } from "./auth/service";
import type { Ctx } from "./context";
import { getDb } from "./db/client";

export const SESSION_COOKIE = "og_session";

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_ABSOLUTE_MS / 1000),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

export const getCurrentSession = cache(async (): Promise<SessionInfo | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  return resolveSession(getDb(), token);
});

/** Sessão válida e MFA concluída, ou redireciona para o login. */
export async function requireSession(): Promise<SessionInfo> {
  const session = await getCurrentSession();
  if (!session) redirect("/entrar");
  if (session.mfaPending) redirect("/entrar/verificacao");
  return session;
}

export interface RequestContext extends Ctx {
  session: SessionInfo;
  clinicName: string;
  brandColor: string;
  slotMinutes: number;
  isDemo: boolean;
}

/**
 * Contexto da requisição: clínica ativa vem da sessão validada no servidor e
 * o vínculo/permissões são recarregados a cada requisição.
 */
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const session = await requireSession();
  if (!session.activeOrganizationId) redirect("/selecionar-clinica");
  const db = getDb();
  const access = await loadOrgAccess(db, session.userId, session.activeOrganizationId);
  if (!access) redirect("/selecionar-clinica");
  const meta = await requestMeta();
  return {
    db,
    orgId: access.organizationId,
    userId: session.userId,
    userName: session.userName,
    roleKey: access.roleKey,
    permissions: access.permissions,
    timezone: access.timezone,
    ip: meta.ip,
    session,
    clinicName: access.displayName,
    brandColor: access.brandColor,
    slotMinutes: access.slotMinutes,
    isDemo: access.isDemo,
  };
});
