// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInviteAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function AcceptInviteForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const { run, pending, error, fieldErrors } = useAction((i: { name: string; password: string }) => acceptInviteAction(token, i.name, i.password), { refresh: false });
  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run({ name, password });
        if (res.ok) router.replace(res.data.redirectTo);
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="Seu nome" htmlFor="name">
        <Input id="name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Senha" htmlFor="password" hint="Mínimo de 10 caracteres" error={fieldErrors.password}>
        <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Aceitar e entrar
      </Button>
    </form>
  );
}
