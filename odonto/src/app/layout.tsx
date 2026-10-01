// Hello World
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import { ToastProvider } from "@/components/ui/toast";
import { PRODUCT_NAME } from "@/lib/product";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: "Gestão odontológica e financeira em nuvem: agenda, pacientes, orçamentos, tratamentos e financeiro integrados.",
  applicationName: PRODUCT_NAME,
  // Sistema interno com dados de pacientes: nunca indexar.
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: PRODUCT_NAME,
    description: "Gestão odontológica e financeira em nuvem.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg font-sans text-fg antialiased" suppressHydrationWarning>
        <SmoothScrollProvider>
          <ToastProvider>{children}</ToastProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
