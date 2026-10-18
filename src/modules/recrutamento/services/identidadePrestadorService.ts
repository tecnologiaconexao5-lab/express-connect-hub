// ═══════════════════════════════════════════════════════════════════════════
// AG-07G — UNIFICAÇÃO APP → RECRUTAMENTO → PRESTADOR
// Prevenção de duplicidade: uma pessoa = UM prestador operacional.
//
// Identidade principal:
//   1. CPF real normalizado (quando disponível);
//   2. vínculo explícito candidato ↔ prestador (origem_cadastro = recrutamento:<id>);
//   3. telefone/e-mail NORMALIZADOS como apoio de reconciliação.
// CPF real nunca é substituído por CPF sintético (REC_...).
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

/** CPF/CNPJ → somente dígitos. */
export function normalizarDocumento(valor?: string | null): string {
  return String(valor || "").replace(/\D/g, "");
}

/** Telefone → somente dígitos. */
export function normalizarTelefone(valor?: string | null): string {
  return String(valor || "").replace(/\D/g, "");
}

/** E-mail → minúsculas + trim. */
export function normalizarEmail(valor?: string | null): string {
  return String(valor || "").trim().toLowerCase();
}

/** Detecta CPF sintético (REC_...) — nunca deve substituir CPF real. */
export function ehCpfSintetico(cpf?: string | null): boolean {
  return /^REC_/i.test(String(cpf || "").trim());
}

export interface IdentidadePrestador {
  id: string;
  nome_completo: string;
  cpf_cnpj: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  origem: string | null;
  origem_cadastro: string | null;
  status: string | null;
  liberado_app: boolean | null;
  cnh_validade: string | null;
}

/**
 * Procura UM prestador operacional existente que represente a MESMA pessoa.
 * Prioridade: vínculo explícito → CPF → telefone → e-mail (sempre normalizados).
 */
export async function buscarPrestadorOperacionalExistente(opts: {
  cpf?: string | null;
  telefone?: string | null;
  email?: string | null;
  origemCadastro?: string | null;
}): Promise<IdentidadePrestador | null> {
  const cpf = normalizarDocumento(opts.cpf);
  const tel = normalizarTelefone(opts.telefone);
  const email = normalizarEmail(opts.email);

  // 1. Vínculo explícito recrutamento ↔ prestador (origem_cadastro)
  if (opts.origemCadastro) {
    const { data } = await supabase
      .from("prestadores")
      .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, email, origem, origem_cadastro, status, liberado_app, cnh_validade")
      .eq("origem_cadastro", opts.origemCadastro)
      .maybeSingle();
    if (data) return data as IdentidadePrestador;
  }

  // 2. Busca para reconciliação normalizada em JS (CPF/telefone/e-mail)
  const { data } = await supabase
    .from("prestadores")
    .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, email, origem, origem_cadastro, status, liberado_app, cnh_validade")
    .limit(5000);
  const linhas = (data || []) as IdentidadePrestador[];

  for (const r of linhas) {
    if (cpf && normalizarDocumento(r.cpf_cnpj) === cpf) return r;
  }
  for (const r of linhas) {
    if (tel && (normalizarTelefone(r.telefone) === tel || normalizarTelefone(r.whatsapp) === tel)) return r;
  }
  for (const r of linhas) {
    if (email && normalizarEmail(r.email) === email) return r;
  }
  return null;
}
