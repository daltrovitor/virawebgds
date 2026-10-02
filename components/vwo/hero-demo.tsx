// Hello World
"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { useTranslations } from "next-intl"
import { ToothGlyph } from "@/components/dental/arch-chart"
import { VwoMark } from "@/components/brand/vwo-mark"
import { cn } from "@/lib/utils"

const FRONT_TEETH = [15, 14, 13, 12, 11, 21, 22, 23, 24, 25]
const SEQUENCE = [12, 11, 21, 22]
const UNIT = 3850
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** Quantia que conta até o alvo com mola (sem piscar, sem loop infinito). */
function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const [text, setText] = useState(BRL.format(0))
  useEffect(() => {
    const controls = animate(mv, value, { type: "spring", stiffness: 90, damping: 22 })
    const unsub = mv.on("change", (v) => setText(BRL.format(Math.round(v * 100) / 100)))
    return () => {
      controls.stop()
      unsub()
    }
  }, [mv, value])
  return <span className="tabular">{text}</span>
}

/**
 * Hero (coluna de 38,2%): o símbolo facetado entra em cena e, à frente dele, um orçamento real é montado
 * dente a dente — narrativa do produto, com paralaxe sutil seguindo o cursor.
 */
export function HeroDemo() {
  const t = useTranslations("vwo.heroDemo")
  const reduce = useReducedMotion()
  const [selected, setSelected] = useState<number[]>(reduce ? SEQUENCE : [])

  // Sequência única: um dente por vez, como a recepção faria
  useEffect(() => {
    if (reduce) return
    const timers = SEQUENCE.map((tooth, i) => setTimeout(() => setSelected((prev) => [...prev, tooth]), 1500 + i * 520))
    return () => timers.forEach(clearTimeout)
  }, [reduce])

  // Paralaxe de cursor (camadas em profundidades diferentes)
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 80, damping: 20 })
  const sy = useSpring(py, { stiffness: 80, damping: 20 })
  const markX = useTransform(sx, (v) => v * -18)
  const markY = useTransform(sy, (v) => v * -14)
  const cardX = useTransform(sx, (v) => v * 10)
  const cardY = useTransform(sy, (v) => v * 8)

  useEffect(() => {
    if (reduce) return
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      px.set(e.clientX / window.innerWidth - 0.5)
      py.set(e.clientY / window.innerHeight - 0.5)
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [px, py, reduce])

  const total = selected.length * UNIT

  return (
    <div className="relative mx-auto w-full max-w-[460px] pt-[48%] lg:mx-0">
      {/* Plano de fundo: símbolo facetado em escala monumental */}
      <motion.div style={{ x: markX, y: markY }} className="pointer-events-none absolute -right-4 top-0 w-[80%] sm:-right-8" aria-hidden>
        <VwoMark animate="mount" delay={0.15} decorative className="w-full drop-shadow-[0_30px_40px_rgba(19,42,70,0.18)]" />
      </motion.div>

      {/* Plano médio: o orçamento sendo montado */}
      <motion.div
        style={{ x: cardX, y: cardY }}
        initial={{ y: 40 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.5 }}
        className="relative rounded-md border border-border bg-background/95 p-4 shadow-[0_24px_60px_-28px_rgba(15,31,51,0.35)] backdrop-blur sm:p-5"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("caption")}</p>
          <p className="text-[11px] text-muted-foreground">{t("arch")}</p>
        </div>

        <div className="mt-3 flex items-end gap-0.5" aria-hidden>
          {FRONT_TEETH.map((tooth) => {
            const on = selected.includes(tooth)
            return (
              <div key={tooth} className="flex min-w-0 flex-1 flex-col items-center">
                <motion.div className="h-14 w-full max-w-[30px]" animate={{ y: on ? 4 : 0 }} transition={{ type: "spring", stiffness: 420, damping: 24 }}>
                  <ToothGlyph fdi={tooth} lower={false} state={on ? "selected" : "idle"} />
                </motion.div>
                <span className={cn("mt-1 font-display text-[10px] font-semibold tabular", on ? "text-primary" : "text-muted-foreground")}>{tooth}</span>
              </div>
            )
          })}
        </div>

        <ul className="mt-4 space-y-1.5" aria-label={t("caption")}>
          <AnimatePresence initial={false}>
            {selected.map((tooth) => (
              <motion.li
                key={tooth}
                initial={{ x: -10 }}
                animate={{ x: 0 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className="flex items-center gap-2 text-[12.5px]"
              >
                <span className="rounded-xs bg-secondary px-1.5 py-0.5 font-display text-[10.5px] font-semibold tabular text-ink-soft">{tooth}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{t("procedure")}</span>
                <span className="tabular text-ink-soft">{BRL.format(UNIT)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-4 flex items-end justify-between border-t border-hairline pt-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("total")}</p>
            <p className="font-display text-xl font-semibold text-ink">
              <CountUp value={total} />
            </p>
          </div>
          <motion.p
            className="text-right text-[12px] text-ink-soft"
            initial={false}
            animate={{ y: selected.length === SEQUENCE.length ? 0 : 6 }}
            style={{ visibility: selected.length === SEQUENCE.length ? "visible" : "hidden" }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
          >
            {t("plan")}
            <br />
            <span className="font-semibold tabular text-primary">{BRL.format((SEQUENCE.length * UNIT) / 12)}</span>
          </motion.p>
        </div>
      </motion.div>
    </div>
  )
}

export default HeroDemo
