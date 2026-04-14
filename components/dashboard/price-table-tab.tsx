"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus, Trash2, Edit2, Search, Loader2, Tag,
  Package, DollarSign, Clock, Percent, ChevronDown,
  ChevronRight, LayoutGrid, List as ListIcon, X,
} from "lucide-react"
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/app/actions/price-table-actions"
import type { ServiceCategory, ServiceProduct } from "@/lib/budget-types"
import { CATEGORY_COLORS } from "@/lib/budget-types"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"

export default function PriceTableTab() {
  const t = useTranslations("dashboard.priceTableTab")
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [products, setProducts] = useState<ServiceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // Category form
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", color: CATEGORY_COLORS[0] })

  // Product form
  const [showProductForm, setShowProductForm] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [productForm, setProductForm] = useState({
    category_id: "",
    name: "",
    description: "",
    base_price: "",
    cost: "",
    duration_minutes: "",
    tax_percent: "",
  })

  // Expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [cats, prods] = await Promise.all([getCategories(), getProducts()])
      setCategories(cats)
      setProducts(prods)
      // Expand all categories by default
      setExpandedCategories(new Set(cats.map((c) => c.id)))
    } catch (error) {
      console.error("Error loading price table:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  // ── Category CRUD ─────────────────────────────────

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: t("nameRequired"), variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      if (editingCategoryId) {
        const res = await updateCategory(editingCategoryId, categoryForm)
        if (!res.success) throw new Error(res.error)
        toast({ title: t("categoryUpdated") })
      } else {
        const res = await createCategory(categoryForm)
        if (!res.success) throw new Error(res.error)
        toast({ title: t("categoryCreated") })
      }
      await loadData()
      resetCategoryForm()
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEditCategory = (cat: ServiceCategory) => {
    setCategoryForm({ name: cat.name, description: cat.description || "", color: cat.color || CATEGORY_COLORS[0] })
    setEditingCategoryId(cat.id)
    setShowCategoryForm(true)
    setShowProductForm(false)
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t("deleteCategoryConfirm"))) return
    const res = await deleteCategory(id)
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: t("categoryDeleted") })
    await loadData()
  }

  const resetCategoryForm = () => {
    setCategoryForm({ name: "", description: "", color: CATEGORY_COLORS[0] })
    setEditingCategoryId(null)
    setShowCategoryForm(false)
  }

  // ── Product CRUD ──────────────────────────────────

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.category_id) {
      toast({ title: t("nameCatRequired"), variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        category_id: productForm.category_id,
        name: productForm.name,
        description: productForm.description,
        base_price: parseFloat(productForm.base_price) || 0,
        cost: parseFloat(productForm.cost) || 0,
        duration_minutes: parseInt(productForm.duration_minutes) || undefined,
        tax_percent: parseFloat(productForm.tax_percent) || 0,
      }

      if (editingProductId) {
        const res = await updateProduct(editingProductId, payload)
        if (!res.success) throw new Error(res.error)
        toast({ title: t("productUpdated") })
      } else {
        const res = await createProduct(payload)
        if (!res.success) throw new Error(res.error)
        toast({ title: t("productCreated") })
      }
      await loadData()
      resetProductForm()
    } catch (err) {
      toast({ title: "Erro", description: err instanceof Error ? err.message : "Erro desconhecido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEditProduct = (prod: ServiceProduct) => {
    setProductForm({
      category_id: prod.category_id,
      name: prod.name,
      description: prod.description || "",
      base_price: prod.base_price.toString(),
      cost: (prod.cost || 0).toString(),
      duration_minutes: prod.duration_minutes ? prod.duration_minutes.toString() : "",
      tax_percent: prod.tax_percent.toString(),
    })
    setEditingProductId(prod.id)
    setShowProductForm(true)
    setShowCategoryForm(false)
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm(t("deleteProductConfirm"))) return
    const res = await deleteProduct(id)
    if (!res.success) {
      toast({ title: "Erro", description: res.error, variant: "destructive" })
      return
    }
    toast({ title: t("productDeleted") })
    await loadData()
  }

  const resetProductForm = () => {
    setProductForm({
      category_id: "",
      name: "",
      description: "",
      base_price: "",
      cost: "",
      duration_minutes: "",
      tax_percent: "",
    })
    setEditingProductId(null)
    setShowProductForm(false)
  }

  const openNewProductForm = (categoryId?: string) => {
    resetProductForm()
    if (categoryId) {
      setProductForm((prev) => ({ ...prev, category_id: categoryId }))
    }
    setShowProductForm(true)
    setShowCategoryForm(false)
  }

  // Filtering
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.description || "").toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getProductsForCategory = (catId: string) =>
    filteredProducts.filter((p) => p.category_id === catId)

  const uncategorizedProducts = filteredProducts.filter(
    (p) => !categories.find((c) => c.id === p.category_id),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { resetCategoryForm(); setShowCategoryForm(true); setShowProductForm(false) }}
            variant="outline"
            className="gap-2"
          >
            <Tag className="w-4 h-4" />
            {t("newCategory")}
          </Button>
          <Button
            onClick={() => openNewProductForm()}
            className="bg-primary text-primary-foreground gap-2"
          >
            <Plus className="w-4 h-4" />
            {t("newProduct")}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("categories")}</p>
              <p className="text-2xl font-bold text-foreground">{categories.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-500">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("products")}</p>
              <p className="text-2xl font-bold text-foreground">{products.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("avgPrice")}</p>
              <p className="text-2xl font-bold text-foreground">
                R$ {products.length > 0
                  ? (products.reduce((s, p) => s + p.base_price, 0) / products.length).toFixed(0)
                  : "0"}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-500">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("avgTax")}</p>
              <p className="text-2xl font-bold text-foreground">
                {products.length > 0
                  ? (products.reduce((s, p) => s + p.tax_percent, 0) / products.length).toFixed(1)
                  : "0"}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category Form */}
      {showCategoryForm && (
        <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {editingCategoryId ? t("editCategory") : t("newCategory")}
            </h3>
            <Button variant="ghost" size="sm" onClick={resetCategoryForm}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              placeholder={t("form.catName")}
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              className="bg-background"
            />
            <Input
              placeholder={t("form.catDesc")}
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="bg-background"
            />
          </div>
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">{t("form.catColor")}</p>
            <div className="flex gap-2 flex-wrap">
              {CATEGORY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCategoryForm({ ...categoryForm, color })}
                  className={`w-8 h-8 transition-all ${categoryForm.color === color ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingCategoryId ? t("form.update") : t("form.createCategory")}
            </Button>
            <Button variant="outline" onClick={resetCategoryForm}>{t("form.cancel")}</Button>
          </div>
        </Card>
      )}

      {/* Product Form */}
      {showProductForm && (
        <Card className="p-6 border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-primary/5 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-foreground">
              {editingProductId ? t("editProduct") : t("newProduct")}
            </h3>
            <Button variant="ghost" size="sm" onClick={resetProductForm}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.category")}</label>
              <select
                value={productForm.category_id}
                onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                className="w-full h-10 bg-background border border-input px-3 py-2 text-sm focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("form.select")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.name")}</label>
              <Input
                placeholder={t("form.namePlaceholder")}
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.desc")}</label>
              <Input
                placeholder={t("form.descPlaceholder")}
                value={productForm.description}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.basePrice")}</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={productForm.base_price}
                onChange={(e) => setProductForm({ ...productForm, base_price: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.cost")}</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={productForm.cost}
                onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.duration")}</label>
              <Input
                type="number"
                placeholder="30"
                value={productForm.duration_minutes}
                onChange={(e) => setProductForm({ ...productForm, duration_minutes: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">{t("form.taxPercent")}</label>
              <Input
                type="number"
                step="0.1"
                placeholder="0"
                value={productForm.tax_percent}
                onChange={(e) => setProductForm({ ...productForm, tax_percent: e.target.value })}
                className="bg-background"
              />
            </div>
          </div>

          {/* Price preview */}
          {productForm.base_price && (
            <div className="mt-4 p-3 bg-background border border-border">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("price")}:</span>{" "}
                  <span className="font-bold text-foreground">R$ {parseFloat(productForm.base_price || "0").toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("tax")}:</span>{" "}
                  <span className="font-bold text-amber-600">
                    R$ {(parseFloat(productForm.base_price || "0") * (parseFloat(productForm.tax_percent || "0") / 100)).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("total")}:</span>{" "}
                  <span className="font-bold text-emerald-600">
                    R$ {(parseFloat(productForm.base_price || "0") * (1 + (parseFloat(productForm.tax_percent || "0") / 100))).toFixed(2)}
                  </span>
                </div>
                {productForm.cost && (
                  <div>
                    <span className="text-muted-foreground">{t("profit")}:</span>{" "}
                    <span className="font-bold text-primary">
                      R$ {(parseFloat(productForm.base_price || "0") - parseFloat(productForm.cost || "0")).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button onClick={handleSaveProduct} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingProductId ? t("form.update") : t("form.createProduct")}
            </Button>
            <Button variant="outline" onClick={resetProductForm}>{t("form.cancel")}</Button>
          </div>
        </Card>
      )}

      {/* Search + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1 border border-border">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ListIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Categories + Products */}
      {categories.length === 0 && products.length === 0 ? (
        <Card className="p-12 border border-border text-center">
          <Tag className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">{t("emptyTitle")}</h3>
          <p className="text-muted-foreground mb-4">
            {t("emptyDesc")}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => { resetCategoryForm(); setShowCategoryForm(true) }} variant="outline" className="gap-2">
              <Tag className="w-4 h-4" /> {t("createCategory")}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((cat) => {
            const catProducts = getProductsForCategory(cat.id)
            const isExpanded = expandedCategories.has(cat.id)
            return (
              <Card key={cat.id} className="border border-border overflow-hidden">
                {/* Category Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory(cat.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-8" style={{ backgroundColor: cat.color || "#3396d3" }} />
                    {isExpanded
                      ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      : <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    }
                    <div>
                      <h3 className="font-bold text-foreground">{cat.name}</h3>
                      {cat.description && (
                        <p className="text-sm text-muted-foreground">{cat.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5">
                      {catProducts.length} {catProducts.length === 1 ? t("products").slice(0, -1) : t("products")}
                    </span>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => openNewProductForm(cat.id)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditCategory(cat)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Products in category */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {catProducts.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        {t("noProductsInCat")}{" "}
                        <button
                          className="text-primary underline hover:no-underline"
                          onClick={() => openNewProductForm(cat.id)}
                        >
                          {t("addProduct")}
                        </button>
                      </div>
                    ) : viewMode === "grid" ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                        {catProducts.map((prod) => (
                          <ProductCard
                            key={prod.id}
                            product={prod}
                            onEdit={handleEditProduct}
                            onDelete={handleDeleteProduct}
                            t={t}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {catProducts.map((prod) => (
                          <ProductRow
                            key={prod.id}
                            product={prod}
                            onEdit={handleEditProduct}
                            onDelete={handleDeleteProduct}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}

          {/* Uncategorized */}
          {uncategorizedProducts.length > 0 && (
            <Card className="border border-border overflow-hidden">
              <div className="p-4 bg-muted/50">
                <h3 className="font-bold text-muted-foreground">{t("uncategorized")}</h3>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {uncategorizedProducts.map((prod) => (
                  <ProductCard key={prod.id} product={prod} onEdit={handleEditProduct} onDelete={handleDeleteProduct} t={t} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── Product Card ────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
  t,
}: {
  product: ServiceProduct
  onEdit: (p: ServiceProduct) => void
  onDelete: (id: string) => void
  t: any
}) {
  const totalWithTax = product.base_price * (1 + product.tax_percent / 100)
  const profit = product.base_price - (product.cost || 0)

  return (
    <div className="border border-border p-4 hover:shadow-md transition-shadow bg-background group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-foreground text-sm">{product.name}</h4>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(product)} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(product.id)} className="p-1 hover:bg-muted text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> {t("price")}
          </span>
          <span className="text-sm font-bold text-foreground">R$ {product.base_price.toFixed(2)}</span>
        </div>
        {product.tax_percent > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Percent className="w-3 h-3" /> {t("tax")} ({product.tax_percent}%)
            </span>
            <span className="text-xs text-amber-600 font-medium">
              + R$ {(product.base_price * product.tax_percent / 100).toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground font-medium">{t("total")}</span>
          <span className="text-sm font-bold text-emerald-600">R$ {totalWithTax.toFixed(2)}</span>
        </div>
        {product.cost != null && product.cost > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{t("profit")}</span>
            <span className={`text-xs font-bold ${profit >= 0 ? "text-primary" : "text-destructive"}`}>
              R$ {profit.toFixed(2)}
            </span>
          </div>
        )}
        {product.duration_minutes && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
            <Clock className="w-3 h-3" /> {product.duration_minutes} min
          </div>
        )}
      </div>
    </div>
  )
}

// ── Product List Row ────────────────────────────────

function ProductRow({
  product,
  onEdit,
  onDelete,
}: {
  product: ServiceProduct
  onEdit: (p: ServiceProduct) => void
  onDelete: (id: string) => void
}) {
  const totalWithTax = product.base_price * (1 + product.tax_percent / 100)

  return (
    <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group">
      <div className="flex-1 mr-4">
        <p className="font-bold text-foreground text-sm">{product.name}</p>
        {product.description && <p className="text-xs text-muted-foreground">{product.description}</p>}
      </div>
      <div className="flex items-center gap-6 text-sm">
        {product.duration_minutes && (
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
            <Clock className="w-3 h-3" /> {product.duration_minutes} min
          </span>
        )}
        <span className="font-medium text-foreground">R$ {product.base_price.toFixed(2)}</span>
        {product.tax_percent > 0 && (
          <span className="text-xs text-amber-600">{product.tax_percent}%</span>
        )}
        <span className="font-bold text-emerald-600">R$ {totalWithTax.toFixed(2)}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(product)} className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(product.id)} className="p-1 hover:bg-muted text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
