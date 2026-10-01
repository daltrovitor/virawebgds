"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/server/action-result";
import { useToast } from "./toast";

/**
 * Executa uma Server Action sem perder o formulário: em falha, mantém os
 * valores e expõe mensagem e erros por campo; em sucesso, atualiza a página.
 */
export function useAction<I, O>(action: (input: I) => Promise<ActionResult<O>>, opts: { success?: string | ((data: O) => string); refresh?: boolean } = {}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lastFailure, setLastFailure] = useState<Extract<ActionResult<O>, { ok: false }> | null>(null);

  const run = useCallback(
    (input: I): Promise<ActionResult<O>> =>
      new Promise((resolve) => {
        startTransition(async () => {
          setError(null);
          setFieldErrors({});
          setLastFailure(null);
          let result: ActionResult<O>;
          try {
            result = await action(input);
          } catch {
            result = { ok: false, error: "Falha de conexão. Verifique a internet e tente novamente.", code: "network" };
          }
          if (result.ok) {
            const msg = typeof opts.success === "function" ? opts.success(result.data) : opts.success;
            if (msg) toast.push("success", msg);
            if (opts.refresh !== false) router.refresh();
          } else {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
            setLastFailure(result);
            if (result.code !== "conflict" && result.code !== "validation") toast.push("error", result.error);
          }
          resolve(result);
        });
      }),
    [action, opts, router, toast],
  );

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
    setLastFailure(null);
  }, []);

  return { run, pending, error, fieldErrors, lastFailure, reset };
}
