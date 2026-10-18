// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 46 — CENTRAL DE COMUNICAÇÃO INTELIGENTE
// communicationHubService.ts
// Gerencia templates, eventos, preferências e links públicos de rastreio.
// Modo simulation por padrão.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CommunicationTemplate {
  id: string;
  tenant_id?: string;
  codigo: string;
  nome: string;
  canal: string;
  publico: "destinatario" | "cliente" | "prestador";
  evento: string;
  assunto?: string;
  corpo: string;
  variaveis?: Array<{ var: string; desc: string }>;
  branding?: Record<string, string>;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CommunicationEvent {
  id: string;
  tenant_id?: string;
  os_id?: string;
  alocacao_id?: string;
  cliente_id?: string;
  prestador_id?: string;
  template_id?: string;
  destinatario_nome?: string;
  destinatario_contato?: string;
  evento: string;
  publico: "destinatario" | "cliente" | "prestador";
  canal: string;
  status_envio: "pendente" | "enviado" | "falhou" | "cancelado" | "simulado";
  assunto?: string;
  mensagem?: string;
  payload?: Record<string, any>;
  erro?: string;
  scheduled_at?: string;
  sent_at?: string;
  created_at?: string;
}

export interface CommunicationPreference {
  id: string;
  tenant_id?: string;
  cliente_id?: string;
  canal: string;
  publico: string;
  ativo: boolean;
  eventos_permitidos?: string[];
  branding?: {
    logo_url?: string;
    nome_exibicao?: string;
    cor_primaria?: string;
    cor_secundaria?: string;
    assinatura_texto?: string;
    texto_rodape?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface TrackingPublicLink {
  id: string;
  tenant_id?: string;
  os_id: string;
  token_publico: string;
  expira_em?: string;
  ativo: boolean;
  acessos: number;
  ultimo_acesso_em?: string;
  created_at?: string;
}

export interface RenderContext {
  destinatario_nome?: string;
  transportadora?: string;
  link_rastreio?: string;
  link_avaliacao?: string;
  link_painel?: string;
  janela_entrega?: string;
  horario_entrega?: string;
  protocolo_entrega?: string;
  numero_os?: string;
  origem?: string;
  destino?: string;
  data_prevista?: string;
  prestador_nome?: string;
  veiculo_placa?: string;
  veiculo_tipo?: string;
  status_atual?: string;
  previsao_entrega?: string;
  tipo_ocorrencia?: string;
  descricao_ocorrencia?: string;
  data_entrega?: string;
  data_operacao?: string;
  valor_operacao?: string;
  tempo_restante?: string;
  instrucao?: string;
  recebedor_nome?: string;
  assinatura?: string;
  [key: string]: string | undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_BRANDING = {
  nome_exibicao: "Conexão Express",
  cor_primaria: "#1a365d",
  cor_secundaria: "#2b6cb0",
  assinatura_texto: "Entrega acompanhada por Conexão Express — tecnologia logística inteligente.",
  texto_rodape: "© Conexão Express Transportes",
};

let simulationMode = !(import.meta.env.VITE_COMUNICACAO_PRODUCAO_ASSISTIDA === "true" || import.meta.env.VITE_COMMUNICATION_PRODUCTION === "true");

export function setCommunicationMode(mode: "simulation" | "production") {
  simulationMode = mode === "simulation";
}

export function getCommunicationMode(): string {
  return simulationMode ? "simulation" : "production";
}

export function isSimulationMode(): boolean {
  return simulationMode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export async function listarTemplates(publico?: string): Promise<CommunicationTemplate[]> {
  let query = supabase.from("communication_templates").select("*").eq("ativo", true);
  if (publico) query = query.eq("publico", publico);
  const { data, error } = await query.order("publico").order("codigo");
  if (error) throw error;
  return data || [];
}

export async function obterTemplatePorCodigo(codigo: string): Promise<CommunicationTemplate | null> {
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("codigo", codigo)
    .eq("ativo", true)
    .single();
  if (error) return null;
  return data;
}

export async function obterTemplatesPorEvento(evento: string, publico: string): Promise<CommunicationTemplate[]> {
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("evento", evento)
    .eq("publico", publico)
    .eq("ativo", true);
  if (error) return [];
  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERIZAÇÃO DE MENSAGEM
// ═══════════════════════════════════════════════════════════════════════════════

export function renderizarMensagem(template: CommunicationTemplate, contexto: RenderContext): string {
  let mensagem = template.corpo;
  // Substitui variáveis {{variavel}}
  for (const [key, value] of Object.entries(contexto)) {
    mensagem = mensagem.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  // Substitui assinatura se não definida no contexto
  if (!contexto.assinatura) {
    const branding = template.branding || {};
    const nomeExibicao = (branding.nome_exibicao as string) || DEFAULT_BRANDING.nome_exibicao;
    const assinatura = (branding.assinatura_texto as string) || DEFAULT_BRANDING.assinatura_texto;
    mensagem = mensagem.replace(/\{\{assinatura\}\}/g, assinatura);
    mensagem = mensagem.replace(/\{\{transportadora\}\}/g, nomeExibicao);
  }
  return mensagem;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTOS DE COMUNICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export async function gerarEventoComunicacao(params: {
  os_id?: string;
  alocacao_id?: string;
  cliente_id?: string;
  prestador_id?: string;
  evento: string;
  publico: "destinatario" | "cliente" | "prestador";
  destinatario_nome?: string;
  destinatario_contato?: string;
  contexto?: RenderContext;
  canal?: string;
}): Promise<CommunicationEvent | null> {
  const { evento, publico, contexto, canal, ...rest } = params;

  // Busca template pelo evento + público
  const templates = await obterTemplatesPorEvento(evento, publico);
  const template = templates.length > 0 ? templates[0] : null;

  if (!template) {
    // Sem template: registra evento sem mensagem renderizada
    const { data, error } = await supabase
      .from("communication_events")
      .insert({
        ...rest,
        evento,
        publico,
        canal: canal || "simulation",
        status_envio: "simulado",
        payload: { contexto, motivo: "sem_template" },
      })
      .select()
      .single();
    if (error) { console.warn("[CommHub] Erro ao gerar evento:", error.message); return null; }
    return data;
  }

  // Verifica duplicação: mesmo evento + OS nas últimas 24h
  const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existentes } = await supabase
    .from("communication_events")
    .select("id")
    .eq("os_id", params.os_id)
    .eq("evento", evento)
    .eq("publico", publico)
    .gte("created_at", umDiaAtras)
    .limit(1);
  if (existentes && existentes.length > 0) {
    return null; // já enviado, não duplica
  }

  // Renderiza mensagem
  const ctx: RenderContext = {
    ...contexto,
    transportadora: DEFAULT_BRANDING.nome_exibicao,
    assinatura: DEFAULT_BRANDING.assinatura_texto,
  };
  const mensagemRenderizada = renderizarMensagem(template, ctx);

  // Insere evento
  const { data, error } = await supabase
    .from("communication_events")
    .insert({
      ...rest,
      template_id: template.id,
      evento,
      publico,
      canal: canal || "simulation",
      status_envio: simulationMode ? "simulado" : "pendente",
      assunto: template.assunto || undefined,
      mensagem: mensagemRenderizada,
      payload: { contexto, template_codigo: template.codigo },
      sent_at: simulationMode ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.warn("[CommHub] Erro ao gerar evento:", error.message);
    return null;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO
// ═══════════════════════════════════════════════════════════════════════════════

export async function listarHistoricoPorOS(osId: string): Promise<CommunicationEvent[]> {
  const { data, error } = await supabase
    .from("communication_events")
    .select("*")
    .eq("os_id", osId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data || [];
}

export async function listarHistoricoPorCliente(clienteId: string, limit = 50): Promise<CommunicationEvent[]> {
  const { data, error } = await supabase
    .from("communication_events")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function listarTodosEventos(filtros?: {
  publico?: string;
  canal?: string;
  status?: string;
  limit?: number;
}): Promise<CommunicationEvent[]> {
  let query = supabase.from("communication_events").select("*");
  if (filtros?.publico) query = query.eq("publico", filtros.publico);
  if (filtros?.canal) query = query.eq("canal", filtros.canal);
  if (filtros?.status) query = query.eq("status_envio", filtros.status);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(filtros?.limit || 100);
  if (error) return [];
  return data || [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINKS PÚBLICOS DE RASTREAMENTO
// ═══════════════════════════════════════════════════════════════════════════════

export async function criarLinkPublico(osId: string, expiraEmDias = 30): Promise<TrackingPublicLink | null> {
  // Gera token único (UUID sem hífens + timestamp)
  const token = `${crypto.randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;
  const expiraEm = new Date(Date.now() + expiraEmDias * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("tracking_public_links")
    .insert({
      os_id: osId,
      token_publico: token,
      expira_em: expiraEm,
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    console.warn("[CommHub] Erro ao criar link público:", error.message);
    return null;
  }
  return data;
}

export async function obterOSPorToken(token: string): Promise<{
  os: any;
  alocacao: any;
  pod: any;
  link: TrackingPublicLink;
} | null> {
  // Busca o link
  const { data: link, error: linkErr } = await supabase
    .from("tracking_public_links")
    .select("*")
    .eq("token_publico", token)
    .eq("ativo", true)
    .single();

  if (linkErr || !link) return null;

  // Verifica expiração
  if (link.expira_em && new Date(link.expira_em) < new Date()) {
    await supabase.from("tracking_public_links").update({ ativo: false }).eq("id", link.id);
    return null;
  }

  // Atualiza contador de acessos
  await supabase
    .from("tracking_public_links")
    .update({ acessos: (link.acessos || 0) + 1, ultimo_acesso_em: new Date().toISOString() })
    .eq("id", link.id);

  // Busca dados da OS (apenas campos públicos, sem dados financeiros)
  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, status, data, origem, destino, observacoes_gerais")
    .eq("id", link.os_id)
    .single();

  // Busca alocação ativa (status, previsao, prestador nome)
  const { data: alocacao } = await supabase
    .from("alocacoes_escala")
    .select("id, status, finalizada, origem, destino, horario_inicio_real, horario_fim_real, data_finalizacao, prestador_id")
    .eq("ordem_servico_id", link.os_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Busca POD
  const { data: pod } = await supabase
    .from("entregas_protocolo")
    .select("id, nome_recebedor, data_hora_entrega, status")
    .eq("alocacao_id", alocacao?.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Busca nome do prestador (apenas nome, sem dados sensíveis)
  let prestadorNome = null;
  if (alocacao?.prestador_id) {
    const { data: pres } = await supabase
      .from("prestadores")
      .select("nome_completo")
      .eq("id", alocacao.prestador_id)
      .single();
    prestadorNome = pres?.nome_completo;
  }

  return {
    os: os ? { ...os, prestador_nome: prestadorNome } : null,
    alocacao,
    pod,
    link,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREFERÊNCIAS DE COMUNICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export async function obterPreferencias(clienteId?: string): Promise<CommunicationPreference | null> {
  const { data, error } = await supabase
    .from("communication_preferences")
    .select("*")
    .eq("ativo", true)
    .order("created_at")
    .limit(1);
  if (error || !data || data.length === 0) return null;

  // Se clienteId for fornecido, busca preferência específica
  if (clienteId) {
    const especifica = data.find(p => p.cliente_id === clienteId);
    if (especifica) return especifica;
  }

  // Fallback para preferência global (cliente_id = null)
  return data.find(p => !p.cliente_id) || data[0];
}

export async function atualizarPreferencias(
  clienteId: string | null,
  prefs: Partial<CommunicationPreference>
): Promise<boolean> {
  const { error } = await supabase
    .from("communication_preferences")
    .upsert({
      cliente_id: clienteId,
      ...prefs,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tenant_id, cliente_id" });
  return !error;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVENIÊNCIA: DISPARAR COMUNICAÇÃO POR EVENTO DE OPERAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export async function dispararComunicacaoOperacao(params: {
  evento: string;
  os_id?: string;
  alocacao_id?: string;
  cliente_id?: string;
  prestador_id?: string;
  contexto?: RenderContext;
}): Promise<{
  cliente: CommunicationEvent | null;
  destinatario: CommunicationEvent | null;
  prestador: CommunicationEvent | null;
}> {
  const { evento, ...rest } = params;
  const resultados = { cliente: null as CommunicationEvent | null, destinatario: null as CommunicationEvent | null, prestador: null as CommunicationEvent | null };

  // Verifica preferências
  const prefs = await obterPreferencias(params.cliente_id || undefined);
  const eventosPermitidos = prefs?.eventos_permitidos || [];

  // Cliente
  if (eventosPermitidos.length === 0 || eventosPermitidos.includes(evento)) {
    resultados.cliente = await gerarEventoComunicacao({
      ...rest,
      evento,
      publico: "cliente",
      canal: "simulation",
    });
  }

  // Destinatário
  if (eventosPermitidos.length === 0 || eventosPermitidos.includes(evento)) {
    resultados.destinatario = await gerarEventoComunicacao({
      ...rest,
      evento,
      publico: "destinatario",
      canal: "simulation",
    });
  }

  // Prestador
  if (eventosPermitidos.length === 0 || eventosPermitidos.includes(evento)) {
    resultados.prestador = await gerarEventoComunicacao({
      ...rest,
      evento,
      publico: "prestador",
      canal: "simulation",
    });
  }

  return resultados;
}
