// Hello World
"use client";

import { useState, type ComponentProps } from "react";
import { centsToInput, parseBRL } from "@/domain/money";
import { cn } from "@/lib/cn";
import { controlClass } from "./field";

/** Valor em centavos; o texto segue o formato brasileiro (1.234,56). */
export function MoneyInput({
  value,
  onChange,
  className,
  allowNegative = false,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (cents: number | null) => void;
  allowNegative?: boolean;
}) {
  const [text, setText] = useState(centsToInput(value));
  const [prevValue, setPrevValue] = useState(value);
  // Sincroniza o texto quando o valor externo muda (ajuste durante a renderização,
  // sem efeito): preserva o que o usuário digitou se já representa o mesmo valor.
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseBRL(text) !== value) setText(centsToInput(value));
  }
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-subtle" aria-hidden="true">
        R$
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        className={cn(controlClass, "h-10 pl-9 text-right tabular", className)}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseBRL(e.target.value);
          if (parsed === null) onChange(e.target.value.trim() === "" ? null : value);
          else if (!allowNegative && parsed < 0) onChange(value);
          else onChange(parsed);
        }}
        onBlur={() => setText(centsToInput(value))}
        {...props}
      />
    </div>
  );
}
