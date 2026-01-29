"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  getUserSettings,
  updateUserProfile,
  updateClinicInfo,
  updateEmail,
  updatePassword,
} from "@/app/actions/settings"
import { getCurrentPlan, getUserSubscription } from "@/app/actions/subscription"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PLAN_LIMITS } from "@/lib/plan-limits"
import UsageDashboard from "@/components/usage-dashboard"
import { createClient } from "@/lib/supabase-client"
import { useTranslations } from "next-intl"

export default function SettingsTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [email, setEmail] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [currentPlan, setCurrentPlan] = useState<"basic" | "premium" | "master">("basic")
  const [viraBotEnabled, setViraBotEnabled] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const t = useTranslations("dashboard.settings")
  const tCommon = useTranslations("common")

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel("settings-subscription-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
        },
        async () => {
          console.log(" Subscription changed, reloading settings...")
          await loadSettings()
          toast({
            title: t("toast.settingsUpdated"),
            description: t("toast.updatedAuto"),
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, toast])

  const loadSettings = async () => {
    try {
      const [settings, plan, subscription] = await Promise.all([
        getUserSettings(),
        getCurrentPlan(),
        getUserSubscription(),
      ])

      console.log(" Settings loaded:", settings)
      console.log(" Current plan loaded:", plan)
      console.log(" Subscription loaded:", subscription)

      if (settings) {
        setFullName(settings.full_name || "")
        setPhone(settings.phone || "")
        setClinicName(settings.clinic_name || "")
        setEmail(settings.email)
      }

      setCurrentPlan(plan)
      setViraBotEnabled(subscription?.virabot_enabled || false)
    } catch (error) {
      console.log(" Error loading settings:", error)
      toast({
        title: t("toast.loadError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    setSaving(true)
    try {
      await updateUserProfile({ full_name: fullName, phone })
      toast({
        title: t("toast.profileUpdated"),
        description: t("toast.profileUpdatedDesc"),
      })
    } catch (error) {
      toast({
        title: t("toast.profileError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateClinic = async () => {
    setSaving(true)
    try {
      await updateClinicInfo({ clinic_name: clinicName })
      toast({
        title: t("toast.clinicUpdated"),
        description: t("toast.clinicUpdatedDesc"),
      })
    } catch (error) {
      toast({
        title: t("toast.clinicError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateEmail = async () => {
    if (!newEmail) {
      toast({
        title: t("toast.emailInvalid"),
        description: t("toast.emailInvalidDesc"),
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const result = await updateEmail(newEmail)
      if (result.success) {
        toast({
          title: t("toast.emailUpdated"),
          description: result.message,
        })
        setNewEmail("")
      } else {
        toast({
          title: t("toast.emailError"),
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: t("toast.emailError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: t("password.invalid"),
        description: t("password.length"),
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: t("password.mismatch"),
        description: t("password.confirmCorrect"),
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const result = await updatePassword(newPassword)
      if (result.success) {
        toast({
          title: t("toast.passwordUpdated"),
          description: result.message,
        })
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast({
          title: t("toast.passwordError"),
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: t("toast.passwordError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getPlanBadge = (planType: "basic" | "premium" | "master") => {
    const badges = {
      basic: { label: tCommon("plans.basic"), color: "bg-blue-500 text-white" },
      premium: { label: tCommon("plans.premium"), color: "bg-purple-500 text-white" },
      master: { label: tCommon("plans.master"), color: "bg-green-500 text-white" },
    }

    const planBadge = badges[planType]
    const planInfo = PLAN_LIMITS[planType]

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className={planBadge.color}>{planBadge.label}</Badge>
          {viraBotEnabled && <Badge className="bg-purple-600 text-white">{t("plan.viraBotActive")}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{t("plan.perMonth", { price: planInfo.price.toFixed(2) })}</p>
        <div className="text-sm text-muted-foreground space-y-1 mt-2">
          <p>
            <strong>{t("plan.patients")}</strong> {planInfo.patients === "unlimited" ? t("plan.unlimited") : planInfo.patients}
          </p>
          <p>
            <strong>{t("plan.professionals")}</strong>{" "}
            {planInfo.professionals === "unlimited" ? t("plan.unlimited") : planInfo.professionals}
          </p>
          <p>
            <strong>{t("plan.appointments")}</strong>{" "}
            {planInfo.appointmentsPerMonth === "unlimited" ? t("plan.unlimited") : planInfo.appointmentsPerMonth}
          </p>
          <p>
            <strong>{t("plan.support")}</strong> {planInfo.supportHours}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <UsageDashboard planType={currentPlan} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.title")}</CardTitle>
            <CardDescription>{t("profile.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="full-name" className="text-right">
                {t("profile.name")}
              </Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4 mt-4">
              <Label htmlFor="phone" className="text-right">
                {t("profile.phone")}
              </Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="col-span-3" />
            </div>
            <Button className="mt-4" onClick={handleUpdateProfile} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("clinic.title")}</CardTitle>
            <CardDescription>{t("clinic.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clinic-name" className="text-right">
                {t("clinic.name")}
              </Label>
              <Input
                id="clinic-name"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <Button className="mt-4" onClick={handleUpdateClinic} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("email.title")}</CardTitle>
            <CardDescription>{t("email.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-email" className="text-right">
                {t("email.new")}
              </Label>
              <Input
                id="new-email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="col-span-3"
              />
            </div>
            <Button className="mt-4" onClick={handleUpdateEmail} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("password.title")}</CardTitle>
            <CardDescription>{t("password.desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">
                {t("password.new")}
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4 mt-4">
              <Label htmlFor="confirm-password" className="text-right">
                {t("password.confirm")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="col-span-3"
              />
            </div>
            <Button className="mt-4" onClick={handleUpdatePassword} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("plan.title")}</CardTitle>
            <CardDescription>{t("plan.desc")}</CardDescription>
          </CardHeader>
          <CardContent>{getPlanBadge(currentPlan)}</CardContent>
        </Card>
      </div>
    </div>
  )
}
