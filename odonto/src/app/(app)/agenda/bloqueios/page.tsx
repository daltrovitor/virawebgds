// Hello World
import type { Metadata } from "next";
import { BlocksManager } from "@/components/agenda/blocks-manager";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page";
import { todayInTz } from "@/domain/dates";
import { listBlocks } from "@/server/services/appointments";
import { listProfessionals } from "@/server/services/professionals";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Bloqueios de agenda" };

export default async function BlocksPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("schedule.edit")) return <NoAccess what="bloqueios de agenda" />;
  const [blocks, professionals] = await Promise.all([listBlocks(ctx), listProfessionals(ctx)]);
  return (
    <>
      <PageHeader title="Bloqueios de agenda" back={{ href: "/agenda", label: "Agenda" }} description="Indisponibilidades únicas ou semanais, da clínica toda ou de um profissional." />
      <BlocksManager
        today={todayInTz(ctx.timezone)}
        professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
        blocks={blocks.map((b) => ({ ...b.block, professionalName: b.professionalName }))}
      />
    </>
  );
}
