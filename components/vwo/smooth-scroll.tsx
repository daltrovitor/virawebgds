// Hello World
"use client"

import type React from "react"
import { useEffect } from "react"

/**
 * Rolagem inercial (Lenis) com um único loop de animação: o ticker do GSAP dirige o RAF do Lenis
 * e o Lenis informa o ScrollTrigger a cada quadro — sem "tremor" entre scroll suave e animações.
 *
 * Lenis e GSAP são importados sob demanda logo após a montagem, fora do caminho crítico de renderização
 * (a primeira pintura não espera ~150 KB de JavaScript). Respeita prefers-reduced-motion (rolagem nativa).
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let disposed = false
    let cleanup: (() => void) | undefined

    ;(async () => {
      const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
        import("lenis"),
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ])
      if (disposed) return
      gsap.registerPlugin(ScrollTrigger)
      const lenis = new Lenis({ autoRaf: false, lerp: 0.08, duration: 1.2, smoothWheel: true, anchors: true })
      lenis.on("scroll", ScrollTrigger.update)
      const update = (time: number) => lenis.raf(time * 1000)
      gsap.ticker.add(update)
      gsap.ticker.lagSmoothing(0)
      ScrollTrigger.refresh()
      cleanup = () => {
        gsap.ticker.remove(update)
        lenis.destroy()
      }
    })()

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [])

  return <>{children}</>
}

export default SmoothScroll
