import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type postgres from "postgres";

/**
 * Backup lógico portátil (JSON por tabela + manifesto com contagens e hashes).
 * Complementa — não substitui — o backup gerenciado do provedor (ex.: PITR do
 * Supabase). Restauração exige banco vazio com as migrações aplicadas.
 */
export interface BackupManifest {
  format: "odonto-backup-v1";
  createdAt: string;
  migrations: string[];
  tables: { name: string; rows: number; sha256: string }[];
  files: { included: boolean; count: number };
}

const CHUNK = 500;

async function listTables(sql: postgres.Sql): Promise<string[]> {
  const rows = await sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public' order by tablename`;
  return rows.map((r) => r.tablename);
}

async function countFiles(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? await countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}

export async function backupDatabase(sql: postgres.Sql, outDir: string, opts: { storageDir?: string | null } = {}): Promise<BackupManifest> {
  await mkdir(outDir, { recursive: true });
  const tables = await listTables(sql);
  const manifest: BackupManifest = {
    format: "odonto-backup-v1",
    createdAt: new Date().toISOString(),
    migrations: (await sql<{ hash: string }[]>`select hash from drizzle.__drizzle_migrations order by created_at`.catch(() => [])).map((r) => r.hash),
    tables: [],
    files: { included: false, count: 0 },
  };
  // Leitura consistente: todas as tabelas no mesmo snapshot.
  await sql.begin("isolation level repeatable read read only", async (tx) => {
    for (const name of tables) {
      const rows = await tx.unsafe(`select row_to_json(t)::text as j from "${name}" t`);
      const body = rows.map((r) => (r as unknown as { j: string }).j).join("\n");
      await writeFile(join(outDir, `${name}.jsonl`), body, "utf8");
      manifest.tables.push({ name, rows: rows.length, sha256: createHash("sha256").update(body).digest("hex") });
    }
  });
  if (opts.storageDir && existsSync(opts.storageDir)) {
    await cp(opts.storageDir, join(outDir, "files"), { recursive: true });
    manifest.files = { included: true, count: await countFiles(join(outDir, "files")) };
  }
  await writeFile(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

export async function restoreDatabase(sql: postgres.Sql, fromDir: string, opts: { storageDir?: string | null } = {}): Promise<{ tables: number; rows: number; files: number }> {
  const manifest = JSON.parse(await readFile(join(fromDir, "manifest.json"), "utf8")) as BackupManifest;
  if (manifest.format !== "odonto-backup-v1") throw new Error("Formato de backup desconhecido");
  const [{ n }] = (await sql`select count(*)::int as n from organizations`) as unknown as [{ n: number }];
  if (n > 0) throw new Error("O banco de destino não está vazio; restauração recusada para não sobrescrever dados");
  const existing = new Set(await listTables(sql));
  let total = 0;
  await sql.begin(async (tx) => {
    // Desativa gatilhos e FKs durante a carga (ordem das tabelas e referências circulares).
    await tx.unsafe("set local session_replication_role = replica");
    for (const t of manifest.tables) {
      if (!existing.has(t.name)) throw new Error(`Tabela ${t.name} não existe no destino; aplique as migrações antes`);
      const body = await readFile(join(fromDir, `${t.name}.jsonl`), "utf8");
      if (createHash("sha256").update(body).digest("hex") !== t.sha256) throw new Error(`Arquivo de ${t.name} corrompido (hash divergente)`);
      const lines = body === "" ? [] : body.split("\n");
      for (let i = 0; i < lines.length; i += CHUNK) {
        const chunk = `[${lines.slice(i, i + CHUNK).join(",")}]`;
        await tx.unsafe(`insert into "${t.name}" select * from json_populate_recordset(null::"${t.name}", $1::json)`, [chunk]);
      }
      total += lines.length;
    }
    // Reposiciona sequências de colunas seriais.
    const serials = await tx<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public' and column_default like 'nextval(%'`;
    for (const s of serials) {
      await tx.unsafe(`select setval(pg_get_serial_sequence('"${s.table_name}"', '${s.column_name}'), coalesce((select max("${s.column_name}") from "${s.table_name}"), 0) + 1, false)`);
    }
  });
  // Verificação pós-carga: contagens precisam bater com o manifesto.
  for (const t of manifest.tables) {
    const [{ c }] = (await sql.unsafe(`select count(*)::int as c from "${t.name}"`)) as unknown as [{ c: number }];
    if (c !== t.rows) throw new Error(`Contagem divergente em ${t.name}: ${c} ≠ ${t.rows}`);
  }
  let files = 0;
  if (manifest.files.included && opts.storageDir) {
    await cp(join(fromDir, "files"), opts.storageDir, { recursive: true, errorOnExist: false, force: false });
    files = await countFiles(opts.storageDir);
  }
  return { tables: manifest.tables.length, rows: total, files };
}

export async function isDirectory(path: string): Promise<boolean> {
  return existsSync(path) && (await stat(path)).isDirectory();
}
