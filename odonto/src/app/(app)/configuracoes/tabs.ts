import type { Permission } from "@/domain/permissions";

export const CFG_TABS: { key: string; label: string; href: string; anyOf: Permission[] }[] = [
  { key: "clinica", label: "Clínica e expediente", href: "/configuracoes/clinica", anyOf: ["settings.manage"] },
  { key: "usuarios", label: "Usuários e permissões", href: "/configuracoes/usuarios", anyOf: ["users.manage"] },
  { key: "integracoes", label: "Integrações", href: "/configuracoes/integracoes", anyOf: ["settings.manage"] },
  { key: "anamnese", label: "Anamnese", href: "/configuracoes/anamnese", anyOf: ["settings.manage"] },
  { key: "modelos", label: "Modelos de documento", href: "/configuracoes/modelos", anyOf: ["settings.manage"] },
  { key: "auditoria", label: "Auditoria", href: "/configuracoes/auditoria", anyOf: ["audit.view"] },
  { key: "minha-conta", label: "Minha conta", href: "/configuracoes/minha-conta", anyOf: [] },
];

export function visibleCfgTabs(perms: ReadonlySet<string>) {
  return CFG_TABS.filter((t) => t.anyOf.length === 0 || t.anyOf.some((p) => perms.has(p)));
}
