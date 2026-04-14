"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { addExpense } from "@/app/actions/closing-actions"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

export default function ExpenseModal({ open, onOpenChange, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; onAdd: () => void }) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("Impostos")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const { toast } = useToast()
  const t = useTranslations("dashboard.expense")

  const handleSave = async () => {
    if (!amount) return
    setLoading(true)
    try {
      const res = await addExpense({
        amount: Number(amount.replace(",", ".")),
        category,
        description,
        date
      })
      if (res.success) {
        toast({ title: t('successTitle'), description: t('successDesc') })
        onAdd()
        onOpenChange(false)
        setAmount("")
        setDescription("")
      } else {
        toast({ title: t('errorTitle'), description: res.error || t('errorDesc'), variant: 'destructive'})
      }
    } catch(e) {
      toast({ title: t('errorTitle'), description: t('errorConnect'), variant: 'destructive'})
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-none">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-wider">{t('title')}</DialogTitle>
          <DialogDescription>
            {t('desc')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>{t('amount')}</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="rounded-none" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('category')}</Label>
            <Select value={category} onValueChange={setCategory}>
               <SelectTrigger className="rounded-none">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent className="rounded-none">
                 <SelectItem value="Impostos">{t('catTaxes')}</SelectItem>
                 <SelectItem value="Materiais">{t('catMaterials')}</SelectItem>
                 <SelectItem value="Salários">{t('catSalaries')}</SelectItem>
                 <SelectItem value="Operacional">{t('catOperational')}</SelectItem>
                 <SelectItem value="Outros">{t('catOther')}</SelectItem>
               </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-none" />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t('description')}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descPlaceholder')} className="rounded-none resize-none" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-none">{t('cancel')}</Button>
          <Button onClick={handleSave} disabled={loading || !amount} className="rounded-none bg-red-600 hover:bg-red-700 text-white min-w-[100px]">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
