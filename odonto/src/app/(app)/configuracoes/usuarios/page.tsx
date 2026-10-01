// Hello World
import type { Metadata } from "next";
import { UsersManager } from "@/components/admin/users-manager";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { isPermission } from "@/domain/permissions";
import { listInvitations, listMembers, listRoles } from "@/server/services/users";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Usuários e permissões" };

export default async function UsersPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("users.manage")) return <NoAccess what="o gerenciamento de usuários" />;
  const [members, roles, invitations] = await Promise.all([listMembers(ctx), listRoles(ctx), listInvitations(ctx)]);
  return (
    <>
      <PageHeader title="Configurações" description="Cada usuário tem um papel por clínica. Permissões controlam visualizar, criar, aprovar, dar baixa, estornar, exportar e ver conteúdo clínico." />
      <TabLinks label="Seções de configurações" active="usuarios" tabs={visibleCfgTabs(ctx.permissions)} />
      <UsersManager
        currentUserId={ctx.userId}
        members={members.map((m) => ({ ...m, lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null }))}
        roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name, isSystem: r.isSystem, permissions: r.permissions.filter(isPermission) }))}
        invitations={invitations.map((i) => ({ ...i, expiresAt: i.expiresAt.toISOString() }))}
      />
    </>
  );
}
