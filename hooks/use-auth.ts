"use client"

const isDev = process.env.NODE_ENV === 'development'

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase-client"
import type { User } from "@supabase/supabase-js"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Memoize supabase client to avoid recreating on every render
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        // First, get the current user from the session
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()
        
        if (isMounted) {
          setUser(currentUser)
          setLoading(false)
        }
      } catch (error) {
        console.error('[useAuth] Error getting user:', error)
        if (isMounted) {
          setUser(null)
          setLoading(false)
        }
      }
    }

    initializeAuth()
    
    const persistSession = async (event: string, session: any) => {
      try {
        const consent = localStorage.getItem('vwd:consent_cookies')
        const forcePersist = (process.env.NEXT_PUBLIC_FORCE_PERSIST_SESSION || '') === 'true'
        if (consent === 'true' || forcePersist) {
          await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ event, session }),
          })
        }
      } catch (e) {
        console.debug('Error while attempting to persist auth cookie', e)
      }
    }

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user || null)
      }
      persistSession(_event, session)
    })

    // Also listen for consent changes to persist immediately
    const handleConsentChange = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        persistSession('SIGNED_IN', session)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('vwd:consent_changed', handleConsentChange)
    }

    return () => {
      isMounted = false
      subscription.unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('vwd:consent_changed', handleConsentChange)
      }
    }
  }, [supabase])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
      },
    })
    return { data, error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const sendPasswordReset = async (email: string) => {
    // Send password reset email via Supabase
    // Uses Supabase JS v2 API: resetPasswordForEmail
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
    })
    return { data, error }
  }

  const signInWithGoogle = async (flow: 'login' | 'signup' = 'signup') => {
    // Start OAuth flow via Supabase
    // Pass flow param so the callback can block new users on the login flow
    const baseRedirect = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`
    const redirectUrl = new URL(baseRedirect)
    redirectUrl.searchParams.set('flow', flow)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    signInWithGoogle,
  }
}
