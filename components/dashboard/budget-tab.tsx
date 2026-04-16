"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Plus, Trash2, Search, Loader2, Copy, Eye,
  FileText, DollarSign, TrendingUp, BarChart3,
  ChevronLeft, ChevronRight, Receipt, X, Check,
  Sparkles,
} from "lucide-react"
import {
  getBudgets,
  createBudget,
  updateBudgetStatus,
  duplicateBudget,
  deleteBudget,
  getBudgetDashboardStats,
} from "@/app/actions/budget-actions"
import { getProducts } from "@/app/actions/price-table-actions"
import { getPatients } from "@/app/actions/patients"
import {
  calculateBudgetTotals,
  calculateItemTotals,
  suggestPaymentPlans,
} from "@/lib/budget-calculations"
import type {
  Budget,
  BudgetItemDraft,
  BudgetStatus,
  BudgetPaymentMethod,
  InstallmentInterval,
  ServiceProduct,
} from "@/lib/budget-types"
import {
  BUDGET_STATUS_LABELS,
  BUDGET_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  INSTALLMENT_INTERVAL_LABELS,
} from "@/lib/budget-types"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "next-intl"

type Patient = { id: string; name: string; email?: string | null; phone?: string | null }

export default function BudgetTab() {
  const t = useTranslations("dashboard.budgetTab")
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [products, setProducts] = useState<ServiceProduct[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [stats, setStats] = useState({
    totalBudgets: 0, totalRevenue: 0, netRevenue: 0, conversionRate: 0, approvedCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<BudgetStatus | "all">("all")
  const [showWizard, setShowWizard] = useState(false)
  const [viewingBudget, setViewingBudget] = useState<Budget | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [b, p, pt, s] = await Promise.all([
        getBudgets(),
        getProducts(),
        getPatients(),
        getBudgetDashboardStats(),
      ])
      setBudgets(b)
      setProducts(p)
      setPatients(pt as Patient[])
      setStats(s)
    } catch (error) {
      console.error("Error loading budget data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDuplicate = async (id: string) => {
    const res = await duplicateBudget(id)
    if (res.success) {
      toast({ title: t("toasts.duplicated") })
      await loadData()
    } else {
      toast({ title: t("toasts.errorLabel"), description: res.error, variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este orçamento?")) return
    const res = await deleteBudget(id)
    if (res.success) {
      toast({ title: t("toasts.deleted") })
      await loadData()
    } else {
      toast({ title: t("toasts.errorLabel"), description: res.error, variant: "destructive" })
    }
  }

  const [isStatusLoading, setIsStatusLoading] = useState(false)
  const handleStatusChange = async (id: string, status: BudgetStatus) => {
    if (isStatusLoading) return
    setIsStatusLoading(true)
    try {
      const res = await updateBudgetStatus(id, status)
      if (res.success) {
        toast({ title: t("toasts.statusUpdated", { status: t(`status.${status}`) }) })
        await loadData()
        // ✅ Update detail view if open
        if (viewingBudget && viewingBudget.id === id) {
          setViewingBudget({ ...viewingBudget, status })
        }
      } else {
        toast({ 
          title: t("toasts.errorLabel"), 
          description: res.error || "Erro ao atualizar status", 
          variant: "destructive" 
        })
      }
    } catch (err) {
      toast({ 
        title: t("toasts.errorLabel"), 
        description: err instanceof Error ? err.message : "Erro inesperado", 
        variant: "destructive" 
      })
    } finally {
      setIsStatusLoading(false)
    }
  }

  const filteredBudgets = budgets.filter((b) => {
    const matchesSearch =
      (b.patient?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Full-screen wizard for creating budget
  if (showWizard) {
    return (
      <BudgetWizard t={t}
        products={products}
        patients={patients}
        onClose={() => setShowWizard(false)}
        onCreated={async () => {
          setShowWizard(false)
          await loadData()
        }}
      />
    )
  }

  // Full-screen budget detail view
  if (viewingBudget) {
    return (
      <BudgetDetail t={t}
        budget={viewingBudget}
        onBack={() => { setViewingBudget(null); loadData() }}
        onStatusChange={handleStatusChange}
        onDuplicate={handleDuplicate}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Button
          onClick={() => setShowWizard(true)}
          className="bg-primary text-primary-foreground gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />{t("newBudget")}</Button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary"><FileText className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("stats.budgets")}</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalBudgets}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-500"><DollarSign className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("stats.revenue")}</p>
              <p className="text-2xl font-bold text-foreground">R$ {stats.totalRevenue.toFixed(0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-500"><TrendingUp className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("stats.netRevenue")}</p>
              <p className="text-2xl font-bold text-foreground">R$ {stats.netRevenue.toFixed(0)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-500"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t("stats.conversion")}</p>
              <p className="text-2xl font-bold text-foreground">{stats.conversionRate}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
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
        <div className="flex gap-1 flex-wrap">
          <Button variant={statusFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setStatusFilter("all")}>{t("all")}</Button>
          {(Object.keys(BUDGET_STATUS_LABELS) as BudgetStatus[]).map((s) => (
            <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(s)}>
              {BUDGET_STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Budget List */}
      {filteredBudgets.length === 0 ? (
        <Card className="p-12 border border-border text-center">
          <Receipt className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">{t("emptyTitle")}</h3>
          <p className="text-muted-foreground mb-4">{t("emptyDesc")}</p>
          <Button onClick={() => setShowWizard(true)} className="gap-2">
            <Plus className="w-4 h-4" />{t("createBudget")}</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBudgets.map((budget) => (
            <Card
              key={budget.id}
              className="p-4 sm:p-6 border border-border hover:shadow-lg transition-shadow cursor-pointer flex flex-col gap-4"
              onClick={() => setViewingBudget(budget)}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-foreground text-lg">
                      {budget.patient?.name || t("noClient")}
                    </h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 ${BUDGET_STATUS_COLORS[budget.status]}`}>
                      {t(`status.${budget.status}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{(budget.items || []).length} {(budget.items || []).length === 1 ? t("item") : t("items")}</span>
                    <span>{t("createdAt")} {new Date(budget.created_at).toLocaleDateString("pt-BR")}</span>
                    {budget.valid_until && (
                      <span>{t("validUntil")} {new Date(budget.valid_until).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {t("total")}: <span className="font-medium text-foreground">R$ {(budget.total_amount || 0).toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-red-500 font-medium">
                       {t("wizard.costs")}: - R$ {(budget.total_cost || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {t("net")} <span className="text-emerald-600 font-bold">R$ {(budget.net_revenue || 0).toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewingBudget(budget)}
                      className="text-muted-foreground hover:bg-primary/10"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(budget.id)} className="text-muted-foreground hover:bg-primary/10">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(budget.id)} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {budget.status === "approved" && (
                      <Button 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); handleStatusChange(budget.id, "paid") }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white ml-2 shadow-sm font-bold h-8"
                      >
                        <Check className="w-4 h-4 mr-1" /> {t("status.paid")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Status Update Row */}
              <div 
                className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("changeStatus")}:</span>
                  <div className="flex flex-wrap gap-1">
                    {(Object.keys(BUDGET_STATUS_LABELS) as BudgetStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(budget.id, s)}
                        disabled={budget.status === s}
                        className={`text-[9px] font-bold px-2 py-1 rounded transition-all transform hover:scale-105 ${
                          budget.status === s 
                          ? "opacity-30 cursor-not-allowed grayscale" 
                          : `${BUDGET_STATUS_COLORS[s]} hover:brightness-110 shadow-sm`
                        }`}
                      >
                        {t(`status.${s}`)}
                      </button>
                    ))}
                  </div>
                </div>
                
                <p className="text-[9px] italic text-muted-foreground text-right mt-1">
                  {t("detail.paidRequiredInfo")}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// BUDGET WIZARD – Multi-step creation flow
// ============================================================

function BudgetWizard({
  t,

  products,
  patients,
  onClose,
  onCreated,
}: {
  t: any
  products: ServiceProduct[]
  patients: Patient[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  // Step 1: Select client
  const [patientId, setPatientId] = useState("")
  const [patientSearch, setPatientSearch] = useState("")

  // Step 2: Products
  const [items, setItems] = useState<BudgetItemDraft[]>([])
  const [productSearch, setProductSearch] = useState("")

  // Step 3: Payment
  const [downPayment, setDownPayment] = useState(0)
  const [installmentCount, setInstallmentCount] = useState(1)
  const [installmentInterval, setInstallmentInterval] = useState<InstallmentInterval>("monthly")
  const [paymentMethods, setPaymentMethods] = useState<{ method: BudgetPaymentMethod['method']; amount: number }[]>([])
  const [notes, setNotes] = useState("")
  const [validUntil, setValidUntil] = useState("")
  
  // Additional costs
  const [additionalCosts, setAdditionalCosts] = useState<{ name: string; amount: number }[]>([])
  const [additionalTax, setAdditionalTax] = useState(0)

  const totals = useMemo(
    () => calculateBudgetTotals(items, downPayment, installmentCount),
    [items, downPayment, installmentCount],
  )

  const selectedPatient = patients.find((p) => p.id === patientId)

  // Add product
  const addProduct = (prod: ServiceProduct) => {
    const existing = items.find((i) => i.product_id === prod.id)
    if (existing) {
      setItems(items.map((i) =>
        i.product_id === prod.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setItems([...items, {
        product_id: prod.id,
        product_name: prod.name,
        quantity: 1,
        unit_price: prod.base_price,
        cost_per_unit: prod.cost || 0,
        tax_percent: prod.tax_percent,
      }])
    }
  }

  const updateItem = (index: number, field: keyof BudgetItemDraft, value: number) => {
    setItems(items.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const addPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { method: "pix", amount: 0 }])
  }

  const updatePaymentMethod = (index: number, field: string, value: any) => {
    setPaymentMethods(paymentMethods.map((pm, i) => i === index ? { ...pm, [field]: value } : pm))
  }

  const removePaymentMethod = (index: number) => {
    setPaymentMethods(paymentMethods.filter((_, i) => i !== index))
  }

  const applySuggestedPlan = (plan: { downPayment: number; installments: number; interval: "monthly" }) => {
    setDownPayment(plan.downPayment)
    setInstallmentCount(plan.installments)
    setInstallmentInterval(plan.interval)
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const res = await createBudget({
        patient_id: patientId,
        items,
        notes,
        valid_until: validUntil,
        down_payment: downPayment,
        installment_count: installmentCount,
        installment_interval: installmentInterval,
        payment_methods: paymentMethods,
      })
      if (!res.success) throw new Error(res.error)
      toast({ title: t("toasts.created") })
      onCreated()
    } catch (err) {
      toast({
        title: t("toasts.errorCreate"),
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return !!patientId
    if (step === 2) return items.length > 0
    return true
  }

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const filteredProducts = products.filter((p) =>
    p.active && p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  const suggestedPlans = useMemo(() => suggestPaymentPlans(totals.total_amount), [totals.total_amount])

  const STEPS = [
    { num: 1, label: t("wizard.steps.client") },
    { num: 2, label: t("wizard.steps.products") },
    { num: 3, label: t("wizard.steps.payment") },
    { num: 4, label: t("wizard.steps.summary") },
  ]

  return (
    <div className="space-y-6">
      {/* Wizard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t("newBudget")}</h2>
          <p className="text-muted-foreground">{t("wizard.step", { step })}</p>
        </div>
        <Button variant="outline" onClick={onClose} className="gap-2">
          <X className="w-4 h-4" />{t("wizard.cancel")}</Button>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-8 h-8 text-sm font-bold transition-colors ${
              step >= s.num
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {step > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${step > s.num ? "bg-primary" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="p-6 border border-border min-h-[400px]">
        {/* STEP 1: Client */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground mb-2">{t("wizard.clientTitle")}</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("wizard.searchClient")}
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid gap-2 max-h-[400px] overflow-y-auto">
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPatientId(p.id)}
                  className={`text-left p-4 border transition-all ${
                    patientId === p.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <p className="font-bold text-foreground">{p.name}</p>
                  <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                    {p.email && <span>{p.email}</span>}
                    {p.phone && <span>{p.phone}</span>}
                  </div>
                </button>
              ))}
              {filteredPatients.length === 0 && (
                <p className="text-center text-muted-foreground py-8">{t("wizard.noClientFound")}</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Products */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground mb-2">{t("wizard.productsTitle")}</h3>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("wizard.searchProducts")}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Available products grouped by category */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">{t("wizard.availableProducts")}</p>
                <div className="max-h-[400px] overflow-y-auto space-y-4 border border-border p-3 bg-slate-50/50 dark:bg-slate-900/50">
                  {Object.entries(
                    filteredProducts.reduce((acc, p) => {
                      const catName = p.category?.name || t("wizard.uncategorized")
                      if (!acc[catName]) acc[catName] = []
                      acc[catName].push(p)
                      return acc
                    }, {} as Record<string, ServiceProduct[]>)
                  ).map(([category, items]) => (
                    <div key={category} className="space-y-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {category}
                      </h4>
                      <div className="grid gap-1">
                        {items.map((prod) => (
                          <button
                            key={prod.id}
                            onClick={() => addProduct(prod)}
                            className="w-full text-left p-3 bg-white dark:bg-card hover:border-primary/50 hover:shadow-sm transition-all flex items-center justify-between border border-border rounded-lg group"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{prod.name}</p>
                              {prod.duration_minutes && (
                                <p className="text-[10px] text-muted-foreground">
                                  {prod.duration_minutes} min
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-foreground">R$ {prod.base_price.toFixed(2)}</span>
                              <div className="p-1 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                <Plus className="w-3 h-3" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm italic">
                      {t("wizard.noProducts")}
                    </p>
                  )}
                </div>
              </div>

              {/* Selected items */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {t("wizard.itemsInBudget", { count: items.length })}
                </p>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <div className="p-8 border border-dashed border-border text-center text-muted-foreground">
                      {t("wizard.clickToAdd")}
                    </div>
                  ) : (
                    items.map((item, idx) => {
                      const calc = calculateItemTotals(item)
                      return (
                        <div key={idx} className="p-3 border border-border bg-background">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-bold text-foreground text-sm">{item.product_name}</p>
                            <button onClick={() => removeItem(idx)} className="text-destructive p-1 hover:bg-muted">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground">{t("wizard.qty")}</label>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 1)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground">{t("wizard.unitPrice")}</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="text-[10px] text-muted-foreground">{t("wizard.total")}</label>
                              <span className="text-sm font-bold text-emerald-600 mt-1">
                                R$ {calc.total.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {item.tax_percent > 0 && (
                            <p className="text-[10px] text-amber-600 mt-1">
                              Imposto ({item.tax_percent}%): R$ {calc.tax_amount.toFixed(2)}
                            </p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Real-time totals */}
                {items.length > 0 && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-border">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("wizard.subtotal")}</span>
                        <span className="font-medium text-foreground">R$ {totals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("wizard.totalTax")}</span>
                        <span className="font-medium text-amber-600">R$ {(totals.total_tax + additionalTax).toFixed(2)}</span>
                      </div>
                      
                      {/* Additional Costs Section */}
                      {additionalCosts.length > 0 && (
                        <div className="pt-2 border-t border-border mt-2">
                          <p className="text-xs font-semibold text-foreground mb-1">Custos Adicionais:</p>
                          {additionalCosts.map((cost, idx) => (
                            <div key={idx} className="flex justify-between text-xs ml-2">
                              <span className="text-muted-foreground">{cost.name}</span>
                              <span className="text-destructive">- R$ {cost.amount.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-end border-t border-border pt-2">
                        <span className="font-bold text-foreground mb-1">{t("wizard.total")}</span>
                        <span className="font-bold text-primary text-4xl">R$ {(totals.total_amount + additionalTax - additionalCosts.reduce((sum, c) => sum + c.amount, 0)).toFixed(2)}</span>
                      </div>
                      {(totals.total_cost > 0 || additionalCosts.length > 0) && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{t("wizard.costs")}</span>
                            <span className="text-destructive">- R$ {(totals.total_cost + additionalCosts.reduce((sum, c) => sum + c.amount, 0)).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{t("wizard.netRevenue")}</span>
                            <span className="text-emerald-600 font-bold">R$ {(totals.net_revenue - additionalCosts.reduce((sum, c) => sum + c.amount, 0) + additionalTax).toFixed(2)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Additional Costs and Tax Input */}
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg space-y-3">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">Custos e Impostos Adicionais</p>
                  
                  {/* Additional tax input */}
                  <div>
                    <label className="text-xs text-muted-foreground">Imposto Adicional</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={additionalTax}
                      onChange={(e) => setAdditionalTax(parseFloat(e.target.value) || 0)}
                      placeholder="Ex: 50.00"
                      className="h-8 text-xs"
                    />
                  </div>
                  
                  {/* Additional costs list */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Custos Adicionais</label>
                    {additionalCosts.map((cost, idx) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <Input
                          type="text"
                          value={cost.name}
                          onChange={(e) => setAdditionalCosts(additionalCosts.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                          placeholder="Nome do custo"
                          className="h-7 text-xs flex-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={cost.amount}
                          onChange={(e) => setAdditionalCosts(additionalCosts.map((c, i) => i === idx ? { ...c, amount: parseFloat(e.target.value) || 0 } : c))}
                          placeholder="Valor"
                          className="h-7 text-xs w-20"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAdditionalCosts(additionalCosts.filter((_, i) => i !== idx))}
                          className="h-7 px-2"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAdditionalCosts([...additionalCosts, { name: "", amount: 0 }])}
                      className="gap-1 text-xs h-7"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar Custo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Payment Plan */}
        {step === 3 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-foreground mb-2">{t("wizard.paymentTitle")}</h3>

            {/* Suggested plans */}
            {suggestedPlans.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">{t("wizard.suggestions")}</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {suggestedPlans.map((plan, i) => {
                    const installmentValue = plan.installments > 0
                      ? Math.round((totals.total_amount - plan.downPayment) / plan.installments * 100) / 100
                      : 0
                    return (
                      <button
                        key={i}
                        onClick={() => applySuggestedPlan(plan)}
                        className="p-3 border border-border text-left hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <p className="text-sm font-bold text-foreground">{plan.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {plan.label === 'À vista' || (plan.downPayment >= totals.total_amount && installmentValue <= 0) ? (
                            `R$ ${totals.total_amount.toFixed(2)}`
                          ) : (
                            <>
                              {plan.downPayment > 0 && `Entrada: R$ ${plan.downPayment.toFixed(2)}`}
                              {installmentValue > 0 && (
                                <>
                                  {plan.downPayment > 0 ? ' + ' : ''}
                                  {plan.installments}x de R$ {installmentValue.toFixed(2)}
                                </>
                              )}
                            </>
                          )}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("wizard.downPayment")}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={downPayment}
                  onChange={(e) => setDownPayment(parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("wizard.installments")}</label>
                <Input
                  type="number"
                  min={1}
                  value={installmentCount}
                  onChange={(e) => setInstallmentCount(parseInt(e.target.value) || 1)}
                  className="bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("wizard.interval")}</label>
                <select
                  value={installmentInterval}
                  onChange={(e) => setInstallmentInterval(e.target.value as InstallmentInterval)}
                  className="w-full h-10 bg-background border border-input px-3 text-sm"
                >
                  {(Object.entries(INSTALLMENT_INTERVAL_LABELS)).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Installment preview */}
            {installmentCount > 0 && (
              <div className={`p-4 rounded-xl border-2 transition-all ${
                downPayment >= totals.total_amount && installmentCount > 1 
                ? "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/30"
                : "bg-primary/5 border-primary/20"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground font-medium">{t("wizard.installmentValue")}</span>
                    {downPayment >= totals.total_amount && installmentCount > 1 && (
                      <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">
                        Atenção: entrada cobre o valor total
                      </span>
                    )}
                  </div>
                  <span className={`text-2xl font-bold ${
                    downPayment >= totals.total_amount && installmentCount > 1 ? "text-amber-600" : "text-primary"
                  }`}>
                    R$ {totals.installment_value.toFixed(2)}
                  </span>
                </div>
                
                <div className="mt-2 pt-2 border-t border-dashed border-primary/20">
                  {downPayment >= totals.total_amount ? (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">
                        {installmentCount > 1 
                          ? "O valor de entrada atual quita o orçamento integralmente." 
                          : `Pagamento único de R$ ${downPayment.toFixed(2)}`
                        }
                      </p>
                      {installmentCount > 1 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] border-amber-400 text-amber-700 hover:bg-amber-50"
                          onClick={() => setDownPayment(0)}
                        >
                          Remover entrada e parcelar total
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground font-medium">
                      Entrada: R$ {downPayment.toFixed(2)}
                      {totals.installment_value > 0 && (
                        <> + {installmentCount}x de R$ {totals.installment_value.toFixed(2)} ({INSTALLMENT_INTERVAL_LABELS[installmentInterval].toLowerCase()})</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Payment methods */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">{t("wizard.paymentMethods")}</label>
                <Button variant="outline" size="sm" onClick={addPaymentMethod} className="gap-1">
                  <Plus className="w-3 h-3" />{t("wizard.addMethod")}
                </Button>
              </div>
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("wizard.noMethod")}</p>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((pm, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={pm.method}
                        onChange={(e) => updatePaymentMethod(idx, "method", e.target.value)}
                        className="h-10 bg-background border border-input px-3 text-sm flex-1"
                      >
                        {(Object.entries(PAYMENT_METHOD_LABELS)).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder={t("wizard.value")}
                        value={pm.amount || ""}
                        onChange={(e) => updatePaymentMethod(idx, "amount", parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <Button variant="ghost" size="sm" onClick={() => removePaymentMethod(idx)} className="text-destructive">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes & Validity */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("wizard.notes")}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("wizard.notesPlaceholder")}
                  className="w-full bg-background border border-input px-3 py-2 text-sm min-h-[80px]"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">{t("validUntil")}</label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Summary */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-foreground mb-2">Resumo do Orçamento</h3>

            {/* Client */}
            <div className="p-4 bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">{t("wizard.client")}</p>
              <p className="text-lg font-bold text-foreground">{selectedPatient?.name || "-"}</p>
            </div>

            {/* Items table */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Itens</p>
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium text-foreground">Produto</th>
                      <th className="text-center p-3 font-medium text-foreground">{t("wizard.qty")}</th>
                      <th className="text-right p-3 font-medium text-foreground">{t("wizard.unitPrice")}</th>
                      <th className="text-right p-3 font-medium text-foreground">{t("wizard.tax")}</th>
                      <th className="text-right p-3 font-medium text-foreground">{t("wizard.total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const calc = calculateItemTotals(item)
                      return (
                        <tr key={idx} className="border-t border-border">
                          <td className="p-3 font-medium text-foreground">{item.product_name}</td>
                          <td className="p-3 text-center text-foreground">{item.quantity}</td>
                          <td className="p-3 text-right text-foreground">R$ {item.unit_price.toFixed(2)}</td>
                          <td className="p-3 text-right text-amber-600">R$ {calc.tax_amount.toFixed(2)}</td>
                          <td className="p-3 text-right font-bold text-foreground">R$ {calc.total.toFixed(2)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 border border-border space-y-2">
                <h4 className="font-bold text-foreground mb-2">Financeiro</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("wizard.subtotal")}</span>
                  <span className="font-medium text-foreground">R$ {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("wizard.tax")}s</span>
                  <span className="font-medium text-amber-600">R$ {totals.total_tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="font-bold text-foreground">{t("wizard.totalValue")}</span>
                  <span className="font-bold text-foreground text-lg">R$ {totals.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("wizard.costs")}</span>
                  <span className="text-destructive">R$ {totals.total_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-emerald-600">{t("detail.net")}</span>
                  <span className="font-bold text-emerald-600">R$ {totals.net_revenue.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 border border-border space-y-2">
                <h4 className="font-bold text-foreground mb-2">{t("wizard.paymentInfo")}</h4>
                {downPayment > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("detail.downPayment")}</span>
                    <span className="font-medium text-foreground">R$ {downPayment.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("detail.installments")}</span>
                  <span className="font-medium text-foreground">
                    {installmentCount}x de R$ {totals.installment_value.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("wizard.interval")}</span>
                  <span className="font-medium text-foreground">
                    {t(`intervals.${installmentInterval}`)}
                  </span>
                </div>
                {paymentMethods.length > 0 && (
                  <div className="border-t border-border pt-2 mt-2">
                    <p className="text-xs text-muted-foreground mb-1">{t("wizard.paymentMethods")}</p>
                    {paymentMethods.map((pm, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-foreground">{t(`paymentMethods.${pm.method}`)}</span>
                        <span className="font-medium text-foreground">R$ {pm.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {notes && (
              <div className="p-3 bg-muted border border-border">
                <p className="text-xs text-muted-foreground">{t("wizard.notes")}</p>
                <p className="text-sm text-foreground">{notes}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> {t("common.previous")}
        </Button>
        {step < 4 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="gap-2"
          >
            {t("common.next")} <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <Check className="w-4 h-4" />{t("createBudget")}</Button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// BUDGET DETAIL VIEW
// ============================================================

function BudgetDetail({
  t,

  budget,
  onBack,
  onStatusChange,
  onDuplicate,
}: {
  budget: Budget
  onBack: () => void
  onStatusChange: (id: string, status: BudgetStatus) => void
  t: any
  onDuplicate: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> {t("detail.back")}
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onDuplicate(budget.id)} className="gap-1">
            <Copy className="w-4 h-4" /> {t("detail.duplicate")}
          </Button>
          {budget.status === "draft" && (
            <Button size="sm" onClick={() => onStatusChange(budget.id, "sent")} className="gap-1">
              {t("detail.sendToClient")}
            </Button>
          )}
          {budget.status === "sent" && (
            <>
              <Button size="sm" onClick={() => onStatusChange(budget.id, "approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                <Check className="w-4 h-4" /> {t("detail.approve")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onStatusChange(budget.id, "rejected")} className="text-destructive gap-1">
                <X className="w-4 h-4" /> {t("detail.reject")}
              </Button>
            </>
          )}
          {budget.status === "approved" && (
              <Button size="sm" onClick={() => onStatusChange(budget.id, "paid")} className="bg-emerald-600 hover:bg-emerald-700 shadow text-white gap-1 font-bold">
                <Check className="w-4 h-4" /> {t("detail.markAsPaid")} 
              </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold text-foreground">{t("detail.budget")}</h2>
            <span className={`text-xs uppercase font-bold px-2 py-1 ${BUDGET_STATUS_COLORS[budget.status]}`}>
              {t(`status.${budget.status}`)}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("wizard.client")}: <strong>{budget.patient?.name || "—"}</strong> • {t("createdAt")} {new Date(budget.created_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-foreground">R$ {budget.total_amount.toFixed(2)}</p>
          <p className="text-sm text-emerald-600 font-medium">{t("net")} R$ {budget.net_revenue.toFixed(2)}</p>
        </div>
      </div>

      {/* Items */}
      <Card className="border border-border overflow-hidden">
        <div className="p-4 bg-muted border-b border-border">
          <h3 className="font-bold text-foreground">{t("detail.itemsTitle")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-foreground">{t("detail.product")}</th>
                <th className="text-center p-3 font-medium text-foreground">{t("wizard.qty")}</th>
                <th className="text-right p-3 font-medium text-foreground">{t("wizard.unitPrice")}</th>
                <th className="text-right p-3 font-medium text-foreground">{t("wizard.subtotal")}</th>
                <th className="text-right p-3 font-medium text-foreground">{t("wizard.tax")}</th>
                <th className="text-right p-3 font-medium text-foreground">{t("wizard.total")}</th>
              </tr>
            </thead>
            <tbody>
              {(budget.items || []).map((item) => (
                <tr key={item.id} className="border-b border-border">
                  <td className="p-3 font-medium text-foreground">{item.product_name}</td>
                  <td className="p-3 text-center text-foreground">{item.quantity}</td>
                  <td className="p-3 text-right text-foreground">R$ {item.unit_price.toFixed(2)}</td>
                  <td className="p-3 text-right text-foreground">R$ {item.subtotal.toFixed(2)}</td>
                  <td className="p-3 text-right text-amber-600">R$ {item.tax_amount.toFixed(2)}</td>
                  <td className="p-3 text-right font-bold text-foreground">R$ {item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-6 border border-border bg-white dark:bg-card">
          <h4 className="font-bold text-foreground mb-4">{t("detail.financialSummary")}</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("wizard.subtotal")}</span>
              <span className="text-foreground">R$ {budget.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("wizard.totalTax")}</span>
              <span className="text-amber-600">R$ {budget.total_tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
              <span className="text-foreground">{t("wizard.total")}</span>
              <span className="text-foreground text-lg">R$ {budget.total_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("wizard.costs")}</span>
              <span className="text-destructive">- R$ {budget.total_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-emerald-600">{t("net")}</span>
              <span className="text-emerald-600">R$ {(budget.net_revenue || 0).toFixed(2)}</span>
            </div>
            
            {budget.status !== "paid" && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-tight">
                  <span className="font-bold">💡 {t("total")}: </span>
                  {t("detail.paidRequiredInfo")}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 border border-border bg-white dark:bg-card">
          <h4 className="font-bold text-foreground mb-4">{t("detail.paymentPlan")}</h4>
          <div className="space-y-2">
            {budget.down_payment > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("detail.downPayment")}</span>
                <span className="text-foreground font-medium">R$ {budget.down_payment.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("detail.installments")}</span>
              <span className="text-foreground font-medium">
                {budget.installment_count}x de R$ {budget.installment_value.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("wizard.interval")}</span>
              <span className="text-foreground">{t(`intervals.${budget.installment_interval}`)}</span>
            </div>
            {(budget.payment_methods || []).length > 0 && (
              <div className="border-t border-border pt-2 mt-2 space-y-1">
                <p className="text-xs text-muted-foreground font-medium">{t("wizard.paymentMethods")}</p>
                {(budget.payment_methods || []).map((pm) => (
                  <div key={pm.id} className="flex justify-between text-sm">
                    <span className="text-foreground">{t(`paymentMethods.${pm.method}`)}</span>
                    <span className="font-medium text-foreground">R$ {pm.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {budget.notes && (
        <Card className="p-4 border border-border">
          <p className="text-xs text-muted-foreground">{t("wizard.notes")}</p>
          <p className="text-sm text-foreground mt-1">{budget.notes}</p>
        </Card>
      )}
    </div>
  )
}
