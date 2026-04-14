"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, DollarSign, Clock, TrendingUp } from "lucide-react"
import {
  getFinancialSummary,
  getRecentPayments,
  getRecentExpenses,
  Payment,
  Expense
} from "@/app/actions/financial-actions"
import { AttendanceTab } from "@/components/financial/attendance-tab"
import PaymentModal from "@/components/financial/payment-modal"
import FinancialChart from "./financial-chart"
import PendingPaymentsModal from "@/components/financial/pending-payments-modal"
import ExpenseModal from "@/components/financial/expense-modal"
import { useTranslations } from 'next-intl'
import CostsChart from "./costs-chart"

export default function FinancialTab({ isDemo = false }: { isDemo?: boolean }) {
  const [activeTab, setActiveTab] = useState("payments")
  const [summary, setSummary] = useState({ totalReceived: 0, totalDiscounts: 0, totalPending: 0, totalExpenses: 0 })
  const [recentPayments, setRecentPayments] = useState<Payment[]>([])
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const t = useTranslations('dashboard.financial')

  const loadSummary = async () => {
    if (isDemo) {
      setSummary({ totalReceived: 12450.00, totalDiscounts: 450.00, totalPending: 2350.00, totalExpenses: 1200.00 })
      setRecentPayments([
        { id: "1", patient_name: "Maria Silva", amount: 250.00, status: "paid", payment_date: new Date().toISOString() },
        { id: "2", patient_name: "Carlos Mendes", amount: 180.00, status: "pending", payment_date: new Date().toISOString() },
        { id: "3", patient_name: "Beatriz Lima", amount: 300.00, status: "paid", payment_date: new Date().toISOString() },
      ])
      return
    }
    try {
      const s = await getFinancialSummary("monthly")
      const [recentP, recentE] = await Promise.all([
        getRecentPayments(10),
        getRecentExpenses(10)
      ])

      setSummary(s)
      setRecentPayments(recentP || [])
      setRecentExpenses(recentE || [])
    } catch (err) {
      console.error("Error loading financial data:", err)
    }
  }

  useEffect(() => {
    loadSummary()
  }, [])

  return (
    <div className="space-y-8 px-2 sm:px-0">
      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 font-medium ${activeTab === "payments"
            ? "border-b-2 border-primary text-primary"
            : "text-muted-foreground hover:text-foreground"
            }`}
          onClick={() => setActiveTab("payments")}
        >
          {t('tabs.finance')}
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === "attendance"
            ? "border-b-2 border-primary text-primary"
            : "text-muted-foreground hover:text-foreground"
            }`}
          onClick={() => setActiveTab("attendance")}
        >
          {t('tabs.attendance')}
        </button>
      </div>

      {activeTab === "payments" ? (
        <>
          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-6 transition-all hover:shadow-lg border-0 bg-white dark:bg-card">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('cards.received')}</p>
                  <p className="text-2xl font-black text-emerald-500">R$ {Number(summary.totalReceived || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 transition-all hover:shadow-lg border-0 bg-white dark:bg-card">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-500/10 text-red-500">
                  <TrendingUp className="w-6 h-6 rotate-180" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('cards.expenses')}</p>
                  <p className="text-2xl font-black text-red-500">R$ {Number(summary.totalExpenses || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 transition-all hover:shadow-lg border-0 bg-white dark:bg-card">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('cards.discounts')}</p>
                  <p className="text-2xl font-black text-blue-500">R$ {Number(summary.totalDiscounts || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 transition-all hover:shadow-lg border-0 bg-white dark:bg-card">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('cards.pending')}</p>
                  <p className="text-2xl font-black text-amber-500">R$ {Number(summary.totalPending || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Pagamentos Recentes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">{t('recentPayments')}</h3>
                <div className="flex gap-2">
                  <Button onClick={() => setShowModal(true)} size="sm" className="bg-primary text-primary-foreground shadow">
                    + Pagamento
                  </Button>
                  <Button onClick={() => setShowPendingModal(true)} size="sm" variant="outline">
                    Pendentes
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {recentPayments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground rounded-lg border bg-white dark:bg-slate-900 shadow">
                    {t('noPayments')}
                  </div>
                ) : (
                  recentPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-xl border border-border dark:border-slate-700 shadow-sm hover:shadow transition"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground truncate max-w-[150px]">
                          {(payment.patient?.name || (payment as any).patients?.name) || (payment as any).patient_name || "-"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(payment.payment_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                         <span className={`text-sm font-bold ${payment.status === "paid" ? "text-emerald-400" : "text-foreground"}`}>
                           R$ {Number(payment.amount).toFixed(2)}
                         </span>
                         <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                           payment.status === "paid" ? "bg-emerald-600/10 text-emerald-500" : "bg-amber-600/10 text-amber-500"
                         }`}>
                           {payment.status === "paid" ? "PAGO" : "PENDENTE"}
                         </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Custos Recentes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-foreground">{t('recentExpenses')}</h3>
                <Button onClick={() => setShowExpenseModal(true)} size="sm" className="bg-red-600 hover:bg-red-700 text-white shadow">
                  {t('addExpense')}
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {recentExpenses.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground rounded-lg border bg-white dark:bg-slate-900 shadow">
                    Nenhum custo encontrado.
                  </div>
                ) : (
                  recentExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-card rounded-xl border border-border dark:border-slate-700 shadow-sm hover:shadow transition"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground truncate max-w-[150px]">
                          {expense.description || expense.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(expense.expense_date).toLocaleDateString()} • {expense.category}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-red-500">
                          - R$ {Number(expense.amount).toFixed(2)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 uppercase">
                           Custo
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="mt-12 space-y-4">
            <h3 className="text-xl font-bold">{t('report')}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FinancialChart days={30} />
              <CostsChart days={30} />
            </div>
            
            {/* Resumo Consolidado */}
            <div className="bg-white dark:bg-card rounded-xl border border-border dark:border-slate-700 p-6 shadow-sm">
              <h4 className="font-semibold mb-4 capitalize">{t('summary')} {t('consolidated')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t('summaryStats.received')}</span>
                  <span className="text-xl font-bold text-emerald-400">R$ {Number(summary.totalReceived || 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t('cards.expenses')}</span>
                  <span className="text-xl font-bold text-red-500">R$ {Number(summary.totalExpenses || 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t('summaryStats.discounts')}</span>
                  <span className="text-xl font-bold text-blue-500">R$ {Number(summary.totalDiscounts || 0).toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t('netBalance')}</span>
                  <p className={`text-2xl font-black ${(Number(summary.totalReceived || 0) - Number(summary.totalExpenses || 0)) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    R$ {(Number(summary.totalReceived || 0) - Number(summary.totalExpenses || 0)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <PaymentModal
            open={showModal}
            onOpenChange={setShowModal}
            onSaved={async () => {
              setShowModal(false)
              await loadSummary()
            }}
          />
          <PendingPaymentsModal
            open={showPendingModal}
            onOpenChange={setShowPendingModal}
            onUpdated={async () => {
              await loadSummary()
              setShowPendingModal(false)
            }}
          />
          <ExpenseModal
            open={showExpenseModal}
            onOpenChange={setShowExpenseModal}
            onSaved={async () => {
              setShowExpenseModal(false)
              await loadSummary()
            }}
          />
        </>
      ) : (
        <AttendanceTab />
      )}
      {/* Modal Custos */}
      {showExpenseModal && (
        <ExpenseModal
          open={showExpenseModal}
          onOpenChange={setShowExpenseModal}
          onAdd={loadSummary}
        />
      )}
    </div>
  )
}
