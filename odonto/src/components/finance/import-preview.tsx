// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmOfxAction, discardOfxAction } from "@/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { useAction } from "@/components/ui/use-action";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";

interface Line {
  index: number;
  externalId: string | null;
  postedOn: string;
  amountCents: number;
  description: string;
  classification: "new" | "duplicate_external_id" | "probable_duplicate" | "identical_in_file";
  note: string | null;
}

const CLASS: Record<Line["classification"], { label: string; tone: "success" | "neutral" | "warning" }> = {
  new: { label: "Nova", tone: "success" },
  identical_in_file: { label: "Nova — idêntica a outra no arquivo", tone: "warning" },
  duplicate_external_id: { label: "Já importada", tone: "neutral" },
  probable_duplicate: { label: "Provável duplicata (sem ID do banco)", tone: "warning" },
};

export function ImportPreview({ batchId, accountId, status, lines, errors, warnings }: { batchId: string; accountId: string; status: string; lines: Line[]; errors: string[]; warnings: string[] }) {
  const router = useRouter();
  const [force, setForce] = useState<number[]>([]);
  const [ack, setAck] = useState(false);
  const confirm = useAction(confirmOfxAction, { success: (d) => (d.alreadyConfirmed ? "Importação já confirmada" : `${d.inserted} movimentação(ões) importada(s); ${d.skipped} ignorada(s) por duplicidade`) });
  const discard = useAction(discardOfxAction, { success: "Importação descartada" });
  const willImport = lines.filter((l) => l.classification === "new" || l.classification === "identical_in_file" || (l.classification === "probable_duplicate" && force.includes(l.index))).length;
  return (
    <div className="space-y-4">
      {errors.length > 0 ? (
        <Notice tone="danger" title="Erros no arquivo">
          <ul className="list-inside list-disc">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {warnings.length > 0 ? (
        <Notice tone="warning" title="Revise antes de confirmar">
          <ul className="list-inside list-disc">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {status === "preview" ? <Checkbox className="mt-2" label="Revisei os avisos" checked={ack} onChange={(e) => setAck(e.target.checked)} /> : null}
        </Notice>
      ) : null}
      {status !== "preview" ? <Notice tone="info">Esta importação já foi {status === "confirmed" ? "confirmada" : "descartada"}.</Notice> : null}
      <Card>
        <CardHeader title={`${lines.length} movimentação(ões) no arquivo`} description={`Serão importadas ${willImport}. Duplicadas por identificador do banco nunca são reimportadas.`} />
        <TableWrap label="Prévia do extrato">
          <Table>
            <thead>
              <tr>
                <Th>Data</Th>
                <Th>Descrição</Th>
                <Th align="right">Valor</Th>
                <Th>Classificação</Th>
                <Th>Importar mesmo assim</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <Tr key={l.index}>
                  <Td className="tabular">{formatDateBR(l.postedOn)}</Td>
                  <Td className="max-w-md">
                    <span className="block truncate">{l.description}</span>
                    {l.note ? <span className="text-xs text-subtle">{l.note}</span> : null}
                  </Td>
                  <Td align="right" className={l.amountCents < 0 ? "text-danger" : "text-success"}>
                    {formatBRL(l.amountCents)}
                  </Td>
                  <Td>
                    <Badge tone={CLASS[l.classification].tone}>{CLASS[l.classification].label}</Badge>
                  </Td>
                  <Td>
                    {l.classification === "probable_duplicate" && status === "preview" ? (
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" className="size-4 accent-accent" checked={force.includes(l.index)} onChange={(e) => setForce((f) => (e.target.checked ? [...f, l.index] : f.filter((x) => x !== l.index)))} />
                        É outra transação real
                      </label>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        {status === "preview" ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
            {confirm.error ? <p className="mr-auto text-sm text-danger">{confirm.error}</p> : null}
            <Button
              variant="ghost"
              loading={discard.pending}
              onClick={async () => {
                const res = await discard.run(batchId);
                if (res.ok) router.push(`/financeiro/conciliacao?conta=${accountId}`);
              }}
            >
              Descartar
            </Button>
            <Button
              variant="primary"
              loading={confirm.pending}
              disabled={errors.length > 0 || (warnings.length > 0 && !ack)}
              onClick={async () => {
                const res = await confirm.run({ batchId, forceLineIndexes: force, acknowledgeWarnings: ack });
                if (res.ok) router.push(`/financeiro/conciliacao?conta=${accountId}`);
              }}
            >
              Confirmar importação
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
