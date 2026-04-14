"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Check, X, Calendar, Users, BarChart3, Sparkles, Bell, CreditCard, ArrowLeft } from "lucide-react"
import { PRODUCTS } from "@/lib/products"
import { useRouter } from "next/navigation"
import { useTranslations } from 'next-intl'
import DemoDashboard from "./demo-dashboard"
import LanguageToggle from "@/components/language-toggle"

export default function DemoPage() {
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "premium" | "master">("premium")
  const router = useRouter()
  const t = useTranslations('demoPage')
  const tTitles = useTranslations('titles')
  const tProducts = useTranslations('products')

  useEffect(() => {
    document.title = tTitles('demo')
  }, [tTitles])

  const featuresRaw = t.raw('featuresList') as any
  const features = (Array.isArray(featuresRaw) ? featuresRaw : Object.values(featuresRaw || {})) as Array<{
    category: string,
    items: Array<{ name: string, basic: any, premium: any, master: any }>
  }>

  const planCards = PRODUCTS.map((product) => ({
    id: product.planType,
    name: tProducts(`${product.planType}.name`),
    price: `R$ ${(product.priceInCents / 100).toFixed(0)}`,
    period: product.billingCycle === "monthly" ? "/mês" : "único",
    description: tProducts(`${product.planType}.description`),
    highlighted: product.planType === "premium",
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <a href="/">
            <Button
              variant="ghost"
              className="gap-2 cursor-pointer hover:scale-105 active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('back')}
            </Button>
          </a>
          <LanguageToggle variant="compact" />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('title')}</h1>
          <p className="text-lg text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        <Tabs defaultValue="comparison" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="comparison">{t('tabs.comparison')}</TabsTrigger>
            <TabsTrigger value="features">{t('tabs.features')}</TabsTrigger>
            <TabsTrigger value="demo">{t('tabs.demo')}</TabsTrigger>
          </TabsList>

          <TabsContent value="comparison">
            <div className="grid md:grid-cols-3 gap-6">
              {planCards.map((plan) => (
                <Card
                  key={plan.id}
                  className={`p-6 border-2 cursor-pointer transition-all ${selectedPlan === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    } ${plan.highlighted ? "md:scale-105 shadow-xl" : ""}`}
                  onClick={() => setSelectedPlan(plan.id as any)}
                >
                  {plan.highlighted && (
                    <div className="mb-4 inline-block bg-accent text-accent-foreground px-3 py-1 rounded-full text-sm font-semibold">
                      {t('popular')}
                    </div>
                  )}
                  <h2 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h2>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground ml-2">{plan.period}</span>
                  </div>
                  <Button
                    className={`w-full ${selectedPlan === plan.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-muted/80"
                      }`}
                  >
                    {selectedPlan === plan.id ? t('selected') : t('select')}
                  </Button>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="features">
            <Card className="p-8">
              <div className="overflow-x-auto">
                {features.map((category, catIdx) => (
                  <div key={catIdx} className="mb-8 last:mb-0">
                    <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                      {category.category === "Gerenciamento" && <Users className="w-5 h-5 text-primary" />}
                      {category.category === "Relatórios e Análises" && <BarChart3 className="w-5 h-5 text-primary" />}
                      {category.category === "Recursos Avançados" && <Sparkles className="w-5 h-5 text-primary" />}
                      {category.category === "Suporte" && <Bell className="w-5 h-5 text-primary" />}
                      {category.category}
                    </h2>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 font-semibold text-foreground">{t('feature')}</th>
                          <th className="text-center py-3 px-4 font-semibold text-foreground">{t('basic')}</th>
                          <th className="text-center py-3 px-4 font-semibold text-foreground">{t('premium')}</th>
                          <th className="text-center py-3 px-4 font-semibold text-foreground">{t('master')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(category.items) ? category.items : Object.values(category.items || {})).map((feature: any, idx: number) => (
                          <tr key={idx} className="border-b border-border hover:bg-muted/50">
                            <td className="py-3 px-4 text-foreground">{feature.name}</td>
                            <td className="text-center py-3 px-4">
                              {typeof feature.basic === "boolean" ? (
                                feature.basic ? (
                                  <Check className="w-5 h-5 text-accent mx-auto" />
                                ) : (
                                  <X className="w-5 h-5 text-muted-foreground mx-auto" />
                                )
                              ) : (
                                <span className="text-sm text-foreground">{feature.basic}</span>
                              )}
                            </td>
                            <td className="text-center py-3 px-4">
                              {typeof feature.premium === "boolean" ? (
                                feature.premium ? (
                                  <Check className="w-5 h-5 text-accent mx-auto" />
                                ) : (
                                  <X className="w-5 h-5 text-muted-foreground mx-auto" />
                                )
                              ) : (
                                <span className="text-sm text-foreground">{feature.premium}</span>
                              )}
                            </td>
                            <td className="text-center py-3 px-4">
                              {typeof feature.master === "boolean" ? (
                                feature.master ? (
                                  <Check className="w-5 h-5 text-accent mx-auto" />
                                ) : (
                                  <X className="w-5 h-5 text-muted-foreground mx-auto" />
                                )
                              ) : (
                                <span className="text-sm text-foreground">{feature.master}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="demo">
            <div className="mt-8 animate-in fade-in zoom-in duration-500">
              <DemoDashboard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
