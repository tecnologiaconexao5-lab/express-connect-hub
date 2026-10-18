// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÕES FINANCEIRAS + REGRAS POR CLIENTE
// configFinanceiraService.ts
//
// Fonte oficial de configuração financeira da empresa e regras por cliente.
//
// Contas bancárias: fonte canônica = tabela `contas_financeiras` (ativa=true).
// Chaves em `configuracoes_sistema`:
//   - "config_financeira_empresa"              → dados financeiros da Conexão
//   - "regras_financeiras_cliente:{clienteId}" → regras por cliente
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";
import {
  carregarConfiguracaoSistema,
  carregarConfiguracaoSistemaSource,
  salvarConfiguracaoSistema,
} from "@/services/configuracoesService";

// ── Dados financeiros da empresa ──────────────────────────────────────────────
export interface ConfigFinanceiraEmpresa {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  inscricaoMunicipal: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  emailFinanceiro: string;
  logoClaro: string;
  logoColorido: string;
  banco: string;
  codigoBanco: string;
  agencia: string;
  conta: string;
  digito: string;
  tipoConta: string;
  pix: string;
  beneficiario: string;
  beneficiarioCnpj: string;
}

export const CONFIG_FINANCEIRA_EMPRESA_DEFAULT: ConfigFinanceiraEmpresa = {
  razaoSocial: "",
  nomeFantasia: "Conexão Express",
  cnpj: "",
  ie: "",
  inscricaoMunicipal: "",
  endereco: "",
  cidade: "",
  uf: "",
  telefone: "",
  email: "",
  emailFinanceiro: "financeiro@conexaoexpress.com.br",
  logoClaro: "/logos/logo-conexao-branco.png",
  logoColorido: "/logos/logo-conexao-colorido.png",
  banco: "",
  codigoBanco: "",
  agencia: "",
  conta: "",
  digito: "",
  tipoConta: "Conta Corrente",
  pix: "",
  beneficiario: "",
  beneficiarioCnpj: "",
};

export async function buscarConfigFinanceiraEmpresa(): Promise<ConfigFinanceiraEmpresa> {
  try {
    const val = await carregarConfiguracaoSistema("config_financeira_empresa");
    if (val && typeof val === "object") {
      return { ...CONFIG_FINANCEIRA_EMPRESA_DEFAULT, ...(val as Record<string, unknown>) } as ConfigFinanceiraEmpresa;
    }
  } catch {
    // fallback abaixo
  }
  return { ...CONFIG_FINANCEIRA_EMPRESA_DEFAULT };
}

export async function buscarConfigFonte(): Promise<{ empresa: ConfigFinanceiraEmpresa; fonte: "supabase" | "local" }> {
  try {
    const result = await carregarConfiguracaoSistemaSource("config_financeira_empresa");
    const val = result.value;
    if (val && typeof val === "object") {
      return {
        empresa: { ...CONFIG_FINANCEIRA_EMPRESA_DEFAULT, ...(val as Record<string, unknown>) } as ConfigFinanceiraEmpresa,
        fonte: result.source,
      };
    }
  } catch {
    // fallback abaixo
  }
  return { empresa: { ...CONFIG_FINANCEIRA_EMPRESA_DEFAULT }, fonte: "local" };
}

export async function salvarConfigFinanceiraEmpresa(dados: ConfigFinanceiraEmpresa): Promise<{ success: boolean; error?: string }> {
  try {
    await salvarConfiguracaoSistema("config_financeira_empresa", dados);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

// ── Regras financeiras por cliente ────────────────────────────────────────────
export interface RegrasFinanceirasCliente {
  modeloFaturaPadrao: "conexao_express" | "calvo";
  exigeRomaneioOC: boolean;
  prazoPagamentoDias: number | null;
  diaFixo?: number | null;
  periodoFechamento?: "semanal" | "quinzenal" | "mensal" | null;
  exigeAprovacao: boolean;
  emailFinanceiro: string;
  observacaoPadrao: string;
  tipoDocumentoFiscalEsperado: "NFS-e" | "CT-e" | "nenhum";
  instrucoesEspeciais: string;
}

export const REGRAS_FINANCEIRAS_DEFAULT: RegrasFinanceirasCliente = {
  modeloFaturaPadrao: "conexao_express",
  exigeRomaneioOC: false,
  prazoPagamentoDias: null,
  diaFixo: null,
  periodoFechamento: null,
  exigeAprovacao: false,
  emailFinanceiro: "",
  observacaoPadrao: "",
  tipoDocumentoFiscalEsperado: "nenhum",
  instrucoesEspeciais: "",
};

function chaveRegraCliente(clienteId: string): string {
  return `regras_financeiras_cliente:${clienteId}`;
}

export async function buscarRegrasFinanceirasCliente(clienteId: string): Promise<RegrasFinanceirasCliente> {
  if (!clienteId) return { ...REGRAS_FINANCEIRAS_DEFAULT };
  try {
    const val = await carregarConfiguracaoSistema(chaveRegraCliente(clienteId));
    if (val && typeof val === "object") {
      return { ...REGRAS_FINANCEIRAS_DEFAULT, ...(val as Record<string, unknown>) } as RegrasFinanceirasCliente;
    }
  } catch {
    // fallback abaixo
  }
  return { ...REGRAS_FINANCEIRAS_DEFAULT };
}

export async function salvarRegrasFinanceirasCliente(clienteId: string, regras: RegrasFinanceirasCliente): Promise<{ success: boolean; error?: string }> {
  if (!clienteId) return { success: false, error: "Cliente é obrigatório" };
  try {
    await salvarConfiguracaoSistema(chaveRegraCliente(clienteId), regras);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

// ── Contas bancárias (configuração) ───────────────────────────────────────────
export interface ContaBancariaFinanceira {
  id: string;
  nome: string;
  banco: string;
  codigoBanco: string;
  agencia: string;
  conta: string;
  digito: string;
  pix: string;
  titular: string;
  titularCnpj: string;
  tipo: string;
  ativa: boolean;
  principal: boolean;
}

export async function buscarContasBancariasConfig(): Promise<ContaBancariaFinanceira[]> {
  try {
    const { data, error } = await supabase
      .from("contas_financeiras")
      .select("id, nome, banco, agencia, numero_conta, digito, chave_pix, titular, tipo, ativa, principal")
      .eq("ativa", true)
      .order("principal", { ascending: false })
      .order("nome", { ascending: true });

    if (error || !data) return [];

    return data.map((c: Record<string, unknown>) => ({
      id: c.id as string,
      nome: c.nome as string,
      banco: c.banco as string,
      codigoBanco: "",
      agencia: c.agencia as string,
      conta: c.numero_conta as string,
      digito: (c.digito as string) || "",
      pix: (c.chave_pix as string) || "",
      titular: c.titular as string,
      titularCnpj: "",
      tipo: (c.tipo as string) || "corrente",
      ativa: c.ativa as boolean,
      principal: (c.principal as boolean) || false,
    })) as ContaBancariaFinanceira[];
  } catch {
    return [];
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuidValido = (v?: string | null): boolean => typeof v === "string" && UUID_RE.test(v);

export async function salvarContasBancariasConfig(
  contas: ContaBancariaFinanceira[],
  client: { from: (t: string) => any } = supabase as any
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = (c: ContaBancariaFinanceira) => ({
      nome: c.nome,
      banco: c.banco || null,
      agencia: c.agencia || null,
      numero_conta: c.conta || null,
      digito: c.digito || null,
      chave_pix: c.pix || null,
      titular: c.titular || null,
      tipo: c.tipo || "Conta Corrente",
      ativa: c.ativa !== false,
      principal: c.principal === true,
    });

    // Regra EXISTENTE no schema: no maximo UMA conta principal (indice unico parcial).
    const principais = contas.filter((c) => c.principal === true);
    if (principais.length > 1) {
      return { success: false, error: "Apenas uma conta principal é permitida. Desmarque as demais." };
    }

    // Libera a vaga de principal antes de gravar a nova principal (evita violacao do indice).
    if (principais.length === 1) {
      const novaId = isUuidValido(principais[0].id) ? principais[0].id : "00000000-0000-0000-0000-000000000000";
      const { error: errUnset } = await (client.from("contas_financeiras") as any)
        .update({ principal: false })
        .eq("principal", true)
        .neq("id", novaId);
      if (errUnset) return { success: false, error: errUnset.message };
    }

    // Novos (id temporario "c-..." ou ausente) -> INSERT SEM id (DEFAULT gen_random_uuid()).
    // Existentes (UUID real) -> UPDATE pela PK (preserva o UUID, nao duplica).
    const existentes = contas.filter((c) => isUuidValido(c.id));
    const novos = contas.filter((c) => !isUuidValido(c.id));

    for (const c of existentes) {
      const { error } = await (client.from("contas_financeiras") as any).update(payload(c)).eq("id", c.id);
      if (error) return { success: false, error: error.message };
    }
    if (novos.length > 0) {
      const { error } = await (client.from("contas_financeiras") as any).insert(novos.map(payload));
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erro ao salvar" };
  }
}

// ── Helpers de vencimento por regra do cliente ────────────────────────────────
export type TipoVencimento = "dias_corridos" | "dias_uteis" | "dia_fixo";

export interface CalcVencimentoInput {
  dataEmissao?: string;
  prazoDias?: number | null;
  diaFixo?: number | null;
  tipo?: TipoVencimento;
}

/** Calcula o vencimento a partir da regra do cliente. Sem motor complexo nesta fase. */
export function calcularVencimentoPorRegra(input: CalcVencimentoInput): string {
  const base = input.dataEmissao || new Date().toISOString().split("T")[0];
  const d = new Date(base + "T12:00:00");

  // Dia fixo do mês (ex.: vence dia 15 do mês seguinte ao fechamento)
  if (input.diaFixo && input.diaFixo > 0 && input.diaFixo <= 31) {
    const mesBase = d.getMonth() + 1;
    const anoBase = d.getFullYear();
    let anoVenc = anoBase;
    let mesVenc = mesBase + 1;
    if (mesVenc > 12) { mesVenc = 1; anoVenc = anoBase + 1; }
    const ultimoDiaMes = new Date(anoVenc, mesVenc, 0).getDate();
    const dia = Math.min(input.diaFixo, ultimoDiaMes);
    const venc = new Date(anoVenc, mesVenc - 1, dia, 12, 0, 0);
    return venc.toISOString().split("T")[0];
  }

  // Prazo em dias (corridos; dias úteis apenas se regra avançada for exigida)
  const prazo = (input.prazoDias && input.prazoDias > 0) ? input.prazoDias : 30;
  d.setDate(d.getDate() + prazo);
  return d.toISOString().split("T")[0];
}
