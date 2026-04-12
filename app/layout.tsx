import type React from "react"
import type { Metadata } from "next"
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
})

import AnalyticsTracker from "@/components/analytics-tracker"

export const metadata: Metadata = {
  title: {
    default: "ViraWeb — A Solução Definitiva para Gestão de Clínicas e Consultórios",
    template: "%s | ViraWeb GDS"
  },
  description:
    "Transforme a gestão da sua clínica com o ViraWeb. Sistema completo com agendamentos online, controle financeiro, prontuário eletrônico e lembretes automáticos via WhatsApp.",
  keywords: [
    "gestão de clínicas",
    "software para clínicas",
    "agendamento online para médicos",
    "sistema para dentistas",
    "sistema para psicólogos",
    "prontuário eletrônico",
    "controle financeiro para clínicas",
    "lembretes de agendamento whatsapp",
    "ViraWeb GDS",
    "gestão de pacientes"
  ],
  authors: [{ name: "Equipe ViraWeb", url: "https://viraweb.online" }],
  creator: "ViraWeb",
  publisher: "ViraWeb Tecnologias",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online"),
  alternates: { 
    canonical: process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online",
    languages: {
      "pt-BR": "https://viraweb.online/",
    }
  },
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
  openGraph: {
    title: "ViraWeb — A Solução Definitiva para Gestão de Clínicas e Consultórios",
    description:
      "Simplifique seus agendamentos, reduza as faltas dos pacientes com notificações inteligentes e tenha controle financeiro total em um único sistema GDS.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online",
    siteName: process.env.NEXT_PUBLIC_COMPANY_NAME || "ViraWeb",
    locale: "pt_BR",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ViraWeb — Gestão inteligente para clínicas e profissionais de saúde",
        type: "image/png",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ViraWeb — A Solução Definitiva para Gestão de Clínicas e Consultórios",
    description:
      "Agendamentos online, lembretes interativos e financeiro integrados para alavancar seu atendimento clínico.",
    images: ["/og-image.png"],
    creator: "@ViraWebGDS",
  },
  icons: {
    icon: "/viraweb6.png",
    shortcut: "/viraweb6.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Console Silencer: MUST BE THE FIRST SCRIPT */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            // Se estiver em produção ou mesmo caso o usuário queira bloquear todos, sobrescrevemos:
            if (window.location.hostname !== 'localhost') {
              const noop = () => {};
              console.log = noop;
              console.info = noop;
              console.warn = noop;
              console.error = noop;
              console.debug = noop;
            } else {
              const suppress = (args, original) => {
                const msg = args && args[0] ? String(args[0]) : '';
                const tokens = ['React DevTools', 'Pippit', 'Vercel Web Analytics', 'Largest Contentful Paint', 'aspect ratio', 'Download the React DevTools', 'Fast Refresh', 'zustand'];
                if (tokens.some(t => msg.includes(t))) return;
                original.apply(console, args);
              };
              const w = console.warn; const l = console.log; const e = console.error;
              console.warn = (...a) => suppress(a, w);
              console.log = (...a) => suppress(a, l);
              console.error = (...a) => suppress(a, e);
            }
          })();
        ` }} />
        <link rel="shortcut icon" href="/viraweb6.png" type="image/x-icon" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={process.env.NEXT_PUBLIC_THEME_COLOR || "#0ea5a4"} />
        <link rel="apple-touch-icon" href={process.env.NEXT_PUBLIC_APPLE_TOUCH_ICON || "/viraweb6.png"} />
      </head>
      <body className={`${outfit.variable} font-sans antialiased selection:bg-primary selection:text-white`}>
        {/* JSON-LD: Organization & WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: process.env.NEXT_PUBLIC_COMPANY_NAME || "ViraWeb GDS",
              operatingSystem: "Web",
              applicationCategory: "BusinessApplication",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "BRL",
                description: "Teste gratuito disponível"
              },
              description: "Sistema completo para clínicas e profissionais gerenciarem clientes, agendamentos, prontuários e finanças.",
              url: process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online",
              publisher: {
                "@type": "Organization",
                name: process.env.NEXT_PUBLIC_COMPANY_NAME || "ViraWeb",
                logo: (process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online") + (process.env.NEXT_PUBLIC_SITE_LOGO || "/viraweb6.png"),
                url: process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online",
                sameAs: JSON.parse(process.env.NEXT_PUBLIC_SOCIALS || "[]")
              }
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: process.env.NEXT_PUBLIC_COMPANY_NAME || "ViraWeb",
              url: process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online",
              potentialAction: {
                "@type": "SearchAction",
                target: (process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online") + "/?s={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Planos",
                  item: (process.env.NEXT_PUBLIC_SITE_URL || "https://viraweb.online") + "/plans",
                }
              ],
            }),
          }}
        />

        
        {/* Theme initialization script */}
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            try {
              var theme = localStorage.getItem('theme');
              if (theme === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.style.colorScheme = 'dark';
              } else {
                document.documentElement.classList.remove('dark');
                document.documentElement.style.colorScheme = 'light';
              }
            } catch (e) {
              // silent
            }
          })();
        ` }} />

        <NextIntlClientProvider messages={messages}>
          <Providers>
            <AnalyticsTracker />
            {children}
          </Providers>
        </NextIntlClientProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
