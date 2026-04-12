"use client"

import { Card } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface FinancialMetricsProps {
  data: {
    date: string
    income: number
    expenses: number
    defaultRate: number
  }[]
}

export function FinancialMetrics({ data }: FinancialMetricsProps) {
  return (
    <Card className="p-4">
      <h3 className="text-lg font-semibold mb-4">Métricas Financeiras</h3>
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), "dd/MM", { locale: ptBR })}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(date) => format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
              formatter={(value: number) => [`R$ ${value.toFixed(2)}`, ""]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="income"
              name="Receitas"
              stroke="#10b981"
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              name="Despesas"
              stroke="#ef4444"
              activeDot={{ r: 8 }}
            />
            <Line
              type="monotone"
              dataKey="defaultRate"
              name="Inadimplência"
              stroke="#f59e0b"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
