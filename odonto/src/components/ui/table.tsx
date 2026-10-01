// Hello World
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function TableWrap({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)} data-lenis-prevent role={label ? "region" : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />;
}

export function Th({ className, align = "left", ...props }: ComponentProps<"th"> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border bg-surface px-3 py-2.5 text-xs font-medium uppercase tracking-[0.05em] text-subtle whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, align = "left", ...props }: ComponentProps<"td"> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "border-b border-border px-3 py-2.5 align-middle first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("hover:bg-surface/70", className)} {...props} />;
}
