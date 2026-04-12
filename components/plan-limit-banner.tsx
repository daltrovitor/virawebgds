"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, TrendingUp } from "lucide-react"
import { getUserSubscription } from "@/app/actions/subscription"
import { PLAN_LIMITS, type PlanType } from "@/lib/plan-limits"
import { useTranslations } from "next-intl"

interface PlanLimitBannerProps {
  currentCount: number
  limitType: "patients" | "professionals" | "appointmentsPerMonth"
  onUpgrade?: () => void
}

export default function PlanLimitBanner({ currentCount, limitType, onUpgrade }: PlanLimitBannerProps) {
  const [planType, setPlanType] = useState<PlanType | null>(null)
  const [loading, setLoading] = useState(true)
  const tUpgrade = useTranslations("upgradeModal")
  const tUsage = useTranslations("dashboard.usage")

  useEffect(() => {
    const loadPlan = async () => {
      try {
        const subscription = await getUserSubscription()
        setPlanType(subscription?.plan_type || null)
      } catch (error) {
        console.error("Error loading subscription:", error)
      } finally {
        setLoading(false)
      }
    }
    loadPlan()
  }, [])

  if (loading || !planType) return null

  const limit = PLAN_LIMITS[planType][limitType]
  if (limit === "unlimited") return null

  const limitNumber = limit as number
  const percentage = (currentCount / limitNumber) * 100
  const isNearLimit = percentage >= 80
  const isAtLimit = currentCount >= limitNumber

  if (!isNearLimit) return null

  const labels = {
    patients: tUsage("patients"),
    professionals: tUsage("professionals"),
    appointmentsPerMonth: tUsage("appointments"),
  }

  return (
    <Card className={`p-4 border-2 ${isAtLimit ? "border-red-500 bg-red-50" : "border-yellow-500 bg-yellow-50"}`}>
      <div className="flex items-start gap-4">
        <div className={`p-2 rounded-lg ${isAtLimit ? "bg-red-500" : "bg-yellow-500"}`}>
          <AlertTriangle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-foreground mb-2">{isAtLimit ? tUpgrade("limitReached") : tUpgrade("limitNear")}</h4>
          <p className="text-sm text-muted-foreground mb-3">
            {tUpgrade("usingCount", {
              current: currentCount,
              limit: limitNumber,
              type: labels[limitType].toLowerCase()
            })}
          </p>
          <Progress value={percentage} className="mb-3" />
          {onUpgrade && (
            <Button onClick={onUpgrade} size="sm" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              {tUpgrade("upgrade")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
