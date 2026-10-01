// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/page";
import { getCurrentSession } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; redefinida?: string }> }) {
  const params = await searchParams;
  const session = await getCurrentSession();
  if (session && !session.mfaPending) redirect(session.activeOrganizationId ? "/visao-geral" : "/selecionar-clinica");
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted">Use o e-mail e a senha cadastrados pela clínica.</p>
      {params.redefinida ? (
        <Notice tone="success" className="mt-6">
          Senha redefinida. Entre com a nova senha.
        </Notice>
      ) : null}
      <LoginForm next={params.next} />
      <p className="mt-6 text-sm">
        <Link href="/recuperar-acesso" className="inline-flex min-h-10 items-center text-accent hover:underline cursor-pointer">
          Esqueci minha senha
        </Link>
      </p>
    </>
  );
}
