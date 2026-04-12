"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getAllPendingPayments, markPendingPaymentAsPaid } from "@/app/actions/financial-actions"
import { useToast } from "@/hooks/use-toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated?: () => void
}

export default function PendingPaymentsModal({ open, onOpenChange, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const { toast } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const data = await getAllPendingPayments()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error loading pending payments:', err)
      toast({ title: 'Erro', description: 'Falha ao carregar pagamentos pendentes.' , variant: 'destructive'})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const handleMarkPaid = async (id: string) => {
    try {
      setLoading(true)
      await markPendingPaymentAsPaid(id)
      toast({ title: 'Pago', description: 'Pagamento marcado como pago.' })
      // refresh
      await load()
      if (onUpdated) onUpdated()
    } catch (err) {
      console.error('Error marking pending as paid:', err)
      toast({ title: 'Erro', description: 'Não foi possível marcar o pagamento como pago.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pagamentos Pendentes</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {loading && (
            <div className="text-center py-6">Carregando...</div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-6">Nenhum pagamento pendente encontrado.</div>
          )}

          {!loading && items.length > 0 && (
            <div className="grid gap-3">
              {items.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 border rounded bg-white">
                  <div>
                    <div className="font-medium">{p.patients?.name || 'Sem cliente'}</div>
                    <div className="text-sm text-muted-foreground">R$ {Number(p.amount || 0).toFixed(2)} • Venc.: {p.due_date ? new Date(p.due_date).toLocaleDateString() : '-'}</div>
                    {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleMarkPaid(p.id)}>Marcar como pago</Button>
                    <Button onClick={() => {
                      // open payment modal prefilled could be implemented later
                      onOpenChange(false)
                    }}>Fechar</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
