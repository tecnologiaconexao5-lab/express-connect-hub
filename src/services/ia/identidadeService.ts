import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

// ==================== TYPES ====================

export type StatusIdentidade = "ativa" | "inativa" | "pausada" | "bloqueada";
export type PerfilIdentidade = "comercial" | "financeiro" | "operacional" | "fiscal" | "recrutamento" | "monitoramento" | "cliente" | "prestador" | "rh" | "suporte";
export type TipoCredencial = "whatsapp" | "zoho" | "smtp" | "crm" | "api" | "site_vagas" | "outro";
export type StatusSessaoOperacional = "ativa" | "concluida" | "falhou" | "cancelada";

export interface IaIdentidade {
  id: string;
  robo_id: string;
  nome_operacional: string;
  email_operacional: string | null;
  status: StatusIdentidade;
  perfil: PerfilIdentidade;
  timezone: string;
  idioma: string;
  configuracao_operacional: Record<string, unknown>;
  configuracao_cognitiva: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IaCredencial {
  id: string;
  robo_id: string;
  tipo: TipoCredencial;
  nome_credencial: string;
  provedor: string | null;
  referencia_env: string;
  escopos: string[];
  ativo: boolean;
  ultimo_uso: string | null;
  ultima_rotacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface IaSessaoOperacional {
  id: string;
  robo_id: string;
  identidade_id: string | null;
  motivo: string;
  status: StatusSessaoOperacional;
  contexto_inicial: Record<string, unknown>;
  resultado: Record<string, unknown>;
  inicio: string;
  fim: string | null;
  duracao_segundos: number | null;
  total_acoes: number;
  criado_por: string | null;
  encerrado_por: string | null;
  created_at: string;
  updated_at: string;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ==================== IDENTIDADE (FASE 2) ====================

async function obterIdentidade(roboId: string): Promise<IaIdentidade | null> {
  const { data } = await supabase.from("ia_identidades").select("*").eq("robo_id", roboId).single();
  return data as IaIdentidade | null;
}

async function upsertIdentidade(dados: {
  robo_id: string;
  nome_operacional: string;
  email_operacional?: string;
  status?: StatusIdentidade;
  perfil: PerfilIdentidade;
  timezone?: string;
  idioma?: string;
  configuracao_operacional?: Record<string, unknown>;
  configuracao_cognitiva?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<IaIdentidade | null> {
  const { data } = await supabase.from("ia_identidades").upsert({
    robo_id: dados.robo_id,
    nome_operacional: dados.nome_operacional,
    email_operacional: dados.email_operacional || null,
    status: dados.status || "ativa",
    perfil: dados.perfil,
    timezone: dados.timezone || "America/Sao_Paulo",
    idioma: dados.idioma || "pt-BR",
    configuracao_operacional: dados.configuracao_operacional || {},
    configuracao_cognitiva: dados.configuracao_cognitiva || {},
    metadata: dados.metadata || {},
  }, { onConflict: "robo_id" }).select().single();

  if (data) {
    void centralIaService.registrarLog({
      robo_id: dados.robo_id, acao: "identidade_upsert",
      entrada: { nome_operacional: dados.nome_operacional, perfil: dados.perfil },
      saida: { identidade_id: data.id }, status: "info",
    });
  }
  return data as IaIdentidade | null;
}

async function listarIdentidades(filtros?: { perfil?: PerfilIdentidade; status?: StatusIdentidade }): Promise<(IaIdentidade & { robo_nome?: string; robo_setor?: string })[]> {
  let query = supabase.from("ia_identidades").select("*, automacoes_robos!inner(nome, setor)");
  if (filtros?.perfil) query = query.eq("perfil", filtros.perfil);
  if (filtros?.status) query = query.eq("status", filtros.status);
  const { data } = await query;
  return (data || []).map((r: Record<string, unknown>) => {
    const robo = r.automacoes_robos as Record<string, unknown> || {};
    return {
      ...r as IaIdentidade,
      robo_nome: robo.nome as string,
      robo_setor: robo.setor as string,
    };
  });
}

// ==================== CREDENCIAIS (FASE 5) ====================

async function listarCredenciais(roboId?: string, tipo?: TipoCredencial): Promise<IaCredencial[]> {
  let query = supabase.from("ia_credenciais").select("*");
  if (roboId) query = query.eq("robo_id", roboId);
  if (tipo) query = query.eq("tipo", tipo);
  const { data } = await query;
  return (data || []) as IaCredencial[];
}

async function upsertCredencial(dados: {
  robo_id: string;
  tipo: TipoCredencial;
  nome_credencial: string;
  provedor?: string;
  referencia_env: string;
  escopos?: string[];
}): Promise<IaCredencial | null> {
  const { data } = await supabase.from("ia_credenciais").insert({
    robo_id: dados.robo_id,
    tipo: dados.tipo,
    nome_credencial: dados.nome_credencial,
    provedor: dados.provedor || null,
    referencia_env: dados.referencia_env,
    escopos: dados.escopos || [],
  }).select().single().catch(async () => {
    const { data: existing } = await supabase.from("ia_credenciais").select("*")
      .eq("robo_id", dados.robo_id).eq("tipo", dados.tipo).eq("nome_credencial", dados.nome_credencial).maybeSingle();
    return { data: existing, error: null };
  });
  return data as IaCredencial | null;
}

async function removerCredencial(id: string): Promise<void> {
  await supabase.from("ia_credenciais").delete().eq("id", id);
}

// ==================== SESSÕES OPERACIONAIS (FASE 3) ====================

async function iniciarSessao(params: {
  roboId: string;
  motivo: string;
  contexto_inicial?: Record<string, unknown>;
  criado_por?: string;
}): Promise<IaSessaoOperacional | null> {
  const identidade = await obterIdentidade(params.roboId);
  const { data } = await supabase.from("ia_sessoes_operacionais").insert({
    robo_id: params.roboId,
    identidade_id: identidade?.id || null,
    motivo: params.motivo,
    status: "ativa",
    contexto_inicial: params.contexto_inicial || {},
    inicio: nowISO(),
    criado_por: params.criado_por || null,
  }).select().single();

  if (data) {
    void centralIaService.registrarLog({
      robo_id: params.roboId, acao: "sessao_iniciada",
      entrada: { motivo: params.motivo, identidade_id: identidade?.id },
      saida: { sessao_id: data.id }, status: "info",
    });
  }
  return data as IaSessaoOperacional | null;
}

async function encerrarSessao(sessaoId: string, params?: {
  resultado?: Record<string, unknown>;
  encerrado_por?: string;
}): Promise<IaSessaoOperacional | null> {
  const agora = nowISO();
  const { data: sessao } = await supabase.from("ia_sessoes_operacionais").select("inicio, total_acoes").eq("id", sessaoId).single();
  if (!sessao) return null;

  const inicio = new Date(sessao.inicio).getTime();
  const duracao = Math.floor((Date.now() - inicio) / 1000);

  const { data } = await supabase.from("ia_sessoes_operacionais").update({
    status: "concluida",
    fim: agora,
    duracao_segundos: duracao,
    resultado: params?.resultado || {},
    encerrado_por: params?.encerrado_por || null,
    updated_at: nowISO(),
  }).eq("id", sessaoId).select().single();

  if (data) {
    void centralIaService.registrarLog({
      robo_id: data.robo_id, acao: "sessao_encerrada",
      entrada: { sessao_id: sessaoId, duracao },
      saida: { status: data.status }, status: "info",
    });
  }
  return data as IaSessaoOperacional | null;
}

async function obterSessao(sessaoId: string): Promise<(IaSessaoOperacional & { robo_nome?: string }) | null> {
  const { data } = await supabase
    .from("ia_sessoes_operacionais")
    .select("*, automacoes_robos!inner(nome)")
    .eq("id", sessaoId)
    .single();
  if (!data) return null;
  const robo = (data as Record<string, unknown>).automacoes_robos as Record<string, unknown> || {};
  return { ...data as IaSessaoOperacional, robo_nome: robo.nome as string };
}

async function listarSessoes(filtros?: {
  robo_id?: string;
  status?: StatusSessaoOperacional;
  limite?: number;
}): Promise<(IaSessaoOperacional & { robo_nome?: string })[]> {
  let query = supabase
    .from("ia_sessoes_operacionais")
    .select("*, automacoes_robos!inner(nome)")
    .order("inicio", { ascending: false });
  if (filtros?.robo_id) query = query.eq("robo_id", filtros.robo_id);
  if (filtros?.status) query = query.eq("status", filtros.status);
  if (filtros?.limite) query = query.limit(filtros.limite);
  const { data } = await query;
  return (data || []).map((r: Record<string, unknown>) => {
    const robo = r.automacoes_robos as Record<string, unknown> || {};
    return { ...r as IaSessaoOperacional, robo_nome: robo.nome as string };
  });
}

async function incrementarAcoesSessao(sessaoId: string): Promise<void> {
  await supabase.from("ia_sessoes_operacionais").update({
    total_acoes: supabase.rpc("increment", { x: 1 }) as unknown as number,
    updated_at: nowISO(),
  }).eq("id", sessaoId);
}

// ==================== CONTEXTO PARA F34A (FASE 6) ====================

async function montarContextoIdentidade(roboId: string): Promise<string> {
  const identidade = await obterIdentidade(roboId);
  if (!identidade) return "";

  const partes: string[] = [];
  partes.push("=== IDENTIDADE DIGITAL ===");
  partes.push(`Nome operacional: ${identidade.nome_operacional}`);
  if (identidade.email_operacional) partes.push(`Email: ${identidade.email_operacional}`);
  partes.push(`Perfil: ${identidade.perfil}`);
  partes.push(`Status: ${identidade.status}`);
  partes.push(`Timezone: ${identidade.timezone}`);
  partes.push(`Idioma: ${identidade.idioma}`);

  const cfgOper = identidade.configuracao_operacional;
  if (cfgOper && Object.keys(cfgOper).length > 0) {
    partes.push("Configuração operacional:");
    for (const [k, v] of Object.entries(cfgOper)) {
      partes.push(`  ${k}: ${v}`);
    }
  }

  const cfgCog = identidade.configuracao_cognitiva;
  if (cfgCog && Object.keys(cfgCog).length > 0) {
    partes.push("Configuração cognitiva:");
    for (const [k, v] of Object.entries(cfgCog)) {
      partes.push(`  ${k}: ${v}`);
    }
  }

  return partes.join("\n");
}

// ==================== EXPORTS ====================

export const identidadeService = {
  obterIdentidade,
  upsertIdentidade,
  listarIdentidades,
  listarCredenciais,
  upsertCredencial,
  removerCredencial,
  iniciarSessao,
  encerrarSessao,
  obterSessao,
  listarSessoes,
  incrementarAcoesSessao,
  montarContextoIdentidade,
};
