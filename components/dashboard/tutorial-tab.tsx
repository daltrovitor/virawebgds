"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PlayCircle, CheckCircle2, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"

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

export default function TutorialTab({ onMarkWatched }: { onMarkWatched?: () => void }) {
  const [hasWatchedTutorial, setHasWatchedTutorial] = useState(false)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const supabase = createClient()
  const t = useTranslations("dashboard.tutorial")
  const tCommon = useTranslations("common")

  useEffect(() => {
    loadTutorialStatus()
  }, [])

  const loadTutorialStatus = async () => {
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
