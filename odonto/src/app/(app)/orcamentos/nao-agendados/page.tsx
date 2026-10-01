// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { CLINICAL_LABEL, CLINICAL_TONE } from "@/lib/status";
import { listUnscheduledItems } from "@/server/services/treatments";
import { getRequestContext } from "@/server/session";
import { ORC_TABS } from "../tabs";

export const metadata: Metadata = { title: "Procedimentos não agendados" };

export default async function UnscheduledPage() {
  const ctx = await getRequestContext();
  const rows = await listUnscheduledItems(ctx);
  return (
    <>
      <PageHeader title="Orçamentos e tratamentos" description="Procedimentos aprovados, ainda não concluídos, sem consulta futura marcada." />
      <TabLinks label="Seções" active="nao-agendados" tabs={ORC_TABS} />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Tudo agendado" description="Nenhum procedimento aprovado aguardando agendamento." />
        ) : (
          <TableWrap label="Procedimentos não agendados">
            <Table>
              <thead>
                <tr>
                  <Th>Paciente</Th>
                  <Th>Procedimento</Th>
                  <Th>Região</Th>
                  <Th>Orçamento</Th>
                  <Th>Situação</Th>
                  <Th align="right">Ação</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Tr key={r.item.id}>
                    <Td>
                      <Link href={`/pacientes/${r.item.patientId}?aba=tratamentos`} className="font-medium hover:underline cursor-pointer">
                        {r.patientName}
                      </Link>
                    </Td>
                    <Td>
                      {r.item.procedureName}
                      <span className="block text-xs text-subtle">{r.item.specialtyName}</span>
                    </Td>
                    <Td>{r.item.locationLabel}</Td>
                    <Td className="tabular">nº {r.budgetNumber}</Td>
                    <Td>
                      <Badge tone={CLINICAL_TONE[r.item.clinicalStatus] ?? "neutral"}>{CLINICAL_LABEL[r.item.clinicalStatus]}</Badge>
                    </Td>
                    <Td align="right">
                      {ctx.permissions.has("schedule.edit") ? (
                        <ButtonLink size="sm" href={`/agenda?nova=1&paciente=${r.item.patientId}&item=${r.item.id}`}>
                          Agendar
                        </ButtonLink>
                      ) : null}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
