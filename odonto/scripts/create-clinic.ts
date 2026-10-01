// Cria uma clínica real (ex.: piloto) e o usuário administrador.
// Uso:
//   npm run clinic:create -- --name "Nome da Clínica" --slug nome-da-clinica \
//     --owner-email admin@clinica.com.br --owner-name "Nome" --owner-password "senha-forte"
// A identidade da clínica fica apenas nos dados (configurações), nunca no código.
import { sql } from "drizzle-orm";
import { createDb } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { createOrganization } from "../src/server/services/organizations";
import { createUser } from "../src/server/services/users";
import { arg, loadEnv } from "./env";

loadEnv();

async function main() {
  const name = arg("name");
  const slug = arg("slug");
  const email = arg("owner-email");
  const ownerName = arg("owner-name");
  const password = arg("owner-password");
  if (!name || !slug || !email || !ownerName) {
    console.error("Parâmetros obrigatórios: --name --slug --owner-email --owner-name [--owner-password]");
    process.exit(1);
  }
  const { db, sql: client } = createDb(process.env.DATABASE_URL!, { max: 2 });
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
    let ownerId = existing?.id;
    if (!ownerId) {
      if (!password) throw new Error("Usuário novo: informe --owner-password (mínimo 10 caracteres)");
      ownerId = (await createUser(db, { email, name: ownerName, password })).id;
    }
    const { organizationId } = await createOrganization(db, { name, slug, ownerUserId: ownerId, isDemo: false });
    console.log(`Clínica criada (${organizationId}). Administrador: ${email}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
