'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'
import { ThemeProvider } from "@/components/theme-provider"
import CookieConsent from "@/components/cookie-consent"
import { FCMHandler } from "@/components/notifications/fcm-handler"

export function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  return (
    <>
      <FCMHandler />
      {googleClientId ? (
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
      )}
    </>
  )
}
