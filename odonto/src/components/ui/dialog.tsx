// Hello World
"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Diálogo modal com <dialog> nativo: foco preso, Esc fecha, fundo inerte.
 * `onClose` deve confirmar descarte quando houver edição não salva.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[92dvh] w-[calc(100vw-2rem)] overflow-visible rounded-lg border border-border bg-white p-0 text-fg shadow-xl backdrop:backdrop-blur-[1px]",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
        size === "xl" && "max-w-5xl",
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <h2 id={titleId} className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-fg cursor-pointer" aria-label="Fechar">
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>
          <div className="overflow-y-auto px-5 py-4" data-lenis-prevent>
            {children}
          </div>
          {footer ? <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface px-5 py-3">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}
