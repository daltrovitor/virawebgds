import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { inject } from "vitest";
import type { SystemRole } from "../../src/domain/permissions";
import { loadOrgAccess } from "../../src/server/auth/service";
import type { Ctx } from "../../src/server/context";
import { createDb, type Db, type DbHandle } from "../../src/server/db/client";
import { memberships, professionals, roles, specialties } from "../../src/server/db/schema";
import { saveProcedure, setPrice, listPriceTables } from "../../src/server/services/catalog";
import { createOrganization } from "../../src/server/services/organizations";
import { createUser } from "../../src/server/services/users";

export async function createTestDb(): Promise<DbHandle & { name: string; url: string }> {
  const base = inject("pgBaseUrl");
  const name = `t_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  for (let attempt = 0; ; attempt++) {
    try {
      await admin.unsafe(`create database ${name} template odonto_template`);
      break;
    } catch (err) {
      // Clonagens simultâneas do mesmo modelo podem colidir; tenta novamente.
      if (attempt > 20) throw err;
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
    }
  }
  await admin.end();
  const url = `${base}/${name}`;
  return { ...createDb(url, { max: 20 }), name, url };
}

export interface Clinic {
  orgId: string;
  users: Record<SystemRole, string>;
  professionalId: string;
  ctx: (role: SystemRole) => Promise<Ctx>;
  specialty: (name: string) => Promise<string>;
}

const PASSWORD = "senha-de-teste-123";
export { PASSWORD as TEST_PASSWORD };

export async function createClinic(db: Db, label = "Clínica Demo A"): Promise<Clinic> {
  const suffix = randomUUID().slice(0, 8);
  const owner = await createUser(db, { email: `dono-${suffix}@exemplo.test`, name: `Dono ${label}`, password: PASSWORD });
  const { organizationId: orgId } = await createOrganization(db, {
    name: label,
    slug: `clinica-${suffix}`,
    ownerUserId: owner.id,
    isDemo: true,
  });
  const roleRows = await db.select().from(roles).where(eq(roles.organizationId, orgId));
  const users = { owner: owner.id } as Record<SystemRole, string>;
  for (const key of ["dentist", "reception", "finance", "accountant"] as const) {
    const u = await createUser(db, { email: `${key}-${suffix}@exemplo.test`, name: `${key} ${label}`, password: PASSWORD });
    await db.insert(memberships).values({ organizationId: orgId, userId: u.id, roleId: roleRows.find((r) => r.key === key)!.id });
    users[key] = u.id;
  }
  const [prof] = await db
    .insert(professionals)
    .values({ organizationId: orgId, name: `Dra. Demo ${suffix}`, userId: users.dentist, council: "CRO", councilNumber: "00000", councilState: "GO" })
    .returning({ id: professionals.id });
  const ctx = async (role: SystemRole): Promise<Ctx> => {
    const access = await loadOrgAccess(db, users[role], orgId);
    if (!access) throw new Error("sem acesso");
    return {
      db,
      orgId,
      userId: users[role],
      userName: role,
      roleKey: access.roleKey,
      permissions: access.permissions,
      timezone: access.timezone,
      ip: "127.0.0.1",
    };
  };
  const specialty = async (name: string) => {
    const [row] = await db
      .select({ id: specialties.id })
      .from(specialties)
      .where(and(eq(specialties.organizationId, orgId), eq(specialties.name, name)));
    return row!.id;
  };
  return { orgId, users, professionalId: prof!.id, ctx, specialty };
}

export interface CatalogFixture {
  priceTableId: string;
  crown: string; // Prótese, por dente, R$ 600
  resin: string; // Dentística, por dente, R$ 250
  whitening: string; // Dentística, global, R$ 300
  splint: string; // Prótese, por arcada, R$ 300
  scaling: string; // Periodontia, por hemiarcada, R$ 180
  consult: string; // Clínica geral, global sem região, sem preço cadastrado
}

export async function createCatalog(clinic: Clinic): Promise<CatalogFixture> {
  const ctx = await clinic.ctx("owner");
  const [table] = await listPriceTables(ctx);
  const priceTableId = table!.id;
  const make = async (code: string, name: string, specialty: string, billingUnit: "tooth" | "arch" | "hemiarch" | "session" | "global", allowed: ("teeth" | "arches" | "hemiarches" | "none")[], price: number | null) => {
    const { id } = await saveProcedure(ctx, { specialtyId: await clinic.specialty(specialty), code, name, billingUnit, allowedLocations: allowed });
    if (price !== null) await setPrice(ctx, { priceTableId, procedureId: id, priceCents: price });
    return id;
  };
  return {
    priceTableId,
    crown: await make("PRT-01", "Coroa metalocerâmica", "Prótese", "tooth", ["teeth"], 60_000),
    resin: await make("DEN-01", "Restauração em resina", "Dentística", "tooth", ["teeth"], 25_000),
    whitening: await make("DEN-02", "Clareamento", "Dentística", "global", ["arches", "none"], 30_000),
    splint: await make("PRT-02", "Placa miorrelaxante", "Prótese", "arch", ["arches"], 30_000),
    scaling: await make("PER-01", "Raspagem por hemiarcada", "Periodontia", "hemiarch", ["hemiarches"], 18_000),
    consult: await make("CLG-01", "Avaliação clínica", "Clínica geral", "global", ["none"], null),
  };
}

export function key(): string {
  return randomUUID();
}
