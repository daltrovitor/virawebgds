// Hello World
"use client";

import { useState } from "react";
import { odontogramRows, parseTeethList, toothName, type Dentition } from "@/domain/teeth";
import { cn } from "@/lib/cn";

/**
 * Seleção de dentes (FDI). Serve para localizar procedimentos; não representa
 * diagnóstico. Teclado: Tab entre dentes, Espaço/Enter alterna; campo de texto
 * aceita "11, 12, 21-23" como alternativa.
 */
export function Odontogram({ selected, onChange }: { selected: number[]; onChange: (teeth: number[]) => void }) {
  const [dentition, setDentition] = useState<Dentition>(selected.some((t) => t >= 51) ? "deciduous" : "permanent");
  const [text, setText] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const rows = odontogramRows(dentition);
  const toggle = (t: number) => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t].sort((a, b) => a - b));
  // Função (não componente) para não remontar os botões e preservar o foco do teclado.
  const tooth = (t: number) => {
    const on = selected.includes(t);
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`Dente ${t}: ${toothName(t)}`}
        title={toothName(t)}
        onClick={() => toggle(t)}
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center justify-center rounded-sm border text-xs font-medium tabular transition-colors cursor-pointer sm:h-12 sm:text-sm",
          on ? "border-accent bg-accent text-accent-contrast" : "border-border-strong bg-white text-fg hover:border-accent hover:bg-accent-soft",
        )}
      >
        {t}
      </button>
    );
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Dentição">
          {(["permanent", "deciduous"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dentition === d}
              onClick={() => setDentition(d)}
              className={cn("min-h-9 rounded-sm px-3 text-sm cursor-pointer", dentition === d ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg")}
            >
              {d === "permanent" ? "Permanentes" : "Decíduos"}
            </button>
          ))}
        </div>
        {selected.length > 0 ? (
          <button type="button" className="min-h-9 text-sm text-muted hover:text-fg cursor-pointer" onClick={() => onChange([])}>
            Limpar seleção ({selected.length})
          </button>
        ) : null}
      </div>
      <div className="overflow-x-auto" data-lenis-prevent>
        <div className="min-w-[520px] space-y-1.5 rounded-md border border-border bg-surface p-2">
          <p className="flex justify-between px-1 text-[11px] uppercase tracking-[0.06em] text-subtle">
            <span>Direita do paciente</span>
            <span>Superior</span>
            <span>Esquerda</span>
          </p>
          <div className="flex gap-1" role="group" aria-label="Arcada superior">
            {rows.upper.map((t, i) => (
              <div key={t} className={cn("flex flex-1", i === rows.upper.length / 2 && "ml-2")}>
                {tooth(t)}
              </div>
            ))}
          </div>
          <div className="flex gap-1" role="group" aria-label="Arcada inferior">
            {rows.lower.map((t, i) => (
              <div key={t} className={cn("flex flex-1", i === rows.lower.length / 2 && "ml-2")}>
                {tooth(t)}
              </div>
            ))}
          </div>
          <p className="px-1 text-center text-[11px] uppercase tracking-[0.06em] text-subtle">Inferior</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="teeth-text" className="mb-1.5 block text-sm font-medium">
            Ou digite os dentes
          </label>
          <input
            id="teeth-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex.: 11, 12, 21-23"
            aria-describedby={textError ? "teeth-text-error" : undefined}
            className="h-10 w-full rounded-md border border-border-strong px-3 text-sm focus:border-accent focus:outline-2 focus:outline-accent/30"
          />
        </div>
        <button
          type="button"
          className="h-10 rounded-md border border-border-strong px-3 text-sm hover:bg-surface-2 cursor-pointer"
          onClick={() => {
            const { teeth, invalid } = parseTeethList(text);
            if (invalid.length > 0) {
              setTextError(`Inválido na numeração FDI: ${invalid.join(", ")}`);
              return;
            }
            setTextError(null);
            onChange([...new Set([...selected, ...teeth])].sort((a, b) => a - b));
            setText("");
          }}
        >
          Adicionar
        </button>
      </div>
      {textError ? (
        <p id="teeth-text-error" className="text-xs text-danger" role="alert">
          {textError}
        </p>
      ) : null}
      <p className="text-xs text-muted" aria-live="polite">
        {selected.length === 0 ? "Nenhum dente selecionado." : `Selecionados: ${selected.join(", ")}`}
      </p>
    </div>
  );
}
