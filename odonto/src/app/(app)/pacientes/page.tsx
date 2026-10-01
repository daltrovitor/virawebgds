// Hello World
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/page";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { QuickPatientButton } from "@/components/patients/quick-patient";
import { formatPhone } from "@/domain/text";
import { searchPatients } from "@/server/services/patients";
import { getRequestContext } from "@/server/session";

export const metadata: Metadata = { title: "Pacientes" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const ctx = await getRequestContext();
  const sp = await searchParams;
  const status = sp.status === "archived" || sp.status === "all" ? sp.status : "active";
  const page = Math.max(1, Number(sp.page) || 1);
  const result = await searchPatients(ctx, { q: sp.q ?? "", status, page, pageSize: 25 });
  const canEdit = ctx.permissions.has("patients.edit");
  const qs = (p: number) => `/pacientes?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), status, page: String(p) })}`;
  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Busque por nome, telefone, código ou CPF (conforme sua permissão)."
        actions={
          canEdit ? (
            <>
              <QuickPatientButton />
              <ButtonLink href="/pacientes/novo" variant="primary">
                Novo paciente
              </ButtonLink>
            </>
          ) : null
        }
      />
      <Card>
        <form className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-end sm:px-5" role="search">
          <div className="flex-1">
            <label htmlFor="q" className="mb-1.5 block text-sm font-medium">
              Buscar
            </label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Nome, telefone ou código" className="h-10 w-full rounded-md border border-border-strong px-3 text-sm focus:border-accent focus:outline-2 focus:outline-accent/30" />
          </div>
          <div className="sm:w-48">
            <label htmlFor="status" className="mb-1.5 block text-sm font-medium">
              Situação
            </label>
            <select id="status" name="status" defaultValue={status} className="h-10 w-full rounded-md border border-border-strong px-3 text-sm">
              <option value="active">Ativos</option>
              <option value="archived">Arquivados</option>
              <option value="all">Todos</option>
            </select>
          </div>
          <button type="submit" className="h-10 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-surface-2 cursor-pointer">
            Filtrar
          </button>
        </form>
        {result.items.length === 0 ? (
          <EmptyState
            title={sp.q ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            description={sp.q ? "Confira a grafia ou busque pelo telefone." : "Cadastre o primeiro paciente com nome e telefone; os demais dados podem vir depois."}
          />
        ) : (
          <TableWrap label="Lista de pacientes">
            <Table>
              <thead>
                <tr>
                  <Th>Código</Th>
                  <Th>Nome</Th>
                  <Th>Telefone</Th>
                  <Th align="right">Idade</Th>
                  <Th>Situação</Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((p) => (
                  <Tr key={p.id}>
                    <Td className="tabular text-muted">{p.code}</Td>
                    <Td>
                      <Link href={`/pacientes/${p.id}`} className="font-medium text-fg hover:underline cursor-pointer">
                        {p.socialName || p.fullName}
                      </Link>
                      {p.socialName ? <span className="block text-xs text-subtle">{p.fullName}</span> : null}
                    </Td>
                    <Td className="tabular">{p.phone ? formatPhone(p.phone) : "—"}</Td>
                    <Td align="right">{p.age ?? "—"}</Td>
                    <Td>{p.status === "active" ? <Badge tone="success">Ativo</Badge> : <Badge>Arquivado</Badge>}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
        <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={qs} />
      </Card>
    </>
  );
}
