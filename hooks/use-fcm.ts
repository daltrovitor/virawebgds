"use client"

import { useState, useEffect } from 'react'
import { messaging } from '@/lib/firebase'
import { getToken, onMessage } from 'firebase/messaging'
import { createClient } from '@/lib/supabase/client'
import { useToast } from './use-toast'

export function useFCM() {
    const [token, setToken] = useState<string | null>(null)
    const { toast } = useToast()
    const supabase = createClient()

    useEffect(() => {
        if (typeof window === 'undefined' || !messaging) return

        const requestPermission = async () => {
            try {
                let permission = Notification.permission;
                if (permission !== 'granted' && permission !== 'denied') {
                    permission = await Notification.requestPermission();
                }

                if (permission === 'granted') {
                    const currentToken = await getToken(messaging!, {
                        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY // FCM also uses a VAPID key for web
                    })
                    
                    if (currentToken) {
                        setToken(currentToken)
                        await saveTokenToDb(currentToken)
                    } else {
                        console.warn('No registration token available. Request permission to generate one.')
                    }
                }
            } catch (error) {
                console.error('An error occurred while retrieving token. ', error)
            }
        }

        requestPermission()

        const unsubscribe = onMessage(messaging!, (payload) => {
            console.log('Message received. ', payload)
            
            const data = payload.data || {};
            const notificationTitle = payload.notification?.title || data.title || 'Notificação';
            const notificationBody = payload.notification?.body || data.body || '';
            const targetUrl = data.url || '/';

            // Domain filtering logic
            if (targetUrl.startsWith('http')) {
                try {
                    const targetDomain = new URL(targetUrl).hostname;
                    if (targetDomain !== window.location.hostname) {
                        console.log(`[FCM] Ignoring notification destined for ${targetDomain}`);
                        return;
                    }
                } catch(e) {
                    // Ignore URL parsing errors
                }
            }

            // 1. Mostrar Toast no App
            toast({
                title: notificationTitle,
                description: notificationBody,
            })

            // 2. Forçar Alerta Nativo do Sistema (Windows/Mac)
            if (Notification.permission === 'granted') {
                new Notification(notificationTitle, {
                    body: notificationBody,
                    icon: data.icon || '/viraweb6.png'
                })
            }
        })

        return () => unsubscribe()
    }, [toast])

    const saveTokenToDb = async (fcmToken: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const domainToken = `${window.location.hostname}:::${fcmToken}`
            
            // Delete legacy un-prefixed token if it exists
            await supabase
                .from('user_devices')
                .delete()
                .match({ user_id: user.id, fcm_token: fcmToken })

            await supabase
                .from('user_devices')
                .upsert({
                    user_id: user.id,
                    fcm_token: domainToken,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, fcm_token' })
        } catch (error) {
            console.error('Error saving FCM token:', error)
        }
    }

    return { token }
}
