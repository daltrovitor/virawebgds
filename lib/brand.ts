// Hello World
/**
 * Identidade Vira Web Odonto (VWO).
 * Fonte única para nome, abreviação e cores institucionais — evite repetir strings da marca no código.
 */

export const BRAND = {
  name: "Vira Web Odonto",
  short: "VWO",
  company: "ViraWeb Tecnologias",
  tagline: "Gestão odontológica que trabalha no ritmo da sua cadeira.",
  supportEmail: "suporte@viraweb.online",
  whatsappDisplay: "(62) 9 8463-8578",
  whatsappNumber: "5562984638578",
  /** Azul Mineral (odontologia) — contraste 5,9:1 sobre branco (WCAG AA). */
  accent: "#0369a1",
  /** Grafite-marinho extraído da logo, usado em títulos. */
  ink: "#0f1f33",
  logoNavy: "#132a46",
  logoGold: "#f2bf12",
} as const

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online"

/**
 * Endereços de produção do app (mesmo projeto Vercel; o middleware reconhece qualquer `admin.*`).
 * gdc./admin.viraweb.online deixaram de resolver em out/2026. www.viraweb.dev.br é o site da
 * agência, não o app — não apontar links do app para lá.
 */
export const APP_HOST = "odonto.viraweb.dev.br"
export const ADMIN_HOST = "admin.viraweb.dev.br"
export const APP_URL = `https://${APP_HOST}`
export const ADMIN_URL = `https://${ADMIN_HOST}`

/** Domínios da marca; o antigo segue aceito enquanto ainda houver host apontando para o app. */
const BRAND_DOMAINS = ["viraweb.dev.br", "viraweb.online"]

/**
 * Origem para redirecionamentos de auth: em qualquer host da marca vai sempre para o app;
 * em localhost e previews da Vercel mantém a própria origem.
 */
export function appOriginFor(currentOrigin: string): string {
  const hostname = new URL(currentOrigin).hostname.replace(/\.$/, "").toLowerCase()
  const isBrandHost = BRAND_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))
  return isBrandHost ? APP_URL : currentOrigin
}
