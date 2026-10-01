// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Recuperar acesso" };

export default function RecoverPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar acesso</h1>
      <p className="mt-1 text-sm text-muted">Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link válido por 1 hora.</p>
      <ResetRequestForm />
      <p className="mt-6 text-sm">
        <Link href="/entrar" className="inline-flex min-h-10 items-center text-accent hover:underline cursor-pointer">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
