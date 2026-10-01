import "server-only";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Envio transacional via Resend quando RESEND_API_KEY e EMAIL_FROM existem.
 * Sem configuração, nada é enviado e o chamador decide a alternativa
 * (ex.: link gerado pelo administrador). Ambientes de teste nunca enviam.
 */
export async function sendEmail(message: EmailMessage): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (process.env.APP_ENV === "test" || process.env.APP_ENV === "demo") return { sent: false, reason: "disabled_in_environment" };
  if (!key || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email:não configurado] Para ${message.to}: ${message.subject}\n${message.text}`);
    }
    return { sent: false, reason: "not_configured" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!res.ok) {
    console.error(`[email] falha no envio (${res.status})`);
    return { sent: false, reason: `http_${res.status}` };
  }
  return { sent: true };
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
  return `${base}${path}`;
}
