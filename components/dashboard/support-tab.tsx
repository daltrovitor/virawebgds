"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Mail, Clock, CheckCircle2, AlertCircle, Loader2, Send, Sparkles, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import type { SupportTicket, SupportMessage } from "@/app/actions/support"
import { hasViraBotAccess, PLAN_LIMITS, getSupportChannels } from "@/lib/plan-limits"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import AIAssistant from "@/components/ai-assistant"
import { useTranslations } from "next-intl"

export default function SupportTab() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [supportChannels, setSupportChannels] = useState<string[]>([])
  const [planType, setPlanType] = useState<"basic" | "premium" | "master">("basic")
  const [formData, setFormData] = useState({
    subject: "",
    message: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
  })
  const [showAIChat, setShowAIChat] = useState(false)
  const [hasAIAccess, setHasAIAccess] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const t = useTranslations("dashboard.support")
  const tCommon = useTranslations("common")

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Fetch current user and then tickets & subscription using browser client
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error(tCommon("errors.unauthorized"))


      const [{ data: ticketsData, error: ticketsErr }, { data: subscriptionData, error: subErr }] = await Promise.all([
        supabase.from("support_tickets").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).single(),
      ])

      if (ticketsErr) {
        console.error('Error fetching support tickets (client):', ticketsErr)
      }

      const plan = (subscriptionData?.plan_name || subscriptionData?.plan_type || "basic").toLowerCase() as
        | "basic"
        | "premium"
        | "master"

      setTickets(ticketsData || [])
      setPlanType(plan)
      setSupportChannels(getSupportChannels(plan))
      setHasAIAccess(hasViraBotAccess(plan))
    } catch (error) {
      toast({
        title: t("toast.loadError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTicket = async () => {
    if (!formData.subject || !formData.message) {
      toast({
        title: t("toast.fieldsRequired"),
        description: t("toast.fieldsRequiredDesc"),
        variant: "destructive",
      })
      return
    }

    try {
      // create ticket via browser client
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error("Usuário não autenticado")

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject: formData.subject,
          message: formData.message,
          priority: formData.priority,
          status: "open",
        })
        .select()
        .single()

      if (error) throw error
      toast({
        title: t("toast.ticketCreated"),
        description: t("toast.ticketCreatedDesc"),
      })
      setFormData({ subject: "", message: "", priority: "medium" })
      setShowNewTicket(false)
      await loadData()
    } catch (error) {
      toast({
        title: t("toast.createError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    }
  }

  const handleViewTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      toast({
        title: t("toast.loadMessagesError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    }
  }

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error("Usuário não autenticado")

      const { data, error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: newMessage,
          is_staff: false,
        })
        .select()
        .single()

      if (error) throw error

      const { data: messagesData, error: messagesErr } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true })

      if (messagesErr) console.error('Error refetching messages:', messagesErr)
      setMessages(messagesData || [])
      setNewMessage("")
      toast({
        title: t("toast.messageSent"),
        description: t("toast.messageSentDesc"),
      })
    } catch (error) {
      toast({
        title: t("toast.sendError"),
        description: error instanceof Error ? error.message : tCommon("error"),
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      open: { label: "Aberto", className: "bg-blue-100 text-blue-700" },
      in_progress: { label: "Em Progresso", className: "bg-yellow-100 text-yellow-700" },
      resolved: { label: "Resolvido", className: "bg-green-100 text-green-700" },
      closed: { label: "Fechado", className: "bg-gray-100 text-gray-700" },
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open
    return <Badge className={config.className}>{t(`status.${status as any}`)}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: "Baixa", className: "bg-gray-100 text-gray-700" },
      medium: { label: "Média", className: "bg-blue-100 text-blue-700" },
      high: { label: "Alta", className: "bg-orange-100 text-orange-700" },
      urgent: { label: "Urgente", className: "bg-red-100 text-red-700" },
    }
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    return <Badge className={config.className}>{t(`priority.${priority as any}`)}</Badge>
  }

  const getSupportInfo = () => {
    return {
      title: t(`plans.${planType}.title`),
      description: t(`plans.${planType}.desc`),
      hours: t(`plans.${planType}.hours`),
      features: [
        t(`plans.${planType}.features.0`),
        t(`plans.${planType}.features.1`),
        t(`plans.${planType}.features.2`),
        t(`plans.${planType}.features.3`),
        t(`plans.${planType}.features.4`),
        t(`plans.${planType}.features.5`),
        t(`plans.${planType}.features.6`),
      ].filter(f => f && !f.includes(`plans.${planType}.features.`))
    }
  }

  const supportInfo = getSupportInfo()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (showAIChat && hasAIAccess) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setShowAIChat(false)} className="mb-4">
          {t("backToSupport")}
        </Button>
        <AIAssistant hasAccess={hasAIAccess} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Button
          onClick={() => { }}
          disabled
          title={t("ticketSystem") + " - " + t("comingSoon")}
          className="bg-primary/60 cursor-not-allowed text-primary-foreground flex items-center gap-2 shadow-lg"
        >
          <Plus className="w-4 h-4" />
          {t("newTicket")}
        </Button>
      </div>

      {/* Support Info Card */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary rounded-lg text-white">
            <ExternalLink className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground mb-2">{supportInfo.title}</h3>
            <p className="text-muted-foreground mb-4">{supportInfo.description}</p>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("hours")}</p>
                  <p className="text-sm text-muted-foreground">{supportInfo.hours}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("channels")}</p>
                  <p className="text-sm text-muted-foreground">{t("channelsList")}{hasAIAccess && ", ViraBot IA"}</p>
                </div>
              </div>
            </div>

            {supportInfo.features && supportInfo.features.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {supportInfo.features.slice(0, 3).map((feature, index) => (
                  <Badge key={index} className="bg-primary/10 text-primary">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {feature}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {hasAIAccess && (
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/30">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-primary to-secondary rounded-lg text-white">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">{t("viraBotTitle")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("viraBotDesc")}
              </p>
              <Button
                onClick={() => setShowAIChat(true)}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t("openAIChat")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-6 text-center hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <h4 className="font-bold text-foreground mb-2">{t("email")}</h4>
          <p className="text-sm text-muted-foreground mb-3">suporte@viraweb.online</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-transparent"
            onClick={() => window.open("mailto:suporte@viraweb.online", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t("sendEmail")}
          </Button>
        </Card>

        <Card className="p-6 text-center hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ExternalLink className="w-6 h-6 text-green-600" />
          </div>
          <h4 className="font-bold text-foreground mb-2">{t("whatsapp")}</h4>
          <p className="text-sm text-muted-foreground mb-3">(62) 9 9246-6109</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-transparent"
            onClick={() => window.open("https://wa.me/5562992466109", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t("openWhatsapp")}
          </Button>
        </Card>
      </div>

      {/* Help Resources */}
      <Card className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">{t("resources")}</h3>
        <div className="space-y-3">
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-foreground mb-1">📚 {t("helpCenter")}</h4>
            <p className="text-sm text-muted-foreground">{t("helpCenterDesc")}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-foreground mb-1">💡 {t("faq")}</h4>
            <p className="text-sm text-muted-foreground">{t("faqDesc")}</p>
          </div>
          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-foreground mb-1">🎥 {t("videoTutorials")}</h4>
            <p className="text-sm text-muted-foreground">{t("videoTutorialsDesc")}</p>
          </div>
        </div>
      </Card>

      {/* Tickets (Em breve) */}
      <Card className="p-6 text-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900 border-2 border-primary/20 dark:border-primary/30">
        <h3 className="text-lg font-bold text-foreground mb-4">{t("ticketSystem")}</h3>
        <div className="py-12">
          <Sparkles className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse" />
          <h4 className="text-lg font-semibold text-foreground mb-3">{t("comingSoon")}</h4>
          <p className="text-muted-foreground mb-2">{t("comingSoonDesc")}</p>
          <p className="text-muted-foreground mb-6">{t("featuresTitle")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mb-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{t("features.0")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{t("features.1")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{t("features.2")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{t("features.3")}</span>
            </div>
          </div>
          <Button disabled variant="outline" className="bg-white/50">
            {t("inDevelopment")}
          </Button>
        </div>
      </Card>

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Ticket de Suporte</DialogTitle>
            <DialogDescription>Descreva seu problema ou dúvida e nossa equipe entrará em contato</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Assunto</label>
              <Input
                placeholder="Descreva brevemente o problema"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Prioridade</label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Mensagem</label>
              <Textarea
                placeholder="Descreva detalhadamente seu problema ou dúvida..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="min-h-[150px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreateTicket} className="flex-1">
                Criar Ticket
              </Button>
              <Button variant="outline" onClick={() => setShowNewTicket(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Messages Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <div className="flex gap-2 mt-2">
              {selectedTicket && getStatusBadge(selectedTicket.status)}
              {selectedTicket && getPriorityBadge(selectedTicket.priority)}
            </div>
          </DialogHeader>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg ${message.is_staff ? "bg-primary/10 ml-8" : "bg-muted mr-8"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-foreground">
                    {message.is_staff ? "Equipe de Suporte" : "Você"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-sm text-foreground">{message.message}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <Button onClick={handleSendMessage} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
