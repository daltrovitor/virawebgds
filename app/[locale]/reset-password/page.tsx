'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const dynamic = 'force-dynamic'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase-client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import Image from 'next/image'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null)
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const supabase = createClient()

  // Captura o token apenas no cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      // Extrai o access_token da hash (formato: #access_token=...&type=recovery&...)
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace('#', ''))
        const accessToken = params.get('access_token')
        const type = params.get('type')
        if (accessToken && (type === 'recovery' || !type)) {
          const refreshToken = params.get('refresh_token')
          setRecoveryToken(accessToken)
          setRecoveryRefreshToken(refreshToken)
            // Tenta criar sessão localmente usando o supabase client. Se falhar,
            // mantemos os tokens para usar o fallback direto na API.
            ; (async () => {
              try {
                // setSession pode lançar ou retornar erro dependendo da versão/config
                const result = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken ?? '',
                })
                if (result.error) {
                  console.warn('setSession falhou:', result.error.message)
                } else {
                  console.log('Sessão criada via setSession (recuperação)')
                }
              } catch (err) {
                console.warn('setSession throw:', err)
                // não interrompe: usaremos fallback PATCH na submissão
              }
            })()
          // limpa a hash para não deixar o token exposto no URL
          window.history.replaceState({}, '', window.location.pathname)
        } else {
          toast({
            title: "Erro de Autenticação",
            description: "Link de recuperação inválido ou expirado. Solicite um novo link.",
            variant: "destructive",
          })
          setTimeout(() => router.push('/'), 2000)
        }
      } else {
        toast({
          title: "Link Inválido",
          description: "O link de recuperação está incompleto. Solicite um novo link.",
          variant: "destructive",
        })
        setTimeout(() => router.push('/'), 2000)
      }
      setIsInitializing(false)
    }
  }, [router, toast])

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 0, label: "" }
    let strength = 0
    if (pwd.length >= 6) strength++
    if (pwd.length >= 8) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++

    const labels = ["Fraca", "Fraca", "Média", "Forte", "Muito Forte"]
    return { strength, label: labels[strength] }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recoveryToken) {
      toast({
        title: "Link inválido",
        description: "O link de redefinição de senha é inválido ou expirou.",
        variant: "destructive",
      })
      return
    }
    if (!password || !confirmPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos.",
        variant: "destructive",
      })
      return
    }
    if (password !== confirmPassword) {
      toast({
        title: "Senhas diferentes",
        description: "As senhas não coincidem.",
        variant: "destructive",
      })
      return
    }
    const passwordStrength = getPasswordStrength(password)
    if (passwordStrength.strength < 3) {
      toast({
        title: "Senha fraca",
        description: "Por favor, escolha uma senha mais forte.",
        variant: "destructive",
      })
      return
    }
    setIsLoading(true)
    try {
      // Primeiro tente usar a API do supabase client (recomendado pelo artigo):
      // - Se já houver sessão criada via setSession no useEffect, updateUser funcionará.
      // - Caso contrário, tentamos setSession aqui e então updateUser.
      let updated = false

      try {
        // Verifica se já temos sessão
        const sessionRes = await supabase.auth.getSession()
        if (sessionRes?.data?.session) {
          const { data, error } = await supabase.auth.updateUser({ password })
          if (error) throw error
          updated = true
        } else {
          // Tenta criar sessão com os tokens de recuperação (caso setSession no useEffect tenha falhado)
          try {
            const setRes = await supabase.auth.setSession({
              access_token: recoveryToken,
              refresh_token: recoveryRefreshToken ?? '',
            })
            if (setRes.error) {
              console.warn('setSession (no submit) retornou erro:', setRes.error.message)
            } else {
              const { data, error } = await supabase.auth.updateUser({ password })
              if (error) throw error
              updated = true
            }
          } catch (err) {
            console.warn('Erro ao setSession/updateUser:', err)
          }
        }
      } catch (err) {
        console.warn('Erro ao verificar/criar sessão com supabase client:', err)
      }

      // Se update via client não ocorreu, usa fallback direto na API REST com o token
      if (!updated) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!supabaseUrl || !supabaseAnonKey) throw new Error('Configuração do Supabase não encontrada.')

        const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${recoveryToken}`,
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ password }),
        })

        const resJson = await res.json().catch(() => null)
        if (!res.ok) {
          console.error('Erro ao chamar /auth/v1/user', res.status, resJson)
          const message = (resJson && (resJson.message || resJson.error_description || resJson.error)) || 'Link de recuperação inválido ou expirado'
          toast({ title: 'Erro', description: message, variant: 'destructive' })
          if (message.toLowerCase().includes('expired') || message.toLowerCase().includes('inválido')) {
            setTimeout(() => router.push('/'), 2000)
          }
          return
        }
      }

      toast({ title: 'Senha redefinida!', description: 'Sua senha foi alterada com sucesso.' })
      setTimeout(() => router.push('/'), 2000)
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const passwordStrength = getPasswordStrength(password)

  return (
    isInitializing ? (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando link de recuperação...</p>
        </div>
      </div>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="flex flex-col items-center mb-8">
            <div className=" w-20 flex items-center justify-center mb-4">
              <Image width={214} height={191} alt='' className='' src="/viraweb7.png" />
            </div>
            <h1 className="text-2xl font-bold">Redefinir senha</h1>
            <p className="text-gray-600 text-center mt-2">
              Digite sua nova senha
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nova senha
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
                <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              {password && (
                <div className="mt-1">
                  <div className="text-xs text-gray-600">Força da senha: {passwordStrength.label}</div>
                  <div className="h-1 w-full bg-gray-200 rounded-full mt-1">
                    <div
                      className={`h-1 rounded-full transition-all ${passwordStrength.strength <= 1
                        ? 'bg-red-500'
                        : passwordStrength.strength === 2
                          ? 'bg-yellow-500'
                          : passwordStrength.strength >= 3
                            ? 'bg-green-500'
                            : ''
                        }`}
                      style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirme a nova senha
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
                <Lock className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors"
              disabled={isLoading}
            >
              {isLoading ? "Redefinindo..." : "Redefinir senha"}
            </Button>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-primary cursor-pointer text-sm"
              >
                Voltar para login
              </button>
            </div>
          </form>

          <p className="mt-8 text-xs text-center text-gray-500">
            Seus dados estão seguros e protegidos com criptografia de ponta a ponta.
          </p>
        </div>
      </div>
    )
  )
}
