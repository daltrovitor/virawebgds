// Hello World
"use client";

import { useState } from "react";
import { changePasswordAction, confirmMfaSetupAction, startMfaSetupAction } from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function AccountSecurity({ mfaEnabled, recommendMfa }: { mfaEnabled: boolean; recommendMfa: boolean }) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const change = useAction((i: { current: string; next: string }) => changePasswordAction(i.current, i.next), { success: "Senha alterada" });
  const start = useAction(startMfaSetupAction, { refresh: false });
  const confirm = useAction(confirmMfaSetupAction, { success: "Verificação em duas etapas ativada" });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Alterar senha" />
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pw.next !== pw.confirm) return;
              const res = await change.run({ current: pw.current, next: pw.next });
              if (res.ok) setPw({ current: "", next: "", confirm: "" });
            }}
          >
            {change.error ? <Notice tone="danger">{change.error}</Notice> : null}
            <Field label="Senha atual" htmlFor="pw-cur" error={change.fieldErrors.current}>
              <Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label="Nova senha" htmlFor="pw-new" hint="Mínimo de 10 caracteres" error={change.fieldErrors.password}>
              <Input id="pw-new" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Field label="Confirme" htmlFor="pw-conf" error={pw.confirm && pw.next !== pw.confirm ? "As senhas não conferem" : undefined}>
              <Input id="pw-conf" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <Button type="submit" variant="primary" loading={change.pending}>
              Alterar senha
            </Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Verificação em duas etapas" actions={mfaEnabled ? <Badge tone="success">Ativa</Badge> : <Badge>Inativa</Badge>} />
        <CardBody className="space-y-4">
          {recommendMfa && !mfaEnabled ? <Notice tone="warning">Recomendada para administradores e financeiro.</Notice> : null}
          <p className="text-sm text-muted">Use um aplicativo autenticador (TOTP). O código é pedido a cada novo login.</p>
          {start.error ? <Notice tone="danger">{start.error}</Notice> : null}
          {!setup ? (
            <Button
              loading={start.pending}
              onClick={async () => {
                const res = await start.run(undefined);
                if (res.ok) setSetup(res.data);
              }}
            >
              {mfaEnabled ? "Reconfigurar autenticador" : "Configurar autenticador"}
            </Button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await confirm.run(code);
                if (res.ok) setSetup(null);
              }}
            >
              <p className="text-sm">No aplicativo, adicione uma conta com a chave:</p>
              <code className="block break-all rounded-md border border-border bg-surface px-3 py-2 text-sm tabular">{setup.secret}</code>
              <a href={setup.uri} className="inline-flex min-h-10 items-center text-sm text-accent hover:underline cursor-pointer">
                Abrir no aplicativo (dispositivo móvel)
              </a>
              {confirm.error ? <Notice tone="danger">{confirm.error}</Notice> : null}
              <Field label="Código de 6 dígitos" htmlFor="mfa-code">
                <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              <Button type="submit" variant="primary" loading={confirm.pending}>
                Confirmar e ativar
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
