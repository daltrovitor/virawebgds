// Hello World
"use client"

import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"
import { VwoMark } from "./vwo-mark"

type LogoVariant = "stacked" | "inline" | "mark"
type LogoTone = "ink" | "inverse"

export interface VwoLogoProps {
  variant?: LogoVariant
  tone?: LogoTone
  animate?: "mount" | "inView" | "none"
  delay?: number
  className?: string
  /** Classe aplicada ao símbolo (controle de tamanho). */
  markClassName?: string
}

const LETTER_SPRING = { type: "spring" as const, stiffness: 300, damping: 28 }

/** Letra revelada por máscara (overflow-hidden) — tipografia cinética do Modelo Padrão. */
function MaskedWord({ text, animated, delay, className }: { text: string; animated: boolean; delay: number; className?: string }) {
  if (!animated) return <span className={className}>{text}</span>
  return (
    <span className={cn("inline-flex overflow-hidden align-bottom", className)} aria-hidden>
      {Array.from(text).map((char, i) => (
        <motion.span
          key={`${char}-${i}`}
          className="inline-block"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ ...LETTER_SPRING, delay: delay + i * 0.03 }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  )
}

/**
 * Assinatura completa: símbolo facetado + "ViraWeb" (Montserrat 700/300, como na logo original) + "Odonto".
 */
export function VwoLogo({
  variant = "stacked",
  tone = "ink",
  animate = "none",
  delay = 0,
  className,
  markClassName,
}: VwoLogoProps) {
  const reduceMotion = useReducedMotion()
  const animated = animate === "mount" && !reduceMotion
  const textDelay = delay + 0.55
  const ink = tone === "ink" ? "text-[#132a46]" : "text-white"
  const sub = tone === "ink" ? "text-primary" : "text-sky-200"

  if (variant === "mark") {
    return <VwoMark className={cn("w-9", markClassName, className)} animate={animate} delay={delay} />
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span className="sr-only">{BRAND.name}</span>
      <VwoMark className={cn("w-9 shrink-0", markClassName)} animate={animate} delay={delay} decorative />
      {variant === "stacked" ? (
        <span className="flex flex-col leading-none" aria-hidden>
          <span className={cn("font-display text-[1.32rem] tracking-[-0.01em]", ink)}>
            <MaskedWord text="Vira" animated={animated} delay={textDelay} className="font-bold" />
            <MaskedWord text="Web" animated={animated} delay={textDelay + 0.12} className="font-light" />
          </span>
          <span className={cn("font-display mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.42em]", sub)}>
            <MaskedWord text="Odonto" animated={animated} delay={textDelay + 0.24} />
          </span>
        </span>
      ) : (
        <span className={cn("font-display text-lg leading-none tracking-[-0.01em]", ink)} aria-hidden>
          <MaskedWord text="Vira" animated={animated} delay={textDelay} className="font-bold" />
          <MaskedWord text="Web" animated={animated} delay={textDelay + 0.12} className="font-light" />
          <MaskedWord text="Odonto" animated={animated} delay={textDelay + 0.24} className={cn("ml-1.5 font-medium", sub)} />
        </span>
      )}
    </span>
  )
}

export default VwoLogo
