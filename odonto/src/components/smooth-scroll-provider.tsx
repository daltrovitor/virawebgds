// Hello World
"use client";

import { ReactLenis } from "lenis/react";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Rolagem inercial da página. Desativada quando o usuário prefere menos
 * movimento. Áreas com rolagem própria (agenda, tabelas, diálogos) usam
 * `data-lenis-prevent` para manter a rolagem nativa.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(!query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!enabled) return <>{children}</>;
  return (
    <ReactLenis root options={{ lerp: 0.08, smoothWheel: true, syncTouch: false }}>
      {children}
    </ReactLenis>
  );
}
