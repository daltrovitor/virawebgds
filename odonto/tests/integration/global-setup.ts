import EmbeddedPostgres from "embedded-postgres";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/server/db/migrate";

declare module "vitest" {
  export interface ProvidedContext {
    pgBaseUrl: string;
  }
}

/**
 * Sobe um Postgres real (binários oficiais, sem Docker), aplica as migrações
 * em um banco-modelo e cada arquivo de teste clona esse modelo.
 * Para usar um servidor externo (CI), defina TEST_PG_BASE_URL=postgres://user:pass@host:port.
 */
export default async function setup(project: TestProject) {
  const external = process.env.TEST_PG_BASE_URL;
  let pg: EmbeddedPostgres | null = null;
  let dir: string | null = null;
  let base: string;
  if (external) {
    base = external.replace(/\/$/, "");
  } else {
    dir = mkdtempSync(join(tmpdir(), "odonto-test-pg-"));
    const port = 55000 + Math.floor(Math.random() * 2000);
    pg = new EmbeddedPostgres({
      databaseDir: dir,
      port,
      user: "postgres",
      password: "test",
      persistent: false,
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "max_connections=300", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"],
      onLog: () => {},
      onError: () => {},
    });
    await pg.initialise();
    await pg.start();
    base = `postgres://postgres:test@127.0.0.1:${port}`;
  }
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  await admin.unsafe("drop database if exists odonto_template");
  await admin.unsafe("create database odonto_template");
  await admin.end();
  await runMigrations(`${base}/odonto_template`);
  project.provide("pgBaseUrl", base);
  return async () => {
    if (pg) await pg.stop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  };
}
