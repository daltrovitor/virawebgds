// Hello World
import type { Metadata } from "next";
import { AgendaView } from "@/components/agenda/agenda-view";
import type { FormInitial } from "@/components/agenda/appointment-form";
import { ButtonLink } from "@/components/ui/button";
import { NoAccess } from "@/components/ui/no-access";
import { PageHeader } from "@/components/ui/page";
import { addDays, isValidCivil, startOfWeekMonday, todayInTz } from "@/domain/dates";
import { getAgenda } from "@/server/services/appointments";
import { assertPatientInOrg } from "@/server/services/patients";
import { listProfessionals } from "@/server/services/professionals";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; modo?: string; profissional?: string; nova?: string; paciente?: string; item?: string; pendencia?: string; consulta?: string }>;
}) {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("schedule.view")) return <NoAccess what="a agenda" />;
  const sp = await searchParams;
  const today = todayInTz(ctx.timezone);
  const date = sp.data && isValidCivil(sp.data) ? sp.data : today;
  const mode = sp.modo === "dia" ? "dia" : "semana";
  const professionals = (await listProfessionals(ctx)).map((p) => ({ id: p.id, name: p.name, color: p.color }));
  const professionalFilter = sp.profissional && professionals.some((p) => p.id === sp.profissional) ? sp.profissional : "all";
  const from = mode === "dia" ? date : startOfWeekMonday(date);
  const to = mode === "dia" ? date : addDays(from, 6);
  const data = await getAgenda(ctx, { from, to, professionalId: professionalFilter === "all" ? null : professionalFilter });

  let openCreate: FormInitial | null = null;
  if (sp.nova && ctx.permissions.has("schedule.edit")) {
    const patient = sp.paciente ? await assertPatientInOrg(ctx, sp.paciente).catch(() => null) : null;
    openCreate = {
      mode: "create",
      patient: patient ? { id: patient.id, name: patient.fullName, phone: patient.phone } : null,
      professionalId: professionalFilter !== "all" ? professionalFilter : (professionals[0]?.id ?? ""),
      date,
      startMinute: 9 * 60,
      endMinute: 9 * 60 + 30,
      treatmentItemIds: sp.item ? [sp.item] : [],
      schedulingTaskId: sp.pendencia ?? null,
    };
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Consultas, bloqueios e encaixes. Conflitos são verificados no servidor ao salvar."
        actions={
          <>
            <ButtonLink href="/agenda/pendencias">Pendências</ButtonLink>
            {ctx.permissions.has("schedule.edit") ? <ButtonLink href="/agenda/bloqueios">Bloqueios</ButtonLink> : null}
          </>
        }
      />
      <AgendaView
        data={data}
        mode={mode}
        date={date}
        today={today}
        professionalFilter={professionalFilter}
        professionals={professionals}
        canEdit={ctx.permissions.has("schedule.edit")}
        canOverbook={ctx.permissions.has("schedule.overbook")}
        canClinical={ctx.permissions.has("clinical.edit")}
        canCreatePatient={ctx.permissions.has("patients.edit")}
        timezone={ctx.timezone}
        openCreate={openCreate}
        openAppointmentId={sp.consulta ?? null}
      />
    </>
  );
}
