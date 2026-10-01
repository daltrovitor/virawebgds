import { getTableName, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Referência de coluna sempre qualificada ("tabela"."coluna"). Necessária em
 * subconsultas correlacionadas: em selects de uma só tabela o Drizzle omite o
 * nome da tabela e "id" passaria a apontar para a tabela da subconsulta.
 */
export function q(col: AnyPgColumn): SQL {
  return sql.raw(`"${getTableName(col.table)}"."${col.name}"`);
}
