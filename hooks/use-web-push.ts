"use client"

import { useState, useEffect, useCallback } from "react"
import { savePushSubscription } from "@/app/actions/push"
import { useToast } from "@/hooks/use-toast"

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useWebPush() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true)
      checkSubscription()
    }
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch (error) {
      console.error("Error checking subscription:", error)
    }
  }

  const subscribe = useCallback(async () => {
    if (!vapidPublicKey) {
      console.error("VAPID public key not found")
      return
    }

    setIsLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        toast({
          title: "Permissão negada",
          description: "Você precisa autorizar notificações para receber lembretes.",
          variant: "destructive",
        })
        return
      }

      await navigator.serviceWorker.register("/sw.js")
      const registration = await navigator.serviceWorker.ready
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      const subObj = JSON.parse(JSON.stringify(subscription))
      await savePushSubscription(subObj)
      
      setIsSubscribed(true)
      toast({
        title: "Notificações Ativadas!",
        description: "Você agora receberá seus lembretes em tempo real.",
      })
    } catch (error) {
      console.error("Failed to subscribe to push:", error)
      toast({
        title: "Erro ao ativar notificações",
        description: "Ocorreu um problema ao registrar seu dispositivo.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [vapidPublicKey, toast])

  const unsubscribe = useCallback(async () => {
    setIsLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        // Optional: Call API to remove from DB
        setIsSubscribed(false)
        toast({
          title: "Notificações Desativadas",
          description: "Você não receberá mais alertas neste navegador.",
        })
      }
    } catch (error) {
      console.error("Error unsubscribing:", error)
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  }
}
