// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyMfaAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function MfaForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const { run, pending, error } = useAction(verifyMfaAction, { refresh: false });
  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(code);
        if (res.ok) router.replace(res.data.redirectTo);
      }}
    >
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label="Código" htmlFor="code">
        <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Verificar
      </Button>
    </form>
  );
}
