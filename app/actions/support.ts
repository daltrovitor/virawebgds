"use server"

import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import { sendNotification } from "@/lib/notifications"

export interface SupportTicket {
  id: string
  user_id: string
  subject: string
  message: string
  status: "open" | "in_progress" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  created_at: string
  updated_at: string
}

export interface SupportMessage {
  id: string
  ticket_id: string
  user_id: string
  message: string
  is_staff: boolean
  created_at: string
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return []
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching tickets:", error)
    throw new Error("Failed to fetch tickets")
  }

  return data as SupportTicket[]
}

export async function createSupportTicket(
  subject: string,
  message: string,
  priority: "low" | "medium" | "high" | "urgent" = "medium",
): Promise<SupportTicket> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject,
      message,
      priority,
      status: "open",
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating ticket:", error)
    throw new Error("Failed to create ticket")
  }

  await notifyDevAboutNewTicket(data.id, subject, message, user.email || "Unknown user", priority)

  return data as SupportTicket
}

export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("Error fetching messages:", error)
    throw new Error("Failed to fetch messages")
  }

  return data as SupportMessage[]
}

export async function addTicketMessage(ticketId: string, message: string): Promise<SupportMessage> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      message,
      is_staff: false,
    })
    .select()
    .single()

  if (error) {
    console.error("Error adding message:", error)
    throw new Error("Failed to add message")
  }

  const { data: ticket } = await supabase.from("support_tickets").select("subject").eq("id", ticketId).single()

  await notifyDevAboutSupportMessage(ticketId, ticket?.subject || "Ticket", message, user.email || "Unknown user")

  return data as SupportMessage
}

async function notifyDevAboutNewTicket(
  ticketId: string,
  subject: string,
  message: string,
  userEmail: string,
  priority: string,
) {
  try {
    // Send push notifications to all admins
    const adminSupa = createServiceRoleClient()
    
    // Get all user IDs with admin or staff roles from both possible tables
    const { data: profileAdmins } = await adminSupa
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'staff'])
      
    const { data: legacyAdmins } = await adminSupa
      .from('users')
      .select('id')
      .in('role', ['admin', 'staff'])

    const adminIds = new Set([
      ...(profileAdmins?.map(a => a.id) || []),
      ...(legacyAdmins?.map(a => a.id) || [])
    ])

    if (adminIds.size > 0) {
      console.log(`[SUPPORT] Notifying ${adminIds.size} admins via push: ${Array.from(adminIds).join(', ')}`)
      for (const adminId of adminIds) {
        const result = await sendNotification(adminId, {
          title: `🎫 Novo Ticket Criado: ${subject}`,
          body: `🚨 Prioridade: ${priority === 'urgent' ? 'URGENTE (Responder Rápido)' : priority === 'high' ? 'ALTA' : priority === 'medium' ? 'MÉDIA' : 'BAIXA'}\n📝 ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
          url: `https://admin.viraweb.online/admin?tab=support`,
          targetDomain: 'admin.viraweb.online'
        })
        if (!result.success) {
          console.error(`[SUPPORT] Failed to send push to admin ${adminId}:`, result.error)
        }
      }
    } else {
      console.warn(`[SUPPORT] No admins found to notify via push for new ticket.`)
    }
  } catch (error) {
    console.error("Error notifying dev about new ticket:", error)
  }
}

async function notifyDevAboutSupportMessage(
  ticketId: string,
  ticketSubject: string,
  message: string,
  userEmail: string,
) {
  try {
    // Send push notifications to all admins
    const adminSupa = createServiceRoleClient()
    
    // Get all user IDs with admin or staff roles from both possible tables
    const { data: profileAdmins } = await adminSupa
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'staff'])
      
    const { data: legacyAdmins } = await adminSupa
      .from('users')
      .select('id')
      .in('role', ['admin', 'staff'])

    const adminIds = new Set([
      ...(profileAdmins?.map(a => a.id) || []),
      ...(legacyAdmins?.map(a => a.id) || [])
    ])

    if (adminIds.size > 0) {
      console.log(`[SUPPORT] Notifying ${adminIds.size} admins of new message push: ${Array.from(adminIds).join(', ')}`)
      for (const adminId of adminIds) {
        const result = await sendNotification(adminId, {
          title: `💬 Nova mensagem: ${ticketSubject}`,
          body: `${userEmail}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
          url: `https://admin.viraweb.online/admin?tab=support`,
          targetDomain: 'admin.viraweb.online'
        })
        if (!result.success) {
          console.error(`[SUPPORT] Failed to send message push to admin ${adminId}:`, result.error)
        }
      }
    } else {
      console.warn(`[SUPPORT] No admins found to notify via push for support message.`)
    }
  } catch (error) {
    console.error("Error notifying dev about support message:", error)
  }
}

export async function respondToTicket(ticketId: string, message: string): Promise<SupportMessage> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  // Insert message as staff
  const { data, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      user_id: user.id,
      message,
      is_staff: true,
    })
    .select()
    .single()

  if (error) {
    console.error("Error adding admin response:", error)
    throw new Error("Failed to add response")
  }

  // Update ticket status to in_progress if it was open
  const { data: ticketData } = await supabase.from("support_tickets").select("status, user_id, subject").eq("id", ticketId).single()
  
  if (ticketData?.status === "open") {
    await supabase.from("support_tickets").update({ 
      status: "in_progress", 
      updated_at: new Date().toISOString() 
    }).eq("id", ticketId)
  }

  // Notify the user who created the ticket
  if (ticketData) {
    await sendNotification(ticketData.user_id, {
      title: "📩 Resposta ao seu Suporte",
      body: `Nossa equipe respondeu ao seu ticket: ${ticketData.subject}`,
      url: `https://gdc.viraweb.online/dashboard?tab=support`,
      targetDomain: 'gdc.viraweb.online'
    })
  }

  return data as SupportMessage
}

export async function updateTicketStatusAction(ticketId: string, status: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("support_tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId)

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`)
  }

  return { success: true }
}

export async function deleteSupportTicket(ticketId: string) {
  const supabase = await createClient()

  // First check if the user is admin (security)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    throw new Error("Only admins can delete tickets")
  }

  const { error } = await supabase
    .from("support_tickets")
    .delete()
    .eq("id", ticketId)

  if (error) {
    throw new Error(`Failed to delete ticket: ${error.message}`)
  }

  return { success: true }
}


export async function broadcastNotification(title: string, body: string, url: string = '/') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Verify if it is an admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
     throw new Error("Apenas administradores podem enviar comunicados")
  }

  const adminSupa = createServiceRoleClient()
  
  // Get ALL users who have active devices
  const { data: devices, error } = await adminSupa
    .from('user_devices')
    .select('user_id')
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Unique user IDs
  const userIds = Array.from(new Set(devices?.map(d => d.user_id) || []))

  let successCount = 0
  for (const targetId of userIds) {
    const result = await sendNotification(targetId, {
      title,
      body,
      url
    })
    if (result.success) successCount++
  }

  return { success: true, count: successCount }
}
