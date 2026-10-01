// Aplica as migrações versionadas em DATABASE_URL.
import { runMigrations } from "../src/server/db/migrate";
import { loadEnv } from "./env";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (veja .env.example)");
  process.exit(1);
}
runMigrations(url)
  .then(() => {
    console.log("Migrações aplicadas.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Falha ao migrar:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
