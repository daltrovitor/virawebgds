// Configuração de usuários dev com acesso total gratuito

export const DEV_EMAILS = [
  "vitorrocketleague@gmail.com",
  "dev@viraweb.com",
  "admin@viraweb.com",
  // Adicione mais emails de dev aqui conforme necessário
]

export function isDevUser(email: string | undefined): boolean {
  if (!email) return false
  return DEV_EMAILS.includes(email.toLowerCase())
}

export function shouldBypassSubscriptionCheck(email: string | undefined): boolean {
  const isProduction = process.env.NODE_ENV === "production"
  const allowDevBypass = process.env.ALLOW_DEV_BYPASS !== "false" // Padrão é true, só desabilita se explicitamente "false"

  if (isProduction && !allowDevBypass) {
    return false
  }

  return isDevUser(email)
}
