"use client"

import React, { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return toast({ title: "Informe o email", variant: "destructive" })
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || json?.message || 'Erro')

      toast({ title: 'Email enviado', description: 'Verifique sua caixa de entrada para o link de troca de senha.' })
      setEmail("")
    } catch (err) {
      toast({ title: 'Erro', description: err instanceof Error ? err.message : String(err), variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground">Informe o e-mail da sua conta para receber o link de recuperação.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email</label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
            <Button variant="outline" onClick={() => (window.history.back())}>Voltar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
