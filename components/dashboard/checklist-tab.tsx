"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { getTodos, createTodo, updateTodo, toggleTodoComplete, deleteTodo, Todo } from "@/app/actions/todos"
import { useToast } from "@/hooks/use-toast"
import { formatDateString } from "@/lib/utils"
import { useTranslations } from "next-intl"

export default function ChecklistTab() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDue, setNewDue] = useState<string | undefined>(undefined)
  const { toast } = useToast()
  const t = useTranslations('dashboard.checklist')

  const load = async () => {
    setLoading(true)
    try {
      const data = await getTodos()
      setTodos(data || [])
    } catch (err) {
      toast({
        title: t('toast.loadError'),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      const t_item = await createTodo({ title: newTitle.trim(), due_date: newDue || null })
      setTodos((s) => [t_item, ...s])
      setNewTitle("")
      setNewDue(undefined)
      toast({ title: t('toast.added') })
    } catch (err) {
      toast({
        title: t('toast.addError'),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, completed: boolean) => {
    try {
      const updated = await toggleTodoComplete(id, completed)
      setTodos((s) => s.map((x) => (x.id === id ? updated : x)))
    } catch (err) {
      toast({
        title: t('toast.updateError'),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTodo(id)
      setTodos((s) => s.filter((x) => x.id !== id))
      toast({ title: t('toast.removed') })
    } catch (err) {
      toast({
        title: t('toast.removeError'),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3">
          <h3 className="text-lg font-bold">{t('title')}</h3>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto mt-3 sm:mt-0">
            <Input
              placeholder={t('placeholder')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full sm:w-64"
            />
            <Input
              type="date"
              value={newDue || ""}
              onChange={(e) => setNewDue(e.target.value || undefined)}
              className="w-full sm:w-40"
            />
            <Button className="bg-primary text-primary-foreground w-full sm:w-auto" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : todos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('empty')}</div>
        ) : (
          <div className="space-y-2">
            {todos.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 w-full min-w-0">
                  <input type="checkbox" checked={item.completed} onChange={(e) => handleToggle(item.id, e.target.checked)} />
                  <div className="min-w-0 w-full">
                    <div className={`font-medium truncate ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</div>
                    <div className="text-sm text-muted-foreground mt-1 sm:mt-0 sm:ml-2 whitespace-nowrap">
                      {item.due_date ? formatDateString(item.due_date) : t('noDate')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 sm:mt-0">
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
