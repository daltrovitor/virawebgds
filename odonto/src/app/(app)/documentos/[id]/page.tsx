// Hello World
import type { Metadata } from "next";
import { PrintButton } from "@/components/ui/print-button";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { formatDateTimeBR } from "@/domain/dates";
import { getDocument } from "@/server/services/documents";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Documento" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  const { id } = await params;
  const doc = await getDocument(ctx, id);
  return (
    <>
      <div className="no-print">
        <PageHeader
          title={doc.title}
          description={`Gerado em ${formatDateTimeBR(doc.createdAt, ctx.timezone)}${doc.templateVersion ? ` a partir do modelo versão ${doc.templateVersion}` : ""}. Revise antes de usar.`}
          back={{ href: `/pacientes/${doc.patientId}?aba=documentos`, label: "Documentos do paciente" }}
          actions={
            <>
              <PrintButton />
              <ButtonLink href={`/api/documentos/${doc.id}/pdf`} variant="primary" prefetch={false}>
                Baixar PDF
              </ButtonLink>
            </>
          }
        />
      </div>
      <Card className="mx-auto max-w-3xl">
        <CardBody>
          <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{doc.body}</pre>
        </CardBody>
      </Card>
    </>
  );
}
