// Hello World
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex min-h-10 items-center text-sm text-muted hover:text-fg cursor-pointer">
            ← {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function TabLinks({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="mb-6 -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0" data-lenis-prevent>
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => {
          const current = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center gap-2 px-3 text-sm font-medium transition-colors cursor-pointer",
                  current ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-accent" : "text-muted hover:text-fg",
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 ? <span className="rounded-sm bg-surface-2 px-1.5 text-xs tabular text-muted">{t.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function EmptyState({ title, description, action, className }: { title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        tone === "info" && "border-blue-200 bg-info-soft text-blue-900",
        tone === "warning" && "border-yellow-200 bg-warning-soft text-yellow-900",
        tone === "danger" && "border-red-200 bg-danger-soft text-red-900",
        tone === "success" && "border-green-200 bg-success-soft text-green-900",
        className,
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={cn(title && "mt-0.5")}>{children}</div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
      <p className="text-muted tabular">
        {total} registro{total === 1 ? "" : "s"} · página {page} de {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="inline-flex min-h-10 items-center rounded-md border border-border-strong px-3 hover:bg-surface-2 cursor-pointer" href={hrefFor(page - 1)}>
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="inline-flex min-h-10 items-center rounded-md border border-border-strong px-3 hover:bg-surface-2 cursor-pointer" href={hrefFor(page + 1)}>
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function DescList({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs text-subtle">{i.label}</dt>
          <dd className="mt-0.5 text-sm text-fg break-words">{i.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
