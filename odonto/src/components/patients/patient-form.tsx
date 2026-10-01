// Hello World
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { savePatientAction } from "@/actions/patients";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";
import { formatPhone } from "@/domain/text";
import type { DuplicateCandidate } from "@/server/services/patients";

export interface PatientFormValues {
  id?: string;
  version?: number;
  fullName: string;
  socialName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  phoneAlt: string;
  email: string;
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  origin: string;
  referredBy: string;
  referenceProfessionalId: string;
  adminNotes: string;
}

export const EMPTY_PATIENT: PatientFormValues = {
  fullName: "",
  socialName: "",
  birthDate: "",
  cpf: "",
  phone: "",
  phoneAlt: "",
  email: "",
  zip: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  origin: "",
  referredBy: "",
  referenceProfessionalId: "",
  adminNotes: "",
};

export function PatientForm({
  initial,
  professionals,
  canEditCpf,
  cpfMasked,
}: {
  initial: PatientFormValues;
  professionals: { id: string; name: string }[];
  canEditCpf: boolean;
  cpfMasked?: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [candidates, setCandidates] = useState<DuplicateCandidate[] | null>(null);
  const { run, pending, error, fieldErrors } = useAction(savePatientAction, { success: "Cadastro salvo" });
  const set = (k: keyof PatientFormValues) => (e: { target: { value: string } }) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setDirty(true);
    setCandidates(null);
  };
  const submit = async (confirmNotDuplicate: boolean) => {
    const res = await run({
      ...v,
      id: v.id ?? null,
      version: v.version ?? null,
      birthDate: v.birthDate || null,
      referenceProfessionalId: v.referenceProfessionalId || null,
      confirmNotDuplicate,
    });
    if (!res.ok) return;
    if (res.data.status === "possible_duplicates") {
      setCandidates(res.data.candidates);
      return;
    }
    setDirty(false);
    router.push(`/pacientes/${res.data.id}`);
  };
  const f = (k: keyof PatientFormValues) => fieldErrors[k];
  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">Identificação</legend>
        <Field label="Nome completo" htmlFor="fullName" required error={f("fullName")} className="sm:col-span-2">
          <Input id="fullName" required autoComplete="off" value={v.fullName} onChange={set("fullName")} />
        </Field>
        <Field label="Nome social / preferido" htmlFor="socialName" error={f("socialName")}>
          <Input id="socialName" value={v.socialName} onChange={set("socialName")} />
        </Field>
        <Field label="Nascimento" htmlFor="birthDate" error={f("birthDate")}>
          <Input id="birthDate" type="date" value={v.birthDate} onChange={set("birthDate")} />
        </Field>
        <Field label="CPF" htmlFor="cpf" error={f("cpf")} hint={canEditCpf ? "Opcional até ser informado" : "Visível apenas para quem tem permissão"}>
          {canEditCpf ? <Input id="cpf" inputMode="numeric" value={v.cpf} onChange={set("cpf")} /> : <Input id="cpf" disabled value={cpfMasked ?? "—"} />}
        </Field>
        <Field label="Profissional de referência" htmlFor="ref" error={f("referenceProfessionalId")}>
          <Select id="ref" value={v.referenceProfessionalId} onChange={set("referenceProfessionalId")}>
            <option value="">Nenhum</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-3 text-sm font-semibold">Contato</legend>
        <Field label="Telefone principal (com DDD)" htmlFor="phone" error={f("phone")}>
          <Input id="phone" inputMode="tel" autoComplete="off" value={v.phone} onChange={set("phone")} />
        </Field>
        <Field label="Telefone alternativo" htmlFor="phoneAlt" error={f("phoneAlt")}>
          <Input id="phoneAlt" inputMode="tel" value={v.phoneAlt} onChange={set("phoneAlt")} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={f("email")}>
          <Input id="email" type="email" value={v.email} onChange={set("email")} />
        </Field>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <legend className="mb-3 text-sm font-semibold">Endereço</legend>
        <Field label="CEP" htmlFor="zip" className="lg:col-span-1">
          <Input id="zip" inputMode="numeric" value={v.zip} onChange={set("zip")} />
        </Field>
        <Field label="Logradouro" htmlFor="street" className="lg:col-span-3">
          <Input id="street" value={v.street} onChange={set("street")} />
        </Field>
        <Field label="Número" htmlFor="number" className="lg:col-span-1">
          <Input id="number" value={v.number} onChange={set("number")} />
        </Field>
        <Field label="Complemento" htmlFor="complement" className="lg:col-span-1">
          <Input id="complement" value={v.complement} onChange={set("complement")} />
        </Field>
        <Field label="Bairro" htmlFor="district" className="lg:col-span-2">
          <Input id="district" value={v.district} onChange={set("district")} />
        </Field>
        <Field label="Cidade" htmlFor="city" className="lg:col-span-3">
          <Input id="city" value={v.city} onChange={set("city")} />
        </Field>
        <Field label="UF" htmlFor="state" className="lg:col-span-1" error={f("state")}>
          <Input id="state" maxLength={2} value={v.state} onChange={set("state")} />
        </Field>
      </fieldset>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Administrativo</legend>
        <Field label="Origem / campanha" htmlFor="origin">
          <Input id="origin" value={v.origin} onChange={set("origin")} />
        </Field>
        <Field label="Indicado por" htmlFor="referredBy">
          <Input id="referredBy" value={v.referredBy} onChange={set("referredBy")} />
        </Field>
        <Field label="Observações administrativas" htmlFor="adminNotes" className="sm:col-span-2" hint="Não registre informações clínicas aqui.">
          <Textarea id="adminNotes" value={v.adminNotes} onChange={set("adminNotes")} />
        </Field>
      </fieldset>
      {candidates ? (
        <Notice tone="warning" title="Possível cadastro existente">
          <ul className="mt-2 space-y-1">
            {candidates.map((c) => (
              <li key={c.id}>
                <Link href={`/pacientes/${c.id}`} target="_blank" className="font-medium underline cursor-pointer">
                  {c.fullName}
                </Link>{" "}
                <span className="text-xs">
                  nº {c.code} {c.phone ? `· ${formatPhone(c.phone)}` : ""} — {c.reasons.join(", ")}
                </span>
              </li>
            ))}
          </ul>
          <Button className="mt-3" size="sm" onClick={() => void submit(true)} loading={pending}>
            Confirmo que é outra pessoa: salvar
          </Button>
        </Notice>
      ) : null}
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-white/95 px-4 py-3 sm:-mx-6 sm:px-6">
        {dirty ? <span className="mr-auto text-xs text-warning">Alterações não salvas</span> : null}
        <Button
          variant="ghost"
          onClick={() => {
            if (dirty && !window.confirm("Descartar as alterações não salvas?")) return;
            router.back();
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          Salvar cadastro
        </Button>
      </div>
    </form>
  );
}
