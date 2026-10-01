// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resetPasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function NewPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const { run, pending, error, fieldErrors } = useAction((p: string) => resetPasswordAction(token, p), { refresh: false });
  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) {
          setLocalError("As senhas não conferem");
          return;
        }
        setLocalError(null);
        const res = await run(password);
        if (res.ok) router.replace(res.data.redirectTo);
      }}
    >
      {error || localError ? <Notice tone="danger">{localError ?? error}</Notice> : null}
      <Field label="Nova senha" htmlFor="password" error={fieldErrors.password}>
        <Input id="password" type="password" autoComplete="new-password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Confirme a senha" htmlFor="confirm">
        <Input id="confirm" type="password" autoComplete="new-password" minLength={10} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        Salvar nova senha
      </Button>
    </form>
  );
}
