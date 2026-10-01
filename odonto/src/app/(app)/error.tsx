// Hello World
"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/page";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = /permissão/i.test(error.message);
  const notFound = /não encontrad/i.test(error.message);
  return (
    <div className="rounded-lg border border-border bg-white">
      <EmptyState
        title={forbidden ? "Acesso não permitido" : notFound ? "Registro não encontrado" : "Não foi possível carregar esta página"}
        description={
          forbidden
            ? "Seu papel nesta clínica não inclui esta ação."
            : notFound
              ? "Ele pode ter sido removido ou pertencer a outra clínica."
              : "Tente novamente. Se o problema continuar, informe o código abaixo ao suporte."
        }
        action={
          <div className="flex flex-col items-center gap-2">
            {!forbidden && !notFound ? <Button onClick={reset}>Tentar novamente</Button> : null}
            {error.digest ? <p className="text-xs text-subtle">Código: {error.digest}</p> : null}
          </div>
        }
      />
    </div>
  );
}
