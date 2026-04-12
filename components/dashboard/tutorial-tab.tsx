"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlayCircle, CheckCircle2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"
import Image from "next/image"

function getEmbedUrl(url: string) {
  try {
    const u = new URL(url)
    // youtube.com/watch?v=ID or youtu.be/ID
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
  } catch (e) { }
  // fallback: return original (may already be an embed URL)
  return url
}

export default function TutorialTab({ onMarkWatched, isDemo = false }: { onMarkWatched?: () => void; isDemo?: boolean }) {
  const [hasWatchedTutorial, setHasWatchedTutorial] = useState(false)
  const [isAndroid, setIsAndroid] = useState(true)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()
  const t = useTranslations("dashboard.tutorial")
  const tCommon = useTranslations("common")

  useEffect(() => {
    loadTutorialStatus()
  }, [])

  const loadTutorialStatus = async () => {
    if (isDemo) {
      setHasWatchedTutorial(false)
      setLoading(false)
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_settings')
        .select('has_watched_tutorial')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Supabase error loading tutorial status:', error)
      } else {
        setHasWatchedTutorial(data?.has_watched_tutorial || false)
      }
    } catch (error) {
      console.error('Unexpected error loading tutorial status:', error)
    } finally {
      setLoading(false)
    }
  }

  const markTutorialAsWatched = async () => {
    if (isDemo) {
      setHasWatchedTutorial(true)
      if (onMarkWatched) onMarkWatched()
      toast({ title: t("toast.success"), description: t("toast.successDesc") })
      return
    }
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        throw userError
      }

      if (!user) {
        throw new Error(tCommon("errors.unauthorized"))
      }

      const { error: upsertError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          has_watched_tutorial: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (upsertError) throw upsertError

      setHasWatchedTutorial(true)
      if (onMarkWatched) onMarkWatched()
      toast({
        title: t("toast.success"),
        description: t("toast.successDesc"),
      })
    } catch (err: any) {
      console.error('Error marking tutorial as watched:', err)
      toast({
        title: t("toast.error"),
        description: err.message || tCommon("errors.generic"),
        variant: 'destructive',
      })
    }
  }

  const videoUrl = t("videoUrl")

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
            {videoUrl && videoUrl !== "videoUrl" ? (
              <iframe
                src={getEmbedUrl(videoUrl)}
                className="w-full h-full"
                frameBorder={0}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={t("title")}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <PlayCircle className="w-16 h-16 text-primary" />
                <span className="absolute mt-24 text-muted-foreground">{t("videoSoon")}</span>
              </div>
            )}
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">{t("title")}</h2>
            <p className="text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {hasWatchedTutorial ? (
              <Button variant="outline" className="gap-2" disabled>
                <CheckCircle2 className="w-4 h-4" />
                {t("concluded")}
              </Button>
            ) : (
              <Button onClick={markTutorialAsWatched} className="gap-2">
                <PlayCircle className="w-4 h-4" />
                {t("markWatched")}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* PWA Tutorial Section */}
      <Card className="p-8 border-none shadow-xl bg-gradient-to-br from-white to-slate-50 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
        
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20">
                  <PlayCircle className="w-6 h-6" />
                </div>
                ViraWeb no seu Celular
              </h2>
              <p className="text-slate-500 font-medium mt-1">Transforme o ViraWeb em um Aplicativo para acesso imediato e notificações garantidas.</p>
            </div>
            
            <div className="flex p-1 bg-white border border-slate-100 rounded-2xl shadow-sm self-start md:self-center">
              {[
                { id: 'android', label: 'Android' },
                { id: 'iphone', label: 'iPhone (iOS)' }
              ].map((plat) => (
                <button
                  key={plat.id}
                  onClick={() => setIsAndroid(plat.id === 'android')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    (plat.id === 'android' ? isAndroid : !isAndroid)
                    ? "bg-slate-900 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {plat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Steps Column */}
            <div className="space-y-6 order-2 lg:order-1">
              {isAndroid ? (
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-lg text-xs">1</span>
                    Acesso rápido no Google Chrome
                  </h4>
                  <ul className="space-y-3">
                    {[
                      "Abra o Chrome no seu celular.",
                      "Acesse gdc.viraweb.online e faça login.",
                      "Toque nos três pontinhos (⋮) no canto superior direito.",
                      "Selecione 'Instalar aplicativo' ou 'Adicionar à tela inicial'.",
                      "Pronto! Agora o ViraWeb está na sua lista de apps."
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-50 shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600 text-sm font-medium">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-primary/10 text-primary rounded-lg text-xs">1</span>
                    Instalação no Safari (iPhone)
                  </h4>
                  <ul className="space-y-3">
                    {[
                      "Abra o Safari e acesse gdc.viraweb.online",
                      "Toque no botão de 'Compartilhar' (o quadrado com seta para cima icon) na barra inferior.",
                      "Desça a lista e toque em 'Adicionar à Tela de Início'.",
                      "Toque em 'Adicionar' no canto superior direito.",
                      "O ícone do ViraWeb aparecerá junto aos seus outros aplicativos!"
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-50 shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600 text-sm font-medium">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  <strong>IMPORTANTE:</strong> Ao instalar o app, você garante que as notificações de lembretes e agendamentos cheguem até você mesmo se o ViraWeb não estiver aberto.
                </p>
              </div>
            </div>

            {/* Image Preview Column */}
            <div className="order-1 lg:order-2 flex justify-center">
              <div className="relative max-w-[320px] w-full p-2 bg-slate-900 rounded-[3rem] shadow-2xl shadow-slate-200 border-4 border-slate-800">
                <div className="aspect-[9/19.5] rounded-[2.5rem] overflow-hidden bg-white relative">
                  {isAndroid ? (
                    <Image 
                      src="/tutorialpwaandroid.png" 
                      alt="Tutorial PWA Android" 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <Image 
                      src="/tutorialpwaiphone.jpg" 
                      alt="Tutorial PWA iPhone" 
                      fill 
                      className="object-contain"
                    />
                  )}
                </div>
                {/* Visual device notch elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl mt-2" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{t("topics")}</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{t("step1")}</h4>
              <p className="text-sm text-muted-foreground">{t("step1Desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{t("step2")}</h4>
              <p className="text-sm text-muted-foreground">{t("step2Desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{t("step3")}</h4>
              <p className="text-sm text-muted-foreground">{t("step3Desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">{t("step4")}</h4>
              <p className="text-sm text-muted-foreground">{t("step4Desc")}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
