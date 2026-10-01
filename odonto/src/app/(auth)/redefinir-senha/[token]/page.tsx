// Hello World
import type { Metadata } from "next";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted">Use ao menos 10 caracteres. As sessões abertas serão encerradas.</p>
      <NewPasswordForm token={token} />
    </>
  );
}
