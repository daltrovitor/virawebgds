// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { previewOfxAction } from "@/actions/finance";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/page";
import { useAction } from "@/components/ui/use-action";

export function OfxUpload({ accountId }: { accountId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const preview = useAction(previewOfxAction, { refresh: false });
  return (
    <form
      ref={ref}
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("accountId", accountId);
        const res = await preview.run(fd);
        if (res.ok) router.push(`/financeiro/conciliacao/importacao/${res.data.batchId}`);
      }}
    >
      {preview.error ? <Notice tone="danger">{preview.error}</Notice> : null}
      <label htmlFor="ofx" className="block text-sm font-medium">
        Arquivo OFX da conta selecionada
      </label>
      <input id="ofx" name="file" type="file" required accept=".ofx,.OFX,application/x-ofx,text/plain" className="block w-full text-sm file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-border-strong file:bg-white file:px-3 file:text-sm" />
      <Button type="submit" variant="primary" loading={preview.pending}>
        Ler e pré-visualizar
      </Button>
    </form>
  );
}
