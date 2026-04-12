"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GoogleButton } from "@/components/ui/google-button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, User, Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

interface SignupPageProps {
  onSignup: (name: string, email: string, password: string) => Promise<void>
  onLoginClick: () => void
  onBackClick: () => void
  onGoogleSignIn?: () => void
}

export default function SignupPage({ onSignup, onLoginClick, onBackClick, onGoogleSignIn }: SignupPageProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()



  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 0, label: "" }
    let strength = 0
    if (pwd.length >= 6) strength++
    if (pwd.length >= 8) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++

    const labels = ["Fraca", "Fraca", "Media", "Forte", "Muito Forte"]
    return { strength, label: labels[strength] }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name || !email || !password || !confirmPassword) {
      setError("Por favor, preencha todos os campos")
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não correspondem")
      toast({
        title: "Erro de validação",
        description: "As senhas não correspondem",
        variant: "destructive",
      })
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      toast({
        title: "Senha fraca",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      await onSignup(name, email, password)
      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu email para confirmar sua conta",
      })
    } catch (err) {
      setError("Erro ao criar conta. Tente novamente.")
      toast({
        title: "Erro ao criar conta",
        description: err instanceof Error ? err.message : "Tente novamente mais tarde",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const passwordStrength = getPasswordStrength(password)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={onBackClick}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar
        </button>

        <Card className="p-8 border border-border shadow-lg">
          <div className="mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mb-4 shadow-lg">
              <span className="text-primary-foreground font-bold text-lg">V</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Criar Conta</h1>
            <p className="text-muted-foreground">Comece a usar o gestor de serviços ViraWeb agora</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10"
                />
              </div>
              {password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${passwordStrength.strength <= 1
                        ? "bg-destructive w-1/3"
                        : passwordStrength.strength === 2
                          ? "bg-yellow-500 w-2/3"
                          : "bg-accent w-full"
                        }`}
                    />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{passwordStrength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-10"
                />
              </div>
              {confirmPassword && (
                <div className="mt-2 flex items-center gap-2">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                      <span className="text-xs text-accent">Senhas correspondem</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="text-xs text-destructive">Senhas não correspondem</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Criando conta...
                </>
              ) : (
                "Criar Conta"
              )}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-center">
            <div className="w-full max-w-xs">
              <GoogleButton
                onClick={onGoogleSignIn}
                variant="signup"
                isLoading={isLoading}
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Já tem conta?{" "}
              <button
                onClick={onLoginClick}
                className="text-primary hover:text-primary/80 font-semibold transition-colors cursor-pointer"
              >
                Faça login
              </button>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Ao se cadastrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  )
}
