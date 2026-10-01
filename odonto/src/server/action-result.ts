import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "./errors";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string>; details?: unknown };

/**
 * Executa uma Server Action convertendo erros de domínio em resposta segura.
 * Erros inesperados são registrados sem dados de pacientes e respondidos de forma genérica.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    // Redirecionamentos e notFound() do Next seguem seu fluxo normal.
    unstable_rethrow(err);
    if (err instanceof AppError) {
      const details =
        "conflicts" in err
          ? { conflicts: (err as AppError & { conflicts: unknown }).conflicts, overbookAllowed: (err as AppError & { overbookAllowed?: boolean }).overbookAllowed }
          : "duplicates" in err
            ? { duplicates: (err as AppError & { duplicates: unknown }).duplicates }
            : undefined;
      return { ok: false, error: err.message, code: err.code, fieldErrors: err.fieldErrors, details };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[action] erro inesperado:", message.slice(0, 300));
    return { ok: false, error: "Não foi possível concluir a operação. Tente novamente; se persistir, contate o suporte.", code: "unexpected" };
  }
}
