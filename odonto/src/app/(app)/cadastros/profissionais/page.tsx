// Hello World
import type { Metadata } from "next";
import { ProfessionalsManager } from "@/components/admin/professionals-manager";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader, TabLinks } from "@/components/ui/page";
import { listSpecialties } from "@/server/services/catalog";
import { listProfessionals } from "@/server/services/professionals";
import { listMembers } from "@/server/services/users";
import { getRequestContext } from "@/server/session";
import { CAD_TABS } from "../tabs";

export const metadata: Metadata = { title: "Profissionais" };

export default async function ProfessionalsPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("settings.manage")) return <NoAccess what="o cadastro de profissionais" />;
  const [professionals, specialties, members] = await Promise.all([
    listProfessionals(ctx, { includeInactive: true }),
    listSpecialties(ctx),
    ctx.permissions.has("users.manage") ? listMembers(ctx) : [],
  ]);
  return (
    <>
      <PageHeader title="Cadastros" description="Profissional (agenda e registros clínicos) é diferente de usuário (login). Vincule quando o profissional também acessar o sistema." />
      <TabLinks label="Seções de cadastros" active="profissionais" tabs={CAD_TABS} />
      <ProfessionalsManager
        professionals={professionals.map((p) => ({
          id: p.id,
          name: p.name,
          council: p.council,
          councilNumber: p.councilNumber,
          councilState: p.councilState,
          color: p.color,
          active: p.active,
          userId: p.userId,
          specialtyIds: p.specialties.map((s) => s.id),
          specialtyNames: p.specialties.map((s) => s.name),
          availability: p.availability,
        }))}
        specialties={specialties.map((s) => ({ id: s.id, name: s.name }))}
        users={members.map((m) => ({ id: m.userId, name: `${m.name} (${m.email})` }))}
      />
    </>
  );
}
