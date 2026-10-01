import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backupDatabase, restoreDatabase } from "../../src/server/backup";
import type { DbHandle } from "../../src/server/db/client";
import { attachments, budgets, patients, receivables, treatmentItems } from "../../src/server/db/schema";
import { uploadAttachment } from "../../src/server/services/attachments";
import { addItems, approveBudget, createBudget, getBudget } from "../../src/server/services/budgets";
import { quickCreatePatient } from "../../src/server/services/patients";
import { LocalStorage, setStorageForTests } from "../../src/server/storage";
import { createCatalog, createClinic, createTestDb, key } from "./helpers";

let source: DbHandle;
let target: DbHandle;
let dir: string;

beforeAll(async () => {
  source = await createTestDb();
  target = await createTestDb();
  dir = mkdtempSync(join(tmpdir(), "odonto-backup-"));
  setStorageForTests(new LocalStorage(join(dir, "storage-src")));
});

afterAll(async () => {
  setStorageForTests(null);
  await source.sql.end();
  await target.sql.end();
  rmSync(dir, { recursive: true, force: true });
});

describe("backup e restauração", () => {
  it("cenário 27: backup restaurado em ambiente de teste recupera vínculos principais e arquivos", async () => {
    const clinic = await createClinic(source.db);
    const cat = await createCatalog(clinic);
    const owner = await clinic.ctx("owner");
    const p = await quickCreatePatient(owner, { fullName: "Paciente Backup", phone: "62944440001" });
    if (p.status !== "created") throw new Error("p");
    const b = await createBudget(owner, { patientId: p.id });
    const items = await addItems(owner, { budgetId: b.id, procedureId: cat.crown, selection: { kind: "teeth", teeth: [11, 12] } });
    const d = await getBudget(owner, b.id);
    await approveBudget(owner, {
      budgetId: b.id,
      expectedVersion: d.budget.version,
      idempotencyKey: key(),
      approvedItemIds: items.itemIds,
      discount: { type: "none" },
      plan: { downPayment: null, installments: [{ amountCents: 120_000, dueDate: "2026-11-01", method: "pix" }] },
    });
    const png = new Uint8Array(await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ffffff" } }).png().toBuffer());
    const up = await uploadAttachment(owner, { patientId: p.id, kind: "photo", originalName: "foto.png", bytes: png });

    const manifest = await backupDatabase(source.sql, join(dir, "bk"), { storageDir: join(dir, "storage-src") });
    expect(manifest.tables.find((t) => t.name === "budgets")!.rows).toBe(1);
    expect(manifest.files.count).toBe(2); // original + miniatura

    // Restaurar exige banco vazio: o modelo de teste já tem migrações e nenhuma clínica.
    const res = await restoreDatabase(target.sql, join(dir, "bk"), { storageDir: join(dir, "storage-dst") });
    expect(res.files).toBe(2);
    const [rb] = await target.db.select().from(budgets).where(eq(budgets.id, b.id));
    expect(rb!.patientId).toBe(p.id);
    const titles = await target.db.select().from(receivables).where(eq(receivables.budgetId, b.id));
    expect(titles.reduce((s, t) => s + t.originalCents, 0)).toBe(120_000);
    const tItems = await target.db.select().from(treatmentItems).where(eq(treatmentItems.patientId, p.id));
    expect(tItems).toHaveLength(2);
    const [att] = await target.db.select().from(attachments).where(eq(attachments.id, up.id));
    const restoredBytes = readFileSync(join(dir, "storage-dst", att!.storageKey));
    expect(Buffer.from(restoredBytes).equals(Buffer.from(png))).toBe(true);
    const [pat] = await target.db.select().from(patients).where(eq(patients.id, p.id));
    expect(pat!.fullName).toBe("Paciente Backup");
    // Destino não vazio: recusa sobrescrever.
    await expect(restoreDatabase(target.sql, join(dir, "bk"))).rejects.toThrow(/não está vazio/);
  });
});
