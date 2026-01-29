"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, MessageSquare, Brain, Zap, ArrowRight, Lock, Loader2 } from "lucide-react"
import AIAssistant from "@/components/ai-assistant"
import { hasViraBotAccess } from "@/lib/plan-limits"
import { getCurrentPlan } from "@/app/actions/subscription"
import { useTranslations } from "next-intl"

interface AISectionProps {
  planType: "basic" | "premium" | "master"
}

export default function AISection({ planType }: AISectionProps) {
  const [showAssistant, setShowAssistant] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const t = useTranslations('dashboard.ai')

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const plan = await getCurrentPlan()
        setHasAccess(hasViraBotAccess(plan))
      } catch (error) {
        console.error("Error checking ViraBot access:", error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }
    checkAccess()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (showAssistant && hasAccess) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setShowAssistant(false)} className="mb-4">
          ← {t('back')}
        </Button>
        <AIAssistant hasAccess={hasAccess} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        {/* Animated background elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="relative z-10 p-8 sm:p-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">{t('title')}</h2>
              <p className="text-sm text-gray-400">{t('subtitle')}</p>
            </div>
          </div>

          <p className="text-lg text-gray-300 mb-8 max-w-2xl leading-relaxed">
            {t('description')}
          </p>

          {hasAccess ? (
            <Button
              onClick={() => setShowAssistant(true)}
              size="lg"
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl transition-all group"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              {t('startChat')}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          ) : (
            <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <Lock className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white mb-1">{t('premiumFeature')}</p>
                <p className="text-sm text-gray-400 mb-3">
                  {t('premiumDesc')}
                </p>
                <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                  {t('viewPlans')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Features Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-6 border border-border hover:border-primary/50 transition-all cursor-pointer group bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
            <Brain className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
          </div>
          <h3 className="font-bold text-foreground mb-2">{t('features.analysis.title')}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('features.analysis.desc')}
          </p>
        </Card>

        <Card className="p-6 border border-border hover:border-primary/50 transition-all cursor-pointer group bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
          <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center mb-4 group-hover:bg-secondary group-hover:scale-110 transition-all">
            <MessageSquare className="w-5 h-5 text-secondary group-hover:text-secondary-foreground transition-colors" />
          </div>
          <h3 className="font-bold text-foreground mb-2">{t('features.instant.title')}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('features.instant.desc')}
          </p>
        </Card>

        <Card className="p-6 border border-border hover:border-primary/50 transition-all cursor-pointer group bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
            <Zap className="w-5 h-5 text-primary group-hover:text-white transition-colors" />
          </div>
          <h3 className="font-bold text-foreground mb-2">{t('features.automation.title')}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t('features.automation.desc')}
          </p>
        </Card>
      </div>

      {/* Example Prompts */}
      {hasAccess && (
        <Card className="p-6 border border-border bg-muted/30">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t('prompts.title')}
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              t('prompts.p1'),
              t('prompts.p2'),
              t('prompts.p3'),
              t('prompts.p4'),
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => setShowAssistant(true)}
                className="text-left p-3 rounded-lg bg-background border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm text-foreground"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
