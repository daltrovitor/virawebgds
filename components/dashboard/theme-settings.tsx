"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Settings } from "lucide-react"
import { useTranslations } from "next-intl"

const STORAGE_KEY = "vwd:ui-settings"

type Accent = "blue" | "yellow"
type Density = "comfortable" | "compact"

export default function ThemeSettings() {
  const { theme, setTheme } = useTheme()
  const t = useTranslations("dashboard.theme")
  const [open, setOpen] = useState(false)
  const [accent, setAccent] = useState<Accent>("blue")
  const [density, setDensity] = useState<Density>("comfortable")
  const [radius, setRadius] = useState<string>("0.75rem")

  useEffect(() => {
    // load saved settings
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.accent) setAccent(parsed.accent)
        if (parsed.density) setDensity(parsed.density)
        if (parsed.radius) setRadius(parsed.radius)
      }
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    applyAccent(accent)
    applyDensity(density)
    applyRadius(radius)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent, density, radius }))
    } catch (e) { }
  }, [accent, density, radius])

  function applyAccent(a: Accent) {
    const root = document.documentElement
    if (a === "blue") {
      root.style.setProperty("--primary", "#3396d3")
      root.style.setProperty("--accent", "#ffd400")
      root.style.setProperty("--chart-1", "#3396d3")
      root.style.setProperty("--chart-2", "#ffd400")
    } else {
      // yellow primary look
      root.style.setProperty("--primary", "#ffd400")
      root.style.setProperty("--accent", "#3396d3")
      root.style.setProperty("--chart-1", "#ffd400")
      root.style.setProperty("--chart-2", "#3396d3")
    }
  }

  function applyDensity(d: Density) {
    const root = document.documentElement
    root.dataset.density = d
    if (d === "compact") {
      root.style.setProperty("--radius", "0.25rem")
    } else {
      root.style.setProperty("--radius", "0.75rem")
    }
  }

  function applyRadius(r: string) {
    const root = document.documentElement
    root.style.setProperty("--radius", r)
  }

  return (
    <>
      <div className="fixed right-6 bottom-6 z-50">
        <Button onClick={() => setOpen(true)} className="shadow-lg rounded-full px-4 py-3 bg-gradient-to-br from-primary to-secondary text-white flex items-center gap-2">
          <Settings className="w-4 h-4" />
          {t("button")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t("mode")}</p>
              <Select value={theme || "system"} onValueChange={(v) => setTheme(v === "system" ? "light" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("light")}</SelectItem>
                  <SelectItem value="dark">{t("dark")}</SelectItem>
                  <SelectItem value="system">{t("system")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">{t("accent")}</p>
              <Select value={accent} onValueChange={(v) => setAccent(v as Accent)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">{t("accentBlue")}</SelectItem>
                  <SelectItem value="yellow">{t("accentYellow")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">{t("density")}</p>
              <div className="flex items-center gap-3">
                <Button variant={density === "comfortable" ? undefined : "outline"} onClick={() => setDensity("comfortable")}>{t("comfortable")}</Button>
                <Button variant={density === "compact" ? undefined : "outline"} onClick={() => setDensity("compact")}>{t("compact")}</Button>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">{t("radius")}</p>
              <div className="flex items-center gap-2">
                <input type="range" min="2" max="20" value={parseFloat(radius) * 16} onChange={(e) => setRadius(`${Number(e.target.value) / 16}rem`)} />
                <span className="text-sm">{radius}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => {
                // reset
                setAccent("blue")
                setDensity("comfortable")
                setRadius("0.75rem")
                // system should behave like light per user request
                setTheme("light")
              }}>{t("restore")}</Button>
              <Button onClick={() => setOpen(false)}>{t("close")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
