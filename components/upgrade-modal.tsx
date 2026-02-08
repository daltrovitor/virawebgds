"use client"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Zap, X, Loader2, Tag } from "lucide-react"
import { PLAN_LIMITS, type PlanType } from "@/lib/plan-limits"
import { useUpgradePlan } from "@/hooks/use-upgrade-plan"
import { useTranslations } from "next-intl"

interface UpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan: PlanType
  limitType: "patients" | "professionals" | "appointmentsPerMonth"
  currentCount: number
}

export default function UpgradeModal({ isOpen, onClose, currentPlan, limitType, currentCount }: UpgradeModalProps) {
  const { upgradePlan, isUpgrading } = useUpgradePlan()
  const [couponCode, setCouponCode] = useState("")
  const t = useTranslations("upgradeModal")
  const tUsage = useTranslations("dashboard.usage")
  const tCommon = useTranslations("common")

  const limitNames = {
    patients: tUsage("patients"),
    professionals: tUsage("professionals"),
    appointmentsPerMonth: tUsage("appointments"),
  }

  const currentLimit = PLAN_LIMITS[currentPlan][limitType]

  const availablePlans: PlanType[] =
    currentPlan === "basic" ? ["premium", "master"] : currentPlan === "premium" ? ["master"] : []

  const handleUpgrade = async (planType: PlanType) => {
    try {
      await upgradePlan(planType, couponCode.trim() || undefined)
      onClose()
    } catch (error) {
      console.error(" Upgrade failed:", error)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-base">
            {t("description", {
              limit: currentLimit === "unlimited" ? "∞" : currentLimit,
              type: limitNames[limitType].toLowerCase(),
              plan: tCommon(`plans.${currentPlan}`),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground mb-1">{t("currentUsage")}</p>
            <p className="text-2xl font-bold text-foreground">
              {currentCount} / {currentLimit === "unlimited" ? "∞" : currentLimit}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("upgradeToContinue", { type: limitNames[limitType].toLowerCase() })}
            </p>
          </div>

          {/* Coupon Code Field */}
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg mb-6 border border-primary/20">
            <Label htmlFor="coupon" className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Tag className="w-4 h-4 text-primary" />
              {t("couponCode") || "Código de cupom"}
            </Label>
            <Input
              id="coupon"
              type="text"
              placeholder={t("couponPlaceholder") || "Digite seu código de desconto"}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="bg-background"
              disabled={isUpgrading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {t("couponHint") || "Se você tem um cupom de desconto, insira-o aqui antes de escolher o plano."}
            </p>
          </div>

          {availablePlans.length > 0 ? (
            <>
              <h3 className="font-bold text-lg mb-4">{t("choosePlan")}</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {availablePlans.map((planType) => {
                  const plan = PLAN_LIMITS[planType]
                  const newLimit = plan[limitType]

                  return (
                    <Card
                      key={planType}
                      className="p-6 border-2 hover:border-primary transition-colors cursor-pointer"
                      onClick={() => !isUpgrading && handleUpgrade(planType)}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-xl mb-1">
                            {tCommon(`plans.${planType}`)}
                          </h4>
                          <p className="text-3xl font-bold text-primary">R${plan.price.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">{t("perMonth")}</p>
                        </div>
                        <Zap className="w-6 h-6 text-primary" />
                      </div>

                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          {newLimit === "unlimited"
                            ? t("unlimited")
                            : t("upTo", { count: newLimit })}{" "}
                          {limitNames[limitType]}
                        </p>
                      </div>

                      <div className="space-y-2 mb-4">
                        {plan.features.slice(0, 4).map((feature, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground">{feature}</p>
                          </div>
                        ))}
                      </div>

                      <Button className="w-full" disabled={isUpgrading}>
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
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="font-bold text-xl mb-2">{t("alreadyMaster")}</h3>
              <p className="text-muted-foreground">
                {t("alreadyMasterDesc")}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpgrading}>
            <X className="w-4 h-4 mr-2" />
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
