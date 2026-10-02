// Hello World
"use client"

import type React from "react"
import { useRef } from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const SPRING = { type: "spring" as const, stiffness: 300, damping: 28 }

/**
 * Tipografia cinética mascarada: cada palavra sobe de dentro de uma máscara (overflow-hidden).
 * A visibilidade é observada no contêiner — a palavra mascarada fica recortada e nunca "entra" na tela
 * para o IntersectionObserver. O texto completo fica disponível para leitores de tela e buscadores.
 */
export function KineticLine({
  text,
  className,
  delay = 0,
  trigger = "mount",
}: {
  text: string
  className?: string
  delay?: number
  /** "css" anima por @keyframes já no primeiro paint (use acima da dobra). */
  trigger?: "mount" | "inView" | "css"
}) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const words = text.split(" ")

  if (trigger === "css") {
    return (
      <span className={cn("inline", className)}>
        <span className="sr-only">{text}</span>
        <span aria-hidden>
          {words.map((word, i) => (
            <span key={`${word}-${i}`} className="inline-flex pb-[0.08em] align-bottom">
              {/* Sem máscara: a palavra é pintada inteira no 1º quadro (o título é o LCP) e apenas assenta no lugar */}
              <span className="vwo-rise inline-block" style={{ animationDelay: `${delay + i * 0.06}s` }}>
                {word}
              </span>
              {i < words.length - 1 && <span className="inline-block">&nbsp;</span>}
            </span>
          ))}
        </span>
      </span>
    )
  }

  if (reduce) return <span className={className}>{text}</span>

  const shown = trigger === "mount" || inView

  return (
    <span ref={ref} className={cn("inline", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <span key={`${word}-${i}`} className="inline-flex overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className="inline-block will-change-transform"
              initial={{ y: "108%" }}
              animate={{ y: shown ? "0%" : "108%" }}
              transition={{ ...SPRING, delay: delay + i * 0.06 }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        ))}
      </span>
    </span>
  )
}

/** Entrada em CSS puro (acima da dobra): não espera a hidratação. */
export function CssReveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div className={cn("vwo-fade-up", className)} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  )
}

/** Revelação suave de blocos ao entrar na tela (transform + opacity, acelerado por GPU). */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as = "div",
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  as?: "div" | "li" | "p" | "section"
}) {
  const reduce = useReducedMotion()
  const Tag = motion[as]
  if (reduce) {
    const Plain = as
    return <Plain className={className}>{children}</Plain>
  }
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ ...SPRING, delay }}
    >
      {children}
    </Tag>
  )
}
