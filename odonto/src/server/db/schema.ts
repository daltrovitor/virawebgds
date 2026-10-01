/**
 * Modelo de dados. Convenções:
 * - Toda entidade de negócio tem organization_id (tenant).
 * - Referências entre entidades usam FK composta (organization_id, id), de modo
 *   que o próprio banco recusa vínculos entre clínicas diferentes.
 * - Dinheiro em centavos (bigint). Datas civis como `date` (texto YYYY-MM-DD).
 * - Estados em colunas próprias por conceito (orçamento, item, consulta,
 *   tratamento, título), nunca um status genérico compartilhado.
 */
import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pk = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const money = (name: string) => bigint(name, { mode: "number" });
const civil = (name: string) => date(name, { mode: "string" });
const orgCol = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id);
const userRef = (name: string) => uuid(name).references(() => users.id);

function inList(col: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${col} in (${sql.raw(values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", "))})`;
}

type OrgTarget = { organizationId: AnyPgColumn; id: AnyPgColumn };

function orgFk(name: string, org: AnyPgColumn, col: AnyPgColumn, target: () => OrgTarget) {
  const t = target();
  return foreignKey({ name, columns: [org, col], foreignColumns: [t.organizationId, t.id] });
}

// ---------------------------------------------------------------------------
// Organização, usuários, sessões e permissões
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: pk(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const organizationSettings = pgTable("organization_settings", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id),
  displayName: text("display_name").notNull(),
  legalName: text("legal_name"),
  document: text("document"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  brandColor: text("brand_color").notNull().default("#0f766e"),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  slotMinutes: integer("slot_minutes").notNull().default(15),
  businessHours: jsonb("business_hours").$type<{ days: { start: number; end: number }[][] }>().notNull(),
  uploadMaxMb: integer("upload_max_mb").notNull().default(20),
  budgetValidityDays: integer("budget_validity_days").notNull().default(30),
  features: jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  updatedAt: updatedAt(),
  updatedBy: userRef("updated_by"),
});

export const users = pgTable(
  "users",
  {
    id: pk(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
    mfaSecret: text("mfa_secret"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    disabledAt: ts("disabled_at"),
    lastLoginAt: ts("last_login_at"),
    passwordChangedAt: ts("password_changed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: pk(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    activeOrganizationId: uuid("active_organization_id").references(() => organizations.id),
    mfaVerifiedAt: ts("mfa_verified_at"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    emailKey: text("email_key").notNull(),
    ip: text("ip"),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_email_idx").on(t.emailKey, t.createdAt), index("login_attempts_ip_idx").on(t.ip, t.createdAt)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: pk(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  requestedIp: text("requested_ip"),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

export const roles = pgTable(
  "roles",
  {
    id: pk(),
    organizationId: orgCol(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    permissions: text("permissions").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("roles_org_id_uq").on(t.organizationId, t.id), unique("roles_org_key_uq").on(t.organizationId, t.key)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: pk(),
    organizationId: orgCol(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    roleId: uuid("role_id").notNull(),
    status: text("status").notNull().default("active"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("memberships_org_user_uq").on(t.organizationId, t.userId),
    orgFk("memberships_role_fk", t.organizationId, t.roleId, () => roles),
    check("memberships_status_ck", inList(t.status, ["active", "suspended"])),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: pk(),
    organizationId: orgCol(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    roleId: uuid("role_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    acceptedAt: ts("accepted_at"),
    acceptedUserId: userRef("accepted_user_id"),
    revokedAt: ts("revoked_at"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [orgFk("invitations_role_fk", t.organizationId, t.roleId, () => roles)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    userId: userRef("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_entity_idx").on(t.organizationId, t.entityType, t.entityId),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    organizationId: orgCol(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    result: jsonb("result").$type<unknown>(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ name: "idempotency_keys_pk", columns: [t.organizationId, t.scope, t.key] })],
);

export const orgCounters = pgTable(
  "org_counters",
  {
    organizationId: orgCol(),
    name: text("name").notNull(),
    value: bigint("value", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ name: "org_counters_pk", columns: [t.organizationId, t.name] })],
);

// ---------------------------------------------------------------------------
// Catálogo: especialidades, procedimentos e tabelas de preço
// ---------------------------------------------------------------------------

export const specialties = pgTable(
  "specialties",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique("specialties_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("specialties_org_name_uq").on(t.organizationId, sql`lower(${t.name})`),
  ],
);

export const procedures = pgTable(
  "procedures",
  {
    id: pk(),
    organizationId: orgCol(),
    specialtyId: uuid("specialty_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    billingUnit: text("billing_unit").notNull(),
    allowedLocations: text("allowed_locations").array().notNull(),
    suggestedMinutes: integer("suggested_minutes"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("procedures_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("procedures_org_code_uq").on(t.organizationId, sql`lower(${t.code})`),
    orgFk("procedures_specialty_fk", t.organizationId, t.specialtyId, () => specialties),
    check("procedures_unit_ck", inList(t.billingUnit, ["tooth", "arch", "hemiarch", "session", "global"])),
    check("procedures_locations_ck", sql`cardinality(${t.allowedLocations}) > 0`),
  ],
);

export const professionals = pgTable(
  "professionals",
  {
    id: pk(),
    organizationId: orgCol(),
    userId: userRef("user_id"),
    name: text("name").notNull(),
    council: text("council"),
    councilNumber: text("council_number"),
    councilState: text("council_state"),
    color: text("color").notNull().default("#0f766e"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("professionals_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("professionals_org_user_uq").on(t.organizationId, t.userId).where(sql`${t.userId} is not null`),
  ],
);

export const professionalSpecialties = pgTable(
  "professional_specialties",
  {
    organizationId: orgCol(),
    professionalId: uuid("professional_id").notNull(),
    specialtyId: uuid("specialty_id").notNull(),
  },
  (t) => [
    primaryKey({ name: "professional_specialties_pk", columns: [t.professionalId, t.specialtyId] }),
    orgFk("prof_spec_professional_fk", t.organizationId, t.professionalId, () => professionals),
    orgFk("prof_spec_specialty_fk", t.organizationId, t.specialtyId, () => specialties),
  ],
);

export const professionalAvailability = pgTable(
  "professional_availability",
  {
    id: pk(),
    organizationId: orgCol(),
    professionalId: uuid("professional_id").notNull(),
    weekday: smallint("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
  },
  (t) => [
    orgFk("prof_avail_professional_fk", t.organizationId, t.professionalId, () => professionals),
    check("prof_avail_range_ck", sql`${t.weekday} between 0 and 6 and ${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.endMinute} > ${t.startMinute}`),
  ],
);

export const priceTables = pgTable(
  "price_tables",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique("price_tables_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("price_tables_default_uq").on(t.organizationId).where(sql`${t.isDefault}`),
    uniqueIndex("price_tables_org_name_uq").on(t.organizationId, sql`lower(${t.name})`),
  ],
);

export const priceTableItems = pgTable(
  "price_table_items",
  {
    id: pk(),
    organizationId: orgCol(),
    priceTableId: uuid("price_table_id").notNull(),
    procedureId: uuid("procedure_id").notNull(),
    /** Linha existente com 0 = gratuidade deliberada. Ausência de linha = preço não cadastrado. */
    priceCents: money("price_cents").notNull(),
    updatedAt: updatedAt(),
    updatedBy: userRef("updated_by"),
  },
  (t) => [
    unique("price_items_table_proc_uq").on(t.priceTableId, t.procedureId),
    orgFk("price_items_table_fk", t.organizationId, t.priceTableId, () => priceTables),
    orgFk("price_items_procedure_fk", t.organizationId, t.procedureId, () => procedures),
    check("price_items_nonneg_ck", sql`${t.priceCents} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Pacientes
// ---------------------------------------------------------------------------

export const patients = pgTable(
  "patients",
  {
    id: pk(),
    organizationId: orgCol(),
    code: integer("code").notNull(),
    fullName: text("full_name").notNull(),
    socialName: text("social_name"),
    birthDate: civil("birth_date"),
    cpf: text("cpf"),
    phone: text("phone"),
    phoneAlt: text("phone_alt"),
    email: text("email"),
    zip: text("zip"),
    street: text("street"),
    number: text("number"),
    complement: text("complement"),
    district: text("district"),
    city: text("city"),
    state: text("state"),
    origin: text("origin"),
    referredBy: text("referred_by"),
    referenceProfessionalId: uuid("reference_professional_id"),
    adminNotes: text("admin_notes"),
    status: text("status").notNull().default("active"),
    searchKey: text("search_key").notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("patients_org_id_uq").on(t.organizationId, t.id),
    unique("patients_org_code_uq").on(t.organizationId, t.code),
    uniqueIndex("patients_org_cpf_uq").on(t.organizationId, t.cpf).where(sql`${t.cpf} is not null`),
    index("patients_org_search_idx").on(t.organizationId, t.searchKey),
    orgFk("patients_ref_professional_fk", t.organizationId, t.referenceProfessionalId, () => professionals),
    check("patients_status_ck", inList(t.status, ["active", "archived"])),
    check("patients_cpf_ck", sql`${t.cpf} is null or ${t.cpf} ~ '^[0-9]{11}$'`),
  ],
);

export const patientResponsibles = pgTable(
  "patient_responsibles",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    name: text("name").notNull(),
    relationship: text("relationship"),
    cpf: text("cpf"),
    phone: text("phone"),
    email: text("email"),
    isFinancialResponsible: boolean("is_financial_responsible").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [orgFk("responsibles_patient_fk", t.organizationId, t.patientId, () => patients)],
);

export const patientAlerts = pgTable(
  "patient_alerts",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    kind: text("kind").notNull(),
    priority: text("priority").notNull().default("normal"),
    text: text("text").notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
    resolvedBy: userRef("resolved_by"),
    resolutionNote: text("resolution_note"),
  },
  (t) => [
    orgFk("alerts_patient_fk", t.organizationId, t.patientId, () => patients),
    check("alerts_kind_ck", inList(t.kind, ["administrative", "clinical"])),
    check("alerts_priority_ck", inList(t.priority, ["low", "normal", "high"])),
  ],
);

// ---------------------------------------------------------------------------
// Orçamentos
// ---------------------------------------------------------------------------

export const budgets = pgTable(
  "budgets",
  {
    id: pk(),
    organizationId: orgCol(),
    number: integer("number").notNull(),
    patientId: uuid("patient_id").notNull(),
    professionalId: uuid("professional_id"),
    priceTableId: uuid("price_table_id").notNull(),
    budgetDate: civil("budget_date").notNull(),
    validUntil: civil("valid_until"),
    origin: text("origin"),
    notes: text("notes"),
    status: text("status").notNull().default("draft"),
    currentRevisionId: uuid("current_revision_id"),
    version: integer("version").notNull().default(1),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("budgets_org_id_uq").on(t.organizationId, t.id),
    unique("budgets_org_number_uq").on(t.organizationId, t.number),
    index("budgets_patient_idx").on(t.organizationId, t.patientId),
    orgFk("budgets_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("budgets_professional_fk", t.organizationId, t.professionalId, () => professionals),
    orgFk("budgets_price_table_fk", t.organizationId, t.priceTableId, () => priceTables),
    check(
      "budgets_status_ck",
      inList(t.status, ["draft", "negotiating", "partially_approved", "approved", "rejected", "cancelled"]),
    ),
  ],
);

export const budgetRevisions = pgTable(
  "budget_revisions",
  {
    id: pk(),
    organizationId: orgCol(),
    budgetId: uuid("budget_id").notNull(),
    number: integer("number").notNull(),
    status: text("status").notNull().default("open"),
    reason: text("reason"),
    previousRevisionId: uuid("previous_revision_id"),
    /** Simulação de negociação (não cria dívida nem receita). */
    negotiation: jsonb("negotiation").$type<Record<string, unknown>>(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    approvedAt: ts("approved_at"),
    approvedBy: userRef("approved_by"),
  },
  (t) => [
    unique("revisions_org_id_uq").on(t.organizationId, t.id),
    unique("revisions_budget_number_uq").on(t.budgetId, t.number),
    uniqueIndex("revisions_one_open_uq").on(t.budgetId).where(sql`${t.status} = 'open'`),
    orgFk("revisions_budget_fk", t.organizationId, t.budgetId, () => budgets),
    check("revisions_status_ck", inList(t.status, ["open", "approved", "superseded", "discarded"])),
  ],
);

export const budgetItems = pgTable(
  "budget_items",
  {
    id: pk(),
    organizationId: orgCol(),
    budgetId: uuid("budget_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
    /** Identidade estável do item entre revisões. */
    lineageId: uuid("lineage_id").notNull().defaultRandom(),
    procedureId: uuid("procedure_id").notNull(),
    specialtyId: uuid("specialty_id").notNull(),
    procedureCode: text("procedure_code").notNull(),
    procedureName: text("procedure_name").notNull(),
    specialtyName: text("specialty_name").notNull(),
    billingUnit: text("billing_unit").notNull(),
    locationScope: text("location_scope").notNull(),
    locationLabel: text("location_label").notNull(),
    locationSignature: text("location_signature").notNull(),
    quantity: integer("quantity").notNull(),
    referencePriceCents: money("reference_price_cents"),
    unitPriceCents: money("unit_price_cents").notNull(),
    subtotalCents: money("subtotal_cents").notNull(),
    approvalStatus: text("approval_status").notNull().default("pending"),
    duplicateJustification: text("duplicate_justification"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("budget_items_org_id_uq").on(t.organizationId, t.id),
    unique("budget_items_revision_lineage_uq").on(t.revisionId, t.lineageId),
    index("budget_items_revision_idx").on(t.revisionId),
    orgFk("budget_items_budget_fk", t.organizationId, t.budgetId, () => budgets),
    orgFk("budget_items_revision_fk", t.organizationId, t.revisionId, () => budgetRevisions),
    orgFk("budget_items_procedure_fk", t.organizationId, t.procedureId, () => procedures),
    orgFk("budget_items_specialty_fk", t.organizationId, t.specialtyId, () => specialties),
    check("budget_items_qty_ck", sql`${t.quantity} > 0`),
    check("budget_items_price_ck", sql`${t.unitPriceCents} >= 0 and ${t.subtotalCents} = ${t.unitPriceCents} * ${t.quantity}`),
    check("budget_items_approval_ck", inList(t.approvalStatus, ["pending", "approved", "rejected"])),
    check("budget_items_scope_ck", inList(t.locationScope, ["none", "teeth", "arches", "hemiarches"])),
  ],
);

export const budgetItemLocations = pgTable(
  "budget_item_locations",
  {
    id: pk(),
    organizationId: orgCol(),
    itemId: uuid("item_id").notNull(),
    kind: text("kind").notNull(),
    tooth: smallint("tooth"),
    arch: text("arch"),
    hemiarch: smallint("hemiarch"),
  },
  (t) => [
    foreignKey({
      name: "item_locations_item_fk",
      columns: [t.organizationId, t.itemId],
      foreignColumns: [budgetItems.organizationId, budgetItems.id],
    }).onDelete("cascade"),
    index("item_locations_item_idx").on(t.itemId),
    check(
      "item_locations_kind_ck",
      sql`(${t.kind} = 'tooth' and ${t.tooth} is not null and ${t.arch} is null and ${t.hemiarch} is null)
       or (${t.kind} = 'arch' and ${t.arch} in ('upper','lower') and ${t.tooth} is null and ${t.hemiarch} is null)
       or (${t.kind} = 'hemiarch' and ${t.hemiarch} between 1 and 4 and ${t.tooth} is null and ${t.arch} is null)`,
    ),
  ],
);

export const budgetApprovals = pgTable(
  "budget_approvals",
  {
    id: pk(),
    organizationId: orgCol(),
    budgetId: uuid("budget_id").notNull(),
    revisionId: uuid("revision_id").notNull().unique(),
    approvedBy: userRef("approved_by"),
    approvedAt: ts("approved_at").notNull().defaultNow(),
    approvedItemCount: integer("approved_item_count").notNull(),
    rejectedItemCount: integer("rejected_item_count").notNull(),
    totalCents: money("total_cents").notNull(),
    notes: text("notes"),
  },
  (t) => [
    orgFk("approvals_budget_fk", t.organizationId, t.budgetId, () => budgets),
    orgFk("approvals_revision_fk", t.organizationId, t.revisionId, () => budgetRevisions),
  ],
);

// ---------------------------------------------------------------------------
// Financeiro: cadastros
// ---------------------------------------------------------------------------

export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    bankName: text("bank_name"),
    bankCode: text("bank_code"),
    branch: text("branch"),
    accountNumberMasked: text("account_number_masked"),
    openingBalanceCents: money("opening_balance_cents").notNull().default(0),
    openingDate: civil("opening_date").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique("accounts_org_id_uq").on(t.organizationId, t.id),
    check("accounts_kind_ck", inList(t.kind, ["bank", "cash", "card_clearing", "other"])),
  ],
);

export const financialCategories = pgTable(
  "financial_categories",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    systemKey: text("system_key"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique("categories_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("categories_system_key_uq").on(t.organizationId, t.systemKey).where(sql`${t.systemKey} is not null`),
    check("categories_type_ck", inList(t.type, ["income", "expense"])),
  ],
);

export const costCenters = pgTable(
  "cost_centers",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [unique("cost_centers_org_id_uq").on(t.organizationId, t.id)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    document: text("document"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [unique("suppliers_org_id_uq").on(t.organizationId, t.id)],
);

// ---------------------------------------------------------------------------
// Acordos e títulos
// ---------------------------------------------------------------------------

export const paymentAgreements = pgTable(
  "payment_agreements",
  {
    id: pk(),
    organizationId: orgCol(),
    budgetId: uuid("budget_id").notNull(),
    revisionId: uuid("revision_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    status: text("status").notNull().default("active"),
    subtotalCents: money("subtotal_cents").notNull(),
    discountType: text("discount_type").notNull(),
    discountValue: bigint("discount_value", { mode: "number" }).notNull().default(0),
    discountCents: money("discount_cents").notNull(),
    totalCents: money("total_cents").notNull(),
    downPaymentCents: money("down_payment_cents").notNull().default(0),
    installmentsCount: integer("installments_count").notNull().default(0),
    previousAgreementId: uuid("previous_agreement_id"),
    /** Diferença de valor em relação ao acordo anterior (revisões). */
    adjustmentCents: money("adjustment_cents").notNull().default(0),
    notes: text("notes"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("agreements_org_id_uq").on(t.organizationId, t.id),
    unique("agreements_revision_uq").on(t.revisionId),
    orgFk("agreements_budget_fk", t.organizationId, t.budgetId, () => budgets),
    orgFk("agreements_revision_fk", t.organizationId, t.revisionId, () => budgetRevisions),
    orgFk("agreements_patient_fk", t.organizationId, t.patientId, () => patients),
    check("agreements_status_ck", inList(t.status, ["active", "superseded"])),
    check("agreements_discount_type_ck", inList(t.discountType, ["none", "amount", "percent"])),
    check("agreements_totals_ck", sql`${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} and ${t.discountCents} between 0 and ${t.subtotalCents}`),
  ],
);

export const agreementItemAllocations = pgTable(
  "agreement_item_allocations",
  {
    id: pk(),
    organizationId: orgCol(),
    agreementId: uuid("agreement_id").notNull(),
    budgetItemId: uuid("budget_item_id").notNull(),
    grossCents: money("gross_cents").notNull(),
    discountCents: money("discount_cents").notNull(),
    netCents: money("net_cents").notNull(),
  },
  (t) => [
    orgFk("agreement_alloc_agreement_fk", t.organizationId, t.agreementId, () => paymentAgreements),
    orgFk("agreement_alloc_item_fk", t.organizationId, t.budgetItemId, () => budgetItems),
    check("agreement_alloc_ck", sql`${t.netCents} = ${t.grossCents} - ${t.discountCents}`),
  ],
);

const TITLE_STATUSES = ["open", "partial", "paid", "cancelled"] as const;

export const receivables = pgTable(
  "receivables",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id"),
    agreementId: uuid("agreement_id"),
    budgetId: uuid("budget_id"),
    kind: text("kind").notNull(),
    installmentNumber: integer("installment_number"),
    description: text("description").notNull(),
    categoryId: uuid("category_id"),
    costCenterId: uuid("cost_center_id"),
    competenceDate: civil("competence_date").notNull(),
    dueDate: civil("due_date").notNull(),
    originalCents: money("original_cents").notNull(),
    adjustmentCents: money("adjustment_cents").notNull().default(0),
    paidPrincipalCents: money("paid_principal_cents").notNull().default(0),
    discountGrantedCents: money("discount_granted_cents").notNull().default(0),
    interestReceivedCents: money("interest_received_cents").notNull().default(0),
    fineReceivedCents: money("fine_received_cents").notNull().default(0),
    status: text("status").notNull().default("open"),
    expectedMethod: text("expected_method"),
    methodNote: text("method_note"),
    expectedAccountId: uuid("expected_account_id"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    notes: text("notes"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("receivables_org_id_uq").on(t.organizationId, t.id),
    index("receivables_due_idx").on(t.organizationId, t.status, t.dueDate),
    index("receivables_patient_idx").on(t.organizationId, t.patientId),
    orgFk("receivables_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("receivables_agreement_fk", t.organizationId, t.agreementId, () => paymentAgreements),
    orgFk("receivables_budget_fk", t.organizationId, t.budgetId, () => budgets),
    orgFk("receivables_category_fk", t.organizationId, t.categoryId, () => financialCategories),
    orgFk("receivables_cost_center_fk", t.organizationId, t.costCenterId, () => costCenters),
    orgFk("receivables_account_fk", t.organizationId, t.expectedAccountId, () => financialAccounts),
    check("receivables_kind_ck", inList(t.kind, ["down_payment", "installment", "manual", "adjustment"])),
    check("receivables_status_ck", inList(t.status, TITLE_STATUSES)),
    // Garantia no banco: nenhuma baixa (mesmo concorrente) ultrapassa o saldo.
    check(
      "receivables_balance_ck",
      sql`${t.originalCents} > 0 and ${t.paidPrincipalCents} >= 0 and ${t.discountGrantedCents} >= 0
        and ${t.originalCents} + ${t.adjustmentCents} - ${t.paidPrincipalCents} - ${t.discountGrantedCents} >= 0`,
    ),
  ],
);

export const receivableAdjustments = pgTable(
  "receivable_adjustments",
  {
    id: pk(),
    organizationId: orgCol(),
    receivableId: uuid("receivable_id").notNull(),
    amountCents: money("amount_cents").notNull(),
    reason: text("reason").notNull(),
    source: text("source").notNull(),
    agreementId: uuid("agreement_id"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    orgFk("rec_adj_receivable_fk", t.organizationId, t.receivableId, () => receivables),
    orgFk("rec_adj_agreement_fk", t.organizationId, t.agreementId, () => paymentAgreements),
    check("rec_adj_source_ck", inList(t.source, ["revision", "manual", "cancellation"])),
    check("rec_adj_nonzero_ck", sql`${t.amountCents} <> 0`),
  ],
);

/** Crédito do paciente ou reembolso pendente de decisão explícita (ex.: revisão para menor). */
export const patientCredits = pgTable(
  "patient_credits",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    agreementId: uuid("agreement_id"),
    amountCents: money("amount_cents").notNull(),
    status: text("status").notNull().default("pending_decision"),
    reason: text("reason").notNull(),
    resolution: text("resolution"),
    resolvedBy: userRef("resolved_by"),
    resolvedAt: ts("resolved_at"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    orgFk("credits_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("credits_agreement_fk", t.organizationId, t.agreementId, () => paymentAgreements),
    check("credits_status_ck", inList(t.status, ["pending_decision", "kept_as_credit", "refunded", "applied"])),
    check("credits_amount_ck", sql`${t.amountCents} > 0`),
  ],
);

export const payableRecurrences = pgTable(
  "payable_recurrences",
  {
    id: pk(),
    organizationId: orgCol(),
    supplierId: uuid("supplier_id"),
    description: text("description").notNull(),
    categoryId: uuid("category_id").notNull(),
    costCenterId: uuid("cost_center_id"),
    amountCents: money("amount_cents").notNull(),
    dayOfMonth: smallint("day_of_month").notNull(),
    startDate: civil("start_date").notNull(),
    endDate: civil("end_date"),
    expectedAccountId: uuid("expected_account_id"),
    suspendedAt: ts("suspended_at"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("recurrences_org_id_uq").on(t.organizationId, t.id),
    orgFk("recurrences_supplier_fk", t.organizationId, t.supplierId, () => suppliers),
    orgFk("recurrences_category_fk", t.organizationId, t.categoryId, () => financialCategories),
    orgFk("recurrences_cost_center_fk", t.organizationId, t.costCenterId, () => costCenters),
    check("recurrences_day_ck", sql`${t.dayOfMonth} between 1 and 31`),
    check("recurrences_amount_ck", sql`${t.amountCents} > 0`),
  ],
);

export const payables = pgTable(
  "payables",
  {
    id: pk(),
    organizationId: orgCol(),
    supplierId: uuid("supplier_id"),
    description: text("description").notNull(),
    categoryId: uuid("category_id"),
    costCenterId: uuid("cost_center_id"),
    competenceDate: civil("competence_date").notNull(),
    dueDate: civil("due_date").notNull(),
    originalCents: money("original_cents").notNull(),
    adjustmentCents: money("adjustment_cents").notNull().default(0),
    paidPrincipalCents: money("paid_principal_cents").notNull().default(0),
    discountGrantedCents: money("discount_granted_cents").notNull().default(0),
    interestPaidCents: money("interest_paid_cents").notNull().default(0),
    finePaidCents: money("fine_paid_cents").notNull().default(0),
    status: text("status").notNull().default("open"),
    expectedAccountId: uuid("expected_account_id"),
    recurrenceId: uuid("recurrence_id"),
    recurrencePeriod: text("recurrence_period"),
    installmentGroupId: uuid("installment_group_id"),
    installmentNumber: integer("installment_number"),
    installmentTotal: integer("installment_total"),
    documentNumber: text("document_number"),
    cancelledAt: ts("cancelled_at"),
    cancelReason: text("cancel_reason"),
    notes: text("notes"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("payables_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("payables_recurrence_period_uq")
      .on(t.recurrenceId, t.recurrencePeriod)
      .where(sql`${t.recurrenceId} is not null`),
    index("payables_due_idx").on(t.organizationId, t.status, t.dueDate),
    orgFk("payables_supplier_fk", t.organizationId, t.supplierId, () => suppliers),
    orgFk("payables_category_fk", t.organizationId, t.categoryId, () => financialCategories),
    orgFk("payables_cost_center_fk", t.organizationId, t.costCenterId, () => costCenters),
    orgFk("payables_account_fk", t.organizationId, t.expectedAccountId, () => financialAccounts),
    orgFk("payables_recurrence_fk", t.organizationId, t.recurrenceId, () => payableRecurrences),
    check("payables_status_ck", inList(t.status, TITLE_STATUSES)),
    check(
      "payables_balance_ck",
      sql`${t.originalCents} > 0 and ${t.paidPrincipalCents} >= 0 and ${t.discountGrantedCents} >= 0
        and ${t.originalCents} + ${t.adjustmentCents} - ${t.paidPrincipalCents} - ${t.discountGrantedCents} >= 0`,
    ),
  ],
);

/** Rateio por categoria/centro de custo; quando existe, a soma deve fechar o valor do título. */
export const financialAllocations = pgTable(
  "financial_allocations",
  {
    id: pk(),
    organizationId: orgCol(),
    payableId: uuid("payable_id"),
    receivableId: uuid("receivable_id"),
    categoryId: uuid("category_id").notNull(),
    costCenterId: uuid("cost_center_id"),
    amountCents: money("amount_cents").notNull(),
  },
  (t) => [
    orgFk("fin_alloc_payable_fk", t.organizationId, t.payableId, () => payables),
    orgFk("fin_alloc_receivable_fk", t.organizationId, t.receivableId, () => receivables),
    orgFk("fin_alloc_category_fk", t.organizationId, t.categoryId, () => financialCategories),
    orgFk("fin_alloc_cost_center_fk", t.organizationId, t.costCenterId, () => costCenters),
    check("fin_alloc_target_ck", sql`num_nonnulls(${t.payableId}, ${t.receivableId}) = 1`),
    check("fin_alloc_amount_ck", sql`${t.amountCents} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Liquidações e movimentos de conta
// ---------------------------------------------------------------------------

export const settlements = pgTable(
  "settlements",
  {
    id: pk(),
    organizationId: orgCol(),
    direction: text("direction").notNull(),
    accountId: uuid("account_id").notNull(),
    method: text("method").notNull(),
    methodNote: text("method_note"),
    settledOn: civil("settled_on").notNull(),
    /** Dinheiro efetivamente movimentado = Σ(principal + juros + multa). */
    amountCents: money("amount_cents").notNull(),
    status: text("status").notNull().default("active"),
    reversedAt: ts("reversed_at"),
    reversedBy: userRef("reversed_by"),
    reversalReason: text("reversal_reason"),
    bankTransactionId: uuid("bank_transaction_id"),
    notes: text("notes"),
    idempotencyKey: text("idempotency_key"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("settlements_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("settlements_idem_uq").on(t.organizationId, t.idempotencyKey).where(sql`${t.idempotencyKey} is not null`),
    orgFk("settlements_account_fk", t.organizationId, t.accountId, () => financialAccounts),
    check("settlements_direction_ck", inList(t.direction, ["in", "out"])),
    check("settlements_status_ck", inList(t.status, ["active", "reversed"])),
    check("settlements_amount_ck", sql`${t.amountCents} >= 0`),
  ],
);

export const settlementAllocations = pgTable(
  "settlement_allocations",
  {
    id: pk(),
    organizationId: orgCol(),
    settlementId: uuid("settlement_id").notNull(),
    receivableId: uuid("receivable_id"),
    payableId: uuid("payable_id"),
    principalCents: money("principal_cents").notNull().default(0),
    interestCents: money("interest_cents").notNull().default(0),
    fineCents: money("fine_cents").notNull().default(0),
    discountCents: money("discount_cents").notNull().default(0),
  },
  (t) => [
    index("settlement_alloc_receivable_idx").on(t.receivableId),
    index("settlement_alloc_payable_idx").on(t.payableId),
    orgFk("settlement_alloc_settlement_fk", t.organizationId, t.settlementId, () => settlements),
    orgFk("settlement_alloc_receivable_fk", t.organizationId, t.receivableId, () => receivables),
    orgFk("settlement_alloc_payable_fk", t.organizationId, t.payableId, () => payables),
    check("settlement_alloc_target_ck", sql`num_nonnulls(${t.receivableId}, ${t.payableId}) = 1`),
    check(
      "settlement_alloc_values_ck",
      sql`${t.principalCents} >= 0 and ${t.interestCents} >= 0 and ${t.fineCents} >= 0 and ${t.discountCents} >= 0
        and ${t.principalCents} + ${t.interestCents} + ${t.fineCents} + ${t.discountCents} > 0`,
    ),
  ],
);

export const transfers = pgTable(
  "transfers",
  {
    id: pk(),
    organizationId: orgCol(),
    fromAccountId: uuid("from_account_id").notNull(),
    toAccountId: uuid("to_account_id").notNull(),
    amountCents: money("amount_cents").notNull(),
    occurredOn: civil("occurred_on").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    reversedAt: ts("reversed_at"),
    reversedBy: userRef("reversed_by"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("transfers_org_id_uq").on(t.organizationId, t.id),
    orgFk("transfers_from_fk", t.organizationId, t.fromAccountId, () => financialAccounts),
    orgFk("transfers_to_fk", t.organizationId, t.toAccountId, () => financialAccounts),
    check("transfers_accounts_ck", sql`${t.fromAccountId} <> ${t.toAccountId}`),
    check("transfers_amount_ck", sql`${t.amountCents} > 0`),
    check("transfers_status_ck", inList(t.status, ["active", "reversed"])),
  ],
);

export const MOVEMENT_KINDS = [
  "settlement",
  "settlement_reversal",
  "transfer_out",
  "transfer_in",
  "transfer_reversal",
  "card_settlement_out",
  "card_settlement_in",
  "card_fee",
  "card_anticipation_fee",
  "bank_fee",
  "bank_adjustment",
] as const;

/** Livro-razão das contas: cada movimento efetivo de dinheiro. */
export const accountMovements = pgTable(
  "account_movements",
  {
    id: pk(),
    organizationId: orgCol(),
    accountId: uuid("account_id").notNull(),
    occurredOn: civil("occurred_on").notNull(),
    amountCents: money("amount_cents").notNull(),
    kind: text("kind").notNull(),
    settlementId: uuid("settlement_id"),
    transferId: uuid("transfer_id"),
    cardReceivableId: uuid("card_receivable_id"),
    reversesMovementId: uuid("reverses_movement_id"),
    categoryId: uuid("category_id"),
    description: text("description").notNull(),
    /** Soma das alocações de conciliação ativas (mesmo sinal do valor). */
    reconciledCents: money("reconciled_cents").notNull().default(0),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("movements_org_id_uq").on(t.organizationId, t.id),
    index("movements_account_date_idx").on(t.organizationId, t.accountId, t.occurredOn),
    orgFk("movements_account_fk", t.organizationId, t.accountId, () => financialAccounts),
    orgFk("movements_settlement_fk", t.organizationId, t.settlementId, () => settlements),
    orgFk("movements_transfer_fk", t.organizationId, t.transferId, () => transfers),
    orgFk("movements_category_fk", t.organizationId, t.categoryId, () => financialCategories),
    check("movements_kind_ck", inList(t.kind, MOVEMENT_KINDS)),
    check("movements_amount_ck", sql`${t.amountCents} <> 0`),
    check(
      "movements_reconciled_ck",
      sql`abs(${t.reconciledCents}) <= abs(${t.amountCents}) and (${t.reconciledCents} = 0 or sign(${t.reconciledCents}) = sign(${t.amountCents}))`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

export const cardFeeRules = pgTable(
  "card_fee_rules",
  {
    id: pk(),
    organizationId: orgCol(),
    acquirer: text("acquirer").notNull(),
    brand: text("brand"),
    paymentType: text("payment_type").notNull(),
    installmentsFrom: integer("installments_from").notNull().default(1),
    installmentsTo: integer("installments_to").notNull().default(1),
    feeBasisPoints: integer("fee_basis_points").notNull(),
    fixedFeeCents: money("fixed_fee_cents").notNull().default(0),
    settlementDays: integer("settlement_days").notNull().default(30),
    active: boolean("active").notNull().default(true),
  },
  (t) => [check("card_fee_type_ck", inList(t.paymentType, ["debit", "credit"]))],
);

export const cardTransactions = pgTable(
  "card_transactions",
  {
    id: pk(),
    organizationId: orgCol(),
    settlementId: uuid("settlement_id").notNull().unique(),
    clearingAccountId: uuid("clearing_account_id").notNull(),
    acquirer: text("acquirer").notNull(),
    brand: text("brand"),
    paymentType: text("payment_type").notNull(),
    installments: integer("installments").notNull().default(1),
    grossCents: money("gross_cents").notNull(),
    feeCents: money("fee_cents").notNull(),
    netCents: money("net_cents").notNull(),
    authorizationCode: text("authorization_code"),
    nsu: text("nsu"),
    transactionDate: civil("transaction_date").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("card_tx_org_id_uq").on(t.organizationId, t.id),
    orgFk("card_tx_settlement_fk", t.organizationId, t.settlementId, () => settlements),
    orgFk("card_tx_clearing_fk", t.organizationId, t.clearingAccountId, () => financialAccounts),
    check("card_tx_values_ck", sql`${t.netCents} = ${t.grossCents} - ${t.feeCents} and ${t.feeCents} >= 0 and ${t.grossCents} > 0`),
    check("card_tx_type_ck", inList(t.paymentType, ["debit", "credit"])),
  ],
);

export const cardReceivables = pgTable(
  "card_receivables",
  {
    id: pk(),
    organizationId: orgCol(),
    cardTransactionId: uuid("card_transaction_id").notNull(),
    installmentNumber: integer("installment_number").notNull(),
    expectedDate: civil("expected_date").notNull(),
    grossCents: money("gross_cents").notNull(),
    feeCents: money("fee_cents").notNull(),
    netCents: money("net_cents").notNull(),
    status: text("status").notNull().default("pending"),
    settledOn: civil("settled_on"),
    bankAccountId: uuid("bank_account_id"),
    anticipationFeeCents: money("anticipation_fee_cents").notNull().default(0),
    settledBy: userRef("settled_by"),
    settledAt: ts("settled_at"),
  },
  (t) => [
    unique("card_rec_org_id_uq").on(t.organizationId, t.id),
    unique("card_rec_tx_number_uq").on(t.cardTransactionId, t.installmentNumber),
    orgFk("card_rec_tx_fk", t.organizationId, t.cardTransactionId, () => cardTransactions),
    orgFk("card_rec_bank_fk", t.organizationId, t.bankAccountId, () => financialAccounts),
    check("card_rec_status_ck", inList(t.status, ["pending", "settled", "anticipated", "cancelled"])),
    check("card_rec_values_ck", sql`${t.netCents} = ${t.grossCents} - ${t.feeCents} and ${t.anticipationFeeCents} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Extratos e conciliação
// ---------------------------------------------------------------------------

export const bankImportBatches = pgTable(
  "bank_import_batches",
  {
    id: pk(),
    organizationId: orgCol(),
    accountId: uuid("account_id").notNull(),
    fileName: text("file_name").notNull(),
    fileSha256: text("file_sha256").notNull(),
    format: text("format").notNull().default("ofx"),
    bankId: text("bank_id"),
    accountRefMasked: text("account_ref_masked"),
    periodStart: civil("period_start"),
    periodEnd: civil("period_end"),
    ledgerBalanceCents: money("ledger_balance_cents"),
    ledgerBalanceDate: civil("ledger_balance_date"),
    status: text("status").notNull().default("preview"),
    totalCount: integer("total_count").notNull().default(0),
    newCount: integer("new_count").notNull().default(0),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    ambiguousCount: integer("ambiguous_count").notNull().default(0),
    preview: jsonb("preview").$type<unknown>(),
    warnings: jsonb("warnings").$type<string[]>(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    confirmedAt: ts("confirmed_at"),
    confirmedBy: userRef("confirmed_by"),
  },
  (t) => [
    unique("bank_batches_org_id_uq").on(t.organizationId, t.id),
    orgFk("bank_batches_account_fk", t.organizationId, t.accountId, () => financialAccounts),
    check("bank_batches_status_ck", inList(t.status, ["preview", "confirmed", "discarded"])),
  ],
);

export const bankTransactions = pgTable(
  "bank_transactions",
  {
    id: pk(),
    organizationId: orgCol(),
    accountId: uuid("account_id").notNull(),
    batchId: uuid("batch_id").notNull(),
    externalId: text("external_id"),
    fingerprint: text("fingerprint").notNull(),
    occurrenceIndex: integer("occurrence_index").notNull().default(0),
    postedOn: civil("posted_on").notNull(),
    amountCents: money("amount_cents").notNull(),
    description: text("description").notNull(),
    memo: text("memo"),
    trnType: text("trn_type"),
    checkNumber: text("check_number"),
    status: text("status").notNull().default("pending"),
    ignoreReason: text("ignore_reason"),
    ignoredBy: userRef("ignored_by"),
    ignoredAt: ts("ignored_at"),
    ambiguous: boolean("ambiguous").notNull().default(false),
    reconciledCents: money("reconciled_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    unique("bank_tx_org_id_uq").on(t.organizationId, t.id),
    uniqueIndex("bank_tx_external_uq").on(t.accountId, t.externalId).where(sql`${t.externalId} is not null`),
    uniqueIndex("bank_tx_fingerprint_uq")
      .on(t.accountId, t.fingerprint, t.occurrenceIndex)
      .where(sql`${t.externalId} is null`),
    index("bank_tx_account_date_idx").on(t.organizationId, t.accountId, t.postedOn),
    orgFk("bank_tx_account_fk", t.organizationId, t.accountId, () => financialAccounts),
    orgFk("bank_tx_batch_fk", t.organizationId, t.batchId, () => bankImportBatches),
    check("bank_tx_status_ck", inList(t.status, ["pending", "reconciled", "ignored"])),
    check("bank_tx_amount_ck", sql`${t.amountCents} <> 0`),
    check(
      "bank_tx_reconciled_ck",
      sql`abs(${t.reconciledCents}) <= abs(${t.amountCents}) and (${t.reconciledCents} = 0 or sign(${t.reconciledCents}) = sign(${t.amountCents}))`,
    ),
  ],
);

export const reconciliations = pgTable(
  "reconciliations",
  {
    id: pk(),
    organizationId: orgCol(),
    accountId: uuid("account_id").notNull(),
    status: text("status").notNull().default("active"),
    note: text("note"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    undoneAt: ts("undone_at"),
    undoneBy: userRef("undone_by"),
    undoReason: text("undo_reason"),
  },
  (t) => [
    unique("reconciliations_org_id_uq").on(t.organizationId, t.id),
    orgFk("reconciliations_account_fk", t.organizationId, t.accountId, () => financialAccounts),
    check("reconciliations_status_ck", inList(t.status, ["active", "undone"])),
  ],
);

export const reconciliationAllocations = pgTable(
  "reconciliation_allocations",
  {
    id: pk(),
    organizationId: orgCol(),
    reconciliationId: uuid("reconciliation_id").notNull(),
    bankTransactionId: uuid("bank_transaction_id").notNull(),
    movementId: uuid("movement_id").notNull(),
    amountCents: money("amount_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("recon_alloc_bank_idx").on(t.bankTransactionId),
    index("recon_alloc_movement_idx").on(t.movementId),
    orgFk("recon_alloc_reconciliation_fk", t.organizationId, t.reconciliationId, () => reconciliations),
    orgFk("recon_alloc_bank_fk", t.organizationId, t.bankTransactionId, () => bankTransactions),
    orgFk("recon_alloc_movement_fk", t.organizationId, t.movementId, () => accountMovements),
    check("recon_alloc_amount_ck", sql`${t.amountCents} <> 0`),
  ],
);

export const bankConnections = pgTable(
  "bank_connections",
  {
    id: pk(),
    organizationId: orgCol(),
    accountId: uuid("account_id").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("not_configured"),
    consentExpiresAt: ts("consent_expires_at"),
    lastSyncAt: ts("last_sync_at"),
    syncedFrom: civil("synced_from"),
    syncedUntil: civil("synced_until"),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [
    orgFk("bank_conn_account_fk", t.organizationId, t.accountId, () => financialAccounts),
    check(
      "bank_conn_status_ck",
      inList(t.status, ["not_configured", "pending_authorization", "active", "expired", "revoked", "error"]),
    ),
  ],
);

// ---------------------------------------------------------------------------
// Tratamentos e registros clínicos
// ---------------------------------------------------------------------------

export const treatments = pgTable(
  "treatments",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    budgetId: uuid("budget_id").notNull().unique(),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("treatments_org_id_uq").on(t.organizationId, t.id),
    orgFk("treatments_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("treatments_budget_fk", t.organizationId, t.budgetId, () => budgets),
    check("treatments_status_ck", inList(t.status, ["active", "completed", "cancelled"])),
  ],
);

export const treatmentItems = pgTable(
  "treatment_items",
  {
    id: pk(),
    organizationId: orgCol(),
    treatmentId: uuid("treatment_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    budgetItemId: uuid("budget_item_id").notNull(),
    lineageId: uuid("lineage_id").notNull(),
    procedureId: uuid("procedure_id").notNull(),
    procedureName: text("procedure_name").notNull(),
    specialtyName: text("specialty_name").notNull(),
    locationLabel: text("location_label").notNull(),
    clinicalStatus: text("clinical_status").notNull().default("not_started"),
    cancelledReason: text("cancelled_reason"),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: userRef("cancelled_by"),
    /** Cancelamento clínico exige análise financeira separada. */
    financialReviewPending: boolean("financial_review_pending").notNull().default(false),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("treatment_items_org_id_uq").on(t.organizationId, t.id),
    unique("treatment_items_lineage_uq").on(t.treatmentId, t.lineageId),
    index("treatment_items_patient_idx").on(t.organizationId, t.patientId),
    orgFk("treatment_items_treatment_fk", t.organizationId, t.treatmentId, () => treatments),
    orgFk("treatment_items_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("treatment_items_budget_item_fk", t.organizationId, t.budgetItemId, () => budgetItems),
    check(
      "treatment_items_status_ck",
      inList(t.clinicalStatus, ["not_started", "in_progress", "completed", "cancelled"]),
    ),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    professionalId: uuid("professional_id").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    localDate: civil("local_date").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    status: text("status").notNull().default("scheduled"),
    isFirstVisit: boolean("is_first_visit").notNull().default(false),
    planned: text("planned"),
    performed: text("performed"),
    notes: text("notes"),
    reminderPreference: text("reminder_preference").notNull().default("none"),
    isOverbook: boolean("is_overbook").notNull().default(false),
    overbookReason: text("overbook_reason"),
    rescheduledFromId: uuid("rescheduled_from_id").references((): AnyPgColumn => appointments.id),
    cancelReason: text("cancel_reason"),
    statusChangedAt: ts("status_changed_at"),
    statusChangedBy: userRef("status_changed_by"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique("appointments_org_id_uq").on(t.organizationId, t.id),
    index("appointments_day_idx").on(t.organizationId, t.localDate),
    index("appointments_prof_day_idx").on(t.organizationId, t.professionalId, t.localDate),
    index("appointments_patient_idx").on(t.organizationId, t.patientId),
    orgFk("appointments_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("appointments_professional_fk", t.organizationId, t.professionalId, () => professionals),
    check(
      "appointments_status_ck",
      inList(t.status, [
        "scheduled",
        "confirmed",
        "arrived",
        "in_progress",
        "finished",
        "no_show",
        "cancelled_by_patient",
        "cancelled_by_clinic",
        "cancelled_rescheduled",
        "no_show_rescheduled",
      ]),
    ),
    check("appointments_time_ck", sql`${t.endsAt} > ${t.startsAt} and ${t.endMinute} > ${t.startMinute} and ${t.startMinute} >= 0 and ${t.endMinute} <= 1440`),
    check("appointments_reminder_ck", inList(t.reminderPreference, ["none", "whatsapp", "sms", "email"])),
  ],
);

export const appointmentProcedures = pgTable(
  "appointment_procedures",
  {
    id: pk(),
    organizationId: orgCol(),
    appointmentId: uuid("appointment_id").notNull(),
    treatmentItemId: uuid("treatment_item_id").notNull(),
    outcome: text("outcome"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("appt_proc_uq").on(t.appointmentId, t.treatmentItemId),
    orgFk("appt_proc_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    orgFk("appt_proc_item_fk", t.organizationId, t.treatmentItemId, () => treatmentItems),
    check("appt_proc_outcome_ck", sql`${t.outcome} is null or ${inList(t.outcome, ["performed", "partial", "not_performed"])}`),
  ],
);

export const appointmentStatusHistory = pgTable(
  "appointment_status_history",
  {
    id: pk(),
    organizationId: orgCol(),
    appointmentId: uuid("appointment_id").notNull(),
    kind: text("kind").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    fromStartsAt: ts("from_starts_at"),
    toStartsAt: ts("to_starts_at"),
    reason: text("reason"),
    changedBy: userRef("changed_by"),
    changedAt: ts("changed_at").notNull().defaultNow(),
  },
  (t) => [
    index("appt_history_appt_idx").on(t.appointmentId),
    orgFk("appt_history_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    check("appt_history_kind_ck", inList(t.kind, ["created", "status", "time_change", "reschedule", "edit"])),
  ],
);

export const scheduleBlocks = pgTable(
  "schedule_blocks",
  {
    id: pk(),
    organizationId: orgCol(),
    professionalId: uuid("professional_id"),
    kind: text("kind").notNull(),
    localDate: civil("local_date"),
    weekday: smallint("weekday"),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    startDate: civil("start_date"),
    untilDate: civil("until_date"),
    reason: text("reason").notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    orgFk("blocks_professional_fk", t.organizationId, t.professionalId, () => professionals),
    check("blocks_kind_ck", inList(t.kind, ["single", "weekly"])),
    check(
      "blocks_shape_ck",
      sql`(${t.kind} = 'single' and ${t.localDate} is not null) or (${t.kind} = 'weekly' and ${t.weekday} between 0 and 6 and ${t.startDate} is not null)`,
    ),
    check("blocks_range_ck", sql`${t.endMinute} > ${t.startMinute} and ${t.startMinute} >= 0 and ${t.endMinute} <= 1440`),
  ],
);

export const schedulingTasks = pgTable(
  "scheduling_tasks",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    treatmentItemId: uuid("treatment_item_id"),
    reason: text("reason").notNull(),
    dueDate: civil("due_date"),
    responsibleUserId: userRef("responsible_user_id"),
    status: text("status").notNull().default("open"),
    appointmentId: uuid("appointment_id"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
    resolvedBy: userRef("resolved_by"),
  },
  (t) => [
    index("sched_tasks_patient_idx").on(t.organizationId, t.patientId),
    orgFk("sched_tasks_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("sched_tasks_item_fk", t.organizationId, t.treatmentItemId, () => treatmentItems),
    orgFk("sched_tasks_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    check("sched_tasks_status_ck", inList(t.status, ["open", "scheduled", "cancelled"])),
  ],
);

export const clinicalProgressEntries = pgTable(
  "clinical_progress_entries",
  {
    id: pk(),
    organizationId: orgCol(),
    treatmentItemId: uuid("treatment_item_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    appointmentId: uuid("appointment_id"),
    professionalId: uuid("professional_id"),
    sessionLabel: text("session_label"),
    description: text("description").notNull(),
    resultingStatus: text("resulting_status").notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("progress_item_idx").on(t.treatmentItemId),
    orgFk("progress_item_fk", t.organizationId, t.treatmentItemId, () => treatmentItems),
    orgFk("progress_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("progress_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    orgFk("progress_professional_fk", t.organizationId, t.professionalId, () => professionals),
    check("progress_status_ck", inList(t.resultingStatus, ["not_started", "in_progress", "completed"])),
  ],
);

export const clinicalNotes = pgTable(
  "clinical_notes",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    appointmentId: uuid("appointment_id"),
    professionalId: uuid("professional_id"),
    status: text("status").notNull().default("draft"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    finalizedAt: ts("finalized_at"),
    finalizedBy: userRef("finalized_by"),
  },
  (t) => [
    unique("clinical_notes_org_id_uq").on(t.organizationId, t.id),
    index("clinical_notes_patient_idx").on(t.organizationId, t.patientId),
    orgFk("clinical_notes_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("clinical_notes_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    orgFk("clinical_notes_professional_fk", t.organizationId, t.professionalId, () => professionals),
    check("clinical_notes_status_ck", inList(t.status, ["draft", "final"])),
  ],
);

export const clinicalNoteAddenda = pgTable(
  "clinical_note_addenda",
  {
    id: pk(),
    organizationId: orgCol(),
    noteId: uuid("note_id").notNull(),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    orgFk("addenda_note_fk", t.organizationId, t.noteId, () => clinicalNotes),
    check("addenda_kind_ck", inList(t.kind, ["addendum", "correction"])),
  ],
);

export interface AnamnesisQuestion {
  id: string;
  label: string;
  type: "yes_no" | "text" | "yes_no_details";
  /** Resposta "sim" gera alerta clínico para revisão do profissional. */
  alertOnYes?: boolean;
}

export const anamnesisTemplates = pgTable(
  "anamnesis_templates",
  {
    id: pk(),
    organizationId: orgCol(),
    name: text("name").notNull(),
    version: integer("version").notNull(),
    questions: jsonb("questions").$type<AnamnesisQuestion[]>().notNull(),
    active: boolean("active").notNull().default(true),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("anamnesis_tpl_org_id_uq").on(t.organizationId, t.id),
    unique("anamnesis_tpl_version_uq").on(t.organizationId, t.name, t.version),
  ],
);

export const anamnesisResponses = pgTable(
  "anamnesis_responses",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    templateId: uuid("template_id").notNull(),
    answers: jsonb("answers").$type<Record<string, { answer: string; details?: string }>>().notNull(),
    respondentName: text("respondent_name").notNull(),
    respondentRelation: text("respondent_relation"),
    answeredOn: civil("answered_on").notNull(),
    recordedBy: userRef("recorded_by"),
    reviewedByProfessionalId: uuid("reviewed_by_professional_id"),
    reviewedAt: ts("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("anamnesis_patient_idx").on(t.organizationId, t.patientId),
    orgFk("anamnesis_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("anamnesis_template_fk", t.organizationId, t.templateId, () => anamnesisTemplates),
    orgFk("anamnesis_reviewer_fk", t.organizationId, t.reviewedByProfessionalId, () => professionals),
  ],
);

// ---------------------------------------------------------------------------
// Arquivos, documentos, notificações e integrações
// ---------------------------------------------------------------------------

export const attachments = pgTable(
  "attachments",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key"),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    kind: text("kind").notNull(),
    takenOn: civil("taken_on"),
    description: text("description"),
    derivedFromId: uuid("derived_from_id").references((): AnyPgColumn => attachments.id),
    isProfilePhoto: boolean("is_profile_photo").notNull().default(false),
    uploadedBy: userRef("uploaded_by"),
    createdAt: createdAt(),
    archivedAt: ts("archived_at"),
  },
  (t) => [
    unique("attachments_org_id_uq").on(t.organizationId, t.id),
    index("attachments_patient_idx").on(t.organizationId, t.patientId),
    orgFk("attachments_patient_fk", t.organizationId, t.patientId, () => patients),
    check("attachments_kind_ck", inList(t.kind, ["photo", "radiograph", "document", "other"])),
  ],
);

export const attachmentLinks = pgTable(
  "attachment_links",
  {
    id: pk(),
    organizationId: orgCol(),
    attachmentId: uuid("attachment_id").notNull(),
    tooth: smallint("tooth"),
    treatmentItemId: uuid("treatment_item_id"),
    appointmentId: uuid("appointment_id"),
    budgetId: uuid("budget_id"),
  },
  (t) => [
    index("attachment_links_attachment_idx").on(t.attachmentId),
    orgFk("attachment_links_attachment_fk", t.organizationId, t.attachmentId, () => attachments),
    orgFk("attachment_links_item_fk", t.organizationId, t.treatmentItemId, () => treatmentItems),
    orgFk("attachment_links_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    orgFk("attachment_links_budget_fk", t.organizationId, t.budgetId, () => budgets),
    check(
      "attachment_links_target_ck",
      sql`num_nonnulls(${t.tooth}, ${t.treatmentItemId}, ${t.appointmentId}, ${t.budgetId}) >= 1`,
    ),
  ],
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: pk(),
    organizationId: orgCol(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("doc_templates_org_id_uq").on(t.organizationId, t.id),
    check("doc_templates_kind_ck", inList(t.kind, ["contract", "receipt", "consent", "other"])),
  ],
);

export const generatedDocuments = pgTable(
  "generated_documents",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id").notNull(),
    templateId: uuid("template_id"),
    templateVersion: integer("template_version"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    budgetId: uuid("budget_id"),
    settlementId: uuid("settlement_id"),
    createdBy: userRef("created_by"),
    createdAt: createdAt(),
  },
  (t) => [
    index("generated_docs_patient_idx").on(t.organizationId, t.patientId),
    orgFk("generated_docs_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("generated_docs_template_fk", t.organizationId, t.templateId, () => documentTemplates),
    orgFk("generated_docs_budget_fk", t.organizationId, t.budgetId, () => budgets),
    orgFk("generated_docs_settlement_fk", t.organizationId, t.settlementId, () => settlements),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    organizationId: orgCol(),
    patientId: uuid("patient_id"),
    appointmentId: uuid("appointment_id"),
    channel: text("channel").notNull(),
    purpose: text("purpose").notNull(),
    scheduledFor: ts("scheduled_for").notNull(),
    status: text("status").notNull().default("pending"),
    dedupeKey: text("dedupe_key").notNull(),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    body: text("body").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    cancelledReason: text("cancelled_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("notifications_dedupe_uq").on(t.organizationId, t.dedupeKey),
    index("notifications_pending_idx").on(t.status, t.scheduledFor),
    orgFk("notifications_patient_fk", t.organizationId, t.patientId, () => patients),
    orgFk("notifications_appointment_fk", t.organizationId, t.appointmentId, () => appointments),
    check("notifications_channel_ck", inList(t.channel, ["whatsapp", "sms", "email"])),
    check(
      "notifications_status_ck",
      inList(t.status, ["pending", "sent", "delivered", "failed", "responded", "cancelled"]),
    ),
  ],
);

export const INTEGRATION_KINDS = ["open_finance", "messaging", "email", "payments", "fiscal", "esign", "accounting"] as const;

export const integrationSettings = pgTable(
  "integration_settings",
  {
    id: pk(),
    organizationId: orgCol(),
    kind: text("kind").notNull(),
    provider: text("provider"),
    status: text("status").notNull().default("not_configured"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    lastSyncAt: ts("last_sync_at"),
    lastError: text("last_error"),
    updatedBy: userRef("updated_by"),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("integration_settings_kind_uq").on(t.organizationId, t.kind),
    check("integration_settings_kind_ck", inList(t.kind, INTEGRATION_KINDS)),
    check(
      "integration_settings_status_ck",
      inList(t.status, ["not_configured", "pending", "active", "error", "revoked", "expired"]),
    ),
  ],
);

export const integrationEvents = pgTable(
  "integration_events",
  {
    id: pk(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    eventType: text("event_type").notNull(),
    payloadSha256: text("payload_sha256").notNull(),
    status: text("status").notNull().default("received"),
    occurredAt: ts("occurred_at"),
    receivedAt: ts("received_at").notNull().defaultNow(),
    processedAt: ts("processed_at"),
    error: text("error"),
  },
  (t) => [
    unique("integration_events_uq").on(t.provider, t.externalId),
    check("integration_events_status_ck", inList(t.status, ["received", "processed", "ignored", "failed"])),
  ],
);
