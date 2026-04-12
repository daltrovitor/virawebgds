"use server"

import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

// Initialize web-push. Make sure these are in your .env
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BJf-J7-hCj3Vi7M6tFnGCLwteLnBMwpyCBnWmuelimVdAuvclKNym2eiCVhRRBj9QJFLFI_VZg4GgOX5fjaPBSw"
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "6aRYSaMMIoKS7nct30JPRIKmBkDw6ryyGD39L24kgqE"
// It's recommended to provide a mailto link as the subject
webpush.setVapidDetails('mailto:vitorrocketleague@gmail.com', vapidPublicKey, vapidPrivateKey)

export async function savePushSubscription(subscription: any) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Usuário não autenticado")
    }

    // Save the subscription to the database
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id, endpoint'
        })

    if (error) {
        console.error("Error saving push subscription:", error)
        throw new Error("Failed to save subscription")
    }

    return { success: true }
}

import { createClient as createServiceRoleClient } from '@supabase/supabase-js'

export async function sendPushNotification(userId: string, targetPath: string, payload: { title: string; body: string; icon?: string }) {
    // We use the service role key here to bypass RLS, because this is often called 
    // from background tasks (Cron) where no user is logged in.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabase = createServiceRoleClient(supabaseUrl, supabaseServiceKey)

    // Retrieve the user's subscriptions
    const { data: subscriptions, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

    if (error || !subscriptions || subscriptions.length === 0) {
        return { success: false, error: "Nenhuma assinatura de push encontrada" }
    }

    const payloadString = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || '/viraweb6.png',
        url: targetPath
    })

    console.log(`[PUSH] Enviando para ${subscriptions.length} assinaturas do usuário ${userId}`)

    const sendPromises = subscriptions.map(sub => {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }
        return webpush.sendNotification(pushSubscription, payloadString)
            .then(() => console.log(`[PUSH] Sucesso ao enviar para endpoint: ${sub.endpoint.substring(0, 30)}...`))
            .catch(async (err) => {
                console.error("[PUSH] Erro ao enviar:", err.statusCode, err.message)
                // If subscription has expired or is invalid, delete it from the DB
                if (err.statusCode === 404 || err.statusCode === 410) {
                    console.log("[PUSH] Removendo assinatura expirada...")
                    await supabase.from('push_subscriptions').delete().eq('id', sub.id)
                }
            })
    })

    await Promise.allSettled(sendPromises)
    return { success: true }
}

export async function testPushNotification() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Não autenticado")

    return sendPushNotification(user.id, '/', {
        title: "Teste de Notificação",
        body: "Se você recebeu isso, suas notificações estão funcionando corretamente! 🚀"
    })
}
