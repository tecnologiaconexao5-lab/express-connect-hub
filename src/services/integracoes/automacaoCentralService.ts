export type SetorAutomacao = "operacional" | "prestadores" | "comercial" | "financeiro" | "gestao";

export type TipoEventoOperacional =
  | "OS_CRIADA"
  | "OS_ATUALIZADA"
  | "OS_SAIU_PARA_COLETA"
  | "OS_SAIU_PARA_ENTREGA"
  | "OS_EM_ROTA"
  | "OS_ENTREGUE"
  | "OS_ATRASADA";

export type TipoEventoPrestadores =
  | "PRESTADOR_NOVA_OPERACAO"
  | "PRESTADOR_CONFIRMAR_ESCALA"
  | "PRESTADOR_CONFIRMAR_PRESENCA"
  | "PRESTADOR_SEM_ATUALIZACAO"
  | "PRESTADOR_NOVO_ONBOARDING";

export type TipoEventoComercial =
  | "LEAD_NOVO"
  | "FOLLOWUP_PROPOSTA"
  | "CLIENTE_SEM_RETORNO"
  | "POS_ATENDIMENTO";

export type TipoEventoFinanceiro =
  | "CONTA_RECEBER_CRIADA"
  | "COBRANCA_VENCENDO"
  | "COBRANCA_ATRASADA"
  | "REPASSE_PRESTADOR_AVISO";

export type TipoEventoGestao =
  | "RESUMO_DIARIO"
  | "RESUMO_SEMANAL"
  | "ALERTA_OPERACIONAL";

export type TipoEvento =
  | TipoEventoOperacional
  | TipoEventoPrestadores
  | TipoEventoComercial
  | TipoEventoFinanceiro
  | TipoEventoGestao;

export interface AutomacaoPayload {
  setor: SetorAutomacao;
  tipoEvento: string;
  origemSistema: "TMS_CONEXAO_EXPRESS";
  dataEvento: string;
  entidadeId?: string;
  osId?: string;
  clienteId?: string;
  prestadorId?: string;
  telefoneCliente?: string;
  telefonePrestador?: string;
  dados: Record<string, unknown>;
}

export interface AutomacaoResult {
  sucesso: boolean;
  erro?: string;
  webhookUrl?: string;
}

const EVENTOS_VALIDOS: Record<SetorAutomacao, string[]> = {
  operacional: [
    "OS_CRIADA",
    "OS_ATUALIZADA",
    "OS_SAIU_PARA_COLETA",
    "OS_SAIU_PARA_ENTREGA",
    "OS_EM_ROTA",
    "OS_ENTREGUE",
    "OS_ATRASADA"
  ],
  prestadores: [
    "PRESTADOR_NOVA_OPERACAO",
    "PRESTADOR_CONFIRMAR_ESCALA",
    "PRESTADOR_CONFIRMAR_PRESENCA",
    "PRESTADOR_SEM_ATUALIZACAO",
    "PRESTADOR_NOVO_ONBOARDING"
  ],
  comercial: [
    "LEAD_NOVO",
    "FOLLOWUP_PROPOSTA",
    "CLIENTE_SEM_RETORNO",
    "POS_ATENDIMENTO"
  ],
  financeiro: [
    "CONTA_RECEBER_CRIADA",
    "COBRANCA_VENCENDO",
    "COBRANCA_ATRASADA",
    "REPASSE_PRESTADOR_AVISO"
  ],
  gestao: [
    "RESUMO_DIARIO",
    "RESUMO_SEMANAL",
    "ALERTA_OPERACIONAL"
  ]
};

export function getWebhookUrl(): string | undefined {
  return import.meta.env.VITE_N8N_WEBHOOK_OS;
}

export function validarEvento(evento: AutomacaoPayload): { valido: boolean; erro?: string } {
  if (!evento.setor || !EVENTOS_VALIDOS[evento.setor]) {
    return { valido: false, erro: `Setor inválido: ${evento.setor}` };
  }

  if (!evento.tipoEvento) {
    return { valido: false, erro: "tipoEvento é obrigatório" };
  }

  const eventosSetor = EVENTOS_VALIDOS[evento.setor as SetorAutomacao] || [];
  if (!eventosSetor.includes(evento.tipoEvento)) {
    return {
      valido: false,
      erro: `Evento '${evento.tipoEvento}' não é válido para o setor '${evento.setor}'. Eventos válidos: ${eventosSetor.join(", ")}`
    };
  }

  return { valido: true };
}

export async function disparaEventoAutomacao(
  setor: SetorAutomacao,
  tipoEvento: string,
  dados: Record<string, unknown> = {},
  adicional?: {
    entidadeId?: string;
    osId?: string;
    clienteId?: string;
    prestadorId?: string;
    telefoneCliente?: string;
    telefonePrestador?: string;
  }
): Promise<AutomacaoResult> {
  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    console.warn("[AutomacaoCentral] Webhook não configurado no .env (VITE_N8N_WEBHOOK_OS). Pulando automação.");
    return { sucesso: false, erro: "Webhook não configurado" };
  }

  const payload: AutomacaoPayload = {
    setor,
    tipoEvento,
    origemSistema: "TMS_CONEXAO_EXPRESS",
    dataEvento: new Date().toISOString(),
    dados,
    ...adicional
  };

  const validacao = validarEvento(payload);
  if (!validacao.valido) {
    console.warn(`[AutomacaoCentral] Evento inválido: ${validacao.erro}`);
    return { sucesso: false, erro: validacao.erro };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      console.error(`[AutomacaoCentral] n8n retornou erro: ${errorText}`);
      return { sucesso: false, erro: `HTTP ${response.status}`, webhookUrl };
    }

    console.log(`[AutomacaoCentral] Evento '${tipoEvento}' disparado com sucesso para o setor '${setor}'`);
    return { sucesso: true, webhookUrl };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro de conexão";
    console.error(`[AutomacaoCentral] Falha ao disparar evento: ${msg}`);
    return { sucesso: false, erro: msg, webhookUrl };
  }
}

export function getEventosPorSetor(setor: string): string[] {
  return EVENTOS_VALIDOS[setor as SetorAutomacao] || [];
}

export function getTodosEventos(): Record<string, string[]> {
  return { ...EVENTOS_VALIDOS };
}