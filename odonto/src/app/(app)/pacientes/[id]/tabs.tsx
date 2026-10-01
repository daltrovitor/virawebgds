// Hello World
import Link from "next/link";
import { AlertsPanel } from "@/components/patients/alerts-panel";
import { AnamnesisPanel } from "@/components/patients/anamnesis-panel";
import { DocumentsPanel } from "@/components/patients/documents-panel";
import { GalleryPanel } from "@/components/patients/gallery-panel";
import { PatientForm } from "@/components/patients/patient-form";
import { PatientTitles } from "@/components/patients/patient-titles";
import { ResponsiblesPanel } from "@/components/patients/responsibles-panel";
import { SchedulingTasksPanel } from "@/components/patients/scheduling-tasks";
import { ClinicalTimeline } from "@/components/patients/clinical-timeline";
import { TreatmentItemsPanel } from "@/components/patients/treatment-items";
import { ArchivePatientButton } from "@/components/patients/archive-button";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { formatDateBR, formatDateTimeBR, minutesToHHMM, todayInTz } from "@/domain/dates";
import { formatBRL } from "@/domain/money";
import type { Permission } from "@/domain/permissions";
import { appointmentBadge, budgetBadge } from "@/lib/status";
import { can } from "@/server/context";
import type { RequestContext } from "@/server/session";
import { listPatientAppointments } from "@/server/services/appointments";
import { listGallery } from "@/server/services/attachments";
import { listBudgets } from "@/server/services/budgets";
import { activeAnamnesisTemplate, clinicalTimeline, listAnamnesis } from "@/server/services/clinical";
import { listDocuments } from "@/server/services/documents";
import { listAccounts } from "@/server/services/finance-setup";
import { listAlerts, listResponsibles, listSchedulingTasks, type PatientView } from "@/server/services/patients";
import { listProfessionals } from "@/server/services/professionals";
import { listSettlementsForTitles, patientFinancialSummary } from "@/server/services/titles";
import { listPatientTreatmentItems, patientTreatmentSummary } from "@/server/services/treatments";

export const TABS: { key: string; label: string; anyOf: Permission[] }[] = [
  { key: "visao-geral", label: "Visão geral", anyOf: [] },
  { key: "cadastro", label: "Cadastro", anyOf: ["patients.view"] },
  { key: "agenda", label: "Agenda", anyOf: ["schedule.view"] },
  { key: "orcamentos", label: "Orçamentos", anyOf: ["budgets.view"] },
  { key: "tratamentos", label: "Tratamentos", anyOf: ["clinical.view", "budgets.view", "schedule.view"] },
  { key: "historico", label: "Histórico clínico", anyOf: ["clinical.view"] },
  { key: "arquivos", label: "Imagens e arquivos", anyOf: ["attachments.view"] },
  { key: "financeiro", label: "Financeiro", anyOf: ["finance.view"] },
  { key: "anamnese", label: "Anamnese", anyOf: ["clinical.view"] },
  { key: "documentos", label: "Documentos", anyOf: ["patients.view"] },
];
export type TabKey = (typeof TABS)[number]["key"];

export async function PatientTab({ tab, patient, ctx }: { tab: TabKey; patient: PatientView; ctx: RequestContext }) {
  switch (tab) {
    case "cadastro":
      return <RegistrationTab patient={patient} ctx={ctx} />;
    case "agenda":
      return <ScheduleTab patient={patient} ctx={ctx} />;
    case "orcamentos":
      return <BudgetsTab patient={patient} ctx={ctx} />;
    case "tratamentos":
      return <TreatmentsTab patient={patient} ctx={ctx} />;
    case "historico":
      return <HistoryTab patient={patient} ctx={ctx} />;
    case "arquivos":
      return <FilesTab patient={patient} ctx={ctx} />;
    case "financeiro":
      return <FinanceTab patient={patient} ctx={ctx} />;
    case "anamnese":
      return <AnamnesisTab patient={patient} ctx={ctx} />;
    case "documentos":
      return <DocumentsTab patient={patient} ctx={ctx} />;
    default:
      return <OverviewTab patient={patient} ctx={ctx} />;
  }
}

type TabProps = { patient: PatientView; ctx: RequestContext };

async function OverviewTab({ patient, ctx }: TabProps) {
  const [alerts, appts, tasks, treatment, finance] = await Promise.all([
    listAlerts(ctx, patient.id),
    can(ctx, "schedule.view") ? listPatientAppointments(ctx, patient.id) : null,
    can(ctx, "schedule.view") ? listSchedulingTasks(ctx, { patientId: patient.id }) : [],
    can(ctx, "clinical.view") || can(ctx, "budgets.view") || can(ctx, "schedule.view") ? patientTreatmentSummary(ctx, patient.id) : null,
    can(ctx, "finance.view") ? patientFinancialSummary(ctx, patient.id) : null,
  ]);
  const next = appts?.future[0];
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <AlertsPanel
        patientId={patient.id}
        alerts={alerts.map((a) => ({ id: a.alert.id, kind: a.alert.kind, priority: a.alert.priority, text: a.alert.text, createdAt: a.alert.createdAt, authorName: a.authorName }))}
        canCreateAdmin={can(ctx, "patients.edit")}
        canCreateClinical={can(ctx, "clinical.edit")}
      />
      {appts ? (
        <Card>
          <CardHeader title="Próxima consulta" actions={<ButtonLink href={`/pacientes/${patient.id}?aba=agenda`} size="sm">Agenda</ButtonLink>} />
          <CardBody>
            {next ? (
              <div className="space-y-1">
                <p className="text-lg font-semibold tabular">
                  {formatDateBR(next.localDate)} · {minutesToHHMM(next.startMinute)}–{minutesToHHMM(next.endMinute)}
                </p>
                <p className="text-sm text-muted">{next.professionalName}</p>
                <Badge tone={appointmentBadge(next.status).tone}>{appointmentBadge(next.status).label}</Badge>
              </div>
            ) : (
              <p className="text-sm text-muted">Nenhuma consulta futura.</p>
            )}
          </CardBody>
        </Card>
      ) : null}
      {appts ? (
        <Card>
          <CardHeader title="Pendências" />
          <CardBody className="space-y-2 text-sm">
            <p>
              <span className="font-medium tabular">{appts.pendingClosure.length}</span> consulta(s) passada(s) sem desfecho registrado
            </p>
            <p>
              <span className="font-medium tabular">{tasks.length}</span> retorno(s)/procedimento(s) aguardando data
            </p>
            <p>
              <span className="font-medium tabular">{appts.missedOrCancelled.filter((a) => a.status === "no_show" || a.status === "no_show_rescheduled").length}</span> falta(s) registrada(s)
            </p>
          </CardBody>
        </Card>
      ) : null}
      {treatment ? (
        <Card>
          <CardHeader title="Tratamento" description="Itens concluídos ÷ itens ativos aprovados (sem ponderar preço)." />
          <CardBody>
            {treatment.overall.percent === null ? (
              <p className="text-sm text-muted">{treatment.overall.label}</p>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular">{treatment.overall.percent}%</p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-sm bg-surface-2" role="progressbar" aria-valuenow={treatment.overall.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Evolução do tratamento">
                  <div className="h-full bg-accent" style={{ width: `${treatment.overall.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">{treatment.overall.label}</p>
              </>
            )}
          </CardBody>
        </Card>
      ) : null}
      {finance ? (
        <Card>
          <CardHeader title="Resumo financeiro" actions={<ButtonLink href={`/pacientes/${patient.id}?aba=financeiro`} size="sm">Detalhes</ButtonLink>} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-subtle">Em aberto</dt>
                <dd className="font-medium tabular">{formatBRL(finance.openCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Vencido</dt>
                <dd className={finance.overdueCents > 0 ? "font-medium tabular text-danger" : "font-medium tabular"}>{formatBRL(finance.overdueCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Recebido</dt>
                <dd className="font-medium tabular text-success">{formatBRL(finance.receivedCents)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Próximo vencimento</dt>
                <dd className="font-medium tabular">{finance.nextDue ? `${formatDateBR(finance.nextDue.dueDate)} · ${formatBRL(finance.nextDue.balanceCents)}` : "—"}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

async function RegistrationTab({ patient, ctx }: TabProps) {
  const [professionals, responsibles] = await Promise.all([listProfessionals(ctx), listResponsibles(ctx, patient.id)]);
  const canEdit = can(ctx, "patients.edit");
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.618fr_1fr]">
      <Card>
        <CardHeader title="Dados cadastrais" actions={canEdit ? <ArchivePatientButton patientId={patient.id} status={patient.status as "active" | "archived"} /> : null} />
        <CardBody>
          {canEdit ? (
            <PatientForm
              canEditCpf={can(ctx, "patients.view_documents")}
              cpfMasked={patient.cpfMasked}
              professionals={professionals.map((p) => ({ id: p.id, name: p.name }))}
              initial={{
                id: patient.id,
                version: patient.version,
                fullName: patient.fullName,
                socialName: patient.socialName ?? "",
                birthDate: patient.birthDate ?? "",
                cpf: patient.cpf ?? "",
                phone: patient.phone ?? "",
                phoneAlt: patient.phoneAlt ?? "",
                email: patient.email ?? "",
                zip: patient.zip ?? "",
                street: patient.street ?? "",
                number: patient.number ?? "",
                complement: patient.complement ?? "",
                district: patient.district ?? "",
                city: patient.city ?? "",
                state: patient.state ?? "",
                origin: patient.origin ?? "",
                referredBy: patient.referredBy ?? "",
                referenceProfessionalId: patient.referenceProfessionalId ?? "",
                adminNotes: patient.adminNotes ?? "",
              }}
            />
          ) : (
            <p className="text-sm text-muted">Somente leitura.</p>
          )}
        </CardBody>
      </Card>
      <ResponsiblesPanel patientId={patient.id} canEdit={canEdit} responsibles={responsibles} />
    </div>
  );
}

async function ScheduleTab({ patient, ctx }: TabProps) {
  const [appts, tasks] = await Promise.all([listPatientAppointments(ctx, patient.id), listSchedulingTasks(ctx, { patientId: patient.id, status: "all" })]);
  const rows = (list: typeof appts.all, empty: string) =>
    list.length === 0 ? (
      <EmptyState title={empty} />
    ) : (
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th>Horário</Th>
              <Th>Profissional</Th>
              <Th>Situação</Th>
              <Th>Motivo / observação</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const b = appointmentBadge(a.status);
              return (
                <Tr key={a.id}>
                  <Td className="tabular">
                    <Link href={`/agenda?data=${a.localDate}&consulta=${a.id}`} className="hover:underline cursor-pointer">
                      {formatDateBR(a.localDate)}
                    </Link>
                  </Td>
                  <Td className="tabular">
                    {minutesToHHMM(a.startMinute)}–{minutesToHHMM(a.endMinute)}
                  </Td>
                  <Td>{a.professionalName}</Td>
                  <Td>
                    <Badge tone={b.tone}>{b.label}</Badge>
                  </Td>
                  <Td className="max-w-xs truncate text-muted">{a.cancelReason ?? (a.isOverbook ? "Encaixe" : "")}</Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableWrap>
    );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Consultas futuras" />
        {rows(appts.future, "Nenhuma consulta futura")}
      </Card>
      <Card>
        <CardHeader title="Consultas passadas sem encerramento" description="O resultado ainda não foi registrado. Nada é presumido como falta ou conclusão." />
        {rows(appts.pendingClosure, "Nenhuma pendência de encerramento")}
      </Card>
      <SchedulingTasksPanel
        patientId={patient.id}
        canEdit={can(ctx, "schedule.edit")}
        tasks={tasks.map((t) => ({ id: t.task.id, reason: t.task.reason, dueDate: t.task.dueDate, status: t.task.status, responsibleName: t.responsibleName, createdAt: t.task.createdAt }))}
      />
      <Card>
        <CardHeader title="Faltas e desmarcações" description="Com motivo, autoria e vínculo com a remarcação." />
        {rows(appts.missedOrCancelled, "Nenhuma falta ou desmarcação")}
      </Card>
      <Card>
        <CardHeader title="Consultas realizadas" />
        {rows(appts.past, "Nenhuma consulta finalizada")}
      </Card>
    </div>
  );
}

async function BudgetsTab({ patient, ctx }: TabProps) {
  const list = await listBudgets(ctx, { patientId: patient.id, pageSize: 100 });
  return (
    <Card>
      <CardHeader title="Orçamentos do paciente" description="Cada orçamento mantém versões, aprovação por item e acordo de pagamento." />
      {list.items.length === 0 ? (
        <EmptyState title="Nenhum orçamento" description="Use “Novo orçamento” no topo da ficha." />
      ) : (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Data</Th>
                <Th>Profissional</Th>
                <Th>Situação</Th>
                <Th align="right">Orçado</Th>
                <Th align="right">Acordo</Th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((b) => {
                const badge = budgetBadge(b.status);
                return (
                  <Tr key={b.id}>
                    <Td className="tabular">
                      <Link href={`/pacientes/${patient.id}/orcamentos/${b.id}`} className="font-medium hover:underline cursor-pointer">
                        {b.number}
                      </Link>
                    </Td>
                    <Td className="tabular">{formatDateBR(b.budgetDate)}</Td>
                    <Td>{b.professionalName ?? "—"}</Td>
                    <Td>
                      <Badge tone={badge.tone}>{badge.label}</Badge> {b.revisionOpen ? <Badge tone="warning">Revisão em andamento</Badge> : null}
                    </Td>
                    <Td align="right">{formatBRL(b.subtotalCents)}</Td>
                    <Td align="right">{b.agreedTotalCents !== null && can(ctx, "finance.view") ? formatBRL(b.agreedTotalCents) : "—"}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </Card>
  );
}

async function TreatmentsTab({ patient, ctx }: TabProps) {
  const [items, summary] = await Promise.all([listPatientTreatmentItems(ctx, { patientId: patient.id, filter: "all" }), patientTreatmentSummary(ctx, patient.id)]);
  return (
    <TreatmentItemsPanel
      patientId={patient.id}
      canProgress={can(ctx, "clinical.edit")}
      canCancel={can(ctx, "treatments.edit")}
      canResolveFinance={can(ctx, "finance.edit")}
      summaryLabel={summary.overall.label}
      items={items.map((i) => ({
        id: i.id,
        procedureName: i.procedureName,
        specialtyName: i.specialtyName,
        locationLabel: i.locationLabel,
        clinicalStatus: i.clinicalStatus,
        budgetNumber: i.budgetNumber,
        budgetId: i.budgetId,
        nextAppointmentAt: i.nextAppointmentAt,
        sessions: i.sessions,
        financialReviewPending: i.financialReviewPending,
        cancelledReason: i.cancelledReason,
      }))}
    />
  );
}

async function HistoryTab({ patient, ctx }: TabProps) {
  const timeline = await clinicalTimeline(ctx, patient.id);
  return <ClinicalTimeline patientId={patient.id} entries={timeline} canEdit={can(ctx, "clinical.edit")} currentUserId={ctx.userId} timezone={ctx.timezone} />;
}

async function FilesTab({ patient, ctx }: TabProps) {
  const [files, items] = await Promise.all([listGallery(ctx, { patientId: patient.id }), listPatientTreatmentItems(ctx, { patientId: patient.id, filter: "all" })]);
  return (
    <GalleryPanel
      patientId={patient.id}
      canUpload={can(ctx, "attachments.upload")}
      canSetPhoto={can(ctx, "patients.edit")}
      treatmentItems={items.map((i) => ({ id: i.id, label: `${i.procedureName} — ${i.locationLabel}` }))}
      files={files.map((f) => ({
        id: f.id,
        kind: f.kind,
        originalName: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        takenOn: f.takenOn,
        createdAt: f.createdAt,
        description: f.description,
        uploaderName: f.uploaderName,
        thumbUrl: f.thumbUrl,
        url: f.url,
        isProfilePhoto: f.isProfilePhoto,
        links: f.links.map((l) => ({ tooth: l.tooth, procedureName: l.procedureName, locationLabel: l.locationLabel, treatmentItemId: l.treatmentItemId })),
      }))}
    />
  );
}

async function FinanceTab({ patient, ctx }: TabProps) {
  const summary = await patientFinancialSummary(ctx, patient.id);
  const [accounts, history] = await Promise.all([
    can(ctx, "finance.settle") ? listAccounts(ctx) : [],
    listSettlementsForTitles(
      ctx,
      summary.titles.map((t) => t.id),
    ),
  ]);
  return (
    <PatientTitles
      titles={summary.titles.map((t) => ({
        id: t.id,
        description: t.description,
        dueDate: t.dueDate,
        originalCents: t.originalCents + t.adjustmentCents,
        balanceCents: t.balanceCents,
        status: t.status,
        overdue: t.overdue,
        expectedMethod: t.expectedMethod,
        budgetId: t.budgetId,
      }))}
      history={history.map((h) => ({
        settlementId: h.settlement.id,
        settledOn: h.settlement.settledOn,
        method: h.settlement.method,
        status: h.settlement.status,
        accountName: h.accountName,
        principalCents: h.allocation.principalCents,
        interestCents: h.allocation.interestCents,
        fineCents: h.allocation.fineCents,
        discountCents: h.allocation.discountCents,
        receivableId: h.allocation.receivableId,
      }))}
      accounts={accounts.filter((a) => a.active).map((a) => ({ id: a.id, name: a.name, kind: a.kind }))}
      canSettle={can(ctx, "finance.settle")}
      canReverse={can(ctx, "finance.reverse")}
      totals={{ openCents: summary.openCents, overdueCents: summary.overdueCents, receivedCents: summary.receivedCents }}
      today={todayInTz(ctx.timezone)}
    />
  );
}

async function AnamnesisTab({ patient, ctx }: TabProps) {
  const [template, history, professionals] = await Promise.all([activeAnamnesisTemplate(ctx), listAnamnesis(ctx, patient.id), listProfessionals(ctx)]);
  const isProfessional = professionals.some((p) => p.userId === ctx.userId);
  return (
    <AnamnesisPanel
      patientId={patient.id}
      patientName={patient.fullName}
      canEdit={can(ctx, "clinical.edit")}
      canReview={can(ctx, "clinical.edit") && isProfessional}
      template={template ? { id: template.id, version: template.version, questions: template.questions } : null}
      history={history.map((h) => ({
        id: h.response.id,
        answeredOn: h.response.answeredOn,
        respondentName: h.response.respondentName,
        respondentRelation: h.response.respondentRelation,
        answers: h.response.answers,
        templateVersion: h.template.version,
        questions: h.template.questions,
        recordedByName: h.recordedByName,
        reviewerName: h.reviewerName,
        reviewedAt: h.response.reviewedAt ? formatDateTimeBR(h.response.reviewedAt, ctx.timezone) : null,
        reviewNote: h.response.reviewNote,
      }))}
    />
  );
}

async function DocumentsTab({ patient, ctx }: TabProps) {
  const docs = await listDocuments(ctx, patient.id);
  return (
    <DocumentsPanel
      docs={docs.filter((d) => d.kind !== "receipt" || can(ctx, "finance.view")).map((d) => ({ id: d.id, kind: d.kind, title: d.title, createdAt: formatDateTimeBR(d.createdAt, ctx.timezone), templateVersion: d.templateVersion }))}
    />
  );
}
