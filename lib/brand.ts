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
