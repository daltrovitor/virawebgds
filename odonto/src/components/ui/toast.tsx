// Hello World
"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

const ToastContext = createContext<{ push: (tone: ToastTone, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list.slice(-3), { id, tone, message }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === "error" ? 8000 : 4500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6" aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              role={t.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg",
                t.tone === "success" && "border-green-200 bg-white text-fg",
                t.tone === "error" && "border-red-200 bg-danger-soft text-red-900",
                t.tone === "info" && "border-border bg-white text-fg",
              )}
            >
              <span className={cn("mr-2 font-medium", t.tone === "success" && "text-success", t.tone === "error" && "text-danger")}>
                {t.tone === "success" ? "Concluído." : t.tone === "error" ? "Erro." : "Aviso."}
              </span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("ToastProvider ausente");
  return ctx;
}
