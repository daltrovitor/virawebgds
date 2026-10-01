// Inicia um Postgres local real (sem Docker) para desenvolvimento.
// Uso: npm run db:local  (mantém o processo aberto; Ctrl+C encerra)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";

const baseDir =
  process.env.LOCAL_PG_DIR ??
  (process.platform === "win32"
    ? join(process.env.LOCALAPPDATA ?? homedir(), "odonto-gestao", "pg")
    : join(homedir(), ".local", "share", "odonto-gestao", "pg"));
const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const password = process.env.LOCAL_PG_PASSWORD ?? "odonto_local_dev";

async function main() {
  const firstRun = !existsSync(join(baseDir, "PG_VERSION"));
  if (firstRun) mkdirSync(baseDir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: baseDir,
    port,
    user: "postgres",
    password,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  if (firstRun) await pg.initialise();
  await pg.start();
  const admin = postgres({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres", max: 1, onnotice: () => {} });
  const exists = await admin`select 1 from pg_database where datname = 'odonto'`;
  if (exists.length === 0) await admin.unsafe("create database odonto");
  await admin.end();
  console.log(`Postgres local pronto em postgres://postgres:${password}@127.0.0.1:${port}/odonto`);
  console.log(`Dados em ${baseDir}. Ctrl+C para encerrar.`);
  const shutdown = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
