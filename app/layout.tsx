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

export const metadata: Metadata = {
  title: "ViraWeb — Gestor de Clientes e Agendamentos",
  description:
    "ViraWeb é um sistema completo para clínicas e profissionais gerenciarem clientes, agendamentos e pagamentos.",
  keywords: [
    "gestão de clientes",
    "agendamentos online",
    "software para clínicas",
    "profissionais de saúde",
    "ViraWeb",
  ],
  metadataBase: new URL("https://viraweb.online"),
  alternates: { canonical: "https://viraweb.online" },
  robots: undefined,
  openGraph: {
    title: "ViraWeb — Gestor de Clientes e Agendamentos",
    description:
      "Sistema para clínicas e profissionais gerenciarem clientes, agendamentos e cobranças.",
    url: "https://viraweb.online",
    siteName: "ViraWeb",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ViraWeb — Gestor de Clientes",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ViraWeb — Gestor de Clientes e Agendamentos",
    description:
      "Sistema para clínicas e profissionais gerenciarem clientes, agendamentos e cobranças.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/viraweb6.ico",
    shortcut: "/viraweb6.ico",
    apple: "/apple-touch-icon.png",
  },
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
      {/* JSON-LD: Organization & WebSite */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: process.env.NEXT_PUBLIC_COMPANY_NAME || "(coloque aqui)",
            url: process.env.NEXT_PUBLIC_SITE_URL || "(coloque aqui)",
            logo:
              (process.env.NEXT_PUBLIC_SITE_URL || "") +
              (process.env.NEXT_PUBLIC_SITE_LOGO || "/viraweb6.ico"),
            sameAs: JSON.parse(process.env.NEXT_PUBLIC_SOCIALS || "[]"),
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "ViraWeb",
            url: "https://viraweb.online",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://viraweb.online/?s={search_term_string}",
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
                item: "https://viraweb.online",
              },
            ],
          }),
        }}
      />
      <link rel="shortcut icon" href="/viraweb6.ico" type="image/x-icon" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content={process.env.NEXT_PUBLIC_THEME_COLOR || "#0ea5a4"} />
      <link rel="apple-touch-icon" href={process.env.NEXT_PUBLIC_APPLE_TOUCH_ICON || "/viraweb6.ico"} />
      <body className={`${outfit.variable} font-sans antialiased selection:bg-primary selection:text-white`}>
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
            {children}
          </Providers>
        </NextIntlClientProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
