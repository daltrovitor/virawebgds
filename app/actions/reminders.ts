"use server"

import { createClient } from "@/lib/supabase/server"

export interface Reminder {
    id: string
    user_id: string
    title: string
    description: string
    scheduled_at: string
    sent: boolean
    created_at: string
}

export async function getReminders() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true })

    if (error) {
        console.error("Error fetching reminders", error)
        return []
    }

    return data as Reminder[]
}

export async function createReminder(title: string, description: string, scheduled_at: Date) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Usuário não autenticado")

    const { data, error } = await supabase
        .from('reminders')
        .insert({
            user_id: user.id,
            title,
            description,
            scheduled_at: scheduled_at.toISOString(),
            sent: false
        })
        .select()
        .single()

    if (error) {
        console.error("Error creating reminder", error)
        throw new Error(error.message)
    }

    return data as Reminder
}

export async function deleteReminder(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error("Usuário não autenticado")

    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return { success: true }
}
