"use server"

import { createClient } from "@/lib/supabase/server"
import { sendNotification as sendFCM } from "@/lib/notifications"

export interface Notification {
  id: string
  user_id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
}

export async function getNotifications() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Error fetching notifications:", error)
    return []
  }

  return data as Notification[]
}

export async function getUnreadCount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false)

  if (error) {
    console.error("Error fetching unread count:", error)
    return 0
  }

  return count || 0
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id)

  return { success: !error }
}

export async function markAllAsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false)

  return { success: !error }
}

export async function deleteNotification(notificationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", user.id)

  return { success: !error }
}

export async function createNotification(
  title: string,
  body: string,
  userId: string
) {
  // Use our centralized notification service
  return sendFCM(userId, { title, body })
}
