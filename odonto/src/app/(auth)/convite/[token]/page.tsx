// Hello World
import type { Metadata } from "next";
import { Notice } from "@/components/ui/page";
import { getDb } from "@/server/db/client";
import { getInvitation } from "@/server/services/users";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Convite" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitation(getDb(), token);
  if (!invitation) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Convite indisponível</h1>
        <Notice tone="warning" className="mt-6">
          Este convite expirou, foi revogado ou já foi utilizado. Peça um novo convite ao administrador da clínica.
        </Notice>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Aceitar convite</h1>
      <p className="mt-1 text-sm text-muted">
        Acesso para <strong className="font-medium text-fg">{invitation.email}</strong>. Se você já tem cadastro, informe sua senha atual.
      </p>
      <AcceptInviteForm token={token} defaultName={invitation.name} />
    </>
  );
}
