import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";
import { governancaService } from "@/services/ia/governancaService";
import { identidadeService } from "@/services/ia/identidadeService";

// @deprecated — 100% SIMULADO. Substituido por actionEngineService + conectoresService. Manter apenas para compatibilidade com callers existentes.
// ==================== TYPES ====================

export type CanalIntegracao = "whatsapp" | "email" | "zoho_mail" | "crm" | "leads" | "google_ads" | "meta_ads" | "api_externa" | "webhook";
export type CategoriaIntegracao = "comunicacao" | "comercial" | "marketing" | "operacao";
export type StatusIntegracao = "simulada" | "bloqueada_governanca" | "bloqueada_identidade" | "erro";

export interface IntencaoIntegracao {
  canal: CanalIntegracao;
  acao: string;
  payload: Record<string, unknown>;
  entidade_tipo?: string;
  entidade_id?: string;
}

export interface ResultadoIntegracao {
  sucesso: boolean;
  status: StatusIntegracao;
  canal: CanalIntegracao;
  acao: string;
  payload_original: Record<string, unknown>;
  payload_mockado: Record<string, unknown>;
  duracao_ms: number;
  log_id: string | null;
  motivo?: string;
}

export interface CanalConfig {
  nome: string;
  categoria: CategoriaIntegracao;
  acoes_suportadas: string[];
  mock_responses: Record<string, (payload: Record<string, unknown>) => Record<string, unknown>>;
}

export interface ContextoCanais {
  canais_disponiveis: string;
  modo_seguro_ativo: boolean;
  total_canais: number;
  total_acoes_suportadas: number;
}

// ==================== CANAIS (FASE 3 — TODOS SIMULADOS, SEM HARDCODE) ====================

function mockEnvioMensagem(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "Mensagem simulada em modo seguro — nenhum disparo real foi executado",
    destino: payload.para || payload.destino || payload.telefone || "não informado",
    conteudo: (payload.mensagem || payload.texto || "").toString().slice(0, 80),
    timestamp: new Date().toISOString(),
  };
}

function mockEnvioEmail(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "E-mail simulado em modo seguro — nenhum envio real foi executado",
    para: payload.para || payload.destino || "não informado",
    assunto: (payload.assunto || payload.subject || "").toString().slice(0, 80),
    timestamp: new Date().toISOString(),
  };
}

function mockRegistroCRM(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "Registro em CRM simulado — nenhuma API externa foi chamada",
    entidade: payload.nome || payload.entidade || payload.cliente || "não informado",
    tipo: payload.tipo || "lead",
    dados_recebidos: Object.keys(payload).length,
    timestamp: new Date().toISOString(),
  };
}

function mockLead(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "Lead simulado em modo seguro — nenhuma integração real com CRM de leads foi executada",
    lead: payload.nome || payload.email || payload.telefone || "não informado",
    origem: payload.origem || "modo_seguro",
    timestamp: new Date().toISOString(),
  };
}

function mockAnuncio(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "Anúncio simulado em modo seguro — nenhum gasto real foi gerado",
    plataforma: payload.plataforma || "não informado",
    campanha: payload.campanha || payload.nome || "não informado",
    orcamento_simulado: payload.orcamento || 0,
    timestamp: new Date().toISOString(),
  };
}

function mockAPIExterna(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "Chamada a API externa simulada — nenhuma requisição HTTP real foi feita",
    url: payload.url || payload.endpoint || "não informado",
    metodo: payload.metodo || payload.method || "GET",
    timestamp: new Date().toISOString(),
  };
}

function mockWebhook(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    status: "simulado",
    mensagem: "Webhook simulado em modo seguro — nenhum disparo externo foi executado",
    url: payload.url || payload.webhook_url || "não informado",
    evento: payload.evento || payload.tipo || "generico",
    timestamp: new Date().toISOString(),
  };
}

const CANAIS_CONFIG: Record<CanalIntegracao, CanalConfig> = {
  whatsapp: {
    nome: "WhatsApp",
    categoria: "comunicacao",
    acoes_suportadas: ["enviar_mensagem", "enviar_texto", "enviar_midia", "status_conexao"],
    mock_responses: { enviar_mensagem: mockEnvioMensagem, enviar_texto: mockEnvioMensagem, enviar_midia: mockEnvioMensagem, status_conexao: () => ({ status: "conectado", modo: "simulado" }) },
  },
  email: {
    nome: "E-mail (SMTP)",
    categoria: "comunicacao",
    acoes_suportadas: ["enviar_email", "enviar_email_html", "enviar_email_anexo"],
    mock_responses: { enviar_email: mockEnvioEmail, enviar_email_html: mockEnvioEmail, enviar_email_anexo: mockEnvioEmail },
  },
  zoho_mail: {
    nome: "Zoho Mail",
    categoria: "comunicacao",
    acoes_suportadas: ["enviar_email", "listar_emails", "criar_rascunho"],
    mock_responses: { enviar_email: mockEnvioEmail, listar_emails: () => ({ status: "simulado", emails: [], total: 0 }), criar_rascunho: mockEnvioEmail },
  },
  crm: {
    nome: "CRM",
    categoria: "comercial",
    acoes_suportadas: ["criar_cliente", "atualizar_cliente", "criar_oportunidade", "buscar_cliente"],
    mock_responses: { criar_cliente: mockRegistroCRM, atualizar_cliente: mockRegistroCRM, criar_oportunidade: mockRegistroCRM, buscar_cliente: () => ({ status: "simulado", encontrado: false }) },
  },
  leads: {
    nome: "Leads",
    categoria: "comercial",
    acoes_suportadas: ["capturar_lead", "qualificar_lead", "transferir_lead", "listar_leads"],
    mock_responses: { capturar_lead: mockLead, qualificar_lead: mockLead, transferir_lead: mockLead, listar_leads: () => ({ status: "simulado", leads: [], total: 0 }) },
  },
  google_ads: {
    nome: "Google Ads",
    categoria: "marketing",
    acoes_suportadas: ["criar_campanha", "pausar_campanha", "obter_metricas", "criar_anuncio"],
    mock_responses: { criar_campanha: mockAnuncio, pausar_campanha: () => ({ status: "pausado_simulado" }), obter_metricas: () => ({ status: "simulado", metricas: { impressoes: 0, cliques: 0, conversoes: 0, gasto: 0 } }), criar_anuncio: mockAnuncio },
  },
  meta_ads: {
    nome: "Meta Ads",
    categoria: "marketing",
    acoes_suportadas: ["criar_campanha", "criar_anuncio", "obter_metricas", "agendar_post"],
    mock_responses: { criar_campanha: mockAnuncio, criar_anuncio: mockAnuncio, obter_metricas: () => ({ status: "simulado", metricas: { alcance: 0, engajamento: 0 } }), agendar_post: () => ({ status: "agendado_simulado" }) },
  },
  api_externa: {
    nome: "API Externa",
    categoria: "operacao",
    acoes_suportadas: ["get", "post", "put", "delete", "consultar", "enviar_dados"],
    mock_responses: { get: mockAPIExterna, post: mockAPIExterna, put: mockAPIExterna, delete: mockAPIExterna, consultar: mockAPIExterna, enviar_dados: mockAPIExterna },
  },
  webhook: {
    nome: "Webhook",
    categoria: "operacao",
    acoes_suportadas: ["disparar", "notificar", "callback", "enviar_evento"],
    mock_responses: { disparar: mockWebhook, notificar: mockWebhook, callback: () => ({ status: "simulado", recebido: true }), enviar_evento: mockWebhook },
  },
};

function encontrarAcaoMock(canal: CanalConfig, acao: string): ((payload: Record<string, unknown>) => Record<string, unknown>) | null {
  const exact = canal.mock_responses[acao];
  if (exact) return exact;
  for (const [key, fn] of Object.entries(canal.mock_responses)) {
    if (acao.toLowerCase().includes(key.toLowerCase())) return fn;
  }
  return null;
}

// ==================== ENGINE (FASE 2) ====================

async function registrarLogIntegracao(params: {
  robo_id: string;
  sessao_id?: string | null;
  canal: CanalIntegracao;
  categoria: CategoriaIntegracao;
  acao: string;
  payload: Record<string, unknown>;
  payload_mockado: Record<string, unknown>;
  status: StatusIntegracao;
  governanca_decisao?: string;
  identidade_status?: string;
  duracao_ms: number;
  erro?: string;
}): Promise<string | null> {
  const { data } = await supabase.from("ia_integracoes_externas_logs").insert({
    robo_id: params.robo_id,
    sessao_id: params.sessao_id || null,
    canal: params.canal,
    categoria: params.categoria,
    acao: params.acao,
    payload: params.payload,
    payload_mockado: params.payload_mockado,
    status: params.status,
    governanca_decisao: params.governanca_decisao || null,
    identidade_status: params.identidade_status || null,
    duracao_ms: params.duracao_ms,
    erro: params.erro || null,
  }).select().single();
  return data?.id || null;
}

async function executarIntegracao(params: {
  roboId: string;
  sessaoId?: string;
  intencao: IntencaoIntegracao;
}): Promise<ResultadoIntegracao> {
  const inicio = Date.now();
  const { roboId, sessaoId, intencao } = params;

  // Valida canal
  const canalConfig = CANAIS_CONFIG[intencao.canal];
  if (!canalConfig) {
    return {
      sucesso: false, status: "erro", canal: intencao.canal,
      acao: intencao.acao, payload_original: intencao.payload,
      payload_mockado: {}, duracao_ms: Date.now() - inicio,
      log_id: null, motivo: `Canal ${intencao.canal} não suportado`,
    };
  }

  // F35: Valida governança
  const govAvaliacao = await governancaService.avaliarAcao({
    roboId, acaoTipo: `${intencao.canal}_${intencao.acao}`,
    valor: (intencao.payload.valor as number) || (intencao.payload.valor_financeiro as number) || 0,
    contexto: { ...intencao.payload, canal: intencao.canal, integracao_externa: true },
  });
  if (!govAvaliacao.permitido) {
    const duracao = Date.now() - inicio;
    const logId = await registrarLogIntegracao({
      robo_id: roboId, sessao_id: sessaoId,
      canal: intencao.canal, categoria: canalConfig.categoria,
      acao: intencao.acao, payload: intencao.payload,
      payload_mockado: {}, status: "bloqueada_governanca",
      governanca_decisao: govAvaliacao.motivo,
      duracao_ms: duracao,
    });
    return {
      sucesso: false, status: "bloqueada_governanca",
      canal: intencao.canal, acao: intencao.acao,
      payload_original: intencao.payload, payload_mockado: {},
      duracao_ms: duracao, log_id: logId,
      motivo: govAvaliacao.motivo,
    };
  }

  // F36: Valida identidade
  let identidadeStatus = "ok";
  try {
    const identidade = await identidadeService.obterIdentidade(roboId);
    if (identidade && (identidade.status === "bloqueada" || identidade.status === "inativa")) {
      identidadeStatus = `${identidade.status}`;
      const duracao = Date.now() - inicio;
      const logId = await registrarLogIntegracao({
        robo_id: roboId, sessao_id: sessaoId,
        canal: intencao.canal, categoria: canalConfig.categoria,
        acao: intencao.acao, payload: intencao.payload,
        payload_mockado: {}, status: "bloqueada_identidade",
        identidade_status: identidadeStatus,
        duracao_ms: duracao,
      });
      return {
        sucesso: false, status: "bloqueada_identidade",
        canal: intencao.canal, acao: intencao.acao,
        payload_original: intencao.payload, payload_mockado: {},
        duracao_ms: duracao, log_id: logId,
        motivo: `Identidade ${identidade.nome_operacional} está ${identidade.status}`,
      };
    }
    if (identidade) identidadeStatus = `ativa (${identidade.perfil})`;
  } catch { identidadeStatus = "nao_configurada"; }

  // MODO SEGURO: Simula a integração
  const mockFn = encontrarAcaoMock(canalConfig, intencao.acao);
  const payloadMockado = mockFn ? mockFn(intencao.payload) : { status: "simulado", mensagem: `Ação ${intencao.acao} simulada em modo seguro`, canal: intencao.canal };

  const duracao = Date.now() - inicio;
  const logId = await registrarLogIntegracao({
    robo_id: roboId, sessao_id: sessaoId,
    canal: intencao.canal, categoria: canalConfig.categoria,
    acao: intencao.acao, payload: intencao.payload,
    payload_mockado: payloadMockado, status: "simulada",
    governanca_decisao: govAvaliacao.motivo,
    identidade_status: identidadeStatus,
    duracao_ms: duracao,
  });

  void centralIaService.registrarLog({
    robo_id: roboId, acao: "integracao_externa_simulada",
    entrada: { canal: intencao.canal, acao: intencao.acao, payload: intencao.payload },
    saida: { status: "simulada", log_id: logId, payload_mockado: payloadMockado },
    status: "info",
  });

  return {
    sucesso: true, status: "simulada",
    canal: intencao.canal, acao: intencao.acao,
    payload_original: intencao.payload,
    payload_mockado: payloadMockado,
    duracao_ms: duracao,
    log_id: logId,
  };
}

// ==================== CONTEXTO PARA F34A (FASE 7) ====================

function montarContextoCanais(): ContextoCanais {
  const canaisInfo = Object.entries(CANAIS_CONFIG).map(([key, cfg]) => {
    const acoes = cfg.acoes_suportadas.map(a => `    - ${a}`).join("\n");
    return `  [${key}] ${cfg.nome} (${cfg.categoria})\n    Ações suportadas:\n${acoes}`;
  }).join("\n\n");

  const totalAcoes = Object.values(CANAIS_CONFIG).reduce((acc, cfg) => acc + cfg.acoes_suportadas.length, 0);

  return {
    canais_disponiveis: canaisInfo,
    modo_seguro_ativo: true,
    total_canais: Object.keys(CANAIS_CONFIG).length,
    total_acoes_suportadas: totalAcoes,
  };
}

function montarContextoIntegracoes(): string {
  const ctx = montarContextoCanais();
  const linhas: string[] = [];
  linhas.push("=== INTEGRAÇÕES EXTERNAS DISPONÍVEIS ===");
  linhas.push("⚠️  MODO SEGURO ATIVO — Nenhuma integração real será executada.");
  linhas.push("Todas as ações externas são simuladas, registradas e auditáveis.");
  linhas.push("");
  linhas.push(`Total de canais: ${ctx.total_canais}`);
  linhas.push(`Total de ações suportadas: ${ctx.total_acoes_suportadas}`);
  linhas.push("");
  linhas.push(ctx.canais_disponiveis);
  linhas.push("");
  linhas.push("Para usar um canal, especifique:");
  linhas.push('  - canal: o identificador do canal (ex: "whatsapp", "email", "crm")');
  linhas.push('  - acao: a ação desejada (ex: "enviar_mensagem", "criar_cliente")');
  linhas.push('  - payload: objeto com os parâmetros necessários');
  linhas.push("");
  linhas.push("REGRAS:");
  linhas.push("- Considere as restrições da governança ao escolher um canal.");
  linhas.push("- Considere a identidade do robô (perfil) ao selecionar canais compatíveis.");
  linhas.push("- Ações fora do escopo do perfil do robô precisam de aprovação.");
  return linhas.join("\n");
}

// ==================== EXPORTS ====================

export const externalIntegrationEngine = {
  executarIntegracao,
  montarContextoCanais,
  montarContextoIntegracoes,
  CANAIS_CONFIG,
};
