// Hello World
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <As className={cn("rounded-lg border border-border bg-white", className)}>{children}</As>;
}

export function CardHeader({ title, description, actions, className, level = 2 }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <H className="text-sm font-semibold tracking-tight text-fg">{title}</H>
        {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

/** Indicador do topo da pirâmide: número grande, rótulo e contexto. */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger" | "accent" | "warning";
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-subtle">{label}</p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular sm:text-[1.75rem]",
          tone === "danger" && "text-danger",
          tone === "accent" && "text-accent-strong",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const cls = "block rounded-lg border border-border bg-white px-4 py-4 sm:px-5";
  if (href) {
    return (
      <a href={href} className={cn(cls, "transition-colors hover:border-zinc-400 cursor-pointer")}>
        {content}
      </a>
    );
  }
  return <div className={cls}>{content}</div>;
}
