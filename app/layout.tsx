// Hello World
import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"
import { Providers } from "./providers"
import { Montserrat, Outfit } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getMessages, getLocale } from "next-intl/server"
import AnalyticsTracker from "@/components/analytics-tracker"
import { BRAND, SITE_URL } from "@/lib/brand"

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
})

// Montserrat é a família da logo original (Vira 700 / Web 300): usada na assinatura e nos títulos.
// display "optional": sem troca tardia de fonte no título do hero (o LCP não é reemitido em redes lentas).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-montserrat",
  display: "optional",
  preload: true,
  adjustFontFallback: true,
})

const TITLE = `${BRAND.name} | Software odontológico para clínicas e consultórios`
const DESCRIPTION =
  "Vira Web Odonto (VWO): agenda odontológica, ficha do paciente, odontograma, orçamentos com plano de pagamento, financeiro e conciliação bancária em uma plataforma em nuvem."

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s | ${BRAND.name}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND.name,
  keywords: [
    "software odontológico",
    "sistema para dentista",
    "gestão de clínica odontológica",
    "odontograma online",
    "orçamento odontológico",
    "agenda odontológica",
    "prontuário odontológico",
    "plano de pagamento odontológico",
    "Vira Web Odonto",
    "VWO",
  ],
  authors: [{ name: BRAND.company, url: SITE_URL }],
  creator: BRAND.company,
  publisher: BRAND.company,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/vwo-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "pt-BR": `${SITE_URL}/pt-BR`,
      en: `${SITE_URL}/en`,
    },
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: BRAND.name,
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/brand/vwo-icon-512.png`,
        width: 512,
        height: 512,
        alt: `${BRAND.name} — software odontológico`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/brand/vwo-icon-512.png`],
  },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  // JSON-LD para buscadores e motores generativos
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND.name,
    alternateName: BRAND.short,
    operatingSystem: "Web, iOS, Android (PWA)",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "DentalPracticeManagementSoftware",
    url: SITE_URL,
    image: `${SITE_URL}/brand/vwo-icon-512.png`,
    description: DESCRIPTION,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BRL",
      lowPrice: "0",
      highPrice: "247.90",
      offerCount: "3",
      offers: [
        {
          "@type": "Offer",
          name: "Teste gratuito",
          price: "0",
          priceCurrency: "BRL",
          description: "Teste completo por 14 dias; a cobrança começa só depois do período de teste.",
        },
      ],
    },
    featureList: [
      "Agenda odontológica semanal com status de consulta",
      "Ficha do paciente com agendamentos, faltas, imagens e orçamentos",
      "Orçamento pelo odontograma (dente, hemiarco, arcada ou sem região)",
      "Plano de pagamento parcelado integrado ao contas a receber",
      "Anamnese, documentos clínicos e tratamentos",
      "Financeiro, fechamento e conciliação bancária",
    ],
    publisher: {
      "@type": "Organization",
      name: BRAND.company,
      logo: `${SITE_URL}/brand/vwo-icon-512.png`,
      url: SITE_URL,
      sameAs: JSON.parse(process.env.NEXT_PUBLIC_SOCIALS || "[]"),
    },
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND.company,
    brand: { "@type": "Brand", name: BRAND.name, alternateName: BRAND.short },
    url: SITE_URL,
    logo: `${SITE_URL}/brand/vwo-icon-512.png`,
    description: `Desenvolvedora do ${BRAND.name}, plataforma SaaS de gestão para clínicas e consultórios odontológicos.`,
    knowsAbout: [
      "Gestão de clínicas odontológicas",
      "Odontograma digital",
      "Orçamentos e planos de tratamento",
      "Agenda odontológica",
      "Financeiro para dentistas",
    ],
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "O que é o Vira Web Odonto?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O Vira Web Odonto (VWO) é um software odontológico em nuvem que reúne agenda, ficha do paciente, odontograma, orçamentos com plano de pagamento, financeiro e conciliação bancária.",
        },
      },
      {
        "@type": "Question",
        name: "Como funciona o orçamento pelo odontograma?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Você escolhe o procedimento da tabela de preços e clica nos dentes, em um hemiarco, na arcada ou em 'sem região'. Cada dente vira uma linha do orçamento e o plano de pagamento gera as parcelas no contas a receber.",
        },
      },
      {
        "@type": "Question",
        name: "O Vira Web Odonto tem teste grátis?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. São 14 dias de teste com acesso às funcionalidades principais; a cobrança só começa depois do período de teste e você pode cancelar antes.",
        },
      },
      {
        "@type": "Question",
        name: "Funciona no celular e no tablet?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim. A plataforma é responsiva e pode ser instalada como app (PWA) no iPhone, iPad e Android.",
        },
      },
    ],
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND.name,
    url: SITE_URL,
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${outfit.variable} ${montserrat.variable} font-sans antialiased`}
      >
        {/* Tema: aplica a preferência salva antes da hidratação (padrão: claro). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light"}}catch(e){}})();`,
          }}
        />

        <NextIntlClientProvider messages={messages}>
          <Providers>
            <AnalyticsTracker />
            {/* Cada página declara o próprio <main>; aqui só um contêiner para evitar landmarks aninhados. */}
            <div id="main-content">{children}</div>
          </Providers>
        </NextIntlClientProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
