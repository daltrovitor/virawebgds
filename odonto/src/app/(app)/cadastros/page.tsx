// Hello World
import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/session";

export default async function CadastrosIndex() {
  const ctx = await getRequestContext();
  if (ctx.permissions.has("catalog.manage")) redirect("/cadastros/procedimentos");
  if (ctx.permissions.has("settings.manage")) redirect("/cadastros/profissionais");
  redirect("/cadastros/financeiro");
}
