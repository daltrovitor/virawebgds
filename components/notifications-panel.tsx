"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, Check, CheckCheck, Trash2, X, AlertCircle, Info, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type Notification,
} from "@/app/actions/notifications"

export default function NotificationsPanel({ isDemo = false }: { isDemo?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [panelSide, setPanelSide] = useState<"left" | "right">("right")
  const [panelTop, setPanelTop] = useState<number | null>(null)

  const loadNotifications = async () => {
    if (isDemo) {
      setNotifications([
        { id: "1", title: "Novo Agendamento", message: "Maria Silva agendou para amanhã.", type: "info", read: false, created_at: new Date().toISOString() } as any,
        { id: "2", title: "Pagamento Recebido", message: "Recebido R$ 250,00 de João Santos.", type: "success", read: true, created_at: new Date().toISOString() } as any,
      ])
      setUnreadCount(1)
      return
    }
    try {
      const [notifs, count] = await Promise.all([getNotifications(), getUnreadCount()])
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (error) {
      console.error(" Error loading notifications:", error)
    }
  }

  useEffect(() => {
    loadNotifications()
    if (isDemo) return
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [isDemo])

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      try {
        const rect = buttonRef.current.getBoundingClientRect()
        const spaceRight = window.innerWidth - rect.right
        const spaceLeft = rect.left
        // prefer side with more space (favor right when equal)
        const preferRight = spaceRight >= spaceLeft
        setPanelSide(preferRight ? "right" : "left")
        setPanelTop(Math.max(8, Math.round(rect.bottom + 8)))
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen])

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id)
      await loadNotifications()
    } catch (error) {
      console.error(" Error marking as read:", error)
    }
  }

  const handleMarkAllAsRead = async () => {
    setIsLoading(true)
    try {
      await markAllAsRead()
      await loadNotifications()
    } catch (error) {
      console.error(" Error marking all as read:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id)
      await loadNotifications()
    } catch (error) {
      console.error(" Error deleting notification:", error)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Agora"
    if (diffMins < 60) return `${diffMins}min atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`
    return date.toLocaleDateString("pt-BR")
  }

  return (
    <div className="relative inline-block">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-muted-foreground hover:text-foreground hover:bg-muted p-2"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-semibold px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <Card
            className="z-50 shadow-xl border border-border absolute"
            style={{
              top: "100%",
              right: 0,
              width: "calc(100vw - 2rem)",
              maxWidth: 384,
              marginTop: "0.5rem",
            }}
          >
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    disabled={isLoading}
                    className="text-xs"
                  >
                    <CheckCheck className="w-4 h-4 mr-1" />
                    Marcar todas
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 transition-colors ${!notification.read ? "bg-background/50 border-l-4 border-primary/30" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-semibold text-sm text-foreground truncate">{notification.title}</h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 truncate">{notification.message}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</span>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="h-7 px-2 text-xs"
                                >
                                  <Check className="w-3 h-3 mr-1" />
                                  Lida
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(notification.id)}
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </>
      )}
    </div>
  )
}
