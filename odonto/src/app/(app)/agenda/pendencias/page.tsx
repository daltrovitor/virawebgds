// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { NoAccess } from "@/components/ui/no-access";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDateBR, minutesToHHMM } from "@/domain/dates";
import { appointmentBadge } from "@/lib/status";
import { listPendingClosure } from "@/server/services/appointments";
import { listSchedulingTasks } from "@/server/services/patients";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Pendências da agenda" };

export default async function PendingPage() {
  const ctx = await getRequestContext();
  if (!ctx.permissions.has("schedule.view")) return <NoAccess what="a agenda" />;
  const [closures, tasks] = await Promise.all([listPendingClosure(ctx), listSchedulingTasks(ctx)]);
  return (
    <>
      <PageHeader title="Pendências da agenda" back={{ href: "/agenda", label: "Agenda" }} description="Nada é presumido: consultas passadas ficam pendentes até o desfecho ser registrado." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Consultas passadas sem encerramento" description={`${closures.length} consulta(s)`} />
          {closures.length === 0 ? (
            <EmptyState title="Nenhuma pendência de encerramento" />
          ) : (
            <TableWrap label="Consultas sem encerramento">
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Horário</Th>
                    <Th>Paciente</Th>
                    <Th>Profissional</Th>
                    <Th>Situação atual</Th>
                    <Th align="right">Ação</Th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map((c) => {
                    const b = appointmentBadge(c.appointment.status as Parameters<typeof appointmentBadge>[0]);
                    return (
                      <Tr key={c.appointment.id}>
                        <Td className="tabular">{formatDateBR(c.appointment.localDate)}</Td>
                        <Td className="tabular">
                          {minutesToHHMM(c.appointment.startMinute)}–{minutesToHHMM(c.appointment.endMinute)}
                        </Td>
                        <Td>
                          <Link href={`/pacientes/${c.appointment.patientId}`} className="font-medium hover:underline cursor-pointer">
                            {c.patientName}
                          </Link>
                        </Td>
                        <Td>{c.professionalName}</Td>
                        <Td>
                          <Badge tone={b.tone}>{b.label}</Badge>
                        </Td>
                        <Td align="right">
                          <ButtonLink size="sm" href={`/agenda?data=${c.appointment.localDate}&modo=dia&consulta=${c.appointment.id}`}>
                            Registrar desfecho
                          </ButtonLink>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
        <Card>
          <CardHeader title="Retornos e procedimentos aguardando data" description={`${tasks.length} pendência(s)`} />
          {tasks.length === 0 ? (
            <EmptyState title="Nenhuma pendência de agendamento" />
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.task.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <span className="text-sm">
                    <Link href={`/pacientes/${t.task.patientId}?aba=agenda`} className="font-medium hover:underline cursor-pointer">
                      {t.patientName}
                    </Link>{" "}
                    — {t.task.reason}
                    <span className="block text-xs text-muted">Prazo sugerido: {t.task.dueDate ? formatDateBR(t.task.dueDate) : "sem prazo"}</span>
                  </span>
                  {ctx.permissions.has("schedule.edit") ? (
                    <ButtonLink size="sm" href={`/agenda?nova=1&paciente=${t.task.patientId}&pendencia=${t.task.id}${t.task.treatmentItemId ? `&item=${t.task.treatmentItemId}` : ""}`}>
                      Agendar
                    </ButtonLink>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
