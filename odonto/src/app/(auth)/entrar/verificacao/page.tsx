// Hello World
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/session";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function MfaPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/entrar");
  if (!session.mfaPending) redirect("/visao-geral");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Verificação em duas etapas</h1>
      <p className="mt-1 text-sm text-muted">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
      <MfaForm />
    </>
  );
}
