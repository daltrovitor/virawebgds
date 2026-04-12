import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { streamText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod/v4"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 🔐 Autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    console.log(" 🤖 Chat request from user:", userId)

    // 🔍 Verifica plano do usuário
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan_name, virabot_enabled, status")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .single()

    if (subscriptionError) {
      console.warn("Could not fetch subscription for user", userId, subscriptionError)
    }

    // Access rules:
    // - If subscription.virabot_enabled is true => allow
    // - Or if plan_name is "master" or "premium" (older rows or missing flag) => allow
    const hasAccess = !!subscription && (subscription.virabot_enabled === true || subscription.plan_name === "master" || subscription.plan_name === "premium")

    if (!hasAccess) {
      console.log("ViraBot access denied. Subscription:", subscription)
      return NextResponse.json(
        { error: "ViraBot está disponível apenas para planos Premium e Master" },
        { status: 403 },
      )
    }

    // 📥 Mensagens do usuário e idioma
    const body = await request.json()
    const { messages, locale = 'pt-BR' } = body
    console.log(" 📨 Received messages:", messages.length, "Locale:", locale)

    const isEnglish = locale === 'en';

    // Intercept common intents and answer directly from the DB.
    const lastMessage = Array.isArray(messages) && messages.length ? messages[messages.length - 1] : null
    const userText = lastMessage?.role === "user" ? String(lastMessage.content).toLowerCase() : String(messages).toLowerCase()

    const FALLBACK = isEnglish
      ? "I don't have the ability to answer that, but if you want to ask me something about your ViraWeb account I'll be happy to answer."
      : "Não tenho capacidade para responder isso e quiser me perguntar algo sobre a sua conta da ViraWeb ficarei feliz em responder."

    // Helper DB queries
    const getCount = async (table: string) => {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("user_id", userId)
      if (error) throw error
      return count || 0
    }

    const formatAppointments = (rows: any[]) => {
      if (!rows || rows.length === 0) return isEnglish ? "No appointments found." : "Nenhum agendamento encontrado."
      return rows
        .map((r) => `${r.date} ${r.time} — ${r.patients?.name || (isEnglish ? "Client not specified" : "Cliente não especificado")} ( ${r.professionals?.name || (isEnglish ? "Professional not specified" : "Profissional não especificado")} )`)
        .join('\n')
    }

    try {
      // Greeting detection
      if (/^(oi|ol[áa]|ola|olá|bom dia|boa tarde|boa noite|e aí|e ai|hello|hi|hey)\b/.test(userText)) {
        try {
          const { data: profile } = await supabase.from("users").select("full_name").eq("id", userId).single()
          const name = profile?.full_name ? String(profile.full_name).split(" ")[0] : null

          if (isEnglish) {
            const greeting = name ? `Hello ${name}! How can I help you today?` : `Hello! How can I help you today?`
            return new Response(greeting)
          } else {
            const greeting = name ? `Olá ${name}! Como posso ajudar você hoje?` : `Olá! Como posso ajudar você hoje?`
            return new Response(greeting)
          }
        } catch (e) {
          return new Response(isEnglish ? "Hello! How can I help you today?" : "Olá! Como posso ajudar você hoje?")
        }
      }

      // Intents: counts
      if (/quantos?.*profissional|quantos profissionais|número de profissionais|how many professionals|number of professionals/.test(userText)) {
        const n = await getCount("professionals")
        if (isEnglish) {
          return new Response(`You have ${n} professional${n === 1 ? "" : "s"} registered in the system.`)
        } else {
          const reply = `Você tem ${n} ${n === 1 ? "profissional" : "profissionais"} cadastrad${n === 1 ? "o" : "os"} no sistema.`
          return new Response(reply)
        }
      }

      if (/quantos?.*cliente|quantos clientes|número de clientes|how many clients|number of clients/.test(userText)) {
        const n = await getCount("patients")
        if (isEnglish) {
          return new Response(`You have ${n} client${n === 1 ? "" : "s"} registered in ViraWeb.`)
        } else {
          const reply = `Você tem ${n} ${n === 1 ? "cliente" : "clientes"} cadastrad${n === 1 ? "o" : "os"} no ViraWeb.`
          return new Response(reply)
        }
      }

      if (/quantos?.*agendamentos|número de agendamentos|quantos agendamentos|how many appointments|number of appointments/.test(userText)) {
        const n = await getCount("appointments")
        if (isEnglish) {
          return new Response(`You have ${n} appointment${n === 1 ? "" : "s"}.`)
        } else {
          const reply = `Você tem ${n} ${n === 1 ? "agendamento" : "agendamentos"}.`
          return new Response(reply)
        }
      }

      // Quantas notas o usuário tem
      if (/quantas?.*nota|quantas?.*notas|minhas notas|minhas anotações|how many notes|my notes/.test(userText)) {
        try {
          const n = await getCount("user_notes")
          if (isEnglish) {
            return new Response(`You have ${n} note${n === 1 ? "" : "s"} in your notes area.`)
          } else {
            const reply = `Você tem ${n} ${n === 1 ? "nota" : "notas"} na sua área de notas.`
            return new Response(reply)
          }
        } catch (e) {
          console.error("Error counting user_notes:", e)
          return new Response(FALLBACK)
        }
      }

      // Quantos itens na checklist (todos)
      if (/quantos?.*(itens|items).*checklist|quantos?.*itens.*checklist|minha checklist|itens da checklist|how many checklist|checklist items/.test(userText)) {
        try {
          const { data: todos, error: todosErr } = await supabase.from("todos").select("id,completed").eq("user_id", userId)
          if (todosErr) throw todosErr
          const total = (todos || []).length
          const completed = (todos || []).filter((t: any) => !!t.completed).length
          const pending = total - completed

          if (isEnglish) {
            return new Response(`Checklist: ${total} items total — ${completed} completed, ${pending} pending.`)
          } else {
            return new Response(`Checklist: ${total} itens no total — ${completed} concluído(s), ${pending} pendente(s).`)
          }
        } catch (e) {
          console.error("Error fetching todos:", e)
          return new Response(FALLBACK)
        }
      }

      // Quantas metas o usuário tem
      if (/quantas?.*meta|quantas?.*metas|minhas metas|how many goals|my goals/.test(userText)) {
        try {
          const n = await getCount("goals")
          if (isEnglish) {
            return new Response(`You have ${n} goal${n === 1 ? "" : "s"} registered.`)
          } else {
            const reply = `Você tem ${n} ${n === 1 ? "meta" : "metas"} cadastrada${n === 1 ? "" : "s"}.`
            return new Response(reply)
          }
        } catch (e) {
          console.error("Error counting goals:", e)
          return new Response(FALLBACK)
        }
      }

      // If none of the above intents match, try a generative fallback using OpenAI + user context.
      const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY?.toString()
      if (!OPENAI_KEY) {
        console.warn("OpenAI API key not configured; returning fallback message")
        return new Response(FALLBACK)
      }

      // Gather brief user context to provide to the model
      const [profileRes, goalsRes, notifsRes] = await Promise.all([
        supabase.from("users").select("full_name,clinic_name").eq("id", userId).limit(1).single(),
        supabase.from("goals").select("title,current_value,target_value,unit,category").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("notifications").select("title,message,created_at,read").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      ])

      const profile = profileRes.data || null
      const goals = Array.isArray(goalsRes.data) ? goalsRes.data : []
      const notifs = Array.isArray(notifsRes.data) ? notifsRes.data : []

      const contextParts: string[] = []
      if (profile) contextParts.push(isEnglish
        ? `User: ${profile.full_name || "(no name)"}${profile.clinic_name ? ` — Clinic: ${profile.clinic_name}` : ""}`
        : `Usuário: ${profile.full_name || "(sem nome)"}${profile.clinic_name ? ` — Clínica: ${profile.clinic_name}` : ""}`
      )

      if (goals.length > 0) {
        contextParts.push(isEnglish
          ? `Recent Goals: ${goals.map((g: any) => `${g.title} — ${g.current_value}/${g.target_value} ${g.unit || ""}`).join("; ")}`
          : `Metas recentes: ${goals.map((g: any) => `${g.title} — ${g.current_value}/${g.target_value} ${g.unit || ""}`).join("; ")}`
        )
      }

      if (notifs.length > 0) {
        contextParts.push(isEnglish
          ? `Latest Notifications: ${notifs.slice(0, 5).map((n: any) => `${n.title}: ${n.message}`).join("; ")}`
          : `Últimas notificações: ${notifs.slice(0, 5).map((n: any) => `${n.title}: ${n.message}`).join("; ")}`
        )
      }

      const systemPromptPt = `Você é o ViraBot, o assistente inteligente do ViraWeb, projetado para oferecer suporte abrangente e personalizado. Suas capacidades incluem:
1. Análise e sugestões: Com base nos dados do usuário, ofereça insights úteis e recomendações proativas.
2. Suporte contextual: Use o contexto do usuário (dados, metas, notificações) para fornecer respostas relevantes.
3. Explicações didáticas: Explique conceitos do sistema de forma clara.
Lembre-se: Use apenas dados reais do contexto fornecido, nunca invente informações. Mantenha um tom profissional e amigável. RESPONDA EM PORTUGUÊS.`

      const systemPromptEn = `You are ViraBot, ViraWeb's intelligent assistant, designed to offer comprehensive and personalized support. Your capabilities include:
1. Analysis and suggestions: Based on user data, offer useful insights and proactive recommendations.
2. Contextual support: Use user context (data, goals, notifications) to provide relevant answers.
3. Didactic explanations: Explain system concepts clearly.
Remember: Use only real data from the provided context, never invent information. Maintain a professional and friendly tone. ANSWER IN ENGLISH.`

      const currentSystemPrompt = isEnglish ? systemPromptEn : systemPromptPt
      const fullContext = contextParts.length > 0 ? contextParts.join("\n") : (isEnglish ? "No additional user context." : "Sem contexto adicional do usuário.")

      const openaiMessages: any[] = [
        { role: "system", content: `${currentSystemPrompt}\n\n${isEnglish ? "User Context:" : "Contexto do usuário:"}\n${fullContext}` },
        { role: "user", content: lastMessage?.content || userText },
      ]

      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo-16k",
            messages: openaiMessages,
            max_tokens: 1000,
            temperature: 0.7,
            frequency_penalty: 0.3,
            presence_penalty: 0.3,
          }),
        })

        if (!resp.ok) {
          console.error("OpenAI response not ok", await resp.text())
          return new Response(FALLBACK)
        }

        const data = await resp.json()
        const reply = data?.choices?.[0]?.message?.content
        if (reply) return new Response(String(reply))
        return new Response(FALLBACK)
      } catch (aiErr) {
        console.error("OpenAI generative error:", aiErr)
        return new Response(FALLBACK)
      }
    } catch (err) {
      console.error("Erro ao consultar o banco para intent detection:", err)
      return new Response(FALLBACK)
    }
  } catch (error) {
    console.error(" ❌ AI chat error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
