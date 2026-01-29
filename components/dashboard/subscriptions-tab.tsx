"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { CreditCard, Calendar, CheckCircle2, X, Zap, AlertCircle, Loader2 } from "lucide-react"
import { updateSubscriptionStatus } from "@/app/actions/subscription"
import { PLAN_LIMITS } from "@/lib/plan-limits"
import UsageDashboard from "@/components/usage-dashboard"
import { useUpgradePlan } from "@/hooks/use-upgrade-plan"
import { createClient } from "@/lib/supabase-client"
import { useTranslations } from "next-intl"

interface Subscription {
  id: string
  plan_name: "basic" | "premium" | "master" | string
  plan_type: "basic" | "premium" | "master" | string
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
}

interface SubscriptionsTabProps {
  subscription?: Subscription
  userId?: string
}

export default function SubscriptionsTab({ subscription: initialSubscription, userId }: SubscriptionsTabProps) {
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | undefined>(initialSubscription)
  const { toast } = useToast()
  const { upgradePlan, isUpgrading } = useUpgradePlan()
  const supabase = createClient()
  const t = useTranslations("dashboard.subscriptions")
  const tCommon = useTranslations("common")

  useEffect(() => {
    if (!userId) return

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
          console.log(" Subscription updated via realtime:", payload)

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

  console.log(" Subscription data received:", subscription)
  console.log(" Subscription plan_name:", subscription?.plan_name)
  console.log(" Subscription plan_type:", subscription?.plan_type)
  console.log(" Subscription status:", subscription?.status)
  console.log(" ViraBot enabled:", subscription?.virabot_enabled)

  if (!subscription) {
    console.log(" No subscription found")
    return (
      <Card className="p-8 text-center border border-border">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-bold text-foreground mb-2">{t("noSubscription")}</h3>
        <p className="text-muted-foreground mb-4">{t("noSubscriptionDesc")}</p>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">{t("choosePlan")}</Button>
      </Card>
    )
  }

  const normalizedPlanType = (subscription.plan_name || subscription.plan_type)?.toLowerCase() as
    | "basic"
    | "premium"
    | "master"
  console.log(" Normalized plan type:", normalizedPlanType)

  const planInfo = PLAN_LIMITS[normalizedPlanType]
  console.log(" Plan info found:", planInfo)

  const tUsage = useTranslations("dashboard.usage")
  const tSupport = useTranslations("dashboard.support")

  if (!planInfo) {
    console.log(" Invalid plan type - not found in PLAN_LIMITS")
    return (
      <Card className="p-8 text-center border border-border">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-bold text-destructive mb-2">{t("invalidPlan")}</h3>
        <p className="text-muted-foreground mb-2">
          {t("invalidPlanDesc")}{" "}
          <strong>{subscription.plan_name || subscription.plan_type}</strong>
        </p>
        <p className="text-xs text-muted-foreground">{t("validPlans")}</p>
      </Card>
    )
  }

  const handleCancelSubscription = async () => {
    setIsLoading(true)
    try {
      await updateSubscriptionStatus(subscription.id, "canceled")

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

  const getPlanName = (planType: string) => {
    const names = {
      basic: tCommon("plans.basic"),
      premium: tCommon("plans.premium"),
      master: tCommon("plans.master"),
    }
    return names[planType as keyof typeof names] || planType
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="cursor-pointer">
        <h2 className="text-3xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground italic mt-1">{t("viewCurrent")}</p>
      </div>

      {/* Current Subscription */}
      <Card className="p-6 border border-border bg-gradient-to-br from-primary/5 to-secondary/5 cursor-pointer hover:shadow-lg transition-shadow">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-2xl font-bold text-foreground mb-2">{getPlanName(normalizedPlanType)}</h3>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold border flex items-center gap-2 ${getStatusColor(subscription.status)}`}
              >
                {getStatusIcon(subscription.status)}
                {subscription.status === "active" && t("active")}
                {subscription.status === "canceled" && t("canceled")}
                {subscription.status === "expired" && t("expired")}
              </span>
              {subscription.virabot_enabled && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold border bg-purple-100 text-purple-700 border-purple-200 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  ViraBot AI
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-foreground">R${planInfo.price.toFixed(2)}</p>
            <p className="text-muted-foreground">/{t("month")}</p>
          </div>
        </div>

        {/* Subscription Details */}
        <div className="grid sm:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t("startDate")}</p>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {subscription.current_period_start
                ? new Date(subscription.current_period_start).toLocaleDateString()
                : t("notConfigured")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t("nextBilling")}</p>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {subscription.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground mb-1">{t("paymentMethod")}</p>
            <p className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              {subscription.stripe_customer_id ? t("creditCard") : t("notConfigured")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {subscription.status === "active" && (
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
      {subscription && <UsageDashboard planType={normalizedPlanType} />}

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
