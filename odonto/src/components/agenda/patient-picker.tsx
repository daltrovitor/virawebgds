// Hello World
"use client";

import { useEffect, useState } from "react";
import { searchPatientsAction } from "@/actions/patients";
import { QuickPatientForm } from "@/components/patients/quick-patient";
import { Button } from "@/components/ui/button";
import { formatPhone } from "@/domain/text";

export interface PickedPatient {
  id: string;
  name: string;
  phone: string | null;
}

/** Busca de paciente com opção de cadastro rápido sem sair do formulário da consulta. */
export function PatientPicker({ value, onChange, canCreate }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; canCreate: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchPatientsAction(term);
      if (!alive) return;
      setLoading(false);
      if (res.ok) setResults(res.data.map((p) => ({ id: p.id, name: p.name, phone: p.phone })));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);
  // Resultados só valem para buscas com ao menos 2 caracteres (estado derivado, sem efeito).
  const visibleResults = term.length >= 2 ? results : [];

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2">
        <span className="min-w-0 text-sm">
          <span className="block truncate font-medium">{value.name}</span>
          {value.phone ? <span className="block text-xs text-muted">{formatPhone(value.phone)}</span> : null}
        </span>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }
  if (creating) {
    return (
      <div className="rounded-md border border-border p-3">
        <QuickPatientForm
          autoFocus
          onCreated={(p) => {
            setCreating(false);
            onChange({ id: p.id, name: p.name, phone: null });
          }}
        />
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setCreating(false)}>
          Voltar à busca
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input
        aria-label="Buscar paciente"
        placeholder="Nome, telefone ou código (mín. 2 caracteres)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-10 w-full rounded-md border border-border-strong px-3 text-sm focus:border-accent focus:outline-2 focus:outline-accent/30"
      />
      <div aria-live="polite" className="text-xs text-subtle">
        {term.length < 2 ? "" : loading ? "Buscando…" : visibleResults.length === 0 ? "Nenhum paciente encontrado." : ""}
      </div>
      {visibleResults.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-border" data-lenis-prevent>
          {visibleResults.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm hover:bg-surface cursor-pointer" onClick={() => onChange(p)}>
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted tabular">{p.phone ? formatPhone(p.phone) : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {canCreate ? (
        <Button size="sm" variant="link" onClick={() => setCreating(true)}>
          Paciente novo? Cadastro rápido
        </Button>
      ) : null}
    </div>
  );
}
