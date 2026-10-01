// Hello World
"use client";

import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { logoutAction } from "@/actions/auth";
import { Dialog } from "@/components/ui/dialog";
import { useAction } from "@/components/ui/use-action";
import { cn } from "@/lib/cn";
import type { NavItem } from "./nav";

interface ShellProps {
  productName: string;
  clinicName: string;
  userName: string;
  roleLabel: string;
  nav: NavItem[];
  canSwitch: boolean;
  isDemo: boolean;
  brandColor: string;
  canSearchPatients: boolean;
  children: ReactNode;
}

function NavList({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {nav.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 items-center rounded-md px-3 text-sm transition-colors cursor-pointer",
                active ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-sm bg-accent" aria-hidden="true" /> : null}
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppShell(props: ShellProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");
  const logout = useAction(logoutAction, { refresh: false });
  const style = props.brandColor && props.brandColor.toLowerCase() !== "#0f766e" ? ({ "--accent": props.brandColor } as CSSProperties) : undefined;

  const userBlock = (
    <div className="border-t border-border p-3">
      <p className="truncate text-sm font-medium text-fg">{props.userName}</p>
      <p className="truncate text-xs text-subtle">{props.roleLabel}</p>
      <div className="mt-2 flex gap-1">
        <Link href="/configuracoes/minha-conta" className="inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg cursor-pointer">
          Minha conta
        </Link>
        <button
          type="button"
          className="inline-flex min-h-10 items-center rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg cursor-pointer"
          onClick={async () => {
            const res = await logout.run(undefined);
            if (res.ok) {
              router.replace(res.data.redirectTo);
              router.refresh();
            }
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-dvh bg-bg", style && "brand-scope")} style={style}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Pular para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-white lg:flex" aria-label="Navegação principal">
        <div className="border-b border-border px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">{props.productName}</p>
          <p className="mt-1 truncate text-sm font-semibold text-fg" title={props.clinicName}>
            {props.clinicName}
          </p>
          {props.canSwitch ? (
            <Link href="/selecionar-clinica" className="mt-1 inline-flex min-h-8 items-center text-xs text-accent hover:underline cursor-pointer">
              Trocar clínica
            </Link>
          ) : null}
        </div>
        <nav className="flex-1 overflow-y-auto p-3" data-lenis-prevent aria-label="Seções">
          <NavList nav={props.nav} />
        </nav>
        {userBlock}
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-ml-2 inline-flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-2 lg:hidden cursor-pointer"
              aria-label="Abrir menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <p className="truncate text-sm font-semibold lg:hidden">{props.clinicName}</p>
            {props.canSearchPatients ? (
              <form
                role="search"
                className="ml-auto w-full max-w-xs sm:max-w-sm lg:ml-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  router.push(`/pacientes?q=${encodeURIComponent(q.trim())}`);
                }}
              >
                <label htmlFor="busca-global" className="sr-only">
                  Buscar paciente por nome, telefone ou código
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <input
                    id="busca-global"
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar paciente"
                    className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm placeholder:text-subtle focus:border-accent focus:bg-white focus:outline-2 focus:outline-accent/30"
                  />
                </div>
              </form>
            ) : null}
          </div>
          {props.isDemo ? (
            <div className="border-t border-yellow-200 bg-warning-soft px-4 py-1.5 text-xs text-yellow-900 sm:px-6 lg:px-8">
              Ambiente de demonstração: dados sintéticos. Nenhuma mensagem, cobrança ou integração real é executada.
            </div>
          ) : null}
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {props.children}
        </main>
      </div>

      <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title={props.clinicName} description={props.productName} size="sm">
        <nav aria-label="Navegação principal">
          <NavList nav={props.nav} onNavigate={() => setMobileOpen(false)} />
        </nav>
        {props.canSwitch ? (
          <Link href="/selecionar-clinica" className="mt-3 inline-flex min-h-10 items-center text-sm text-accent cursor-pointer" onClick={() => setMobileOpen(false)}>
            Trocar clínica
          </Link>
        ) : null}
        <div className="-mx-5 mt-3">{userBlock}</div>
      </Dialog>
    </div>
  );
}
