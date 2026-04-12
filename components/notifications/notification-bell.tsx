'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    }
  }

  useEffect(() => {
    fetchNotifications()

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 10))
          setUnreadCount(count => count + 1)
          
          // Audio notification (optional)
          const audio = new Audio('/notification.mp3')
          audio.play().catch(() => {})
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(count => Math.max(0, count - 1))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative transition-all hover:scale-105">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] animate-in zoom-in"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-muted/50 overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-muted/30 backdrop-blur-md">
          <h3 className="font-semibold text-sm">Notificações</h3>
          <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-normal" onClick={() => {}}>
            Limpar tudo
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem 
                key={notif.id} 
                className={`flex flex-col items-start gap-1 p-4 cursor-pointer focus:bg-muted/50 ${!notif.read ? 'bg-primary/5' : ''}`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="flex justify-between w-full">
                  <span className={`font-medium text-sm ${!notif.read ? 'text-primary' : ''}`}>{notif.title}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
