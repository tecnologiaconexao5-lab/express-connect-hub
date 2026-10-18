// ═══════════════════════════════════════════════════════════════════════════════
// PP-UX-03 — Formatação de datas/períodos/nomes (apresentação).
// Puro, sem dependências, para ser testável e reutilizável.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Formata string DATE/Timestamp para pt-BR sem bug de timezone.
 * - "2026-09-18" (10 chars, DATE puro) → usa Date(y, m-1, d) = sem offset UTC.
 * - "2026-09-18T13:20:00.000Z" (timestamp) → Date(iso) = preserva timezone original.
 */
export function fmtDateLocal(s?: string | null): string {
  if (!s) return "—";
  if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  }
  return new Date(s).toLocaleDateString("pt-BR");
}

/**
 * Período legível e consistente. Nunca exibe "— a —".
 * Ambos ausentes => "Não informado"; um lado só => "A partir de"/"Até".
 */
export function fmtPeriodo(inicio?: string | null, fim?: string | null): string {
  const a = inicio ? fmtDateLocal(inicio) : "";
  const b = fim ? fmtDateLocal(fim) : "";
  if (!a && !b) return "Não informado";
  if (!b) return `A partir de ${a}`;
  if (!a) return `Até ${b}`;
  if (a === b) return a;
  return `${a} a ${b}`;
}

/** Nome legível: vazio/null => "Não informado". */
export function nomeOuNaoInformado(nome?: string | null): string {
  const t = (nome || "").trim();
  return t || "Não informado";
}
