// Hello World
import { redirect } from "next/navigation";
import { getRequestContext } from "@/server/session";
import { visibleCfgTabs } from "./tabs";

export default async function SettingsIndex() {
  const ctx = await getRequestContext();
  redirect(visibleCfgTabs(ctx.permissions)[0]!.href);
}
