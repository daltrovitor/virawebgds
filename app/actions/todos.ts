"use server"

import { createClient } from "@/lib/supabase/server"

export interface Todo {
  id: string
  user_id: string
  title: string
  description?: string | null
  due_date?: string | null
  completed: boolean
  created_at: string
  updated_at: string
}

export async function getTodos() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    // Propagate real auth error message when available to help debugging
    const msg = authError?.message || "User not authenticated"
    throw new Error(msg)
  }

  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching todos:", error)
    throw new Error(error.message || "Failed to fetch todos")
  }

  return (data || []) as Todo[]
}

export async function createTodo(payload: { title: string; description?: string; due_date?: string | null }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("User not authenticated")

  const { data, error } = await supabase
    .from("todos")
    .insert({ user_id: user.id, ...payload })
    .select()
    .single()

  if (error) {
    console.error("Error creating todo:", error)
    throw new Error(error.message || "Failed to create todo")
  }

  return data as Todo
}

export async function updateTodo(id: string, payload: { title?: string; description?: string | null; due_date?: string | null }) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("User not authenticated")

  const { data, error } = await supabase
    .from("todos")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating todo:", error)
    throw new Error(error.message || "Failed to update todo")
  }

  return data as Todo
}

export async function toggleTodoComplete(id: string, completed: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("User not authenticated")

  const { data, error } = await supabase
    .from("todos")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error toggling todo:", error)
    throw new Error(error.message || "Failed to toggle todo")
  }

  return data as Todo
}

export async function deleteTodo(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) throw new Error("User not authenticated")

  const { error } = await supabase.from("todos").delete().eq("id", id).eq("user_id", user.id)

  if (error) {
    console.error("Error deleting todo:", error)
    throw new Error(error.message || "Failed to delete todo")
  }

  return { success: true }
}
