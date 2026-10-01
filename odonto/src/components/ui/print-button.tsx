// Hello World
"use client";

import { Button } from "./button";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return <Button onClick={() => window.print()}>{label}</Button>;
}
