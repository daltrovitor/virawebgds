// Hello World
"use client"

import type React from "react"
import { useRef } from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react"
import { cn } from "@/lib/utils"

/** Botão com atração magnética suave ao cursor (molas newtonianas); estático com movimento reduzido. */
export function MagneticButton({
  children,
  className,
  strength = 0.22,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { strength?: number }) {
  const ref = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.6 })
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.6 })

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength)
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  const { onClick, type = "button", disabled, ...rest } = props
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      whileTap={{ scale: 0.97 }}
      className={cn("relative inline-flex items-center justify-center", className)}
      aria-label={rest["aria-label"]}
    >
      {children}
    </motion.button>
  )
}

export default MagneticButton
