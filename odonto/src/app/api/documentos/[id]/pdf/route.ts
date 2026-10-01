import { NextResponse } from "next/server";
import { formatDateTimeBR } from "@/domain/dates";
import { PdfWriter } from "@/server/pdf";
import { getDocument } from "@/server/services/documents";
import { getRequestContext } from "@/server/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext();
  const { id } = await params;
  const doc = await getDocument(ctx, id);
  const pdf = await PdfWriter.create();
  pdf.text(ctx.clinicName, { size: 9, color: [0.4, 0.4, 0.43] });
  pdf.text(doc.title, { size: 15, bold: true, gap: 10 });
  pdf.text(doc.body, { size: 10.5 });
  pdf.space(12);
  pdf.text(`Documento gerado em ${formatDateTimeBR(doc.createdAt, ctx.timezone)}.`, { size: 8, color: [0.45, 0.45, 0.48] });
  const bytes = await pdf.bytes();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="documento-${doc.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
