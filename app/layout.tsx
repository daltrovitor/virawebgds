import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"
import { Providers } from "./providers"
import { Outfit } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
})

import AnalyticsTracker from "@/components/analytics-tracker"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ViraWeb GDS | Sistema de Gestão Inteligente para Clínicas e Consultórios",
    template: "%s | ViraWeb GDS"
  },
  description: "Plataforma de gestão inteligente para clínicas, consultórios e empresas. Agendamento online multi-profissional, prontuário eletrônico, controle financeiro, gestão de estoque e assistente com IA.",
  keywords: [
    "gestão de clínicas",
    "agendamento online",
    "software médico",
    "prontuário eletrônico",
    "gestão de consultório",
    "sistema para clínicas",
    "controle financeiro para clínicas",
    "CRM de clientes",
    "ViraWeb",
    "ViraWeb GDS",
    "sistema SaaS de agendamento"
  ],
  authors: [{ name: "Equipe ViraWeb", url: SITE_URL }],
  creator: "ViraWeb",
  publisher: "ViraWeb",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      'pt-BR': `${SITE_URL}/pt-BR`,
      'en': `${SITE_URL}/en`,
    },
  },
  openGraph: {
    title: "ViraWeb GDS | Gestão Inteligente para Clínicas e Consultórios",
    description: "O sistema completo para agendamento online, prontuário eletrônico, gestão financeira e IA em clínicas e consultórios.",
    url: SITE_URL,
    siteName: "ViraWeb GDS",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: `${SITE_URL}/viraweb6.png`,
        width: 1200,
        height: 630,
        alt: "ViraWeb GDS - Gestão Inteligente para Clínicas e Consultórios",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ViraWeb GDS | Gestão Inteligente para Clínicas e Consultórios",
    description: "Agendamento online, prontuário eletrônico e controle financeiro integrado.",
    images: [`${SITE_URL}/viraweb6.png`],
  },
}

export const viewport: Viewport = {
  themeColor: "#0ea5a4",
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  // Expanded JSON-LD for AI Search Engines & RAG
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: process.env.NEXT_PUBLIC_COMPANY_NAME || "ViraWeb GDS",
    operatingSystem: "Web, iOS, Android (PWA)",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "MedicalManagementSoftware, CRM, FinancialSoftware",
    url: SITE_URL,
    image: `${SITE_URL}/viraweb6.png`,
    description: "Sistema de gestão definitivo para clínicas, consultórios e equipes de atendimento com agendamento online, prontuário eletrônico, controle financeiro e inteligência artificial.",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "BRL",
      lowPrice: "0",
      highPrice: "299",
      offerCount: "3",
      offers: [
        {
          "@type": "Offer",
          name: "Teste Gratuito",
          price: "0",
          priceCurrency: "BRL",
          description: "Teste completo por 7 dias sem necessidade de cartão de crédito."
        }
      ]
    },
    featureList: [
      "Agendamento Online Multi-profissional",
      "Prontuário Eletrônico de Pacientes",
      "Controle Financeiro e Fluxo de Caixa",
      "Lembretes e Confirmações de Consulta",
      "Assistente Virtual com IA Integrada",
      "Gestão de Insumos e Estoque Médico",
      "Suporte PWA para Celulares e Tablets"
    ],
    publisher: {
      "@type": "Organization",
      name: process.env.NEXT_PUBLIC_COMPANY_NAME || "ViraWeb GDS",
      logo: `${SITE_URL}/viraweb6.png`,
      url: SITE_URL,
      sameAs: JSON.parse(process.env.NEXT_PUBLIC_SOCIALS || "[]")
    }
  }

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ViraWeb GDS",
    url: SITE_URL,
    logo: `${SITE_URL}/viraweb6.png`,
    description: "Desenvolvedora do ViraWeb GDS, plataforma SaaS de gestão inteligente para saúde e negócios de serviços.",
    knowsAbout: [
      "Gestão de Clínicas Médicas",
      "Agendamento Online",
      "Prontuário Eletrônico",
      "Gestão de Consultórios",
      "CRM e Fidelização de Clientes",
      "Finanças para Profissionais da Saúde"
    ]
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "O que é o ViraWeb GDS?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O ViraWeb GDS é um sistema SaaS de gestão empresarial e clínica em nuvem que integra agendamento online multi-profissional, prontuário eletrônico, controle financeiro, gestão de estoque e inteligência artificial."
        }
      },
      {
        "@type": "Question",
        name: "Para quais tipos de negócios o ViraWeb é indicado?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O ViraWeb é indicado para clínicas médicas, odontológicas, estéticas, psicólogos, fisioterapeutas, consultórios individuais, prestadores de serviços e pequenas/médias empresas de agendamento."
        }
      },
      {
        "@type": "Question",
        name: "O ViraWeb possui teste grátis?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim! O ViraWeb oferece um teste gratuito de 7 dias com acesso a todas as funcionalidades principais sem necessidade de cartão de crédito prévio."
        }
      },
      {
        "@type": "Question",
        name: "O ViraWeb funciona no celular ou tablet?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Sim, o ViraWeb é 100% responsivo e possui suporte a PWA (Progressive Web App), podendo ser adicionado diretamente à tela inicial de dispositivos iOS (iPhone/iPad) e Android."
        }
      },
      {
        "@type": "Question",
        name: "Como o ViraWeb reduz faltas (no-shows) dos clientes?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "O ViraWeb envia confirmações e lembretes automáticos de agendamento, permitindo que os clientes confirmem ou cancelem com antecedência, otimizando a taxa de ocupação da agenda."
        }
      }
    ]
  }

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "ViraWeb GDS",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?s={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="shortcut icon" href="/viraweb6.png" type="image/x-icon" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href={process.env.NEXT_PUBLIC_APPLE_TOUCH_ICON || "/viraweb6.png"} />

        {/* JSON-LD Schemas para IAs e Motores de Busca */}
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
      <body className={`${outfit.variable} font-sans antialiased selection:bg-primary selection:text-white`}>
        {/* Theme initialization script - Optimized and moved */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}else{document.documentElement.classList.remove("dark");document.documentElement.style.colorScheme="light"}}catch(e){}})();`
          }}
        />

        <NextIntlClientProvider messages={messages}>
          <Providers>
            <AnalyticsTracker />
            <main id="main-content">
              {children}
            </main>
          </Providers>
        </NextIntlClientProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}

