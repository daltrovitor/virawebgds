import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "./db/client";
import { idempotencyKeys, orgCounters } from "./db/schema";

/**
 * Executa `fn` uma única vez por (clínica, escopo, chave) dentro da transação.
 * Uma requisição repetida (duplo clique, retentativa de rede) espera a primeira
 * terminar — o índice único serializa — e recebe o mesmo resultado.
 */
export async function withIdempotency<T>(
  tx: Tx,
  orgId: string,
  scope: string,
  key: string | null | undefined,
  fn: () => Promise<T>,
): Promise<{ result: T; replayed: boolean }> {
  if (!key) return { result: await fn(), replayed: false };
  const inserted = await tx
    .insert(idempotencyKeys)
    .values({ organizationId: orgId, scope, key, result: null })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });
  if (inserted.length === 0) {
    const [row] = await tx
      .select({ result: idempotencyKeys.result })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.organizationId, orgId), eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
    return { result: row?.result as T, replayed: true };
  }
  const result = await fn();
  await tx
    .update(idempotencyKeys)
    .set({ result: (result ?? null) as unknown })
    .where(and(eq(idempotencyKeys.organizationId, orgId), eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
  return { result, replayed: false };
}

/** Numeração sequencial por clínica (orçamentos, pacientes), atômica. */
export async function nextCounter(tx: Tx, orgId: string, name: string): Promise<number> {
  const [row] = await tx
    .insert(orgCounters)
    .values({ organizationId: orgId, name, value: 1 })
    .onConflictDoUpdate({
      target: [orgCounters.organizationId, orgCounters.name],
      set: { value: sql`${orgCounters.value} + 1` },
    })
    .returning({ value: orgCounters.value });
  return Number(row!.value);
}
