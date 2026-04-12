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

export const metadata: Metadata = {
  title: "ViraWeb | Gestão Inteligente para Clínicas e Equipes",
  description: "Sistema de gestão definitivo para negócios de agendamento. Otimize sua clínica com agendamento online, controle financeiro e inteligência artificial.",
  keywords: ["gestão de clínicas", "agendamento online", "software médico", "ViraWeb", "GDC"],
  authors: [{ name: "Equipe ViraWeb" }],
  robots: "index, follow",
  openGraph: {
    title: "ViraWeb | Gestão Inteligente para Clínicas",
    description: "O sistema definitivo para planejar e escalar negócios de agendamento.",
    url: "https://viraweb.online",
    siteName: "ViraWeb",
    locale: "pt_BR",
    type: "website",
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

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="shortcut icon" href="/viraweb6.png" type="image/x-icon" />
        <link rel="manifest" href="/manifest.json" />
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
