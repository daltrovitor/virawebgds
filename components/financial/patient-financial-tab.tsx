"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/ui/data-table"
import { format } from "date-fns"
import { ptBR, enUS } from "date-fns/locale"
import { useTranslations, useLocale } from "next-intl"
import { AlertTriangle, Check, Clock } from "lucide-react"
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
  const t = useTranslations("dashboard.patientFinancialTab")
  const tCommon = useTranslations("dashboard.financial")
  const locale = useLocale()
  const dateLocale = locale === "en" ? enUS : ptBR

  const columns: ColumnDef<Payment>[] = [
    {
      accessorKey: "payment_date",
      header: t("columns.date"),
      cell: ({ row }) => {
        const date = row.getValue("payment_date") as string
        return date ? format(new Date(date), "dd/MM/yyyy", { locale: dateLocale }) : "-"
      },
    },
    {
      accessorKey: "amount",
      header: t("columns.amount"),
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amount"))
        const discount = parseFloat(row.getValue("discount") || "0")
        return `R$ ${(amount - discount).toFixed(2)}`
      },
    },
    {
      accessorKey: "discount",
      header: t("columns.discount"),
      cell: ({ row }) => {
        const discount = parseFloat(row.getValue("discount") || "0")
        return discount > 0 ? `R$ ${discount.toFixed(2)}` : "-"
      },
    },
    {
      accessorKey: "status",
      header: t("columns.status"),
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
      header: t("columns.dueDate"),
      cell: ({ row }) => {
        const date = row.getValue("due_date") as string
        return date ? format(new Date(date), "dd/MM/yyyy", { locale: dateLocale }) : "-"
      },
    },
    {
      id: 'actions',
      header: t("columns.actions"),
      cell: ({ row }) => {
        const status = row.getValue('status') as string
        return (
          <div>
            {(status === 'pending' || status === 'overdue') && (
              <button
                className="text-sm text-primary underline"
                onClick={() => onOpenPaymentModal && onOpenPaymentModal(row.original.id)}
              >
                {t("actions.settle")}
              </button>
            )}
          </div>
        )
      }
    }
  ]

  return (
    <Tabs defaultValue="history" className="w-full">
      <TabsList>
        <TabsTrigger value="history">{t("title")}</TabsTrigger>
      </TabsList>

      <TabsContent value="history" className="space-y-4">
        <DataTable
          columns={columns}
          data={payments}
          loading={loading}
          noResults={t("empty")}
        />
      </TabsContent>


    </Tabs>
  )
}
