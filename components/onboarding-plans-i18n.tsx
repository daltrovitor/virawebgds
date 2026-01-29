"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Star, Sparkles } from "lucide-react"
import CheckoutButton from "@/components/checkout-button"
import { PRODUCTS } from "@/lib/products"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"

interface OnboardingPlansProps {
    onSelectPlan?: (plan: "basic" | "premium" | "master") => void
    isLoading?: boolean
}

export default function OnboardingPlans({ onSelectPlan, isLoading }: OnboardingPlansProps) {
    const [selectedPlan, setSelectedPlan] = useState<"basic" | "premium" | "master" | null>(null)
    const t = useTranslations('onboarding')
    const tPricing = useTranslations('landing.pricing')

    const tProducts = useTranslations('products')

    const plans = PRODUCTS.map((product) => {
        // Obter features traduzidas
        const featuresObject = tProducts.raw(`${product.planType}.features`) as Record<string, string>;
        const features = Object.values(featuresObject);

        return {
            id: product.planType,
            name: tProducts(`${product.planType}.name`),
            price: `R$ ${(product.priceInCents / 100).toFixed(0)}`,
            period: product.billingCycle === "monthly" ? tPricing('perMonth') : tPricing('oneTime'),
            description: tProducts(`${product.planType}.description`),
            features: features,
            highlighted: product.planType === "premium",
        }
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
            <div className="w-full max-w-6xl">
                {/* Language Toggle */}
                <div className="flex justify-end mb-4">
                    <LanguageToggle variant="compact" />
                </div>

                <div className="text-center mb-12">
                    <div className="inline-block mb-4 px-4 py-2 bg-secondary/20 rounded-full border-2 border-secondary">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2 justify-center">
                            <Sparkles className="w-4 h-4 text-primary" />
                            {t('title')}
                        </p>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">{t('subtitle')}</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        {tPricing('description')}
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`relative p-8 border-2 transition-all duration-300 hover:shadow-2xl ${selectedPlan === plan.id
                                ? "border-primary bg-primary/5 shadow-xl scale-105"
                                : plan.highlighted
                                    ? "border-secondary bg-gradient-to-br from-secondary/10 via-background to-primary/5 md:scale-105 shadow-xl"
                                    : "border-border hover:border-primary bg-card"
                                }`}
                        >
                            {plan.highlighted && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
                                    <Star className="w-4 h-4 fill-current" />
                                    {tPricing('popular')}
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">{plan.description}</p>
                            </div>

                            <div className="mb-8">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold text-primary">{plan.price}</span>
                                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                                </div>
                            </div>

                            <CheckoutButton
                                planType={plan.id as "basic" | "premium" | "master"}
                                className={`w-full mb-8 h-12 text-base font-semibold transition-all ${plan.highlighted
                                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg hover:shadow-xl hover:scale-105"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                                    }`}
                            >
                                {t('selectPlan')} {plan.name}
                            </CheckoutButton>

                            <div className="space-y-4">
                                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                    {tPricing('includedFeatures')}
                                </div>
                                {plan.features.map((feature, idx) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-3 h-3 text-primary" />
                                        </div>
                                        <span className="text-sm text-foreground leading-relaxed">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="mt-8 text-center text-sm text-muted-foreground">
                    <p>{t('securePayment')}</p>
                </div>
            </div>
        </div>
    )
}
