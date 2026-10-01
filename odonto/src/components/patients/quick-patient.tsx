// Hello World
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { quickCreatePatientAction } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatPhone } from "@/domain/text";
import type { DuplicateCandidate } from "@/server/services/patients";

/** Cadastro rápido (nome + contato) com detecção de possível duplicidade. */
export function QuickPatientForm({ onCreated, autoFocus = true }: { onCreated: (p: { id: string; name: string }) => void; autoFocus?: boolean }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [candidates, setCandidates] = useState<DuplicateCandidate[] | null>(null);
  const { run, pending, error, fieldErrors } = useAction(quickCreatePatientAction, { refresh: false });
  const submit = async (confirmNotDuplicate: boolean) => {
    const res = await run({ fullName, phone, confirmNotDuplicate });
    if (!res.ok) return;
    if (res.data.status === "possible_duplicates") setCandidates(res.data.candidates);
    else onCreated({ id: res.data.id, name: fullName });
  };
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="Nome" htmlFor="qp-name" required error={fieldErrors.fullName}>
        <Input id="qp-name" autoFocus={autoFocus} required value={fullName} onChange={(e) => (setFullName(e.target.value), setCandidates(null))} />
      </Field>
      <Field label="Telefone com DDD" htmlFor="qp-phone" error={fieldErrors.phone} hint="Usado para o atalho de WhatsApp; nada é enviado automaticamente.">
        <Input id="qp-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => (setPhone(e.target.value), setCandidates(null))} />
      </Field>
      {candidates ? (
        <Notice tone="warning" title="Possível cadastro existente">
          <ul className="mt-2 space-y-1">
            {candidates.map((c) => (
              <li key={c.id}>
                <Link href={`/pacientes/${c.id}`} className="font-medium underline cursor-pointer" target="_blank">
                  {c.fullName}
                </Link>{" "}
                <span className="text-xs">
                  nº {c.code} {c.phone ? `· ${formatPhone(c.phone)}` : ""} — {c.reasons.join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Os cadastros nunca são unidos automaticamente.</p>
          <Button className="mt-3" size="sm" onClick={() => void submit(true)} loading={pending}>
            É outra pessoa: cadastrar mesmo assim
          </Button>
        </Notice>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={pending}>
          Cadastrar
        </Button>
      </div>
    </form>
  );
}

export function QuickPatientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Cadastro rápido</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Cadastro rápido" description="Nome e contato bastam para marcar a primeira consulta.">
        {open ? (
          <QuickPatientForm
            onCreated={(p) => {
              setOpen(false);
              router.push(`/pacientes/${p.id}`);
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
}
