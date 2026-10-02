// Hello World
"use client"

import { motion, useReducedMotion, type Transition } from "motion/react"
import { cn } from "@/lib/utils"
import { VWO_FACETS, VWO_MARK_VIEWBOX, type VwoFacetGroup } from "./vwo-facets"

/** Vetor de entrada de cada grupo: a seta descendente cai do alto, o núcleo dourado cresce e a seta ascendente sobe. */
const GROUP_ENTRY: Record<VwoFacetGroup, { x: number; y: number; rotate: number; scale: number }> = {
  descent: { x: -70, y: -110, rotate: -10, scale: 0.9 },
  core: { x: 0, y: 30, rotate: 0, scale: 0.2 },
  ascent: { x: -60, y: 120, rotate: 8, scale: 0.9 },
}

const GROUP_DELAY: Record<VwoFacetGroup, number> = { descent: 0, core: 0.28, ascent: 0.42 }

const SPRING: Transition = { type: "spring", stiffness: 300, damping: 28, mass: 0.9 }

export interface VwoMarkProps {
  className?: string
  /** "mount" anima ao montar, "inView" ao entrar na tela, "none" renderiza estático. */
  animate?: "mount" | "inView" | "none"
  delay?: number
  /** Quando true o SVG é decorativo (aria-hidden); caso contrário recebe nome acessível. */
  decorative?: boolean
  title?: string
}

export function VwoMark({ className, animate = "none", delay = 0, decorative = false, title = "Vira Web Odonto" }: VwoMarkProps) {
  const reduceMotion = useReducedMotion()
  const isAnimated = animate !== "none" && !reduceMotion

  return (
    <svg
      viewBox={VWO_MARK_VIEWBOX}
      xmlns="http://www.w3.org/2000/svg"
      className={cn("block h-auto overflow-visible", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
      focusable="false"
    >
      {VWO_FACETS.map((facet, index) => {
        const entry = GROUP_ENTRY[facet.group]
        const facetDelay = delay + GROUP_DELAY[facet.group] + index * 0.035

        if (!isAnimated) {
          return (
            <polygon
              key={facet.id}
              points={facet.points}
              fill={facet.fill}
              stroke={facet.fill}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          )
        }

        const hidden = { opacity: 0, x: entry.x, y: entry.y, rotate: entry.rotate, scale: entry.scale }
        const shown = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }

        return (
          <motion.polygon
            key={facet.id}
            points={facet.points}
            fill={facet.fill}
            stroke={facet.fill}
            strokeWidth={1}
            strokeLinejoin="round"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={hidden}
            {...(animate === "inView"
              ? { whileInView: shown, viewport: { once: true, amount: 0.4 } }
              : { animate: shown })}
            transition={{ ...SPRING, delay: facetDelay, opacity: { duration: 0.35, delay: facetDelay } }}
          />
        )
      })}
    </svg>
  )
}

export default VwoMark
