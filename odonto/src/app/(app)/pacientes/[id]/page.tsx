// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { TabLinks } from "@/components/ui/page";
import { NewBudgetButton } from "@/components/budgets/new-budget-button";
import { whatsappLink } from "@/domain/appointments";
import { formatPhone, initials } from "@/domain/text";
import { profilePhotoUrl } from "@/server/services/attachments";
import { listProfessionals } from "@/server/services/professionals";
import { getPatient } from "@/server/services/patients";
import { getRequestContext } from "@/server/session";
import { PatientTab, TABS, type TabKey } from "./tabs";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  void params;
  return { title: "Ficha do paciente" };
}

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }> }) {
  const ctx = await getRequestContext();
  const { id } = await params;
  const { aba } = await searchParams;
  const patient = await getPatient(ctx, id);
  const visible = TABS.filter((t) => t.anyOf.length === 0 || t.anyOf.some((p) => ctx.permissions.has(p)));
  const active = (visible.find((t) => t.key === aba)?.key ?? "visao-geral") as TabKey;
  const photo = await profilePhotoUrl(ctx, id);
  const wa = whatsappLink(patient.phone);
  const professionals = ctx.permissions.has("budgets.edit") ? await listProfessionals(ctx) : [];
  const displayName = patient.socialName || patient.fullName;
  return (
    <>
      <Link href="/pacientes" className="mb-3 inline-flex min-h-10 items-center text-sm text-muted hover:text-fg cursor-pointer">
        ← Pacientes
      </Link>
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          {photo ? (
            // Miniatura privada via link temporário assinado.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={`Foto de ${displayName}`} width={64} height={64} className="size-16 shrink-0 rounded-md border border-border object-cover" />
          ) : (
            <span className="flex size-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-lg font-semibold text-muted" aria-hidden="true">
              {initials(displayName)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{displayName}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="tabular">Nº {patient.code}</span>
              {patient.socialName ? <span>{patient.fullName}</span> : null}
              {patient.age !== null ? <span>{patient.age} anos</span> : null}
              {patient.phone ? <span className="tabular">{formatPhone(patient.phone)}</span> : null}
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center text-accent hover:underline cursor-pointer">
                  Abrir WhatsApp
                </a>
              ) : null}
              {patient.status === "archived" ? <Badge>Arquivado</Badge> : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ctx.permissions.has("schedule.edit") ? (
            <ButtonLink href={`/agenda?nova=1&paciente=${patient.id}`} variant="primary">
              Agendar
            </ButtonLink>
          ) : null}
          {ctx.permissions.has("budgets.edit") ? <NewBudgetButton patientId={patient.id} professionals={professionals.map((p) => ({ id: p.id, name: p.name }))} /> : null}
          {ctx.permissions.has("attachments.upload") ? <ButtonLink href={`/pacientes/${patient.id}?aba=arquivos#enviar`}>Adicionar arquivo</ButtonLink> : null}
          {ctx.permissions.has("patients.edit") ? <ButtonLink href={`/pacientes/${patient.id}?aba=cadastro`}>Editar cadastro</ButtonLink> : null}
        </div>
      </header>
      <TabLinks label="Seções da ficha" active={active} tabs={visible.map((t) => ({ key: t.key, label: t.label, href: `/pacientes/${patient.id}?aba=${t.key}` }))} />
      <PatientTab tab={active} patient={patient} ctx={ctx} />
    </>
  );
}
