import { NextResponse, type NextRequest } from "next/server";
import { centsForCsv, toCsv } from "@/domain/csv";
import { formatDateBR, isValidCivil, todayInTz } from "@/domain/dates";
import { assertCan } from "@/server/context";
import { audit } from "@/server/audit";
import { listMovements, listTitles } from "@/server/services/titles";
import { getRequestContext } from "@/server/session";

interface TitleRow {
  dueDate: string;
  competenceDate: string;
  description: string;
  counterpart: string | null;
  categoryName: string | null;
  originalCents: number;
  adjustmentCents: number;
  balanceCents: number;
  status: string;
  overdue: boolean;
}

const STATUSES = ["open_all", "overdue", "paid", "cancelled", "all"] as const;

/** Exportação CSV respeitando filtros e permissões, com proteção contra fórmulas. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const ctx = await getRequestContext();
  assertCan(ctx, "finance.export");
  const { tipo } = await params;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") && isValidCivil(sp.get("from")) ? sp.get("from")! : undefined;
  const to = sp.get("to") && isValidCivil(sp.get("to")) ? sp.get("to")! : undefined;
  let csv: string;
  if (tipo === "receber" || tipo === "pagar") {
    const status = (STATUSES as readonly string[]).includes(sp.get("status") ?? "") ? (sp.get("status") as (typeof STATUSES)[number]) : "open_all";
    const kind = tipo === "receber" ? "receivable" : "payable";
    const rows: TitleRow[] = [];
    for (let page = 1; page < 200; page++) {
      const res = await listTitles(ctx, { kind, status, from, to, q: sp.get("q") ?? "", page, pageSize: 200 });
      rows.push(...res.items);
      if (rows.length >= res.total) break;
    }
    csv = toCsv(rows, [
      { header: "Vencimento", value: (r) => formatDateBR(r.dueDate) },
      { header: "Competência", value: (r) => formatDateBR(r.competenceDate) },
      { header: "Descrição", value: (r) => r.description },
      { header: kind === "receivable" ? "Paciente" : "Fornecedor", value: (r) => r.counterpart },
      { header: "Categoria", value: (r) => r.categoryName },
      { header: "Valor", value: (r) => centsForCsv(r.originalCents + r.adjustmentCents) },
      { header: "Saldo", value: (r) => centsForCsv(r.balanceCents) },
      { header: "Situação", value: (r) => (r.overdue ? "Vencido" : ({ open: "Em aberto", partial: "Parcial", paid: "Quitado", cancelled: "Cancelado" } as Record<string, string>)[r.status]) },
    ]);
  } else if (tipo === "movimentos") {
    const today = todayInTz(ctx.timezone);
    const rows = await listMovements(ctx, { accountId: sp.get("conta") ?? undefined, from: from ?? `${today.slice(0, 7)}-01`, to: to ?? today });
    csv = toCsv(rows, [
      { header: "Data", value: (r) => formatDateBR(r.movement.occurredOn) },
      { header: "Conta", value: (r) => r.accountName },
      { header: "Descrição", value: (r) => r.movement.description },
      { header: "Categoria", value: (r) => r.categoryName },
      { header: "Tipo", value: (r) => r.movement.kind },
      { header: "Valor", value: (r) => centsForCsv(r.movement.amountCents) },
      { header: "Conciliado", value: (r) => centsForCsv(r.movement.reconciledCents) },
    ]);
  } else {
    return new NextResponse("Exportação desconhecida", { status: 404 });
  }
  await audit(ctx.db, ctx, { action: "export.csv", entityType: "export", entityId: tipo, summary: `Exportação CSV: ${tipo}` });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo}-${todayInTz(ctx.timezone)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
