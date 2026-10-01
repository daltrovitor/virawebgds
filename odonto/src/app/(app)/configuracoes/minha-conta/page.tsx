// Hello World
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { AccountSecurity } from "@/components/admin/account-security";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { users } from "@/server/db/schema";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "../tabs";

export const metadata: Metadata = { title: "Minha conta" };

export default async function MyAccountPage() {
  const ctx = await getRequestContext();
  const [user] = await ctx.db.select({ name: users.name, email: users.email, mfaEnabled: users.mfaEnabled }).from(users).where(eq(users.id, ctx.userId));
  return (
    <>
      <PageHeader title="Configurações" description={`${user?.name} · ${user?.email}`} />
      <TabLinks label="Seções de configurações" active="minha-conta" tabs={visibleCfgTabs(ctx.permissions)} />
      <AccountSecurity mfaEnabled={Boolean(user?.mfaEnabled)} recommendMfa={ctx.roleKey === "owner" || ctx.roleKey === "finance"} />
    </>
  );
}
