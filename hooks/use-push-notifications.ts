"use client"

import { useState, useEffect } from 'react'
import { savePushSubscription } from '@/app/actions/push'
import { useToast } from '@/hooks/use-toast'

// Converts the VAPID key to a Uint8Array
function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [isStandalone, setIsStandalone] = useState(false)
    const { toast } = useToast()

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BJf-J7-hCj3Vi7M6tFnGCLwteLnBMwpyCBnWmuelimVdAuvclKNym2eiCVhRRBj9QJFLFI_VZg4GgOX5fjaPBSw"

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasSW = 'serviceWorker' in navigator
            const hasPush = 'PushManager' in window
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
            const standalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches
            
            setIsIOS(ios)
            setIsStandalone(standalone)
            
            if (hasSW && hasPush) {
                setIsSupported(true)
                checkSubscription()
            } else if (ios) {
                // On iOS, PushManager is only available when standalone
                setIsSupported(true)
            }
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

    const subscribeToPush = async () => {
        if (!isSupported) return false

        setIsLoading(true)
        try {
            // Check if iOS and not standalone
            if (isIOS && !isStandalone) {
                toast({
                    title: "Instale o App",
                    description: "No iPhone, toque em 'Compartilhar' e depois em 'Adicionar à Tela de Início' para ativar notificações.",
                    variant: "destructive"
                })
                setIsLoading(false)
                return false
            }

            if (Notification.permission === 'denied') {
                toast({
                    title: "Permissão negada",
                    description: "Você precisa permitir as notificações nas configurações do seu navegador ou aparelho.",
                    variant: "destructive"
                })
                setIsLoading(false)
                return false
            }

            // Register service worker if not already running
            await navigator.serviceWorker.register('/sw.js')
            const registration = await navigator.serviceWorker.ready

            // Ask for permission and subscribe
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey)
            })

            // Save in backend
            await savePushSubscription(JSON.parse(JSON.stringify(subscription)))
            setIsSubscribed(true)
            
            toast({
                title: "Notificações Ativadas!",
                description: "Você será avisado sobre seus lembretes em tempo real."
            })
            
            setIsLoading(false)
            return true
        } catch (error) {
            console.error("Failed to subscribe:", error)
            
            // Special error for iOS PWA
            if (error instanceof Error && (error.message.includes('manifest') || error.message.includes('PushManager'))) {
               toast({
                   title: "Adicione à Tela Inicial",
                   description: "No iPhone (iOS), você precisa adicionar este app à tela inicial (Compartilhar > Adicionar à Tela de Início) antes de ativar as notificações.",
                   variant: "destructive"
               })
            } else {
               toast({
                   title: "Erro ao ativar notificações",
                   description: "Por favor, tente novamente mais tarde no navegador do seu celular.",
                   variant: "destructive"
               })
           }
           setIsLoading(false)
           return false
        }
    }

    return {
        isSupported,
        isSubscribed,
        isLoading,
        isIOS,
        isStandalone,
        subscribeToPush
    }
}
