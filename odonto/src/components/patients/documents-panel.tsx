// Hello World
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/page";

const KIND: Record<string, string> = { contract: "Contrato", receipt: "Recibo", consent: "Termo", other: "Documento" };

export function DocumentsPanel({ docs }: { docs: { id: string; kind: string; title: string; createdAt: string; templateVersion: number | null }[] }) {
  return (
    <Card>
      <CardHeader
        title="Documentos gerados"
        description="Gerados a partir de modelos configuráveis. Assinatura eletrônica é uma integração futura; nenhum documento tem validade jurídica automática."
      />
      {docs.length === 0 ? (
        <EmptyState title="Nenhum documento" description="Contratos são gerados no orçamento aprovado; recibos, a partir de um recebimento." />
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
              <span className="min-w-0">
                <Link href={`/documentos/${d.id}`} className="block truncate text-sm font-medium hover:underline cursor-pointer">
                  {d.title}
                </Link>
                <span className="text-xs text-subtle">
                  {d.createdAt}
                  {d.templateVersion ? ` · modelo v${d.templateVersion}` : ""}
                </span>
              </span>
              <Badge>{KIND[d.kind] ?? d.kind}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
