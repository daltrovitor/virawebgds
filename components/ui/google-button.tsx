"use client"

import { useCallback } from 'react'
import { useGoogleLogin } from '@react-oauth/google'

interface GoogleButtonProps {
  onSuccess?: (credential: string) => void
  onError?: () => void
  variant?: "signin" | "signup"
  isLoading?: boolean
}

export function GoogleButton({ onSuccess, onError, variant = "signin", isLoading, onClick }: GoogleButtonProps & { onClick?: () => void }) {
  // Protect against missing client id: NEXT_PUBLIC_GOOGLE_CLIENT_ID must be configured
  // If it's not present we avoid calling `useGoogleLogin` which would throw.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const login = googleClientId
    ? useGoogleLogin({
      onSuccess: tokenResponse => {
        if (onSuccess) {
          onSuccess(tokenResponse.access_token)
        }
      },
      onError: () => {
        if (onError) {
          onError()
        }
      }
    })
    : undefined

  return (
    <div className="w-full flex justify-center">
      <button
        onClick={() => {
          if (onClick) {
            onClick()
            return
          }

          if (login) {
            login()
          } else {
            // No client id configured: call onError and log for easier debugging
            console.error('Google OAuth client id is not configured (NEXT_PUBLIC_GOOGLE_CLIENT_ID)')
            if (onError) onError()
          }
        }}
        disabled={isLoading}
        className="w-full max-w-[300px] h-10 inline-flex items-center cursor-pointer justify-center gap-3 rounded-full bg-white hover:bg-gray-50 border border-gray-300 px-3 transition-colors duration-200 shadow-sm disabled:opacity-70"
      >
        <span className="flex-shrink-0">
          <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <g fill="#000" fillRule="evenodd">
              <path d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z" fill="#EA4335" />
              <path d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.64 2.08-1.84 2.92l2.84 2.2c1.7-1.57 2.68-3.88 2.68-6.62z" fill="#4285F4" />
              <path d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z" fill="#FBBC05" />
              <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.84-2.2c-.76.53-1.78.9-3.12.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z" fill="#34A853" />
            </g>
          </svg>
        </span>
        <span className="text-[14px] text-[#3c4043] font-medium tracking-[-0.2px]">
          {isLoading
            ? "Aguarde..."
            : variant === "signup"
              ? "Cadastrar com o Google"
              : "Fazer login com o Google"
          }
        </span>
      </button>
    </div>
  )
}
