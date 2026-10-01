import { and, asc, count, eq, gt, isNull, sql } from "drizzle-orm";
import { DEFAULT_ROLE_PERMISSIONS, isPermission, type Permission } from "@/domain/permissions";
import type { Db } from "../db/client";
import {
  loginAttempts,
  memberships,
  organizationSettings,
  organizations,
  passwordResetTokens,
  roles,
  sessions,
  users,
} from "../db/schema";
import { BusinessRuleError, UnauthenticatedError, ValidationError } from "../errors";
import { decryptSecret } from "../secrets";
import { hashPassword, newToken, passwordProblems, sha256Hex, verifyPassword, verifyTotp } from "./crypto";

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h de inatividade
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias no máximo
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 30;
const RESET_TTL_MS = 60 * 60 * 1000;

export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export type LoginResult =
  | { ok: true; token: string; userId: string; mfaRequired: boolean }
  | { ok: false; reason: "invalid" | "locked" | "disabled" };

/** Mensagem única para credenciais inválidas: não revela se o e-mail existe. */
export async function login(db: Db, email: string, password: string, meta: RequestMeta = {}): Promise<LoginResult> {
  const key = emailKey(email);
  const since = new Date(Date.now() - LOCK_WINDOW_MS);
  const [byEmail] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.emailKey, key), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
  const [byIp] = meta.ip
    ? await db
        .select({ n: count() })
        .from(loginAttempts)
        .where(and(eq(loginAttempts.ip, meta.ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)))
    : [{ n: 0 }];
  if ((byEmail?.n ?? 0) >= MAX_FAILURES_PER_EMAIL || (byIp?.n ?? 0) >= MAX_FAILURES_PER_IP) {
    await db.insert(loginAttempts).values({ emailKey: key, ip: meta.ip ?? null, success: false });
    return { ok: false, reason: "locked" };
  }
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${key}`);
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    await db.insert(loginAttempts).values({ emailKey: key, ip: meta.ip ?? null, success: false });
    return { ok: false, reason: "invalid" };
  }
  if (user.disabledAt) return { ok: false, reason: "disabled" };
  await db.insert(loginAttempts).values({ emailKey: key, ip: meta.ip ?? null, success: true });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  // Seleciona a clínica automaticamente quando há apenas uma.
  const activeMemberships = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.status, "active"), eq(organizations.status, "active")));
  const token = await createSession(db, user.id, meta, activeMemberships.length === 1 ? activeMemberships[0]!.organizationId : null);
  return { ok: true, token, userId: user.id, mfaRequired: user.mfaEnabled };
}

export async function createSession(db: Db, userId: string, meta: RequestMeta, activeOrganizationId: string | null): Promise<string> {
  const token = newToken();
  await db.insert(sessions).values({
    tokenHash: sha256Hex(token),
    userId,
    activeOrganizationId,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_MS),
  });
  return token;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  userName: string;
  email: string;
  activeOrganizationId: string | null;
  mfaPending: boolean;
  isPlatformAdmin: boolean;
}

export async function resolveSession(db: Db, token: string | null | undefined): Promise<SessionInfo | null> {
  if (!token || token.length > 200) return null;
  const now = new Date();
  const [row] = await db
    .select({
      session: sessions,
      userName: users.name,
      email: users.email,
      disabledAt: users.disabledAt,
      mfaEnabled: users.mfaEnabled,
      isPlatformAdmin: users.isPlatformAdmin,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256Hex(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)));
  if (!row || row.disabledAt) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > SESSION_TTL_MS) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > 60_000) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, row.session.id));
  }
  return {
    sessionId: row.session.id,
    userId: row.session.userId,
    userName: row.userName,
    email: row.email,
    activeOrganizationId: row.session.activeOrganizationId,
    mfaPending: row.mfaEnabled && !row.session.mfaVerifiedAt,
    isPlatformAdmin: row.isPlatformAdmin,
  };
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256Hex(token)));
}

export async function verifySessionMfa(db: Db, session: SessionInfo, code: string): Promise<boolean> {
  const [user] = await db.select({ secret: users.mfaSecret }).from(users).where(eq(users.id, session.userId));
  if (!user?.secret) return false;
  if (!verifyTotp(decryptSecret(user.secret), code)) return false;
  await db.update(sessions).set({ mfaVerifiedAt: new Date() }).where(eq(sessions.id, session.sessionId));
  return true;
}

export interface MembershipInfo {
  organizationId: string;
  organizationName: string;
  displayName: string;
  roleKey: string;
  roleName: string;
  isDemo: boolean;
}

export async function listMemberships(db: Db, userId: string): Promise<MembershipInfo[]> {
  return db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      displayName: organizationSettings.displayName,
      roleKey: roles.key,
      roleName: roles.name,
      isDemo: organizations.isDemo,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .innerJoin(organizationSettings, eq(organizationSettings.organizationId, organizations.id))
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")))
    .orderBy(asc(organizationSettings.displayName));
}

/** Seleção explícita da clínica ativa; valida o vínculo no servidor. */
export async function selectOrganization(db: Db, session: SessionInfo, organizationId: string): Promise<void> {
  const list = await listMemberships(db, session.userId);
  if (!list.some((m) => m.organizationId === organizationId)) throw new UnauthenticatedError();
  await db.update(sessions).set({ activeOrganizationId: organizationId }).where(eq(sessions.id, session.sessionId));
}

export interface OrgAccess {
  organizationId: string;
  roleKey: string;
  permissions: Set<Permission>;
  timezone: string;
  displayName: string;
  brandColor: string;
  slotMinutes: number;
  isDemo: boolean;
}

export async function loadOrgAccess(db: Db, userId: string, organizationId: string): Promise<OrgAccess | null> {
  const [row] = await db
    .select({
      roleKey: roles.key,
      permissions: roles.permissions,
      timezone: organizationSettings.timezone,
      displayName: organizationSettings.displayName,
      brandColor: organizationSettings.brandColor,
      slotMinutes: organizationSettings.slotMinutes,
      isDemo: organizations.isDemo,
    })
    .from(memberships)
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.organizationId, memberships.organizationId)))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .innerJoin(organizationSettings, eq(organizationSettings.organizationId, memberships.organizationId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, organizationId),
        eq(memberships.status, "active"),
        eq(organizations.status, "active"),
      ),
    );
  if (!row) return null;
  return {
    organizationId,
    roleKey: row.roleKey,
    permissions: new Set(row.permissions.filter(isPermission)),
    timezone: row.timezone,
    displayName: row.displayName,
    brandColor: row.brandColor,
    slotMinutes: row.slotMinutes,
    isDemo: row.isDemo,
  };
}

// ---------------------------------------------------------------------------
// Recuperação de acesso
// ---------------------------------------------------------------------------

/** Sempre responde igual; só cria token se o usuário existir e estiver ativo. */
export async function requestPasswordReset(db: Db, email: string, meta: RequestMeta = {}): Promise<{ token: string; userName: string } | null> {
  const [user] = await db
    .select({ id: users.id, name: users.name, disabledAt: users.disabledAt })
    .from(users)
    .where(sql`lower(${users.email}) = ${emailKey(email)}`);
  if (!user || user.disabledAt) return null;
  const [recent] = await db
    .select({ n: count() })
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, user.id), gt(passwordResetTokens.createdAt, new Date(Date.now() - RESET_TTL_MS))));
  if ((recent?.n ?? 0) >= 5) return null;
  const token = newToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256Hex(token),
    requestedIp: meta.ip ?? null,
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });
  return { token, userName: user.name };
}

export async function resetPassword(db: Db, token: string, newPassword: string): Promise<void> {
  const problem = passwordProblems(newPassword);
  if (problem) throw new ValidationError(problem, { password: problem });
  const hash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, sha256Hex(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
      .for("update");
    if (!row) throw new BusinessRuleError("Link de redefinição inválido ou expirado. Solicite um novo.");
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await tx.update(users).set({ passwordHash: hash, passwordChangedAt: new Date() }).where(eq(users.id, row.userId));
    // Encerra sessões existentes após troca de senha.
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
  });
}

export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  const [user] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!(await verifyPassword(current, user?.hash))) throw new ValidationError("Senha atual incorreta", { current: "Senha atual incorreta" });
  const problem = passwordProblems(next);
  if (problem) throw new ValidationError(problem, { password: problem });
  await db.update(users).set({ passwordHash: await hashPassword(next), passwordChangedAt: new Date() }).where(eq(users.id, userId));
}

export { DEFAULT_ROLE_PERMISSIONS };
