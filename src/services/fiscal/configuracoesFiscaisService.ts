import { supabase } from "@/lib/supabase";
import type { ConfiguracaoFiscal } from "@/types/fiscal";

export interface SalvarConfiguracaoFiscalInput {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  ie: string;
  inscricao_municipal?: string;
  rntrc: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  codigo_ibge?: string;
  telefone: string;
  email: string;
  ambiente_fiscal: string;
  crt?: string;
  regime_tributario?: string;
  cnae_principal?: string;
  ativo: boolean;
  apelido?: string | null;
  padrao?: boolean;
  limite_plano?: number | null;
  focus_empresa_id?: string | null;
  focus_token_configurado?: boolean;
  focus_status?: string;
  certificado_configurado?: boolean;
  certificado_nome?: string;
  certificado_validade?: string;
  certificado_status?: string;
}

export async function buscarEmitentePadrao(): Promise<ConfiguracaoFiscal | null> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_fiscais")
      .select("*")
      .eq("ativo", true)
      .eq("padrao", true)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as ConfiguracaoFiscal | null;
  } catch (err: any) {
    console.error("[ConfiguracoesFiscais] Erro ao buscar emitente padrao:", err);
    return null;
  }
}

export async function buscarEmitenteAtivo(): Promise<ConfiguracaoFiscal | null> {
  return buscarEmitentePadrao();
}

export async function salvarEmitenteFiscal(dados: SalvarConfiguracaoFiscalInput): Promise<{ success: boolean; data?: ConfiguracaoFiscal; error?: string }> {
  try {
    const { count } = await supabase
      .from("configuracoes_fiscais")
      .select("*", { count: "exact", head: true })
      .eq("ativo", true);

    if (count && count >= 3) {
      return { success: false, error: "Limite de 3 emitentes ativos atingido." };
    }

    const { data, error } = await supabase
      .from("configuracoes_fiscais")
      .insert([dados])
      .select("*")
      .single();

    if (error) throw error;
    return { success: true, data: data as ConfiguracaoFiscal };
  } catch (err: any) {
    console.error("[ConfiguracoesFiscais] Erro ao salvar emitente:", err);
    return { success: false, error: err.message };
  }
}

export async function listarConfiguracoesFiscais(): Promise<ConfiguracaoFiscal[]> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_fiscais")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as ConfiguracaoFiscal[];
  } catch (err: any) {
    console.error("[ConfiguracoesFiscais] Erro ao listar:", err);
    return [];
  }
}

export async function atualizarEmitenteFiscal(id: string, dados: Partial<SalvarConfiguracaoFiscalInput>): Promise<{ success: boolean; data?: ConfiguracaoFiscal; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("configuracoes_fiscais")
      .update(dados)
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return { success: true, data: data as ConfiguracaoFiscal };
  } catch (err: any) {
    console.error("[ConfiguracoesFiscais] Erro ao atualizar emitente:", err);
    return { success: false, error: err.message };
  }
}

export async function definirComoPadrao(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: resetErr } = await supabase
      .from("configuracoes_fiscais")
      .update({ padrao: false })
      .neq("id", id);

    if (resetErr) throw resetErr;

    const { error: setErr } = await supabase
      .from("configuracoes_fiscais")
      .update({ padrao: true })
      .eq("id", id);

    if (setErr) throw setErr;

    return { success: true };
  } catch (err: any) {
    console.error("[ConfiguracoesFiscais] Erro ao definir padrao:", err);
    return { success: false, error: err.message };
  }
}

export async function toggleAtivoEmitente(id: string, ativo: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    if (!ativo) {
      const { data: emit } = await supabase
        .from("configuracoes_fiscais")
        .select("padrao")
        .eq("id", id)
        .single();

      if (emit?.padrao) {
        const { error: resetErr } = await supabase
          .from("configuracoes_fiscais")
          .update({ padrao: false })
          .eq("id", id);

        if (resetErr) throw resetErr;
      }
    }

    const { error } = await supabase
      .from("configuracoes_fiscais")
      .update({ ativo })
      .eq("id", id);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
