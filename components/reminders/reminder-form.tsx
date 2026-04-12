'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

export function ReminderForm({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState<Date>()
  const [time, setTime] = useState('12:00')
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!date) {
        toast.error('Selecione uma data')
        return
    }

    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const description = formData.get('description') as string

    const [hours, minutes] = time.split(':')
    const scheduledAt = new Date(date)
    scheduledAt.setHours(parseInt(hours), parseInt(minutes))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        toast.error('Você precisa estar logado')
        setLoading(false)
        return
    }

    const { error } = await supabase
      .from('reminders')
      .insert({
        user_id: user.id,
        title,
        description,
        scheduled_at: scheduledAt.toISOString(),
        sent: false
      })

    setLoading(false)

    if (error) {
      toast.error('Erro ao criar lembrete: ' + error.message)
    } else {
      toast.success('Lembrete criado com sucesso!')
      onSuccess?.()
      if (e.currentTarget) e.currentTarget.reset()
      setDate(undefined)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-card rounded-xl border border-muted/50 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" name="title" placeholder="Ex: Tomar remédio" required className="bg-muted/30 border-muted" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (Opcional)</Label>
        <Textarea id="description" name="description" placeholder="Mais detalhes..." className="bg-muted/30 border-muted resize-none" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-muted/30 border-muted",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP", { locale: ptBR }) : <span>Selecione a data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="time">Hora</Label>
          <Input 
            id="time" 
            type="time" 
            value={time} 
            onChange={(e) => setTime(e.target.value)} 
            required 
            className="bg-muted/30 border-muted"
          />
        </div>
      </div>

      <Button type="submit" className="w-full font-semibold shadow-lg shadow-primary/20" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Criar Lembrete'}
      </Button>
    </form>
  )
}
