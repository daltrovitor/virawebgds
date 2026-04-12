"use client"

const isDev = process.env.NODE_ENV === 'development'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { CreditCard, Calendar, CheckCircle2, X, Zap, AlertCircle, Loader2, Sparkles } from "lucide-react"
import { updateSubscriptionStatus } from "@/app/actions/subscription"
import { PLAN_LIMITS, type PlanType } from "@/lib/plan-limits"
import UsageDashboard from "@/components/usage-dashboard"
import { useUpgradePlan } from "@/hooks/use-upgrade-plan"
import { createClient } from "@/lib/supabase-client"
import { useTranslations } from "next-intl"

interface Subscription {
  id: string
  plan_name: "basic" | "premium" | "master" | "free" | string
  plan_type: "basic" | "premium" | "master" | "free" | string
  status: "active" | "canceled" | "expired"
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  max_patients: number | null
  max_professionals: number | null
  max_appointments_per_month: number | null
  virabot_enabled: boolean
  created_at: string
  updated_at: string
  user_plan?: string
}

interface SubscriptionsTabProps {
  subscription?: Subscription
  userId?: string
  isDemo?: boolean
}

export default function SubscriptionsTab({ subscription: initialSubscription, userId, isDemo = false }: SubscriptionsTabProps) {
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | undefined>(initialSubscription)
  const { toast } = useToast()
  const { upgradePlan, isUpgrading } = useUpgradePlan()
  const supabase = createClient()
  const t = useTranslations("dashboard.subscriptions")
  const tCommon = useTranslations("common")

  useEffect(() => {
    if (isDemo || !userId) return

    const channel = supabase
      .channel("subscription-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        async (payload: any) => {
          const { data } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .single()

          if (data) {
            data.plan_type = data.plan_name || data.plan_type
            setSubscription(data as Subscription)

            if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
              toast({
                title: t("toast.updated"),
                description: t("toast.updatedDesc", { plan: data.plan_name }),
              })
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, toast])


  if (!subscription && !isDemo) {
    return (
      <Card className="p-8 text-center border border-border">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-2">{t("noSubscription")}</h3>
        <p className="text-muted-foreground mb-4">{t("noSubscriptionDesc")}</p>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">{t("choosePlan")}</Button>
      </Card>
    )
  }

  const demoSubscription: Subscription = {
    id: "demo-id",
    plan_name: "premium",
    plan_type: "premium",
    status: "active",
    stripe_subscription_id: "demo_stripe",
    stripe_customer_id: "demo_customer",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: false,
    max_patients: 100,
    max_professionals: 5,
    max_appointments_per_month: 200,
    virabot_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const activeSubscription = isDemo ? demoSubscription : subscription!
  
  // Normalize subscription for consistent UI
  const isCurrentlyTrial = 
    (activeSubscription.plan_name || "").toLowerCase().includes("free") || 
    (activeSubscription.plan_name || "").toLowerCase().includes("trial") ||
    (activeSubscription.user_plan || "").toLowerCase().includes("free") ||
    (activeSubscription.user_plan || "").toLowerCase().includes("trial") ||
    (typeof window !== 'undefined' && document.cookie.includes('vwd_is_trial=true'))

  // Enforce 14-day period for trial/free plans in UI
  const effectiveSubscription = {
    ...activeSubscription,
    current_period_end: isCurrentlyTrial && activeSubscription.current_period_start
      ? new Date(new Date(activeSubscription.current_period_start).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : activeSubscription.current_period_end
  }

  const lowerPlan = `${effectiveSubscription.plan_name || ""} ${effectiveSubscription.user_plan || ""} ${effectiveSubscription.plan_type || ""}`.toLowerCase()
  const originalPlanName = (effectiveSubscription.plan_name || effectiveSubscription.user_plan || effectiveSubscription.plan_type || "").toLowerCase()
  
  let normalizedPlanType: PlanType = "basic"
  if (lowerPlan.includes("free") || lowerPlan.includes("trial")) normalizedPlanType = "free"
  else if (lowerPlan.includes("master")) normalizedPlanType = "master"
  else if (lowerPlan.includes("premium")) normalizedPlanType = "premium"
  else if (lowerPlan.includes("basic")) normalizedPlanType = "basic"

  const planInfo = PLAN_LIMITS[normalizedPlanType]

  const tUsage = useTranslations("dashboard.usage")
  const tSupport = useTranslations("dashboard.support")

  if (!planInfo) {
    return (
      <Card className="p-8 text-center border border-border">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-bold text-destructive mb-2">{t("invalidPlan")}</h3>
        <p className="text-muted-foreground mb-2">
          {t("invalidPlanDesc")}{" "}
          <strong>{effectiveSubscription.plan_name || effectiveSubscription.plan_type}</strong>
        </p>
        <p className="text-xs text-muted-foreground">{t("validPlans")}</p>
      </Card>
    )
  }

  const handleCancelSubscription = async () => {
    if (isDemo) {
      toast({ title: t("toast.canceled"), description: t("toast.canceledDesc") })
      return
    }
    setIsLoading(true)
    try {
      await updateSubscriptionStatus(effectiveSubscription.id, "canceled")

      toast({
        title: t("toast.canceled"),
        description: t("toast.canceledDesc"),
      })

      setShowCancelForm(false)
      window.location.reload()
    } catch (error) {
      toast({
        title: t("toast.cancelError"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpgrade = async (planType: "premium" | "master") => {
    try {
      await upgradePlan(planType)
    } catch (error) {
      console.error(" Upgrade failed:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-700 border-green-200"
      case "canceled":
        return "bg-red-100 text-red-700 border-red-200"
      case "expired":
        return "bg-yellow-100 text-yellow-700 border-yellow-200"
      default:
        return "bg-gray-100 text-gray-700 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="w-5 h-5" />
      case "canceled":
        return <X className="w-5 h-5" />
      case "expired":
        return <AlertCircle className="w-5 h-5" />
      default:
        return null
    }
  }

  const isTrial = isCurrentlyTrial

  const getPlanName = (planLabel: string) => {
    const labelLower = planLabel.toLowerCase()
    const isFreeOrTrial = labelLower.includes("free") || labelLower.includes("trial") || 
                         (effectiveSubscription.user_plan?.toLowerCase().includes("free")) ||
                         (effectiveSubscription.user_plan?.toLowerCase().includes("trial")) ||
                         (typeof window !== 'undefined' && document.cookie.includes('vwd_is_trial=true'))
    
    // Prioritize explicit Master level even if it's a trial, checking the full plan context
    const baseType = labelLower.includes("master") ? "master" : 
                    labelLower.includes("premium") ? "premium" : 
                    labelLower.includes("basic") ? "basic" : 
                    isFreeOrTrial ? "premium" : "basic"
    
    const names = {
      basic: tCommon("plans.basic"),
      premium: tCommon("plans.premium"),
      master: tCommon("plans.master"),
    }
    
    const baseName = names[baseType as keyof typeof names] || baseType
    return isFreeOrTrial ? `Free Trial ${baseName}` : baseName
  }

  const daysRemaining = effectiveSubscription.current_period_end 
    ? Math.max(0, Math.ceil((new Date(effectiveSubscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 14;



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="cursor-pointer">
        <h2 className="text-3xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground italic mt-1">{t("viewCurrent")}</p>
      </div>

      {/* Current Subscription */}
      {isTrial && (
        <div className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-900 p-6 mb-8 rounded-2xl flex flex-col md:flex-row items-center gap-6 shadow-sm border-l-4 border-l-amber-500">
          <div className="bg-amber-500 text-white p-4 rounded-2xl shadow-lg flex-shrink-0 animate-pulse">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <p className="text-lg font-black uppercase tracking-widest text-amber-600">Período de Experiência Ativo</p>
              <Badge className="bg-amber-200 text-amber-800 hover:bg-amber-200 border-none font-bold">14 DIAS</Badge>
            </div>
            <p className="text-sm md:text-base font-medium text-amber-800/90 leading-relaxed max-w-2xl">
              Você está aproveitando todos os recursos do plano <b>Premium</b> totalmente grátis. 
              Sua conta retornará ao modo limitado após 14 dias caso não realize o upgrade para um plano pago.
            </p>
          </div>
          <Button 
            onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
            className="w-full md:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold py-6 px-8 rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
          >
            Garantir Acesso Vitalício
          </Button>
        </div>
      )}
      <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-secondary/5 cursor-pointer hover:shadow-lg transition-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-foreground">{getPlanName(lowerPlan)}</h3>
                {isTrial && (
                    <Badge variant="secondary" className="bg-blue-600 text-white border-transparent font-black px-3 py-1">
                        GRÁTIS
                    </Badge>
                )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold border flex items-center gap-2 ${getStatusColor(effectiveSubscription.status)}`}
              >
                {getStatusIcon(effectiveSubscription.status)}
                {effectiveSubscription.status === "active" && t("active")}
                {effectiveSubscription.status === "canceled" && t("canceled")}
                {effectiveSubscription.status === "expired" && t("expired")}
              </span>
              {effectiveSubscription.virabot_enabled && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold border bg-purple-100 text-purple-700 border-purple-200 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  ViraBot AI
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            {isTrial && (
                <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-tighter rounded-lg shadow-sm animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    Plano Temporário
                </div>
            )}
            <p className="text-3xl font-bold text-foreground">
              {planInfo.price === 0 ? "R$ 0,00" : `R$${planInfo.price.toFixed(2)}`}
            </p>
            <p className="text-muted-foreground font-medium">
              {planInfo.price === 0 ? "Totalmente Grátis" : `/${t("month")}`}
            </p>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t("startDate")}</p>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {effectiveSubscription.current_period_start
                ? new Date(effectiveSubscription.current_period_start).toLocaleDateString()
                : t("notConfigured")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">{isTrial ? t("trialEnd") : t("nextBilling")}</p>
            <div className="space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {effectiveSubscription.current_period_end ? (
                    new Date(effectiveSubscription.current_period_end).toLocaleDateString()
                ) : isTrial && effectiveSubscription.current_period_start ? (
                    new Date(new Date(effectiveSubscription.current_period_start).getTime() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString()
                ) : (
                    "N/A"
                )}
                </p>
                {isTrial && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 animate-pulse" />
                        {t("expiresInDays", { days: daysRemaining })}
                    </p>
                )}
            </div>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground mb-1">{t("paymentMethod")}</p>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {effectiveSubscription.stripe_customer_id ? t("creditCard") : t("notConfigured")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {effectiveSubscription.status === "active" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setShowCancelForm(!showCancelForm)}
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive"
            >
              {t("cancelSubscription")}
            </Button>
          </div>
        )}
      </Card>

      {/* Cancel Form */}
      {showCancelForm && (
        <Card className="p-6 border border-destructive bg-destructive/5 cursor-pointer">
          <h3 className="text-lg font-bold text-destructive mb-4">{t("cancelConfirm")}</h3>
          <p className="text-muted-foreground mb-4">
            {t("cancelConfirmDesc")}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleCancelSubscription}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("canceling")}
                </>
              ) : (
                t("yesCancel")
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowCancelForm(false)}>
              {t("noKeep")}
            </Button>
          </div>
        </Card>
      )}

      {/* Usage Dashboard */}
      {effectiveSubscription && <UsageDashboard planType={normalizedPlanType} showUpgrade={false} />}

      {/* Benefits Section */}
      <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-secondary/5 cursor-pointer hover:shadow-lg transition-shadow">
        <h3 className="text-lg font-bold text-foreground mb-4">{t("benefits")}</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <li className="flex items-center gap-2 list-none">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-foreground"><b>{tUsage("patients")}:</b> {planInfo.patients === "unlimited" ? t("unlimited") : planInfo.patients}</span>
          </li>
          <li className="flex items-center gap-2 list-none">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-foreground"><b>{tUsage("professionals")}:</b> {planInfo.professionals === "unlimited" ? t("unlimited") : planInfo.professionals}</span>
          </li>
          <li className="flex items-center gap-2 list-none">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-foreground"><b>{tUsage("appointments")}:</b> {planInfo.appointmentsPerMonth === "unlimited" ? t("unlimited") : planInfo.appointmentsPerMonth} {t("perMonth")}</span>
          </li>
          {planInfo.viraBotEnabled && (
            <li className="flex items-center gap-2 list-none">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <span className="text-foreground"><b>{tSupport("viraBotAI")}:</b> {t("unlimited")}</span>
            </li>
          )}
          <li className="flex items-center gap-2 list-none">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <span className="text-foreground"><b>{tSupport("title")}:</b> {normalizedPlanType === "master" ? t("support247") : planInfo.supportHours}</span>
          </li>
        </div>
      </Card>

      {/* Upgrade Options */}
      {normalizedPlanType !== "master" && (
        <div className="cursor-pointer">
          <h3 className="text-lg font-bold text-foreground mb-4">{t("upgrade")}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {normalizedPlanType !== "premium" && (
              <Card className="p-6 border border-border hover:border-primary transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-foreground mb-2">Premium</h4>
                    <p className="text-2xl font-bold text-foreground">R${PLAN_LIMITS.premium.price.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">/mês</p>
                  </div>
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <Button
                  onClick={() => handleUpgrade("premium")}
                  disabled={isUpgrading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isUpgrading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("processing")}
                    </>
                  ) : (
                    t("upgrade")
                  )}
                </Button>
              </Card>
            )}
            <Card className="p-6 border border-border hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-bold text-foreground mb-2">Master</h4>
                  <p className="text-2xl font-bold text-foreground">R${PLAN_LIMITS.master.price.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <Button
                onClick={() => handleUpgrade("master")}
                disabled={isUpgrading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isUpgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("processing")}
                  </>
                ) : (
                  t("upgrade")
                )}
              </Button>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
