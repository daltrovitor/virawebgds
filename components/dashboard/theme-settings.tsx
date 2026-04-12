"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { useTheme } from "next-themes"
import { Settings, X } from "lucide-react"
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

  const themes = [
    { id: "viraweb", name: "ViraWeb", primary: "#3396d3", secondary: "#ffd400" },
    { id: "midnight", name: "Midnight", primary: "#0f172a", secondary: "#334155" },
    { id: "emerald", name: "Emerald", primary: "#059669", secondary: "#10b981" },
    { id: "violet", name: "Violet", primary: "#7c3aed", secondary: "#a78bfa" },
    { id: "rose", name: "Rose", primary: "#e11d48", secondary: "#fb7185" },
  ]

  function applyPreset(id: string) {
    const p = themes.find(t => t.id === id)
    if (!p) return
    const root = document.documentElement
    
    // Set colors
    root.style.setProperty("--primary", p.primary)
    root.style.setProperty("--primary-foreground", "#ffffff")
    root.style.setProperty("--secondary", p.secondary)
    root.style.setProperty("--accent", p.secondary)
    root.style.setProperty("--ring", p.primary)
    root.style.setProperty("--chart-1", p.primary)
    root.style.setProperty("--chart-2", p.secondary)
    root.style.setProperty("--sidebar-primary", p.primary)
    root.style.setProperty("--sidebar-accent", p.secondary)
    
    setAccent(p.id as any)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent: p.id, density, radius }))
    } catch (e) { }
  }

  return (
    <>
      <div className="fixed right-4 bottom-4 z-50">
        <Button 
          onClick={() => setOpen(true)} 
          className="shadow-xl rounded-none px-4 py-3 bg-primary text-primary-foreground flex items-center gap-2 border-2 border-primary/20 hover:opacity-90 transition-all scale-90 sm:scale-100"
        >
          <Settings className="w-5 h-5 animate-spin-slow" />
          <span className="font-black uppercase tracking-tighter text-[11px]">{t("button")}</span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-none border-2 border-slate-900 p-0 overflow-hidden bg-white">
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
            <h2 className="font-black uppercase tracking-widest text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {t("title")}
            </h2>
            <button onClick={() => setOpen(false)} className="hover:rotate-90 transition-transform">
                <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 grid gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">{t("mode")}</p>
              <div className="grid grid-cols-2 gap-2">
                  {["light", "dark"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setTheme(m)}
                        className={`py-2 px-1 border-2 font-bold text-[10px] uppercase tracking-tighter transition-all ${theme === m ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-400 hover:border-slate-400"}`}
                      >
                          {t(m)}
                      </button>
                  ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">{t("accent")}</p>
              <div className="grid grid-cols-1 gap-2">
                  {themes.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p.id)}
                        className={`flex items-center justify-between p-3 border-2 transition-all ${accent === p.id ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300"}`}
                      >
                          <span className="font-black text-[12px] uppercase tracking-tighter">{p.name}</span>
                          <div className="flex gap-1">
                              <div className="w-4 h-4" style={{ backgroundColor: p.primary }} />
                              <div className="w-4 h-4 opacity-50" style={{ backgroundColor: p.secondary }} />
                          </div>
                      </button>
                  ))}
              </div>
            </div>

            <div className="flex justify-between gap-2 mt-4 pt-4 border-t border-slate-100">
              <Button 
                variant="outline" 
                className="rounded-none border-2 border-slate-200 font-black uppercase tracking-tighter text-[10px] h-10 px-6"
                onClick={() => {
                   applyPreset("viraweb")
                   setTheme("light")
                }}
              >
                  {t("restore")}
              </Button>
              <Button 
                className="rounded-none bg-slate-900 text-white font-black uppercase tracking-tighter text-[10px] h-10 px-8 hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                  {t("close")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
