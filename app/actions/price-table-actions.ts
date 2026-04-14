"use server"

import { createClient } from "@/lib/supabase/server"
import type { ServiceCategory, ServiceProduct } from "@/lib/budget-types"

// ============================================================
// CATEGORIES
// ============================================================

export async function getCategories(): Promise<ServiceCategory[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from("service_categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching categories:", error)
    return []
  }
  return (data || []) as ServiceCategory[]
}

export async function createCategory(payload: {
  name: string
  description?: string
  color?: string
  icon?: string
}): Promise<{ success: boolean; data?: ServiceCategory; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { data, error } = await supabase
    .from("service_categories")
    .insert({
      user_id: user.id,
      name: payload.name,
      description: payload.description || null,
      color: payload.color || "#3396d3",
      icon: payload.icon || null,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating category:", error)
    return { success: false, error: error.message }
  }
  return { success: true, data: data as ServiceCategory }
}

export async function updateCategory(
  id: string,
  payload: { name?: string; description?: string; color?: string; icon?: string },
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { error } = await supabase
    .from("service_categories")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error updating category:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteCategory(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  // Check if products exist in this category
  const { count } = await supabase
    .from("service_products")
    .select("id", { head: true, count: "exact" })
    .eq("category_id", id)
    .eq("user_id", user.id)

  if (count && count > 0) {
    return { success: false, error: "Não é possível excluir uma categoria com produtos vinculados. Remova os produtos primeiro." }
  }

  const { error } = await supabase
    .from("service_categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error deleting category:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================================================
// PRODUCTS / TREATMENTS
// ============================================================

export async function getProducts(): Promise<ServiceProduct[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from("service_products")
    .select(`
      *,
      category:service_categories(id, name, color)
    `)
    .eq("user_id", user.id)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching products:", error)
    return []
  }
  return (data || []) as ServiceProduct[]
}

export async function getProductsByCategory(categoryId: string): Promise<ServiceProduct[]> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return []

  const { data, error } = await supabase
    .from("service_products")
    .select(`
      *,
      category:service_categories(id, name, color)
    `)
    .eq("user_id", user.id)
    .eq("category_id", categoryId)
    .order("name", { ascending: true })

  if (error) {
    console.error("Error fetching products by category:", error)
    return []
  }
  return (data || []) as ServiceProduct[]
}

export async function createProduct(payload: {
  category_id: string
  name: string
  description?: string
  base_price: number
  cost?: number
  duration_minutes?: number
  tax_percent: number
}): Promise<{ success: boolean; data?: ServiceProduct; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { data, error } = await supabase
    .from("service_products")
    .insert({
      user_id: user.id,
      category_id: payload.category_id,
      name: payload.name,
      description: payload.description || null,
      base_price: payload.base_price,
      cost: payload.cost || 0,
      duration_minutes: payload.duration_minutes || null,
      tax_percent: payload.tax_percent || 0,
      active: true,
    })
    .select(`
      *,
      category:service_categories(id, name, color)
    `)
    .single()

  if (error) {
    console.error("Error creating product:", error)
    return { success: false, error: error.message }
  }
  return { success: true, data: data as ServiceProduct }
}

export async function updateProduct(
  id: string,
  payload: Partial<{
    category_id: string
    name: string
    description: string
    base_price: number
    cost: number
    duration_minutes: number
    tax_percent: number
    active: boolean
  }>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { error } = await supabase
    .from("service_products")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error updating product:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

export async function deleteProduct(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: "User not authenticated" }

  const { error } = await supabase
    .from("service_products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error deleting product:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
