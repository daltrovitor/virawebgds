export function mapDbErrorToUserMessage(raw: string | undefined | null | any) {
  if (!raw) return "Ocorreu um erro no servidor. Tente novamente mais tarde."
  // Accept objects from Supabase/PostgREST and extract meaningful fields
  let message = ""
  try {
    if (typeof raw === 'string') message = raw
    else if (raw && typeof raw === 'object') {
      message = String(raw.message || raw.error || raw.message?.message || JSON.stringify(raw))
    } else {
      message = String(raw)
    }
  } catch (e) {
    message = String(raw)
  }

  // Common DB / PostgREST errors
  // If the error clearly references CPF, return the CPF-specific message
  if (/\bcpf\b|patients\.cpf|patients_cpf|cpf_unique/i.test(message)) {
    return "Erro: o CPF informado é inválido ou já cadastrado. Você pode deixar o CPF em branco.";
  }

  // Generic unique/duplicate/constraint errors — do not assume CPF specifically
  if (/duplicate|unique|violates unique constraint|duplicate key value|constraint/i.test(message)) {
    return "Erro: valor duplicado no banco de dados ou violação de restrição. Verifique os dados e tente novamente.";
  }
  if (/Could not find the 'birthday' column|PGRST204/i.test(message)) {
    return "Erro no servidor: campo de aniversário não encontrado. Tente salvar sem preencher a data de aniversário ou atualize o banco de dados.";
  }
  if (/policy .* already exists|42710/i.test(message)) {
    return "Erro no servidor: uma política já existe. Execute as migrações atualizadas novamente (idempotentes).";
  }
  if (/permission denied|forbidden/i.test(message)) {
    return "Permissão negada para essa operação. Verifique suas credenciais ou permissões.";
  }

  // Fallback: return a cleaned message without internal codes
  return message.replace(/\s+\|\s+/g, ' - ')
}
