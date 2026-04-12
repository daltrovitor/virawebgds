'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function EmailInputPage() {
  const [email, setEmail] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      const searchParams = new URLSearchParams()
      searchParams.set('email', email)
      router.push(`/forgot-password?${searchParams.toString()}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className=" w-20 flex items-center justify-center mb-4">
           <Image width={214} height={191} alt='' className='' src="/viraweb6.png" />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo</h1>
          <p className="text-gray-600 text-center mt-2">
            Insira seu email para redefinir sua senha
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors"
          >
            Continuar
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
}
