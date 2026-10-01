import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login, resolveSession, requestPasswordReset, resetPassword, selectOrganization } from "../../src/server/auth/service";
import type { DbHandle } from "../../src/server/db/client";
import { auditLogs, budgets, clinicalNotes } from "../../src/server/db/schema";
import { NotFoundError } from "../../src/server/errors";
import { createAppointment } from "../../src/server/services/appointments";
import { reconcile } from "../../src/server/services/bank";
import { addItems, createBudget, getBudget, listBudgets } from "../../src/server/services/budgets";
import { saveClinicalNote, addNoteAddendum } from "../../src/server/services/clinical";
import { saveAccount } from "../../src/server/services/finance-setup";
import { getPatient, quickCreatePatient, searchPatients } from "../../src/server/services/patients";
import { budgetReport } from "../../src/server/services/reports";
import { createReceivable, listTitles, settleTitles } from "../../src/server/services/titles";
import { createCatalog, createClinic, createTestDb, TEST_PASSWORD, type CatalogFixture, type Clinic } from "./helpers";
import { users } from "../../src/server/db/schema";

let h: DbHandle;
let A: Clinic;
let B: Clinic;
let catB: CatalogFixture;
let patientB: string;
let budgetB: string;
let receivableB: string;

beforeAll(async () => {
  h = await createTestDb();
  A = await createClinic(h.db, "Clínica Alfa");
  B = await createClinic(h.db, "Clínica Beta");
  await createCatalog(A);
  catB = await createCatalog(B);
  const ownerB = await B.ctx("owner");
  const p = await quickCreatePatient(ownerB, { fullName: "Paciente da Beta", phone: "62955550001" });
  if (p.status !== "created") throw new Error("paciente");
  patientB = p.id;
  budgetB = (await createBudget(ownerB, { patientId: patientB })).id;
  const cats = await h.db.query.financialCategories.findMany({ where: (c, { eq: e }) => e(c.organizationId, B.orgId) });
  receivableB = (await createReceivable(ownerB, { patientId: patientB, description: "Título B", categoryId: cats.find((c) => c.type === "income")!.id, competenceDate: "2026-10-01", dueDate: "2026-10-01", amountCents: 1000 })).id;
});

afterAll(async () => {
  await h.sql.end();
});

describe("isolamento entre clínicas", () => {
  it("cenário 1: usuário da clínica A não acessa paciente, orçamento, título ou relatório da B, mesmo trocando IDs", async () => {
    const ownerA = await A.ctx("owner");
    await expect(getPatient(ownerA, patientB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getBudget(ownerA, budgetB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createBudget(ownerA, { patientId: patientB })).rejects.toBeInstanceOf(NotFoundError);
    const myPatient = await quickCreatePatient(ownerA, { fullName: "Paciente da Alfa", phone: "62955550002" });
    if (myPatient.status !== "created") throw new Error("p");
    const myBudget = await createBudget(ownerA, { patientId: myPatient.id });
    await expect(addItems(ownerA, { budgetId: myBudget.id, procedureId: catB.crown, selection: { kind: "teeth", teeth: [11] } })).rejects.toBeInstanceOf(NotFoundError);
    const accA = await saveAccount(ownerA, { name: "Banco A", kind: "bank", openingBalanceCents: 0, openingDate: "2026-01-01" });
    await expect(settleTitles(ownerA, { kind: "receivable", accountId: accA.id, method: "pix", settledOn: "2026-10-01", allocations: [{ titleId: receivableB, principalCents: 1000 }] })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createAppointment(ownerA, { patientId: patientB, professionalId: A.professionalId, date: "2026-10-05", startMinute: 540, endMinute: 600 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createAppointment(ownerA, { patientId: myPatient.id, professionalId: B.professionalId, date: "2026-10-05", startMinute: 540, endMinute: 600 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(reconcile(ownerA, { accountId: accA.id, allocations: [{ bankTransactionId: receivableB, movementId: receivableB, amountCents: 1 }] })).rejects.toBeInstanceOf(NotFoundError);
    const search = await searchPatients(ownerA, { q: "Beta" });
    expect(search.total).toBe(0);
    const list = await listBudgets(ownerA, {});
    expect(list.items.every((b) => b.id !== budgetB)).toBe(true);
    const titles = await listTitles(ownerA, { kind: "receivable", status: "all" });
    expect(titles.items.every((t) => t.id !== receivableB)).toBe(true);
    const report = await budgetReport(ownerA, "2026-01-01", "2026-12-31");
    expect(Object.values(report.byStatus).reduce((a, s) => a + s.count, 0)).toBe(1);
  });

  it("o banco recusa vínculo entre clínicas mesmo sem passar pelo serviço (FK composta)", async () => {
    const [b] = await h.db.select().from(budgets).where(eq(budgets.id, budgetB));
    await expect(
      h.db.insert(budgets).values({ organizationId: A.orgId, number: 999, patientId: patientB, priceTableId: b!.priceTableId, budgetDate: "2026-10-01" }),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ code: "23503" }) });
  });
});

describe("autenticação e sessão", () => {
  it("login, seleção explícita de clínica, bloqueio por tentativas e redefinição de senha", async () => {
    const [owner] = await h.db.select().from(users).where(eq(users.id, A.users.owner));
    const ok = await login(h.db, owner!.email, TEST_PASSWORD, { ip: "10.0.0.1" });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    const session = await resolveSession(h.db, ok.token);
    expect(session?.activeOrganizationId).toBe(A.orgId);
    await expect(selectOrganization(h.db, session!, B.orgId)).rejects.toThrow();
    expect(await resolveSession(h.db, "token-invalido")).toBeNull();

    const [fin] = await h.db.select().from(users).where(eq(users.id, A.users.finance));
    for (let i = 0; i < 5; i++) expect((await login(h.db, fin!.email, "errada-123456", { ip: "10.0.0.2" })).ok).toBe(false);
    const locked = await login(h.db, fin!.email, TEST_PASSWORD, { ip: "10.0.0.3" });
    expect(locked).toEqual({ ok: false, reason: "locked" });

    const unknown = await requestPasswordReset(h.db, "naoexiste@exemplo.test");
    expect(unknown).toBeNull();
    const [rec] = await h.db.select().from(users).where(eq(users.id, A.users.reception));
    const reset = await requestPasswordReset(h.db, rec!.email);
    await expect(resetPassword(h.db, reset!.token, "curta")).rejects.toThrow(/10 caracteres/);
    await resetPassword(h.db, reset!.token, "nova-senha-segura-2026");
    await expect(resetPassword(h.db, reset!.token, "outra-senha-segura-2026")).rejects.toThrow(/inválido/);
    expect((await login(h.db, rec!.email, "nova-senha-segura-2026")).ok).toBe(true);
  });
});

describe("registros clínicos e auditoria", () => {
  it("registro finalizado não é sobrescrito; correção entra como adendo; auditoria é somente inclusão", async () => {
    const dentist = await A.ctx("dentist");
    const p = await quickCreatePatient(dentist, { fullName: "Paciente Clínico", phone: "62955550003", confirmNotDuplicate: true });
    if (p.status !== "created") throw new Error("p");
    const note = await saveClinicalNote(dentist, { patientId: p.id, title: "Avaliação", body: "Texto sintético", finalize: true });
    await expect(saveClinicalNote(dentist, { id: note.id, patientId: p.id, title: "Avaliação", body: "Alterado" })).rejects.toThrow(/finalizado/);
    await expect(h.db.update(clinicalNotes).set({ body: "x" }).where(eq(clinicalNotes.id, note.id))).rejects.toThrow();
    await addNoteAddendum(dentist, { noteId: note.id, kind: "correction", body: "Correção sintética" });
    await expect(h.db.delete(auditLogs).where(eq(auditLogs.organizationId, A.orgId))).rejects.toThrow();
    const reception = await A.ctx("reception");
    await expect(saveClinicalNote(reception, { patientId: p.id, title: "x", body: "y" })).rejects.toThrow(/permissão/);
  });
});
