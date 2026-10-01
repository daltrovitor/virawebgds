// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { run, pending, error } = useAction(loginAction, { refresh: false });
  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run({ email, password, next });
        if (res.ok) router.replace(res.data.redirectTo);
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Entrar
      </Button>
    </form>
  );
}
