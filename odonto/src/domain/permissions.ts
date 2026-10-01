/**
 * Permissões por ação. Papéis são conjuntos editáveis por clínica; estes são
 * os padrões propostos para o piloto.
 */
export const PERMISSIONS = [
  "patients.view",
  "patients.edit",
  "patients.view_documents",
  "clinical.view",
  "clinical.edit",
  "attachments.view",
  "attachments.upload",
  "schedule.view",
  "schedule.edit",
  "schedule.overbook",
  "budgets.view",
  "budgets.edit",
  "budgets.approve",
  "budgets.revise",
  "treatments.edit",
  "finance.view",
  "finance.edit",
  "finance.settle",
  "finance.reverse",
  "finance.reconcile",
  "finance.export",
  "reports.view",
  "catalog.manage",
  "settings.manage",
  "users.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABEL: Record<Permission, string> = {
  "patients.view": "Ver cadastro de pacientes",
  "patients.edit": "Criar e editar pacientes",
  "patients.view_documents": "Ver CPF e documentos completos",
  "clinical.view": "Ver conteúdo clínico (histórico, anamnese)",
  "clinical.edit": "Registrar evolução e anotações clínicas",
  "attachments.view": "Ver imagens e arquivos",
  "attachments.upload": "Enviar imagens e arquivos",
  "schedule.view": "Ver agenda",
  "schedule.edit": "Criar e alterar consultas",
  "schedule.overbook": "Encaixar consulta sobreposta",
  "budgets.view": "Ver orçamentos",
  "budgets.edit": "Montar e editar orçamentos",
  "budgets.approve": "Aprovar orçamentos e acordos",
  "budgets.revise": "Revisar orçamento aprovado",
  "treatments.edit": "Atualizar situação de tratamentos",
  "finance.view": "Ver valores financeiros",
  "finance.edit": "Criar e editar lançamentos",
  "finance.settle": "Dar baixa (receber/pagar)",
  "finance.reverse": "Estornar baixas",
  "finance.reconcile": "Importar extratos e conciliar",
  "finance.export": "Exportar dados financeiros",
  "reports.view": "Ver relatórios",
  "catalog.manage": "Gerenciar especialidades, procedimentos e preços",
  "settings.manage": "Alterar configurações da clínica",
  "users.manage": "Gerenciar usuários e permissões",
  "audit.view": "Ver auditoria",
};

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Pacientes", permissions: ["patients.view", "patients.edit", "patients.view_documents"] },
  {
    label: "Clínico",
    permissions: ["clinical.view", "clinical.edit", "attachments.view", "attachments.upload", "treatments.edit"],
  },
  { label: "Agenda", permissions: ["schedule.view", "schedule.edit", "schedule.overbook"] },
  { label: "Orçamentos", permissions: ["budgets.view", "budgets.edit", "budgets.approve", "budgets.revise"] },
  {
    label: "Financeiro",
    permissions: ["finance.view", "finance.edit", "finance.settle", "finance.reverse", "finance.reconcile", "finance.export"],
  },
  {
    label: "Administração",
    permissions: ["reports.view", "catalog.manage", "settings.manage", "users.manage", "audit.view"],
  },
];

export const SYSTEM_ROLES = ["owner", "dentist", "reception", "finance", "accountant"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ROLE_LABEL: Record<SystemRole, string> = {
  owner: "Administrador / proprietário",
  dentist: "Dentista",
  reception: "Recepção",
  finance: "Financeiro",
  accountant: "Contador (leitura financeira)",
};

export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  owner: [...PERMISSIONS],
  dentist: [
    "patients.view",
    "patients.edit",
    "clinical.view",
    "clinical.edit",
    "attachments.view",
    "attachments.upload",
    "schedule.view",
    "schedule.edit",
    "budgets.view",
    "budgets.edit",
    "treatments.edit",
  ],
  reception: ["patients.view", "patients.edit", "schedule.view", "schedule.edit", "budgets.view"],
  finance: [
    "patients.view",
    "budgets.view",
    "budgets.approve",
    "finance.view",
    "finance.edit",
    "finance.settle",
    "finance.reverse",
    "finance.reconcile",
    "finance.export",
    "reports.view",
  ],
  accountant: ["finance.view", "finance.export", "reports.view"],
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
