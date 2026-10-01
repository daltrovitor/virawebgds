// Hello World
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@/lib/product";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[1.618fr_1fr]">
      <main id="conteudo" className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <p className="mb-10 text-sm font-semibold tracking-tight text-fg">{PRODUCT_NAME}</p>
          {children}
        </div>
      </main>
      <aside className="hidden border-l border-border bg-surface lg:flex lg:flex-col lg:justify-end lg:p-12" aria-label="Sobre o sistema">
        <p className="max-w-xs text-sm leading-relaxed text-muted">
          Agenda, ficha do paciente, orçamentos, tratamentos e financeiro da clínica em um só lugar, com acesso por papel e histórico de cada alteração.
        </p>
      </aside>
    </div>
  );
}
