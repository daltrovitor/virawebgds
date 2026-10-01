// Hello World
"use client";

import { useRouter } from "next/navigation";
import { selectOrganizationAction } from "@/actions/auth";
import { Badge } from "@/components/ui/badge";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";

export function OrgPicker({ options, current }: { options: { id: string; name: string; role: string; isDemo: boolean }[]; current: string | null }) {
  const router = useRouter();
  const { run, pending } = useAction(selectOrganizationAction, { refresh: false });
  return (
    <ul className="mt-8 space-y-2">
      {options.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              const res = await run(o.id);
              if (res.ok) {
                router.replace(res.data.redirectTo);
                router.refresh();
              }
            }}
            className={cn(
              "flex min-h-14 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors hover:border-zinc-400 hover:bg-surface cursor-pointer",
              current === o.id ? "border-accent" : "border-border",
            )}
          >
            <span>
              <span className="block text-sm font-medium text-fg">{o.name}</span>
              <span className="block text-xs text-muted">{o.role}</span>
            </span>
            {o.isDemo ? <Badge tone="warning">Demonstração</Badge> : current === o.id ? <Badge tone="accent">Atual</Badge> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
