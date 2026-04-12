"use client"

import { useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { format } from "date-fns"
import { ptBR, enUS } from "date-fns/locale"
import { useTranslations, useLocale } from "next-intl"
import { AlertTriangle, Check, Clock, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ColumnDef } from "@tanstack/react-table"
import type { Payment } from "@/app/actions/financial-actions"
import { AttendanceTab } from "@/components/financial/attendance-tab"

interface PatientFinancialTabProps {
  patientId: string
  payments: Payment[]
  onOpenPaymentModal?: (pendingPaymentId?: string | null) => void
}

// columns are defined inside the component so we can close over props (eg. onOpenPaymentModal)

export function PatientFinancialTab({ patientId, payments, onOpenPaymentModal }: PatientFinancialTabProps) {
  const [loading] = useState(false)
  const t = useTranslations("dashboard.financial.patientFinancialTab")
  const tCommon = useTranslations("dashboard.financial")
  const locale = useLocale()
  const dateLocale = locale === "en" ? enUS : ptBR

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "payment_date",
      header: () => <div className="min-w-[100px]">{t("columns.date")}</div>,
      cell: ({ row }) => {
        const date = row.getValue("payment_date") as string
        return date ? format(new Date(date), "dd/MM/yyyy", { locale: dateLocale }) : "-"
      },
    },
    {
      accessorKey: "amount",
      header: () => <div className="min-w-[80px]">{t("columns.amount")}</div>,
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"))
        const discount = parseFloat(row.getValue("discount") || "0")
        return `R$ ${(amount - discount).toFixed(2)}`
      },
    },
    {
      accessorKey: "discount",
      header: () => <div className="min-w-[80px]">{t("columns.discount")}</div>,
      cell: ({ row }) => {
        const discount = parseFloat(row.getValue("discount") || "0")
        return discount > 0 ? `R$ ${discount.toFixed(2)}` : "-"
      },
    },
    {
      accessorKey: "status",
      header: () => <div className="min-w-[100px]">{t("columns.status")}</div>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return (
          <div className="flex items-center">
            {status === "paid" && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs flex items-center">
                <Check className="w-3 h-3 mr-1" />
                {tCommon("status.paid")}
              </span>
            )}
            {status === "pending" && (
              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {tCommon("status.pending")}
              </span>
            )}
            {status === "overdue" && (
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {tCommon("status.overdue")}
              </span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "due_date",
      header: () => <div className="min-w-[100px]">{t("columns.dueDate")}</div>,
      cell: ({ row }) => {
        const date = row.getValue("due_date") as string
        return date ? format(new Date(date), "dd/MM/yyyy", { locale: dateLocale }) : "-"
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-right pr-4 min-w-[160px]">{t("columns.actions")}</div>,
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <div className="flex justify-end pr-4 py-1 w-[160px] ml-auto">
            {(status === 'pending' || status === 'overdue') && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs h-8 px-3 border-primary/20 hover:border-primary hover:bg-primary/5 text-primary whitespace-nowrap"
                onClick={() => onOpenPaymentModal && onOpenPaymentModal(row.original.id)}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("actions.settle")}</span>
                <span className="sm:hidden">{t("actions.settle").split(' ')[0]}</span>
              </Button>
            )}
          </div>
        )
      },
      size: 160,
      minSize: 160,
      maxSize: 160,
    }
  ]

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">{t("title")}</h3>
      </div>

      <div className="w-full">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          noResults={t("empty")}
        />
      </div>
    </div>
  )
}
