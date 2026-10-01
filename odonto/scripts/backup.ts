// Backup lógico: npm run db:backup [-- --out backups/AAAA-MM-DD]
// Copia também os arquivos privados quando STORAGE_DRIVER=local.
import { join } from "node:path";
import postgres from "postgres";
import { backupDatabase } from "../src/server/backup";
import { arg, loadEnv } from "./env";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Defina DATABASE_URL");
  const out = arg("out") ?? join("backups", new Date().toISOString().replace(/[:.]/g, "-"));
  const storageDir = (process.env.STORAGE_DRIVER ?? "local") === "local" ? (process.env.STORAGE_LOCAL_DIR ?? "storage") : null;
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const m = await backupDatabase(sql, out, { storageDir });
    const rows = m.tables.reduce((s, t) => s + t.rows, 0);
    console.log(`Backup em ${out}: ${m.tables.length} tabelas, ${rows} linhas, ${m.files.count} arquivo(s).`);
    if (!storageDir) console.log("Arquivos no Supabase Storage não entram neste backup: use o backup do provedor (ver docs/BACKUP-E-RESTAURACAO.md).");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
