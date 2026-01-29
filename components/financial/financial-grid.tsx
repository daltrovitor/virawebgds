"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Search, Check, AlertTriangle, Download, Clock } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { Payment } from "@/app/actions/financial-actions"

interface FinancialGridProps {
  data: Payment[]
  loading: boolean
  onPeriodChange: (period: string) => void
  onSearch: (term: string) => void
  onExport: () => void
}

const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "payment_date",
    header: "Data",
    cell: ({ row }) => {
      const date = row.getValue("payment_date") as string
      return date ? format(new Date(date), "dd/MM/yyyy", { locale: ptBR }) : "-"
    },
  },
  {
    id: 'patient',
    header: "Cliente",
    cell: ({ row }) => {
      const orig: any = row.original
      const name = orig?.patients?.name || orig?.patient?.name || "-"
      return name
    },
  },
  {
    accessorKey: "amount",
    header: "Valor",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      const discount = parseFloat(row.getValue("discount") || "0")
      return `R$ ${(amount - discount).toFixed(2)}`
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <div className="flex items-center">
          {status === "paid" && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs flex items-center">
              <Check className="w-3 h-3 mr-1" />
              Pago
            </span>
          )}
          {status === "pending" && (
            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Pendente
            </span>
          )}
          {status === "overdue" && (
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Atrasado
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "due_date",
    header: "Vencimento",
    cell: ({ row }) => {
      const date = row.getValue("due_date") as string
      return date ? format(new Date(date), "dd/MM/yyyy", { locale: ptBR }) : "-"
    },
  },
]

export function FinancialGrid({ data, loading, onPeriodChange, onSearch, onExport }: FinancialGridProps) {
  const [searchTerm, setSearchTerm] = useState("")

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar cliente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                onSearch(e.target.value)
              }}
              className="pl-8"
            />
          </div>
          <Select onValueChange={onPeriodChange} defaultValue="month">
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
              <SelectItem value="quarter">Último trimestre</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onExport} className="flex gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        noResults="Nenhum pagamento encontrado"
      />
    </Card>
  )
}
