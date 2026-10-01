// Hello World
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { visibleNav } from "@/components/shell/nav";
import { ROLE_LABEL, type SystemRole } from "@/domain/permissions";
import { PRODUCT_NAME } from "@/lib/product";
import { listMemberships } from "@/server/auth/service";
import { getRequestContext } from "@/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await getRequestContext();
  const memberships = await listMemberships(ctx.db, ctx.userId);
  const role = memberships.find((m) => m.organizationId === ctx.orgId);
  return (
    <AppShell
      productName={PRODUCT_NAME}
      clinicName={ctx.clinicName}
      userName={ctx.userName}
      roleLabel={role?.roleName ?? ROLE_LABEL[ctx.roleKey as SystemRole] ?? ctx.roleKey}
      nav={visibleNav([...ctx.permissions])}
      canSwitch={memberships.length > 1}
      isDemo={ctx.isDemo}
      brandColor={ctx.brandColor}
      canSearchPatients={ctx.permissions.has("patients.view")}
    >
      {children}
    </AppShell>
  );
}
