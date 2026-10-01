// Hello World
"use client";

import { useState } from "react";
import { requestResetAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const { run, pending, error } = useAction(requestResetAction, { refresh: false });
  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(email);
        if (res.ok) setDone(res.data.message);
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {done ? <Notice tone="success">{done}</Notice> : null}
      <Field label="E-mail" htmlFor="email">
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Enviar instruções
      </Button>
    </form>
  );
}
