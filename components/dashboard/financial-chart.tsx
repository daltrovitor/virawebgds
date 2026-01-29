"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import * as Recharts from "recharts"
import { getFinancialSeries } from "@/app/actions/financial-actions"
import { useTranslations } from "next-intl"

export default function FinancialChart({ days = 30 }: { days?: number }) {
  const [series, setSeries] = useState<{ date: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const t = useTranslations("dashboard.financial")

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await getFinancialSeries(days)
        if (mounted) setSeries(data || [])
      } catch (err) {
        console.error("Error loading financial series:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [days])

  return (
    <Card className="p-4 border border-border">
      <h3 className="text-lg font-bold mb-2">{t('chartTitle', { days })}</h3>
      {loading ? (
        <div className="text-sm text-muted-foreground">{t('chart.loading')}</div>
      ) : (
        <ChartContainer id="financial-series" config={{ received: { label: t('chartLabel'), color: "#16a34a" } }}>
          <Recharts.LineChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <Recharts.CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <Recharts.XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
            <Recharts.YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Recharts.Line type="monotone" dataKey="value" name={t('chartValue')} stroke="#16a34a" strokeWidth={2} dot={false} />
          </Recharts.LineChart>
        </ChartContainer>
      )}
    </Card>
  )
}
