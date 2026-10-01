// Hello World
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  accent: "bg-accent-soft text-accent-strong border-teal-200",
  success: "bg-success-soft text-success border-green-200",
  warning: "bg-warning-soft text-warning border-yellow-200",
  danger: "bg-danger-soft text-danger border-red-200",
  info: "bg-info-soft text-info border-blue-200",
};

const dots: Record<Tone, string> = {
  neutral: "bg-zinc-400",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-yellow-600",
  danger: "bg-danger",
  info: "bg-info",
};

/** A cor sempre acompanha texto; o marcador é decorativo. */
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
