"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Mail, Clock, CheckCircle2, AlertCircle, Loader2, Send, Sparkles, ExternalLink, ArrowLeft, MessageSquare } from "lucide-react"
import { createClient } from "@/lib/supabase-client"
import type { SupportTicket, SupportMessage } from "@/app/actions/support"
import { hasViraBotAccess, PLAN_LIMITS, getSupportChannels } from "@/lib/plan-limits"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSupportTicket, addTicketMessage } from "@/app/actions/support"
import AIAssistant from "@/components/ai-assistant"
import { useTranslations } from "next-intl"

export default function SupportTab({ isDemo = false }: { isDemo?: boolean }) {
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
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()
  const t = useTranslations("dashboard.support")
  const tCommon = useTranslations("common")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const loadData = async () => {
    if (isDemo) {
      setPlanType("premium")
      setHasAIAccess(true)
      setSupportChannels(["Email", "WhatsApp"])
      setLoading(false)
      return
    }
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

    setSubmitting(true)
    try {
      await createSupportTicket(formData.subject, formData.message, formData.priority)

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
    } finally {
      setSubmitting(false)
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

    setSubmitting(true)
    try {
      await addTicketMessage(selectedTicket.id, newMessage)

      // Reopen ticket if it was resolved/closed locally in state (the hook will update it)
      if (selectedTicket.status === "resolved" || selectedTicket.status === "closed") {
        setSelectedTicket({ ...selectedTicket, status: "open" })
      }

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
    } finally {
      setSubmitting(false)
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
          onClick={() => setShowNewTicket(true)}
          className="bg-[#3b82f6] hover:bg-blue-600 text-white font-semibold h-11 px-6 rounded-xl shadow-sm shadow-[#3b82f6]/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t("newTicket")}
        </Button>
      </div>

      {/* Support Info Card */}
      <Card className="p-6 sm:p-8 bg-white border border-slate-200 shadow-sm rounded-3xl relative overflow-hidden group hover:border-[#3b82f6]/30 transition-colors">
        <div className="flex flex-col sm:flex-row items-start gap-6 relative z-10">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-[#3b82f6] group-hover:scale-110 transition-transform">
            <ExternalLink className="w-7 h-7" />
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
              <div className="flex flex-wrap gap-2 mt-2">
                {supportInfo.features.slice(0, 3).map((feature, index) => (
                  <Badge key={index} className="bg-slate-50 text-slate-700 font-medium border border-slate-200 px-3 py-1">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-[#3b82f6]" />
                    {feature}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {hasAIAccess && (
        <Card className="p-6 sm:p-8 bg-[#f0f9ff]/50 border border-[#3b82f6]/20 shadow-sm rounded-3xl relative overflow-hidden group transition-colors">
          <div className="flex flex-col sm:flex-row items-start gap-6 relative z-10">
            <div className="w-14 h-14 bg-white border border-[#3b82f6]/20 rounded-2xl shadow-sm flex items-center justify-center text-[#3b82f6] group-hover:scale-110 group-hover:-rotate-3 transition-transform">
              <Sparkles className="w-7 h-7" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-foreground mb-2">{t("viraBotTitle")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("viraBotDesc")}
              </p>
              <Button
                onClick={() => setShowAIChat(true)}
                className="bg-[#3b82f6] hover:bg-blue-600 text-white font-semibold h-11 px-6 rounded-xl shadow-sm shadow-[#3b82f6]/20"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t("openAIChat")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-8 text-center bg-white border-slate-200 shadow-sm rounded-3xl hover:-translate-y-1 hover:shadow-lg hover:shadow-[#3b82f6]/5 border hover:border-[#3b82f6]/20 transition-all group">
          <div className="w-16 h-16 bg-blue-50/50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-[#3b82f6] group-hover:bg-[#3b82f6] group-hover:text-white transition-colors">
            <Mail className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-foreground text-lg mb-2">{t("email")}</h4>
          <p className="text-[15px] text-muted-foreground mb-6 font-medium">suporte@viraweb.online</p>
          <Button
            variant="outline"
            className="w-full h-11 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium"
            onClick={() => {
              navigator.clipboard.writeText("suporte@viraweb.online")
              toast({
                title: "Email copiado!",
                description: "suporte@viraweb.online foi copiado para a área de transferência",
              })
            }}
          >
            <Mail className="w-4 h-4 mr-2" />
            {t("sendEmail")}
          </Button>
        </Card>

        <Card className="p-8 text-center bg-white border-slate-200 shadow-sm rounded-3xl hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/5 border hover:border-green-500/20 transition-all group">
          <div className="w-16 h-16 bg-green-50/50 rounded-2xl flex items-center justify-center mx-auto mb-5 text-green-600 group-hover:bg-green-500 group-hover:text-white transition-colors">
            <ExternalLink className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-foreground text-lg mb-2">{t("whatsapp")}</h4>
          <p className="text-[15px] text-muted-foreground mb-6 font-medium">(62) 9 9246-6109</p>
          <Button
            variant="outline"
            className="w-full h-11 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium"
            onClick={() => {
              navigator.clipboard.writeText("5562992466109")
              toast({
                title: "WhatsApp copiado!",
                description: "(62) 9 9246-6109 foi copiado para a área de transferência",
              })
            }}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
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

      {/* Tickets List */}
      <Card className="bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-[#3b82f6]">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Meus Tickets</h3>
              <p className="text-xs text-muted-foreground">
                {tickets.length === 0 ? "Nenhum ticket criado" : `${tickets.length} ticket${tickets.length > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowNewTicket(true)}
            size="sm"
            className="bg-[#3b82f6] hover:bg-blue-600 text-white font-semibold rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo
          </Button>
        </div>

        {tickets.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h4 className="text-sm font-bold text-slate-400 mb-1">Nenhum ticket ainda</h4>
            <p className="text-xs text-slate-400">Crie um ticket para receber suporte da nossa equipe.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => handleViewTicket(ticket)}
                className="w-full p-4 sm:p-5 text-left hover:bg-slate-50/50 transition-colors flex items-center justify-between gap-4 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-[#3b82f6] transition-colors">
                      {ticket.subject}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-1">{ticket.message}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(ticket.status)}
                    {getPriorityBadge(ticket.priority)}
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(ticket.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-300 rotate-180 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* New Ticket Dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Novo Ticket de Suporte</DialogTitle>
            <DialogDescription>Descreva seu problema ou dúvida e nossa equipe responderá em breve.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Assunto</label>
              <Input
                placeholder="Descreva brevemente o problema"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Prioridade</label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Baixa</SelectItem>
                  <SelectItem value="medium">🔵 Média</SelectItem>
                  <SelectItem value="high">🟠 Alta</SelectItem>
                  <SelectItem value="urgent">🔴 Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Mensagem</label>
              <Textarea
                placeholder="Descreva detalhadamente seu problema ou dúvida..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="min-h-[150px] rounded-xl"
              />
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleCreateTicket} 
                disabled={submitting}
                className="flex-1 bg-[#3b82f6] hover:bg-blue-600 text-white rounded-xl h-11 font-semibold"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Enviar Ticket
              </Button>
              <Button variant="outline" onClick={() => setShowNewTicket(false)} className="rounded-xl h-11">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Messages Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col rounded-2xl p-0 gap-0">
          {/* Dialog Header */}
          <div className="p-6 border-b border-slate-100 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-lg font-black">{selectedTicket?.subject}</DialogTitle>
              <div className="flex gap-2 mt-2">
                {selectedTicket && getStatusBadge(selectedTicket.status)}
                {selectedTicket && getPriorityBadge(selectedTicket.priority)}
                <span className="text-[10px] text-slate-400 font-medium self-center">
                  Criado em {selectedTicket && new Date(selectedTicket.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </DialogHeader>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="text-center py-8 text-slate-400 text-sm">
                Carregando mensagens...
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-2xl max-w-[85%] ${
                  message.is_staff 
                    ? "bg-[#3b82f6]/10 ml-auto border border-[#3b82f6]/20" 
                    : "bg-slate-50 mr-auto border border-slate-100"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-bold ${message.is_staff ? "text-[#3b82f6]" : "text-slate-600"}`}>
                    {message.is_staff ? "🛡️ Equipe ViraWeb" : "Você"}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(message.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{message.message}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-100 shrink-0 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                className="rounded-xl"
                disabled={submitting}
              />
              <Button 
                onClick={handleSendMessage} 
                size="icon" 
                disabled={submitting || !newMessage.trim()}
                className="bg-[#3b82f6] hover:bg-blue-600 text-white rounded-xl h-10 w-10 shrink-0"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
