import { and, count, desc, eq } from "drizzle-orm";
import type { Ctx } from "./context";
import type { DbOrTx } from "./db/client";
import { auditLogs, users } from "./db/schema";
import { ForbiddenError } from "./errors";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  /** Somente metadados e valores administrativos/financeiros; nunca conteúdo clínico. */
  changes?: Record<string, unknown>;
}

/** Chaves cujo conteúdo nunca vai para a auditoria (texto clínico, documentos, segredos). */
const REDACTED_KEYS = new Set([
  "body",
  "planned",
  "performed",
  "answers",
  "description",
  "notes",
  "cpf",
  "password",
  "passwordHash",
  "token",
  "mfaSecret",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACTED_KEYS.has(k) ? "[omitido]" : redact(v, depth + 1);
  }
  return out;
}

export async function audit(db: DbOrTx, ctx: Pick<Ctx, "orgId" | "userId" | "ip">, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: ctx.orgId,
    userId: ctx.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    changes: entry.changes ? (redact(entry.changes) as Record<string, unknown>) : null,
    ip: ctx.ip ?? null,
  });
}

export async function listAuditLogs(ctx: Ctx, opts: { page?: number; pageSize?: number; entityType?: string | null } = {}) {
  if (!ctx.permissions.has("audit.view")) throw new ForbiddenError();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, opts.pageSize ?? 50);
  const where = and(eq(auditLogs.organizationId, ctx.orgId), opts.entityType ? eq(auditLogs.entityType, opts.entityType) : undefined);
  const [total] = await ctx.db.select({ n: count() }).from(auditLogs).where(where);
  const rows = await ctx.db
    .select({ log: auditLogs, userName: users.name })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items: rows, total: total?.n ?? 0, page, pageSize };
}
