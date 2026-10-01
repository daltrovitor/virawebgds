// Hello World
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlClass =
  "block w-full rounded-md border border-border-strong bg-white px-3 text-sm text-fg placeholder:text-subtle shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition-colors hover:border-zinc-400 focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/30 disabled:bg-surface-2 disabled:text-subtle aria-[invalid=true]:border-danger";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-medium text-fg", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  required,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-10", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlClass, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-24 py-2", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  const id = useId();
  const inputId = props.id ?? id;
  return (
    <label htmlFor={inputId} className={cn("inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm text-fg", className)}>
      <input id={inputId} type="checkbox" className="size-4 cursor-pointer rounded-sm border-border-strong accent-accent" {...props} />
      <span>{label}</span>
    </label>
  );
}
