import type { Permission } from "@/domain/permissions";

export interface NavItem {
  href: string;
  label: string;
  /** Exibido quando o usuário tem qualquer uma destas permissões (vazio = sempre). */
  anyOf: Permission[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/visao-geral", label: "Visão geral", anyOf: [] },
  { href: "/agenda", label: "Agenda", anyOf: ["schedule.view"] },
  { href: "/pacientes", label: "Pacientes", anyOf: ["patients.view"] },
  { href: "/orcamentos", label: "Orçamentos e tratamentos", anyOf: ["budgets.view"] },
  { href: "/financeiro", label: "Financeiro", anyOf: ["finance.view"] },
  { href: "/relatorios", label: "Relatórios", anyOf: ["reports.view"] },
  { href: "/cadastros", label: "Cadastros", anyOf: ["catalog.manage", "settings.manage", "finance.edit"] },
  { href: "/configuracoes", label: "Configurações", anyOf: [] },
];

export function visibleNav(permissions: readonly string[]): NavItem[] {
  const set = new Set(permissions);
  return NAV_ITEMS.filter((i) => i.anyOf.length === 0 || i.anyOf.some((p) => set.has(p)));
}
