import { and, asc, count, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { isPermission, PERMISSIONS, type Permission } from "@/domain/permissions";
import { audit } from "../audit";
import { hashPassword, newToken, passwordProblems, sha256Hex, verifyPassword } from "../auth/crypto";
import { emailKey } from "../auth/service";
import { assertCan, type Ctx } from "../context";
import type { Db } from "../db/client";
import { invitations, memberships, passwordResetTokens, roles, users } from "../db/schema";
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { parseInput, zId, zRequiredText } from "../validation";

const emailSchema = z.email({ message: "E-mail inválido" }).transform((v) => v.trim().toLowerCase());

export async function createUser(db: Db, input: { email: string; name: string; password: string }): Promise<{ id: string }> {
  const email = parseInput(emailSchema, input.email);
  const problem = passwordProblems(input.password);
  if (problem) throw new ValidationError(problem, { password: problem });
  const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
  if (existing) throw new ConflictError("Já existe um usuário com este e-mail");
  const [row] = await db
    .insert(users)
    .values({ email, name: input.name.trim(), passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() })
    .returning({ id: users.id });
  return { id: row!.id };
}

export async function listMembers(ctx: Ctx) {
  assertCan(ctx, "users.manage");
  return ctx.db
    .select({
      membershipId: memberships.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      status: memberships.status,
      roleId: roles.id,
      roleName: roles.name,
      roleKey: roles.key,
      lastLoginAt: users.lastLoginAt,
      mfaEnabled: users.mfaEnabled,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.organizationId, memberships.organizationId)))
    .where(eq(memberships.organizationId, ctx.orgId))
    .orderBy(asc(users.name));
}

export async function listRoles(ctx: Ctx) {
  return ctx.db.select().from(roles).where(eq(roles.organizationId, ctx.orgId)).orderBy(asc(roles.isSystem), asc(roles.name));
}

async function getRole(ctx: Ctx, roleId: string) {
  const [role] = await ctx.db.select().from(roles).where(and(eq(roles.organizationId, ctx.orgId), eq(roles.id, roleId)));
  if (!role) throw new NotFoundError("Papel");
  return role;
}

const rolePermsSchema = z.object({
  roleId: zId,
  permissions: z.array(z.string()).transform((list) => [...new Set(list.filter(isPermission))] as Permission[]),
});

export async function updateRolePermissions(ctx: Ctx, input: z.input<typeof rolePermsSchema>) {
  assertCan(ctx, "users.manage");
  const data = parseInput(rolePermsSchema, input);
  const role = await getRole(ctx, data.roleId);
  if (role.key === "owner") throw new BusinessRuleError("O papel de administrador mantém todas as permissões");
  await ctx.db.transaction(async (tx) => {
    await tx.update(roles).set({ permissions: data.permissions, updatedAt: new Date() }).where(and(eq(roles.id, role.id), eq(roles.organizationId, ctx.orgId)));
    await audit(tx, ctx, {
      action: "role.permissions",
      entityType: "role",
      entityId: role.id,
      summary: `Permissões do papel "${role.name}" alteradas`,
      changes: { before: role.permissions, after: data.permissions },
    });
  });
}

const createRoleSchema = z.object({ name: zRequiredText("Nome do papel", 80), basedOnRoleId: zId.nullish() });

export async function createRole(ctx: Ctx, input: z.input<typeof createRoleSchema>) {
  assertCan(ctx, "users.manage");
  const data = parseInput(createRoleSchema, input);
  const base = data.basedOnRoleId ? await getRole(ctx, data.basedOnRoleId) : null;
  const key = `custom-${newToken(6).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const [row] = await ctx.db
    .insert(roles)
    .values({ organizationId: ctx.orgId, key, name: data.name, isSystem: false, permissions: base?.permissions ?? [] })
    .returning({ id: roles.id });
  await audit(ctx.db, ctx, { action: "role.create", entityType: "role", entityId: row!.id, summary: `Papel criado: ${data.name}` });
  return { id: row!.id };
}

async function countActiveOwners(ctx: Ctx): Promise<number> {
  const [row] = await ctx.db
    .select({ n: count() })
    .from(memberships)
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.organizationId, ctx.orgId), eq(memberships.status, "active"), eq(roles.key, "owner")));
  return row?.n ?? 0;
}

const memberUpdateSchema = z.object({ membershipId: zId, roleId: zId, status: z.enum(["active", "suspended"]) });

export async function updateMember(ctx: Ctx, input: z.input<typeof memberUpdateSchema>) {
  assertCan(ctx, "users.manage");
  const data = parseInput(memberUpdateSchema, input);
  const [m] = await ctx.db
    .select({ membership: memberships, roleKey: roles.key })
    .from(memberships)
    .innerJoin(roles, and(eq(roles.id, memberships.roleId), eq(roles.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.organizationId, ctx.orgId), eq(memberships.id, data.membershipId)));
  if (!m) throw new NotFoundError("Usuário");
  const newRole = await getRole(ctx, data.roleId);
  const losesOwner = m.roleKey === "owner" && m.membership.status === "active" && (newRole.key !== "owner" || data.status !== "active");
  if (losesOwner && (await countActiveOwners(ctx)) <= 1) {
    throw new BusinessRuleError("A clínica precisa de ao menos um administrador ativo");
  }
  await ctx.db.transaction(async (tx) => {
    await tx
      .update(memberships)
      .set({ roleId: newRole.id, status: data.status, updatedAt: new Date() })
      .where(and(eq(memberships.organizationId, ctx.orgId), eq(memberships.id, m.membership.id)));
    await audit(tx, ctx, {
      action: "membership.update",
      entityType: "membership",
      entityId: m.membership.id,
      summary: `Acesso alterado para papel "${newRole.name}" (${data.status === "active" ? "ativo" : "suspenso"})`,
      changes: { roleBefore: m.roleKey, roleAfter: newRole.key, status: data.status },
    });
  });
}

const inviteSchema = z.object({ email: emailSchema, name: zRequiredText("Nome", 120), roleId: zId });

/** Convite com link de uso único (7 dias). O envio por e-mail depende da integração configurada. */
export async function inviteMember(ctx: Ctx, input: z.input<typeof inviteSchema>): Promise<{ token: string }> {
  assertCan(ctx, "users.manage");
  const data = parseInput(inviteSchema, input);
  const role = await getRole(ctx, data.roleId);
  const [existing] = await ctx.db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, ctx.orgId), sql`lower(${users.email}) = ${data.email}`));
  if (existing) throw new ConflictError("Este e-mail já tem acesso à clínica");
  const token = newToken();
  await ctx.db.insert(invitations).values({
    organizationId: ctx.orgId,
    email: data.email,
    name: data.name,
    roleId: role.id,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    createdBy: ctx.userId,
  });
  await audit(ctx.db, ctx, { action: "invitation.create", entityType: "invitation", summary: `Convite enviado para papel "${role.name}"` });
  return { token };
}

export async function listInvitations(ctx: Ctx) {
  assertCan(ctx, "users.manage");
  return ctx.db
    .select({ id: invitations.id, email: invitations.email, name: invitations.name, expiresAt: invitations.expiresAt, roleName: roles.name })
    .from(invitations)
    .innerJoin(roles, and(eq(roles.id, invitations.roleId), eq(roles.organizationId, invitations.organizationId)))
    .where(and(eq(invitations.organizationId, ctx.orgId), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())));
}

export async function revokeInvitation(ctx: Ctx, invitationId: string) {
  assertCan(ctx, "users.manage");
  await ctx.db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.organizationId, ctx.orgId), eq(invitations.id, invitationId)));
}

export async function getInvitation(db: Db, token: string) {
  const [row] = await db
    .select({ invitation: invitations })
    .from(invitations)
    .where(and(eq(invitations.tokenHash, sha256Hex(token)), isNull(invitations.acceptedAt), isNull(invitations.revokedAt), gt(invitations.expiresAt, new Date())));
  return row?.invitation ?? null;
}

/** Aceite: cria o usuário (ou confirma a senha do existente) e o vínculo com a clínica. */
export async function acceptInvitation(db: Db, token: string, input: { name: string; password: string }): Promise<{ userId: string; organizationId: string }> {
  const inv = await getInvitation(db, token);
  if (!inv) throw new BusinessRuleError("Convite inválido, expirado ou já utilizado");
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(users).where(sql`lower(${users.email}) = ${emailKey(inv.email)}`);
    let userId: string;
    if (existing) {
      if (!(await verifyPassword(input.password, existing.passwordHash))) {
        throw new ValidationError("Este e-mail já tem cadastro: informe a senha atual para aceitar o convite", { password: "Senha incorreta" });
      }
      userId = existing.id;
    } else {
      const problem = passwordProblems(input.password);
      if (problem) throw new ValidationError(problem, { password: problem });
      const [created] = await tx
        .insert(users)
        .values({ email: inv.email, name: input.name.trim() || inv.name, passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() })
        .returning({ id: users.id });
      userId = created!.id;
    }
    await tx
      .insert(memberships)
      .values({ organizationId: inv.organizationId, userId, roleId: inv.roleId, createdBy: inv.createdBy })
      .onConflictDoNothing();
    await tx.update(invitations).set({ acceptedAt: new Date(), acceptedUserId: userId }).where(eq(invitations.id, inv.id));
    await audit(tx, { orgId: inv.organizationId, userId }, { action: "invitation.accept", entityType: "membership", summary: "Convite aceito" });
    return { userId, organizationId: inv.organizationId };
  });
}

/** Link de redefinição gerado pelo administrador quando não há e-mail configurado. */
export async function adminResetLink(ctx: Ctx, membershipId: string): Promise<{ token: string }> {
  assertCan(ctx, "users.manage");
  const [m] = await ctx.db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.organizationId, ctx.orgId), eq(memberships.id, membershipId), ne(memberships.userId, ctx.userId)));
  if (!m) throw new NotFoundError("Usuário");
  const token = newToken();
  await ctx.db.insert(passwordResetTokens).values({
    userId: m.userId,
    tokenHash: sha256Hex(token),
    requestedIp: ctx.ip ?? null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await audit(ctx.db, ctx, { action: "user.reset_link", entityType: "membership", entityId: membershipId, summary: "Link de redefinição de senha gerado pelo administrador" });
  return { token };
}

export const ALL_PERMISSIONS = PERMISSIONS;
