// Restauração em banco VAZIO: npm run db:restore -- --from backups/<pasta> --target postgres://...
// Aplica as migrações no destino, carrega os dados, confere contagens e hashes.
import postgres from "postgres";
import { restoreDatabase } from "../src/server/backup";
import { runMigrations } from "../src/server/db/migrate";
import { arg, loadEnv } from "./env";

loadEnv();

async function main() {
  const from = arg("from");
  const target = arg("target") ?? process.env.RESTORE_DATABASE_URL;
  if (!from || !target) throw new Error("Uso: --from <pasta do backup> --target <url do banco vazio> (ou RESTORE_DATABASE_URL)");
  if (target === process.env.DATABASE_URL && !process.argv.includes("--i-know-this-is-the-main-database")) {
    throw new Error("Destino igual ao DATABASE_URL principal. Restaure primeiro em um banco de teste.");
  }
  await runMigrations(target);
  const sql = postgres(target, { max: 1, onnotice: () => {} });
  try {
    const res = await restoreDatabase(sql, from, { storageDir: arg("storage-dir") ?? null });
    console.log(`Restaurado: ${res.tables} tabelas, ${res.rows} linhas, ${res.files} arquivo(s). Contagens e hashes conferidos.`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
