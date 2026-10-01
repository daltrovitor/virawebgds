// Dados SINTÉTICOS de demonstração. Nenhum dado real de paciente.
// Uso: npm run db:seed-demo   (usa DATABASE_URL; cria a clínica "Clínica Demonstração")
// Usuários: admin|dentista|recepcao|financeiro|contador @demo.odonto.test, senha em DEMO_PASSWORD (.env.example).
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { addDays, monthlySchedule, startOfWeekMonday, todayInTz, weekdayOf } from "../src/domain/dates";
import type { SystemRole } from "../src/domain/permissions";
import { loadOrgAccess } from "../src/server/auth/service";
import type { Ctx } from "../src/server/context";
import { createDb } from "../src/server/db/client";
import { memberships, organizations, professionals, roles, specialties, users } from "../src/server/db/schema";
import { changeAppointmentStatus, createAppointment, createBlock, recordAppointmentOutcome } from "../src/server/services/appointments";
import { addItems, approveBudget, createBudget, getBudget, saveNegotiation } from "../src/server/services/budgets";
import { listPriceTables, saveProcedure, setPrice } from "../src/server/services/catalog";
import { recordAnamnesis, activeAnamnesisTemplate } from "../src/server/services/clinical";
import { saveAccount, saveCardFeeRule, saveSupplier } from "../src/server/services/finance-setup";
import { createOrganization, systemCategoryId } from "../src/server/services/organizations";
import { createAlert, quickCreatePatient, savePatient } from "../src/server/services/patients";
import { createPayable, createRecurrence, generateRecurringPayables, recordCardPayment, settleTitles } from "../src/server/services/titles";
import { createUser } from "../src/server/services/users";
import { loadEnv } from "./env";

loadEnv();
// Dados de demonstração nunca entram em um ambiente de produção.
if (process.env.APP_ENV === "production") {
  console.error("Seed de demonstração recusado: APP_ENV=production.");
  process.exit(1);
}
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-odonto-2026";
const TZ = "America/Sao_Paulo";

const PROCEDURES: { code: string; name: string; specialty: string; unit: "tooth" | "arch" | "hemiarch" | "session" | "global"; locs: ("teeth" | "arches" | "hemiarches" | "none")[]; price: number | null; minutes?: number }[] = [
  { code: "CG-01", name: "Consulta de avaliação", specialty: "Clínica geral", unit: "global", locs: ["none"], price: 0, minutes: 30 },
  { code: "CG-02", name: "Profilaxia", specialty: "Clínica geral", unit: "session", locs: ["none", "arches"], price: 18000, minutes: 45 },
  { code: "DEN-01", name: "Restauração em resina (1 face)", specialty: "Dentística", unit: "tooth", locs: ["teeth"], price: 22000, minutes: 45 },
  { code: "DEN-02", name: "Restauração em resina (2+ faces)", specialty: "Dentística", unit: "tooth", locs: ["teeth"], price: 32000, minutes: 60 },
  { code: "DEN-03", name: "Clareamento de consultório", specialty: "Dentística", unit: "global", locs: ["arches", "none"], price: 120000, minutes: 90 },
  { code: "DEN-04", name: "Faceta em resina", specialty: "Dentística", unit: "tooth", locs: ["teeth"], price: 65000, minutes: 90 },
  { code: "PRT-01", name: "Coroa metalocerâmica", specialty: "Prótese", unit: "tooth", locs: ["teeth"], price: 180000, minutes: 60 },
  { code: "PRT-02", name: "Coroa em zircônia", specialty: "Prótese", unit: "tooth", locs: ["teeth"], price: 250000, minutes: 60 },
  { code: "PRT-03", name: "Placa miorrelaxante", specialty: "Prótese", unit: "arch", locs: ["arches"], price: 90000, minutes: 30 },
  { code: "PRT-04", name: "Prótese total", specialty: "Prótese", unit: "arch", locs: ["arches"], price: 280000, minutes: 60 },
  { code: "END-01", name: "Tratamento de canal (unirradicular)", specialty: "Endodontia", unit: "tooth", locs: ["teeth"], price: 90000, minutes: 90 },
  { code: "END-02", name: "Tratamento de canal (multirradicular)", specialty: "Endodontia", unit: "tooth", locs: ["teeth"], price: 140000, minutes: 120 },
  { code: "PER-01", name: "Raspagem subgengival", specialty: "Periodontia", unit: "hemiarch", locs: ["hemiarches"], price: 25000, minutes: 45 },
  { code: "IMP-01", name: "Implante unitário", specialty: "Implantodontia", unit: "tooth", locs: ["teeth"], price: 350000, minutes: 120 },
  { code: "ORT-01", name: "Manutenção ortodôntica", specialty: "Ortodontia", unit: "session", locs: ["none"], price: 25000, minutes: 30 },
  { code: "RAD-01", name: "Radiografia periapical", specialty: "Radiologia", unit: "tooth", locs: ["teeth"], price: 4000, minutes: 15 },
  { code: "RAD-02", name: "Radiografia panorâmica", specialty: "Radiologia", unit: "global", locs: ["none"], price: null, minutes: 15 },
];

const PATIENTS = [
  "Ana Demo Ribeiro",
  "Bruno Demo Carvalho",
  "Carla Demo Nunes",
  "Diego Demo Freitas",
  "Elisa Demo Moraes",
  "Fábio Demo Teixeira",
  "Gabriela Demo Pires",
  "Heitor Demo Barros",
  "Isabela Demo Rocha",
  "João Demo Almeida",
  "Karen Demo Lopes",
  "Lucas Demo Martins",
];

/** Próximo dia útil a partir de uma data (segunda a sexta). */
function businessDay(date: string): string {
  let d = date;
  while (weekdayOf(d) === 0 || weekdayOf(d) === 6) d = addDays(d, 1);
  return d;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL");
  const { db, sql: client } = createDb(url, { max: 4 });
  try {
    const [exists] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "clinica-demonstracao"));
    if (exists) {
      console.log("A clínica de demonstração já existe; nada a fazer.");
      return;
    }
    const emails: Record<SystemRole, string> = {
      owner: "admin@demo.odonto.test",
      dentist: "dentista@demo.odonto.test",
      reception: "recepcao@demo.odonto.test",
      finance: "financeiro@demo.odonto.test",
      accountant: "contador@demo.odonto.test",
    };
    const names: Record<SystemRole, string> = {
      owner: "Administrador Demo",
      dentist: "Dra. Paula Demo",
      reception: "Recepção Demo",
      finance: "Financeiro Demo",
      accountant: "Contador Demo",
    };
    const ids = {} as Record<SystemRole, string>;
    for (const role of Object.keys(emails) as SystemRole[]) {
      const [u] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${emails[role]}`);
      ids[role] = u?.id ?? (await createUser(db, { email: emails[role], name: names[role], password: PASSWORD })).id;
    }
    const { organizationId: orgId } = await createOrganization(db, { name: "Clínica Demonstração", slug: "clinica-demonstracao", ownerUserId: ids.owner, isDemo: true });
    const roleRows = await db.select().from(roles).where(eq(roles.organizationId, orgId));
    for (const role of ["dentist", "reception", "finance", "accountant"] as const) {
      await db.insert(memberships).values({ organizationId: orgId, userId: ids[role], roleId: roleRows.find((r) => r.key === role)!.id }).onConflictDoNothing();
    }
    const ctxFor = async (role: SystemRole): Promise<Ctx> => {
      const access = (await loadOrgAccess(db, ids[role], orgId))!;
      return { db, orgId, userId: ids[role], userName: names[role], roleKey: role, permissions: access.permissions, timezone: TZ, ip: null };
    };
    const owner = await ctxFor("owner");
    const dentist = await ctxFor("dentist");
    const finance = await ctxFor("finance");

    // Profissionais
    const [paula] = await db.insert(professionals).values({ organizationId: orgId, userId: ids.dentist, name: "Dra. Paula Demo", council: "CRO", councilNumber: "00001", councilState: "GO", color: "#0f766e" }).returning();
    const [rafael] = await db.insert(professionals).values({ organizationId: orgId, name: "Dr. Rafael Demo", council: "CRO", councilNumber: "00002", councilState: "GO", color: "#1d4ed8" }).returning();

    // Catálogo e preços (tabela Particular)
    const [table] = await listPriceTables(owner);
    const specs = await db.select().from(specialties).where(eq(specialties.organizationId, orgId));
    const proc: Record<string, string> = {};
    for (const p of PROCEDURES) {
      const specialtyId = specs.find((s) => s.name === p.specialty)!.id;
      const { id } = await saveProcedure(owner, { specialtyId, code: p.code, name: p.name, billingUnit: p.unit, allowedLocations: p.locs, suggestedMinutes: p.minutes });
      if (p.price !== null) await setPrice(owner, { priceTableId: table!.id, procedureId: id, priceCents: p.price });
      proc[p.code] = id;
    }

    // Contas financeiras
    const bank = await saveAccount(owner, { name: "Banco Demo — conta corrente", kind: "bank", bankName: "Banco Demo", bankCode: "999", branch: "0001", accountNumberMasked: "•••12-3", openingBalanceCents: 1_500_000, openingDate: addDays(todayInTz(TZ), -60) });
    const clearing = await saveAccount(owner, { name: "Recebíveis de cartão — Operadora Demo", kind: "card_clearing", openingBalanceCents: 0, openingDate: addDays(todayInTz(TZ), -60) });
    await saveCardFeeRule(owner, { acquirer: "Operadora Demo", paymentType: "credit", installmentsFrom: 1, installmentsTo: 1, feeBasisPoints: 299, settlementDays: 30 });
    await saveCardFeeRule(owner, { acquirer: "Operadora Demo", paymentType: "debit", installmentsFrom: 1, installmentsTo: 1, feeBasisPoints: 149, settlementDays: 1 });
    const supplier = await saveSupplier(owner, { name: "Dental Suprimentos Demo" });
    const lab = await saveSupplier(owner, { name: "Laboratório de Prótese Demo" });

    // Pacientes
    const patientIds: string[] = [];
    for (let i = 0; i < PATIENTS.length; i++) {
      const phone = `6299900${String(1000 + i).slice(-4)}`;
      const r = await quickCreatePatient(owner, { fullName: PATIENTS[i]!, phone, confirmNotDuplicate: true });
      if (r.status === "created") patientIds.push(r.id);
    }
    await savePatient(owner, {
      id: patientIds[0],
      fullName: PATIENTS[0]!,
      birthDate: "1988-04-12",
      phone: "62999001000",
      email: "ana.demo@exemplo.test",
      city: "Goiânia",
      state: "GO",
      origin: "Indicação",
      referenceProfessionalId: paula!.id,
      confirmNotDuplicate: true,
    });
    await createAlert(owner, { patientId: patientIds[0]!, kind: "administrative", priority: "normal", text: "Prefere atendimento no fim da tarde." });
    const tpl = await activeAnamnesisTemplate(dentist);
    await recordAnamnesis(dentist, {
      patientId: patientIds[0]!,
      templateId: tpl!.id,
      answeredOn: todayInTz(TZ),
      respondentName: PATIENTS[0]!,
      answers: { alergias: { answer: "sim", details: "Dado sintético de demonstração" }, fumante: { answer: "não" } },
    });

    const today = todayInTz(TZ);

    // Orçamento aprovado com entrada Pix + parcelas no cartão
    const b1 = await createBudget(dentist, { patientId: patientIds[0]!, professionalId: paula!.id });
    await addItems(dentist, { budgetId: b1.id, procedureId: proc["PRT-02"]!, selection: { kind: "teeth", teeth: [11, 21] } });
    await addItems(dentist, { budgetId: b1.id, procedureId: proc["DEN-01"]!, selection: { kind: "teeth", teeth: [11] } });
    await addItems(dentist, { budgetId: b1.id, procedureId: proc["DEN-03"]!, selection: { kind: "arches", arches: ["upper", "lower"] } });
    const d1 = await getBudget(owner, b1.id);
    const total1 = d1.subtotalCents - Math.round(d1.subtotalCents * 0.05);
    const entry = 100_000;
    const rest = total1 - entry;
    const dates = monthlySchedule(addDays(today, 30), 3);
    const parts = [Math.ceil(rest / 3), Math.floor(rest / 3), rest - Math.ceil(rest / 3) - Math.floor(rest / 3)];
    const approval1 = await approveBudget(owner, {
      budgetId: b1.id,
      expectedVersion: d1.budget.version,
      idempotencyKey: randomUUID(),
      approvedItemIds: d1.items.map((i) => i.id),
      discount: { type: "amount", cents: d1.subtotalCents - total1 },
      plan: { downPayment: { amountCents: entry, dueDate: today, method: "pix" }, installments: dates.map((dueDate, i) => ({ amountCents: parts[i]!, dueDate, method: "boleto" as const })) },
    });
    await settleTitles(finance, { kind: "receivable", accountId: bank.id, method: "pix", settledOn: today, allocations: [{ titleId: approval1.receivableIds[0]!, principalCents: entry }] });

    // Orçamento parcialmente aprovado
    const b2 = await createBudget(dentist, { patientId: patientIds[1]!, professionalId: paula!.id });
    await addItems(dentist, { budgetId: b2.id, procedureId: proc["END-02"]!, selection: { kind: "teeth", teeth: [36] } });
    await addItems(dentist, { budgetId: b2.id, procedureId: proc["PRT-01"]!, selection: { kind: "teeth", teeth: [36] } });
    await addItems(dentist, { budgetId: b2.id, procedureId: proc["IMP-01"]!, selection: { kind: "teeth", teeth: [46] } });
    const d2 = await getBudget(owner, b2.id);
    const approved2 = d2.items.filter((i) => i.procedureCode !== "IMP-01");
    const t2 = approved2.reduce((s, i) => s + i.subtotalCents, 0);
    const approval2 = await approveBudget(owner, {
      budgetId: b2.id,
      expectedVersion: d2.budget.version,
      idempotencyKey: randomUUID(),
      approvedItemIds: approved2.map((i) => i.id),
      discount: { type: "none" },
      plan: { downPayment: null, installments: [{ amountCents: t2, dueDate: today, method: "credit" }] },
    });
    await recordCardPayment(finance, {
      clearingAccountId: clearing.id,
      acquirer: "Operadora Demo",
      brand: "Visa",
      paymentType: "credit",
      installments: 3,
      transactionDate: today,
      feeCents: Math.round(t2 * 0.0299),
      settlementDays: 30,
      allocations: [{ titleId: approval2.receivableIds[0]!, principalCents: t2 }],
      idempotencyKey: randomUUID(),
    });

    // Em negociação e rascunho
    const b3 = await createBudget(dentist, { patientId: patientIds[2]!, professionalId: rafael!.id });
    await addItems(dentist, { budgetId: b3.id, procedureId: proc["PER-01"]!, selection: { kind: "hemiarches", hemiarches: [1, 2, 3, 4] } });
    await addItems(dentist, { budgetId: b3.id, procedureId: proc["CG-02"]!, selection: { kind: "none" }, quantity: 2 });
    const d3 = await getBudget(dentist, b3.id);
    await saveNegotiation(dentist, {
      budgetId: b3.id,
      approvedItemIds: d3.items.map((i) => i.id),
      discount: { type: "percent", basisPoints: 1000 },
      plan: { downPayment: null, installments: [{ amountCents: Math.round(d3.subtotalCents * 0.9), dueDate: addDays(today, 7), method: "pix" }] },
    });
    const b4 = await createBudget(dentist, { patientId: patientIds[3]!, professionalId: paula!.id });
    await addItems(dentist, { budgetId: b4.id, procedureId: proc["PRT-03"]!, selection: { kind: "arches", arches: ["upper"] } });

    // Agenda da semana (dados sintéticos)
    const monday = startOfWeekMonday(today);
    await createBlock(owner, { professionalId: null, kind: "weekly", weekday: 3, startDate: monday, startMinute: 12 * 60, endMinute: 13 * 60, reason: "Almoço da equipe" });
    const slots: [number, number, number, number][] = [
      // [dia da semana offset, início, fim, paciente]
      [0, 8 * 60, 9 * 60, 4],
      [0, 9 * 60 + 15, 10 * 60, 5],
      [1, 14 * 60, 15 * 60 + 30, 6],
      [2, 8 * 60 + 30, 9 * 60, 7],
      [3, 10 * 60, 11 * 60, 8],
      [4, 15 * 60, 16 * 60, 9],
    ];
    for (const [offset, start, end, p] of slots) {
      const date = addDays(monday, offset);
      await createAppointment(owner, { patientId: patientIds[p]!, professionalId: offset % 2 === 0 ? paula!.id : rafael!.id, date, startMinute: start, endMinute: end, reminderPreference: "whatsapp", confirmOutsideHours: true });
    }
    // Hoje: atendimento com procedimento programado
    const todayBiz = businessDay(today);
    const appt = await createAppointment(owner, {
      patientId: patientIds[0]!,
      professionalId: paula!.id,
      date: todayBiz,
      startMinute: 16 * 60,
      endMinute: 17 * 60,
      treatmentItemIds: approval1.treatmentItemIds.slice(0, 1),
      planned: "Preparo para coroa (dente 11)",
      confirmOutsideHours: true,
    });
    await changeAppointmentStatus(owner, { appointmentId: appt.id, to: "confirmed" });
    // Consulta passada sem desfecho (pendência)
    await createAppointment(owner, { patientId: patientIds[10]!, professionalId: rafael!.id, date: businessDay(addDays(today, -7)), startMinute: 9 * 60, endMinute: 9 * 60 + 30, confirmOutsideHours: true });
    // Consulta passada finalizada com evolução
    const past = await createAppointment(owner, {
      patientId: patientIds[1]!,
      professionalId: paula!.id,
      date: businessDay(addDays(today, -3)),
      startMinute: 14 * 60,
      endMinute: 15 * 60,
      treatmentItemIds: approval2.treatmentItemIds.slice(0, 1),
      confirmOutsideHours: true,
    });
    await recordAppointmentOutcome(dentist, {
      appointmentId: past.id,
      performed: "Sessão 1 realizada (registro sintético)",
      finish: true,
      procedures: [{ treatmentItemId: approval2.treatmentItemIds[0]!, outcome: "partial", resultingStatus: "in_progress", sessionLabel: "Sessão 1" }],
    });

    // Contas a pagar e recorrência
    const expense = (await systemCategoryId(db, orgId, "other_expense"))!;
    await createPayable(finance, { supplierId: supplier.id, description: "Materiais de consumo", categoryId: expense, competenceDate: today, firstDueDate: addDays(today, 10), amountCents: 84_590, installments: 2 });
    await createPayable(finance, { supplierId: lab.id, description: "Coroas — laboratório", categoryId: expense, competenceDate: today, firstDueDate: addDays(today, -2), amountCents: 120_000 });
    await createRecurrence(finance, { description: "Aluguel da sala", categoryId: expense, amountCents: 450_000, dayOfMonth: 10, startDate: `${today.slice(0, 7)}-01` });
    await generateRecurringPayables(finance, addDays(today, 90));

    console.log("Clínica de demonstração criada com dados sintéticos.");
    console.log("Usuários: admin | dentista | recepcao | financeiro | contador @demo.odonto.test (senha: DEMO_PASSWORD do .env)");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
