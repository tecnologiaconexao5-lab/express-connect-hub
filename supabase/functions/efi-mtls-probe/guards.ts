// ═══════════════════════════════════════════════════════════════════════════════
// EFI-INT-04A.2 — Guards puros do efi-mtls-probe
// ═══════════════════════════════════════════════════════════════════════════════
// Lógica de segurança SEM dependência de Deno/Supabase/DB — permitindo teste
// estático unitário (Node/tsx). NÃO contém segredos.
// Garante que o probe só fala com HOMOLOGAÇÃO da Efí.
// ═══════════════════════════════════════════════════════════════════════════════

/** Ambiente EXATO exigido para o probe funcionar. */
export const EFI_REQUIRED_ENVIRONMENT = "homologacao";

/** Hosts de HOMOLOGAÇÃO da Efí PERMITIDOS (allowlist fixa). */
export const EFI_ALLOWED_HOSTS: readonly string[] = [
  "pix-h.api.efipay.com.br",
  "cobrancas-h.api.efipay.com.br",
];

/** Hosts de PRODUÇÃO da Efí explicitamente PROIBIDOS (redundante à allowlist). */
export const EFI_FORBIDDEN_HOSTS: readonly string[] = [
  "pix.api.efipay.com.br",
  "cobrancas.api.efipay.com.br",
];

/** Métodos HTTP permitidos no endpoint do probe. */
export const EFI_ALLOWED_METHODS: readonly string[] = ["GET", "OPTIONS"];

/** O ambiente deve ser EXATAMENTE "homologacao" (case-sensitive). */
export function isHomologacao(value: string | null | undefined): boolean {
  return value === EFI_REQUIRED_ENVIRONMENT;
}

/** Somente GET e OPTIONS são permitidos. */
export function isAllowedMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return EFI_ALLOWED_METHODS.includes(method.toUpperCase());
}

/**
 * Extrai o hostname de uma URL base (ou usa o fallback). Retorna null se a URL
 * for inválida — nesse caso o probe deve bloquear.
 */
export function extractHostname(
  rawUrl: string | null | undefined,
  fallback: string,
): string | null {
  const candidate = rawUrl && rawUrl.trim() ? rawUrl.trim() : fallback;
  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** O hostname está na allowlist de HOMOLOGAÇÃO. */
export function isAllowedHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  return EFI_ALLOWED_HOSTS.includes(hostname.toLowerCase());
}

/** O hostname é de PRODUÇÃO da Efí (proibido). */
export function isForbiddenHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  return EFI_FORBIDDEN_HOSTS.includes(hostname.toLowerCase());
}

/**
 * Autorização por token interno. Sem token esperado => NUNCA autoriza.
 * Comparação exata; o token nunca é retornado/logado.
 */
export function isAuthorizedToken(
  expected: string | null | undefined,
  provided: string | null | undefined,
): boolean {
  return !!expected && !!provided && provided === expected;
}
