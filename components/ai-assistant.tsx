"use client"
import { useRef, useEffect, useState } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Send, MessageCircle, X, Lock, Loader2 } from "lucide-react"
import { fetchRaw } from "@/lib/fetch-client"
import { useTranslations, useLocale } from "next-intl"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
}

interface AIAssistantProps {
  isOpen?: boolean
  onClose?: () => void
  hasAccess?: boolean
}

export default function AIAssistant({ isOpen = true, onClose, hasAccess = false }: AIAssistantProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('dashboard.ai.chat')
  const locale = useLocale()

  const [messages, setMessages] = useState<Message[]>([])

  // Set initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t('welcome'),
        },
      ])
    }
  }, [t])

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetchRaw("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          locale,
        }),
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
      }

      setMessages((prev) => [...prev, assistantMessage])

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          assistantMessage.content = buffer

          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMessage.id ? { ...m, content: assistantMessage.content } : m)),
          )
        }

        console.log(" Stream completed, final content:", assistantMessage.content)
      }
    } catch (err) {
      console.error(" Chat error:", err)
      setError(err instanceof Error ? err.message : t('error') || "Erro ao enviar mensagem")
      setMessages((prev) => prev.filter((m) => m.content !== ""))
    } finally {
      setIsLoading(false)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  if (!isOpen) return null

  if (!hasAccess) {
    return (
      <Card className="w-full max-w-2xl mx-auto flex flex-col border-2 border-primary shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">{t('title') || 'ViraBot IA'}</h3>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[300px]">
          <Lock className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">{t('premiumTitle')}</h3>
          <p className="text-muted-foreground mb-4">{t('premiumMessage')}</p>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">{t('upgrade')}</Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-2xl mx-auto flex flex-col border-2 border-primary shadow-2xl h-[600px]">
      <div className="flex items-center justify-between p-4 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t('title') || 'ViraBot IA'}</h3>
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">{t('online')}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2 rounded-lg ${message.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "bg-muted text-foreground rounded-bl-none"
                }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex justify-center">
            <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg text-sm">Error: {error}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-border flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('placeholder')}
          disabled={isLoading}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </form>
    </Card>
  )
}
