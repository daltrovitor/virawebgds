'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider } from "@/components/theme-provider"
import CookieConsent from "@/components/cookie-consent"

// Notificações push (FCM) são iniciadas dentro do dashboard/admin (useFCM), não em páginas públicas:
// evita carregar Firebase na landing e pedir permissão de notificação a visitantes anônimos.
export function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      <ThemeProvider>
        {children}
        <CookieConsent />
      </ThemeProvider>
    </GoogleOAuthProvider>
  ) : (
    <ThemeProvider>
      {children}
      <CookieConsent />
    </ThemeProvider>
  )
}
