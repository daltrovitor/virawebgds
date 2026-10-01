import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export interface DbHandle {
  db: Db;
  sql: postgres.Sql;
}

export function createDb(url: string, options: { max?: number } = {}): DbHandle {
  const sql = postgres(url, {
    max: options.max ?? Number(process.env.DATABASE_POOL_MAX ?? 10),
    // Poolers em modo transação (ex.: Supabase porta 6543) não suportam prepared statements.
    prepare: process.env.DATABASE_PREPARE !== "false",
    onnotice: () => {},
    connection: { application_name: "odonto-gestao" },
  });
  return { db: drizzle(sql, { schema, casing: undefined }), sql };
}

const globalForDb = globalThis as unknown as { __odontoDb?: DbHandle };

/** Conexão compartilhada do processo (reaproveitada entre recarregamentos em dev). */
export function getDb(): Db {
  if (!globalForDb.__odontoDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada. Veja .env.example.");
    globalForDb.__odontoDb = createDb(url);
  }
  return globalForDb.__odontoDb.db;
}

export { schema };
