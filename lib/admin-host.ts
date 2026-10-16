// Hello World
/**
 * O painel admin responde no subdomínio `admin.` de qualquer domínio da marca
 * (admin.viraweb.dev.br hoje, admin.viraweb.online antes). Não fixar o domínio aqui:
 * quando o domínio principal mudou, o admin deixou de ser reconhecido e caía na landing.
 */
export function isAdminHost(host: string | null | undefined): boolean {
  if (!host) return false
  const hostname = host.split(":")[0].replace(/\.$/, "").toLowerCase()
  return hostname.startsWith("admin.")
}
