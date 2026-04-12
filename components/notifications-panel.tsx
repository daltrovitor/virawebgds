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
import { useFCM } from "@/hooks/use-fcm"
import { Smartphone, Loader2 } from "lucide-react"

export default function NotificationsPanel({ isDemo = false }: { isDemo?: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [panelSide, setPanelSide] = useState<"left" | "right">("right")
  const [panelTop, setPanelTop] = useState<number | null>(null)

  const { token: fcmToken } = useFCM()
  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator
  const isSubscribed = !!fcmToken
  const pushLoading = false // FCM hook handles it automatically


  const loadNotifications = async () => {
    if (isDemo) {
      setNotifications([
        { id: "1", title: "Novo Agendamento", body: "Maria Silva agendou para amanhã.", read: false, created_at: new Date().toISOString() } as any,
        { id: "2", title: "Pagamento Recebido", body: "Recebido R$ 449,90 de João Santos.", read: true, created_at: new Date().toISOString() } as any,
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

  const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = typeof window !== 'undefined' && (window.navigator as any).standalone

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
          <span className="absolute -top-1 -right-1 min-w-[18px] h-4 bg-destructive text-destructive-foreground text-[9px] rounded-none flex items-center justify-center font-bold px-1 border border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <Card
            className="z-50 shadow-2xl border-2 border-slate-900 absolute rounded-none"
            style={{
              top: "100%",
              right: 0,
              width: "calc(100vw - 32px)",
              maxWidth: 384,
              marginTop: "0.5rem",
              transform: "none",
              left: "auto"
            }}
          >
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-none font-bold">
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
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsOpen(false)}
                        className="rounded-none hover:rotate-90 transition-transform h-8 w-8 p-0"
                      >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {!fcmToken && (
                <div className="p-3 bg-orange-50 border-b border-orange-100 flex items-start gap-3">
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-none mt-0.5 shrink-0">
                        <Smartphone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-orange-800 mb-0.5">Ative as Notificações</p>
                        <p className="text-[10px] text-orange-600 leading-tight">
                            {isIOS && !isStandalone 
                            ? "No iPhone, toque em 'Compartilhar' e 'Adicionar à Tela de Início' para ativar."
                            : "Permita o acesso no navegador para receber alertas em tempo real."
                            }
                        </p>
                    </div>
                </div>
            )}

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
                            {/* Notification unread indicator as a square */}
                            {!notification.read && (
                              <div className="w-2 h-2 bg-primary rounded-none flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 truncate">{notification.body}</p>
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
