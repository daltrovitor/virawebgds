"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreditCard, DollarSign, Clock } from "lucide-react"
import {
  getFinancialSummary,
  getRecentPayments,
} from "@/app/actions/financial-actions"
import { AttendanceTab } from "@/components/financial/attendance-tab"
import PaymentModal from "@/components/financial/payment-modal"
import FinancialChart from "./financial-chart"
import PendingPaymentsModal from "@/components/financial/pending-payments-modal"
import { useTranslations } from 'next-intl'

export default function FinancialTab() {
  const [activeTab, setActiveTab] = useState("payments")
  const [summary, setSummary] = useState({ totalReceived: 0, totalDiscounts: 0, totalPending: 0 })
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showPendingModal, setShowPendingModal] = useState(false)
  const t = useTranslations('dashboard.financial')

  const loadSummary = async () => {
    try {
      const s = await getFinancialSummary("monthly")
      const recent = await getRecentPayments(10)
      setSummary(s)
      setRecentPayments(recent || [])
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card className="p-6 shadow-md border-0 bg-white dark:bg-card">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-800/10 dark:bg-emerald-900/30 text-emerald-400">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{t('cards.received')}</p>
                  <p className="text-3xl font-bold text-emerald-400">R$ {Number(summary.totalReceived || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 shadow-md border-0 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-transparent dark:to-transparent dark:bg-gradient-to-br">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-800/10 dark:bg-amber-900/30 text-amber-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{t('cards.pending')}</p>
                  <p className="text-3xl font-bold text-foreground">R$ {Number(summary.totalPending || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 shadow-md border-0 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-transparent dark:to-transparent dark:bg-gradient-to-br">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-foreground">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{t('cards.discounts')}</p>
                  <p className="text-3xl font-bold text-foreground">R$ {Number(summary.totalDiscounts || 0).toFixed(2)}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
            <h3 className="text-xl font-bold text-foreground">{t('recentPayments')}</h3>
            <div className="flex gap-2">
              <Button onClick={() => setShowModal(true)} className="bg-primary text-primary-foreground shadow">
                {t('registerPayment')}
              </Button>
              <Button onClick={() => setShowPendingModal(true)} variant="outline">
                {t('managePending')}
              </Button>
            </div>
          </div>

          {/* Lista de pagamentos recentes em cards */}
          <div className="flex flex-col gap-4">
            {recentPayments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground rounded-lg border bg-white dark:bg-slate-900 shadow">
                {t('noPayments')}
              </div>
            ) : (
              recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row items-center justify-between gap-2 p-4 bg-white dark:bg-card rounded-xl border border-border dark:border-slate-700 shadow-sm hover:shadow-md transition relative"
                >
                  <div className="flex-1 flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex flex-col items-start min-w-[160px]">
                      <span className="font-semibold text-lg text-foreground">{(payment.patients?.name || payment.patient?.name) || "-"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-row gap-6 items-center ml-0 sm:ml-8">
                      <span
                        className={`text-base font-bold ${payment.status === "paid" ? "text-emerald-400" : "text-foreground"
                          }`}
                      >
                        R$ {Number(payment.amount).toFixed(2)}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">
                        {payment.discount ? `${t('discount')}: R$ ${Number(payment.discount).toFixed(2)}` : ""}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ml-0 sm:ml-8 ${payment.status === "paid"
                        ? "bg-emerald-600 text-white"
                        : payment.status === "pending"
                          ? "bg-amber-600 text-white"
                          : payment.status === "overdue"
                            ? "bg-red-600 text-white"
                            : "bg-gray-500 text-white"
                        }`}
                    >
                      {payment.status === "paid" && t('status.paid')}
                      {payment.status === "pending" && t('status.pending')}
                      {payment.status === "overdue" && t('status.overdue')}
                      {payment.status === "refunded" && t('status.refunded')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Seção de relatórios financeiros */}
          <div className="mt-6">
            <h3 className="text-xl font-bold mb-3">{t('report')}</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <FinancialChart days={30} />
              <div className="bg-white dark:bg-card rounded-xl border border-border dark:border-slate-700 p-4 shadow-sm">
                <h4 className="font-semibold mb-2">{t('summary')}</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
                      <span className="text-foreground">{t('summaryStats.received')}</span>
                    </span>
                    <span className="font-medium text-emerald-400">R$ {Number(summary.totalReceived || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{t('summaryStats.discounts')}</span>
                    <span className="font-medium text-foreground">R$ {Number(summary.totalDiscounts || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">{t('summaryStats.pending')}</span>
                    <span className="font-medium text-foreground">R$ {Number(summary.totalPending || 0).toFixed(2)}</span>
                  </div>
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
        </>
      ) : (
        <AttendanceTab />
      )}
    </div>
  )
}
