"use client"

import { Smartphone, Chrome, Menu, Plus, DownloadCloud, Home, Bell, Wifi } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"

export default function PWATutorialPage() {
  const t = useTranslations("pwa")
  const router = useRouter()

  const androidSteps = [
    {
      number: 1,
      titleKey: "android.step1.title",
      descKey: "android.step1.desc",
      icon: Chrome,
    },
    {
      number: 2,
      titleKey: "android.step2.title",
      descKey: "android.step2.desc",
      icon: null, // URL input
    },
    {
      number: 3,
      titleKey: "android.step3.title",
      descKey: "android.step3.desc",
      icon: Menu,
    },
    {
      number: 4,
      titleKey: "android.step4.title",
      descKey: "android.step4.desc",
      icon: Plus,
    },
    {
      number: 5,
      titleKey: "android.step5.title",
      descKey: "android.step5.desc",
      icon: Home,
    },
  ]

  const benefits = [
    { titleKey: "benefits.offline.title", descKey: "benefits.offline.desc", icon: Wifi },
    { titleKey: "benefits.push.title", descKey: "benefits.push.desc", icon: Bell },
    { titleKey: "benefits.fast.title", descKey: "benefits.fast.desc", icon: DownloadCloud },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-slate-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white mb-6 flex items-center gap-2"
          >
            ← {t("back")}
          </button>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t("title")}</h1>
          <p className="text-slate-300 text-lg max-w-2xl">{t("subtitle")}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Steps Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">{t("android.title")}</h2>
              <p className="text-slate-600 mb-12">{t("android.subtitle")}</p>

              <div className="space-y-8">
                {androidSteps.map((step) => {
                  const Icon = step.icon
                  return (
                    <div key={step.number} className="flex gap-6 pb-8 border-b border-slate-200 last:border-b-0">
                      {/* Step Number */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                          {step.number}
                        </div>
                      </div>

                      {/* Step Content */}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                          {t(step.titleKey)}
                        </h3>
                        <p className="text-slate-600 text-lg leading-relaxed mb-4">
                          {t(step.descKey)}
                        </p>

                        {/* Icon Visual */}
                        {Icon && (
                          <div className="inline-block p-4 bg-blue-50 rounded-lg">
                            <Icon className="w-8 h-8 text-blue-600" />
                          </div>
                        )}

                        {/* Special case for step 2 - URL display */}
                        {step.number === 2 && (
                          <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-300 font-mono text-sm text-slate-700">
                            gdc.viraweb.online
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Important Note */}
              <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-semibold mb-2">{t("important.title")}</p>
                <p className="text-yellow-700 text-sm leading-relaxed">
                  {t("important.description")}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar - Benefits & Info */}
          <div className="space-y-6">
            {/* Benefits Card */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg shadow-lg p-8">
              <h3 className="text-2xl font-bold mb-6">{t("benefits.title")}</h3>
              <div className="space-y-4">
                {benefits.map((benefit, i) => {
                  const Icon = benefit.icon
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex-shrink-0 pt-1">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">{t(benefit.titleKey)}</p>
                        <p className="text-blue-100 text-sm">{t(benefit.descKey)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* What is PWA Card */}
            <div className="bg-slate-100 rounded-lg p-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4">{t("whatIsPWA.title")}</h3>
              <p className="text-slate-700 text-sm leading-relaxed mb-4">
                {t("whatIsPWA.description")}
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  {t("whatIsPWA.point1")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  {t("whatIsPWA.point2")}
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  {t("whatIsPWA.point3")}
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold gap-2"
            >
              <Home className="w-5 h-5" />
              {t("backToDashboard")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
