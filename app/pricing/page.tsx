"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, X } from "lucide-react"
import Link from "next/link"

interface Plan {
  id: string
  name: string
  price: number
  period: string
  description: string
  features: { name: string; included: boolean }[]
  highlighted?: boolean
}

const plans: Plan[] = [
  {
    id: "basic",
    name: "Básico",
    price: 74.9,
    period: "mês",
    description: "Perfeito para profissionais solo",
    features: [
      { name: "Até 100 clientes", included: true },
      { name: "Até 5 profissionais", included: true },
      { name: "Agendamentos ilimitados", included: true },
      { name: "Relatórios básicos", included: true },
      { name: "Suporte por email", included: true },
      { name: "API de integração", included: false },
      { name: "Backup automático", included: false },
      { name: "Suporte prioritário", included: false },
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 149.9,
    period: "mês",
    description: "Para empresas em crescimento",
    highlighted: true,
    features: [
      { name: "Até 500 clientes", included: true },
      { name: "Até 20 profissionais", included: true },
      { name: "Agendamentos ilimitados", included: true },
      { name: "Relatórios avançados", included: true },
      { name: "Suporte por email e chat", included: true },
      { name: "API de integração", included: true },
      { name: "Backup automático", included: true },
      { name: "Suporte prioritário", included: false },
    ],
  },
  {
    id: "master",
    name: "Master",
    price: 249.9,
    period: "mês",
    description: "Recursos completos para grandes empresas",
    features: [
      { name: "clientes ilimitados", included: true },
      { name: "Profissionais ilimitados", included: true },
      { name: "Agendamentos ilimitados", included: true },
      { name: "Relatórios avançados", included: true },
      { name: "Suporte por email, chat e telefone", included: true },
      { name: "API de integração", included: true },
      { name: "Backup automático", included: true },
      { name: "Suporte prioritário 24/7", included: true },
    ],
  },
]

export default function PricingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    // Here you would typically redirect to checkout or payment page
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/5">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block mb-6">
            <Button variant="outline" className="gap-2 bg-transparent">
              ← Voltar
            </Button>
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Planos e Preços</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano perfeito para seu negócio. Sem taxas ocultas, cancele quando quiser.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative border-2 transition-all duration-300 hover:shadow-xl ${plan.highlighted
                  ? "border-primary bg-gradient-to-br from-primary/5 to-secondary/5 md:scale-105"
                  : "border-border hover:border-primary/50"
                }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-bold">
                  Mais Popular
                </div>
              )}

              <div className="p-8">
                {/* Plan Header */}
                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">R${plan.price.toFixed(2)}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full mb-8 font-semibold py-6 ${plan.highlighted
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    }`}
                >
                  {selectedPlan === plan.id ? "Selecionado" : "Escolher Plano"}
                </Button>

                {/* Features */}
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground mb-4">O que está incluído:</p>
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${feature.included ? "text-foreground" : "text-muted-foreground line-through"
                          }`}
                      >
                        {feature.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-20">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Perguntas Frequentes</h2>

          <div className="space-y-6">
            <Card className="p-6 border border-border">
              <h3 className="font-bold text-foreground mb-2">Posso mudar de plano depois?</h3>
              <p className="text-muted-foreground">
                Sim! Você pode fazer upgrade ou downgrade do seu plano a qualquer momento. A mudança será refletida na
                próxima cobrança.
              </p>
            </Card>

            <Card className="p-6 border border-border">
              <h3 className="font-bold text-foreground mb-2">Qual é a política de cancelamento?</h3>
              <p className="text-muted-foreground">
                Você pode cancelar sua assinatura a qualquer momento. Não há taxas de cancelamento. Seu acesso
                continuará até o final do período de cobrança.
              </p>
            </Card>

            <Card className="p-6 border border-border">
              <h3 className="font-bold text-foreground mb-2">O plano Master tem recursos ilimitados?</h3>
              <p className="text-muted-foreground">
                Sim! O plano Master oferece clientes e profissionais ilimitados, além de todos os recursos avançados e
                suporte prioritário 24/7.
              </p>
            </Card>



            <Card className="p-6 border border-border">
              <h3 className="font-bold text-foreground mb-2">Como funciona o suporte?</h3>
              <p className="text-muted-foreground">
                Todos os planos incluem suporte por email. Os planos Premium e Master também incluem suporte por chat. O
                plano Master oferece suporte prioritário 24/7.
              </p>
            </Card>
          </div>
        </div>


      </div>
    </div>
  )
}
