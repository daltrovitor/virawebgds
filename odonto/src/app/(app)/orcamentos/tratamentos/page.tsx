// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, TabLinks } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { budgets, patients, treatmentItems, treatments } from "@/server/db/schema";
import { assertCanAny } from "@/server/context";
import { progressOf } from "@/server/services/treatments";
import { getRequestContext } from "@/server/session";
import { ORC_TABS } from "../tabs";

export const metadata: Metadata = { title: "Tratamentos em andamento" };

export default async function TreatmentsPage() {
  const ctx = await getRequestContext();
  assertCanAny(ctx, "budgets.view", "clinical.view", "schedule.view");
  const rows = await ctx.db
    .select({ treatment: treatments, patientName: patients.fullName, budgetNumber: budgets.number })
    .from(treatments)
    .innerJoin(patients, eq(patients.id, treatments.patientId))
    .innerJoin(budgets, eq(budgets.id, treatments.budgetId))
    .where(and(eq(treatments.organizationId, ctx.orgId), eq(treatments.status, "active")))
    .orderBy(asc(patients.fullName));
  const items = rows.length
    ? await ctx.db
        .select({ treatmentId: treatmentItems.treatmentId, clinicalStatus: treatmentItems.clinicalStatus })
        .from(treatmentItems)
        .where(and(eq(treatmentItems.organizationId, ctx.orgId), inArray(treatmentItems.treatmentId, rows.map((r) => r.treatment.id))))
    : [];
  const list = rows
    .map((r) => ({ ...r, progress: progressOf(items.filter((i) => i.treatmentId === r.treatment.id)) }))
    .filter((r) => r.progress.active > 0 && r.progress.completed < r.progress.active);
  return (
    <>
      <PageHeader title="Orçamentos e tratamentos" description="Evolução = itens concluídos ÷ itens ativos aprovados. Critério operacional, não avaliação clínica." />
      <TabLinks label="Seções" active="tratamentos" tabs={ORC_TABS} />
      <Card>
        {list.length === 0 ? (
          <EmptyState title="Nenhum tratamento em andamento" />
        ) : (
          <TableWrap label="Tratamentos em andamento">
            <Table>
              <thead>
                <tr>
                  <Th>Paciente</Th>
                  <Th>Orçamento</Th>
                  <Th>Evolução</Th>
                  <Th align="right">Concluídos</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <Tr key={r.treatment.id}>
                    <Td>
                      <Link href={`/pacientes/${r.treatment.patientId}?aba=tratamentos`} className="font-medium hover:underline cursor-pointer">
                        {r.patientName}
                      </Link>
                    </Td>
                    <Td className="tabular">nº {r.budgetNumber}</Td>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-40 overflow-hidden rounded-sm bg-surface-2" role="progressbar" aria-valuenow={r.progress.percent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Evolução de ${r.patientName}`}>
                          <div className="h-full bg-accent" style={{ width: `${r.progress.percent ?? 0}%` }} />
                        </div>
                        <span className="text-sm tabular">{r.progress.percent ?? 0}%</span>
                      </div>
                    </Td>
                    <Td align="right">
                      {r.progress.completed}/{r.progress.active}
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
