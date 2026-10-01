// Hello World
import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { EMPTY_PATIENT, PatientForm } from "@/components/patients/patient-form";
import { assertCan } from "@/server/context";
import { listProfessionals } from "@/server/services/professionals";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Novo paciente" };

export default async function NewPatientPage() {
  const ctx = await getRequestContext();
  assertCan(ctx, "patients.edit");
  const professionals = await listProfessionals(ctx);
  return (
    <>
      <PageHeader title="Novo paciente" description="Somente o nome é obrigatório. Possíveis duplicidades são verificadas antes de salvar." back={{ href: "/pacientes", label: "Pacientes" }} />
      <Card>
        <CardBody>
          <PatientForm initial={EMPTY_PATIENT} professionals={professionals.map((p) => ({ id: p.id, name: p.name }))} canEditCpf={ctx.permissions.has("patients.view_documents")} />
        </CardBody>
      </Card>
    </>
  );
}
