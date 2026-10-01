/**
 * Erros de aplicação com mensagens seguras para o usuário. Erros inesperados
 * nunca expõem detalhes internos (SQL, dados clínicos) na resposta.
 */
export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: FieldErrors;
  constructor(code: string, message: string, status: number, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends AppError {
  constructor(what = "Registro") {
    super("not_found", `${what} não encontrado`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para esta ação") {
    super("forbidden", message, 403);
  }
}

export class UnauthenticatedError extends AppError {
  constructor() {
    super("unauthenticated", "Sessão expirada. Entre novamente.", 401);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fieldErrors?: FieldErrors) {
    super("validation", message, 422, fieldErrors);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super("conflict", message, 409);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super("business_rule", message, 422);
  }
}

/** Códigos SQLSTATE relevantes. */
export function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  if (typeof err === "object" && err !== null && "cause" in err) return pgErrorCode((err as { cause: unknown }).cause);
  return undefined;
}

export function pgConstraint(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "constraint_name" in err) {
    const c = (err as { constraint_name: unknown }).constraint_name;
    if (typeof c === "string") return c;
  }
  if (typeof err === "object" && err !== null && "cause" in err) return pgConstraint((err as { cause: unknown }).cause);
  return undefined;
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  return pgErrorCode(err) === "23505" && (!constraint || pgConstraint(err) === constraint);
}
