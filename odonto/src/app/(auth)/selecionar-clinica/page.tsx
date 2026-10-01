// Hello World
import type { Metadata } from "next";
import { Notice } from "@/components/ui/page";
import { listMemberships } from "@/server/auth/service";
import { getDb } from "@/server/db/client";
import { requireSession } from "@/server/session";
import { OrgPicker } from "./org-picker";

export const metadata: Metadata = { title: "Selecionar clínica" };

export default async function SelectOrgPage() {
  const session = await requireSession();
  const list = await listMemberships(getDb(), session.userId);
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Selecionar clínica</h1>
      <p className="mt-1 text-sm text-muted">Escolha em qual clínica você vai trabalhar agora. Cada clínica tem dados e permissões próprios.</p>
      {list.length === 0 ? (
        <Notice tone="warning" className="mt-6">
          Seu usuário não tem acesso ativo a nenhuma clínica. Peça um convite ao administrador.
        </Notice>
      ) : (
        <OrgPicker options={list.map((m) => ({ id: m.organizationId, name: m.displayName, role: m.roleName, isDemo: m.isDemo }))} current={session.activeOrganizationId} />
      )}
    </>
  );
}
