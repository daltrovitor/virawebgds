import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { readSignedFile } from "@/server/services/attachments";
import { getCurrentSession } from "@/server/session";

/** Download privado: link assinado e temporário + sessão autorizada para o objeto. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = req.nextUrl.searchParams;
  const session = await getCurrentSession();
  try {
    const file = await readSignedFile(
      getDb(),
      { attachmentId: id, orgId: sp.get("o") ?? "", variant: sp.get("v") ?? "original", exp: sp.get("exp") ?? "", sig: sp.get("sig") ?? "" },
      session && !session.mfaPending ? session.userId : null,
    );
    const safeName = encodeURIComponent(file.fileName);
    return new NextResponse(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${file.inline ? "inline" : "attachment"}; filename*=UTF-8''${safeName}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    const status = err instanceof AppError ? err.status : 500;
    return new NextResponse(status === 403 ? "Acesso negado ou link expirado" : "Arquivo indisponível", { status, headers: { "Cache-Control": "no-store" } });
  }
}
