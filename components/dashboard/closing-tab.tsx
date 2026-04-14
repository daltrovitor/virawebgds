"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calculator, FileText, TrendingUp, TrendingDown, Clock, Download, Plus, Receipt } from "lucide-react"
import { getClosingData } from "@/app/actions/closing-actions"
import { useToast } from "@/hooks/use-toast"
import { useTranslations, useLocale } from "next-intl"

interface ClosingData {
    totalRevenue: number
    totalExpenses: number
    netProfit: number
    totalBudgetsApproved: number
    totalBudgetsPending: number
    completedAppointments: number
}

export default function ClosingTab() {
    const today = new Date()
    const [month, setMonth] = useState(today.getMonth() + 1)
    const [year, setYear] = useState(today.getFullYear())
    const [taxRate, setTaxRate] = useState(0)
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<ClosingData | null>(null)
    const { toast } = useToast()
    const t = useTranslations("dashboard.closing")
    const locale = useLocale()

    useEffect(() => {
        loadData()
    }, [month, year])

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await getClosingData(month, year)
            if (res.success && res.data) {
                setData(res.data)
            }
        } catch (e) {
            toast({ title: t('errorTitle'), description: t('errorDesc'), variant: 'destructive'})
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-US', { style: 'currency', currency: 'BRL' }).format(val)
    }

    const netTaxAmount = data ? data.totalRevenue * (taxRate / 100) : 0
    const finalProfit = data ? data.netProfit - netTaxAmount : 0

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 border-l-4 border-primary pl-3">{t('title')}</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">{t('desc')}</p>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={month.toString()} onValueChange={(val) => setMonth(Number(val))}>
                        <SelectTrigger className="w-32 bg-white rounded-none">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                            {Array.from({length: 12}).map((_, i) => (
                                <SelectItem key={i+1} value={(i+1).toString()}>{new Date(2000, i).toLocaleString(locale, { month: 'long' })}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year.toString()} onValueChange={(val) => setYear(Number(val))}>
                        <SelectTrigger className="w-24 bg-white rounded-none">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                            {[year-2, year-1, year, year+1].map(y => (
                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <div className="h-40 flex items-center justify-center text-slate-400">{t('loading')}</div>
            ) : data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="rounded-none border-t-4 border-t-primary shadow-sm">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-primary/10 p-2 text-primary">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('grossRevenue')}</p>
                                <h3 className="text-2xl font-black text-slate-900">{formatCurrency(data.totalRevenue)}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-none border-t-4 border-t-red-500 shadow-sm">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-red-100 p-2 text-red-600">
                                        <TrendingDown className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('costsExpenses')}</p>
                                <h3 className="text-2xl font-black text-slate-900">{formatCurrency(data.totalExpenses)}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-none border-t-4 border-t-blue-500 shadow-sm">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-blue-100 p-2 text-blue-600">
                                        <Receipt className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('approvedBudgets')}</p>
                                <h3 className="text-2xl font-black text-slate-900">{formatCurrency(data.totalBudgetsApproved)}</h3>
                            </CardContent>
                        </Card>

                        <Card className="rounded-none border-t-4 border-t-slate-800 shadow-sm bg-slate-50">
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-slate-200 p-2 text-slate-700">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                </div>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{t('confirmedAttendance')}</p>
                                <h3 className="text-2xl font-black text-slate-900">{data.completedAppointments} {t('appointments')}</h3>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                        <div className="lg:col-span-2 space-y-6">
                            <Card className="rounded-none shadow-sm">
                                <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
                                    <CardTitle className="text-lg uppercase tracking-wider flex items-center gap-2 text-slate-800">
                                        <Calculator className="w-5 h-5 text-primary" />
                                        {t('calculatorTitle')}
                                    </CardTitle>
                                    <CardDescription>{t('calculatorDesc')}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div>
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('taxRate')}</Label>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <Input 
                                                        type="number" 
                                                        value={taxRate} 
                                                        onChange={(e) => setTaxRate(Number(e.target.value))} 
                                                        className="rounded-none w-24 text-center font-bold" 
                                                        min={0}
                                                        max={100}
                                                    />
                                                    <span className="font-bold text-slate-500">%</span>
                                                </div>
                                                <p className="text-xs text-slate-400 mt-2">{t('taxHint')}</p>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 border border-slate-200 p-6 flex flex-col justify-center">
                                            <div className="flex justify-between items-center mb-3 text-sm">
                                                <span className="font-medium text-slate-600">{t('grossProfit')}</span>
                                                <span className="font-medium text-slate-900">{formatCurrency(data.netProfit)}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-4 text-sm">
                                                <span className="font-medium text-slate-600">{t('taxes', { rate: taxRate })}</span>
                                                <span className="font-medium text-red-600">-{formatCurrency(netTaxAmount)}</span>
                                            </div>
                                            <div className="h-px bg-slate-200 mb-4" />
                                            <div className="flex justify-between items-center">
                                                <span className="font-bold text-slate-800 uppercase tracking-wider text-sm">{t('netProfit')}</span>
                                                <span className={`text-2xl font-black ${finalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {formatCurrency(finalProfit)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        
                        <div className="space-y-6">
                           <Card className="rounded-none shadow-sm h-full border-l-4 border-l-slate-300">
                                <CardHeader className="pb-4">
                                    <CardTitle className="text-sm uppercase tracking-wider font-bold">{t('strategicSummary')}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-slate-500">{t('pendingBudgets', { amount: formatCurrency(data.totalBudgetsPending) })}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500">{t('taxImpact', { percent: ((netTaxAmount / (data.totalRevenue||1)) * 100).toFixed(1) })}</p>
                                    </div>
                                    
                                    <Button variant="outline" className="w-full rounded-none mt-4 gap-2 font-bold uppercase tracking-wider text-[11px]" onClick={() => window.print()}>
                                        <Download className="w-3 h-3" />
                                        {t('exportPdf')}
                                    </Button>
                                </CardContent>
                           </Card>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
