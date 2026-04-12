"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { GoogleButton } from "@/components/ui/google-button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Mail, Lock, AlertCircle, Loader2 } from "lucide-react"

interface LoginPageProps {
  onLogin: (email: string, password: string) => void
  onSignupClick: () => void
  onBackClick: () => void
  onForgotPassword?: () => void
  onGoogleSignIn?: () => void
}

export default function LoginPage({ onLogin, onSignupClick, onBackClick, onForgotPassword, onGoogleSignIn }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email || !password) {
      setError("Por favor, preencha todos os campos")
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.")
      toast({
        title: "Erro ao fazer login",
        description: "Verifique suas credenciais e tente novamente",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

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
            <h1 className="text-3xl font-bold text-foreground mb-2">Bem-vindo</h1>
            <p className="text-muted-foreground">Faça login na sua conta ViraWeb</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-4">
            <button
              onClick={() => onForgotPassword && onForgotPassword()}
              className="text-sm text-primary font-semibold cursor-pointer transition-colors"
            >
              Esqueceu a senha?
            </button>

            <div className="w-1/2">
              <GoogleButton
                onClick={onGoogleSignIn}
                variant="signin"
                isLoading={isLoading}
              />
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Não tem conta?{" "}
              <button
                onClick={onSignupClick}
                className="text-primary hover:text-primary/80 font-semibold transition-colors cursor-pointer"
              >
                Cadastre-se
              </button>
            </p>
          </div>

          <div className="mt-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
            <p className="text-xs font-semibold text-accent mb-2">Demo Credentials</p>
            <p className="text-xs text-muted-foreground">
              Email: <span className="font-mono text-foreground">demo@viraweb.com</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Senha: <span className="font-mono text-foreground">demo123</span>
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Seus dados estão seguros e protegidos com criptografia de ponta a ponta.
        </p>
      </div>
    </div>
  )
}
