"use server"

import { createClient } from "@/lib/supabase/server"

export interface UserNote {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export async function getUserNotes(): Promise<UserNote[]> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "User not authenticated"
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from("user_notes")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("Error fetching notes:", error)
    throw new Error(error.message || "Failed to fetch notes")
  }

  return data as UserNote[]
}

export async function createUserNote(title: string, content: string): Promise<UserNote> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "User not authenticated"
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from("user_notes")
    .insert({
      user_id: user.id,
      title,
      content,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating note:", error)
    throw new Error(error.message || "Failed to create note")
  }

  return data as UserNote
}

export async function updateUserNote(id: string, title: string, content: string): Promise<UserNote> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "User not authenticated"
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from("user_notes")
    .update({
      title,
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating note:", error)
    throw new Error(error.message || "Failed to update note")
  }

  return data as UserNote
}

export async function deleteUserNote(id: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const msg = authError?.message || "User not authenticated"
    throw new Error(msg)
  }

  const { error } = await supabase.from("user_notes").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    console.error("Error deleting note:", error)
    throw new Error(error.message || "Failed to delete note")
  }
}
