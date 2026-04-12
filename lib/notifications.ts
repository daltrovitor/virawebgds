import { messaging } from './firebase-admin'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Sends notifications via Firebase Cloud Messaging (FCM)
 */
export async function sendNotification(userId: string, payload: { title: string; body: string; url?: string; targetDomain?: string }) {
  try {
    // 1. Save to Database (In-app)
    const { data: notification, error: dbError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        type: 'info', // Changed from 'reminder' to satisfy DB check constraint
        read: false
      })
      .select()
      .single()

    if (dbError) throw dbError

    // 2. Fetch User FCM Tokens
    const { data: devices, error: devError } = await supabase
      .from('user_devices')
      .select('fcm_token')
      .eq('user_id', userId)

    if (devError) throw devError

    const rawTokens = devices?.map(d => d.fcm_token) || []
    
    const filteredRawTokens = payload.targetDomain
      ? rawTokens.filter(t => t.startsWith(`${payload.targetDomain}:::`))
      : rawTokens;

    const tokenMap = new Map<string, string>(); // FCM token -> raw DB token
    filteredRawTokens.forEach(dbStr => {
      const actualToken = dbStr.includes(':::') ? dbStr.split(':::')[1] : dbStr;
      // If targetDomain was not set, we might get duplicates inside tokenMap (e.g. from both domains)
      // They will implicitly overwrite the key giving 1 unique FCM token, avoiding duplicate pushes.
      tokenMap.set(actualToken, dbStr);
    });

    const tokens = Array.from(tokenMap.keys());

    if (tokens.length > 0) {
      // 3. Send via FCM (Multicast)
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          notificationId: String(notification.id),
          icon: '/viraweb6.png'
        },
        webpush: {
          notification: {
            icon: '/viraweb6.png',
          },
          fcmOptions: {
            link: payload.url || '/',
          }
        },
        tokens: tokens,
      }

      const response = await messaging.sendEachForMulticast(message)
      console.log('[NOTIFICATIONS] FCM Response:', JSON.stringify(response))
      
      // Cleanup invalid tokens
      if (response.failureCount > 0) {
        const failedDbTokens: string[] = []
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error as any
            if (error?.code === 'messaging/invalid-registration-token' || 
                error?.code === 'messaging/registration-token-not-registered') {
              const actualToken = tokens[idx];
              const dbTokenStr = tokenMap.get(actualToken);
              if (dbTokenStr) failedDbTokens.push(dbTokenStr);
              // Also clean up unprefixed legacy if it existed natively
              if (!dbTokenStr?.includes(':::')) failedDbTokens.push(actualToken);
            }
          }
        })

        if (failedDbTokens.length > 0) {
          // Additional cleanup: look for any raw token that ends with the failed actual token
          // just to be incredibly thorough (e.g., both domains fail).
          const allDbTokensToDelete = rawTokens.filter(rt => {
             const clean = rt.includes(':::') ? rt.split(':::')[1] : rt;
             return failedDbTokens.some(ft => (ft.includes(':::') ? ft.split(':::')[1] : ft) === clean);
          });

          if (allDbTokensToDelete.length > 0) {
            await supabase
              .from('user_devices')
              .delete()
              .in('fcm_token', allDbTokensToDelete)
          }
        }
      }
    }

    return { success: true, notificationId: notification.id }
  } catch (error) {
    console.error('Error sending notification via FCM:', error)
    return { success: false, error }
  }
}

// Keep sendWebPush for internal consistency if needed
export async function sendWebPush(userId: string, payload: { title: string; body: string; url?: string }) {
    return sendNotification(userId, payload);
}
