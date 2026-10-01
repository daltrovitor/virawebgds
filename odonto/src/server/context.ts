import type { Permission } from "@/domain/permissions";
import type { Db } from "./db/client";
import { ForbiddenError } from "./errors";

/**
 * Contexto autenticado de uma operação. O tenant vem da sessão validada no
 * servidor, nunca de parâmetros enviados pelo navegador.
 */
export interface Ctx {
  db: Db;
  orgId: string;
  userId: string;
  userName: string;
  roleKey: string;
  permissions: ReadonlySet<Permission>;
  timezone: string;
  ip?: string | null;
}

export function can(ctx: Pick<Ctx, "permissions">, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function assertCan(ctx: Pick<Ctx, "permissions">, ...required: Permission[]): void {
  for (const p of required) {
    if (!ctx.permissions.has(p)) throw new ForbiddenError();
  }
}

export function assertCanAny(ctx: Pick<Ctx, "permissions">, ...options: Permission[]): void {
  if (!options.some((p) => ctx.permissions.has(p))) throw new ForbiddenError();
}
