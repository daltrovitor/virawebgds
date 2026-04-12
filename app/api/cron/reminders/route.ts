import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWebPush } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

/**
 * Reminder Processor (MOST IMPORTANT)
 * Runs Every Minute
 */
export async function GET(request: Request) {
  try {
    // 1. Auth check (Vercel Cron security + Local Test Support)
    const { searchParams } = new URL(request.url)
    const urlSecret = searchParams.get('secret')
    const authHeader = request.headers.get('authorization')
    
    if (process.env.CRON_SECRET && 
        authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
        urlSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 2. Find due reminders
    // Logic: scheduled_at <= now AND sent = false
    const now = new Date().toISOString()
    
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select('*')
      .lte('scheduled_at', now)
      .eq('sent', false)
      .limit(100); // Batch size

    if (error) throw error;

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`[CRON] Processing ${reminders.length} due reminders...`);

    // 3. Process Reminders
    const results = await Promise.allSettled(
      reminders.map(async (reminder) => {
        // IDEMPOTENCY: Mark as sent BEFORE attempting push to prevent double-processing on timeout/retry
        const { error: updateError } = await supabase
          .from('reminders')
          .update({ sent: true })
          .eq('id', reminder.id)
          .eq('sent', false); // Atomic check

        if (updateError) {
            console.error(`[CRON] Reminder ${reminder.id} already processed or failed to update.`);
            return;
        }

        // 4. Trigger Web Push & In-App notification
        return sendWebPush(reminder.user_id, {
          title: reminder.title,
          body: reminder.description || "Você tem um lembrete agendado.",
          url: '/dashboard/reminders'
        });
      })
    );

    const processedCount = results.filter(r => r.status === 'fulfilled').length;

    return NextResponse.json({ 
      success: true, 
      processed: processedCount,
      timestamp: now 
    });
  } catch (error: any) {
    console.error('[CRON ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
