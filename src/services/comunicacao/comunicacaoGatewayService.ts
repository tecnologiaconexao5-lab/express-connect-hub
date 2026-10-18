import { supabase } from "@/lib/supabase";
import { centralIaService, type AutoLog } from "@/services/centralIaService";

function getEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env[key]?.trim();
  return process.env[key]?.trim();
}

function isProducaoAssistida(): boolean {
  return getEnv("VITE_COMUNICACAO_PRODUCAO_ASSISTIDA") === "true";
}

function isWhatsAppProducaoEnabled(): boolean {
  return getEnv("VITE_WHATSAPP_PRODUCAO_ENABLED") === "true";
}

function getAllowedSetores(): string[] {
  return (getEnv("VITE_WHATSAPP_ALLOWED_SETORES") || "operacional").split(",").map(s => s.trim());
}

function getDailyLimit(): number {
  return parseInt(getEnv("VITE_WHATSAPP_DAILY_LIMIT") || "10", 10);
}

function getAllowedHours(): { start: number; end: number } {
  const start = parseInt((getEnv("VITE_WHATSAPP_ALLOWED_HOURS_START") || "08:00").split(":")[0], 10);
  const end = parseInt((getEnv("VITE_WHATSAPP_ALLOWED_HOURS_END") || "18:00").split(":")[0], 10);
  return { start, end };
}

function hasEvolutionConfig(): boolean {
  return !!(
    getEnv("VITE_EVOLUTION_API_URL") &&
    getEnv("VITE_EVOLUTION_API_KEY") &&
    getEnv("VITE_EVOLUTION_INSTANCE")
  );
}

const TERMOS_PROIBIDOS = [
  "sou rob\u00f4", "sou uma IA", "sou intelig\u00eancia artificial",
  "sou humano", "sou atendente humano",
];
const FALLBACK_MSG = "Vou direcionar para o respons\u00e1vel pelo setor e j\u00e1 retorno com uma posi\u00e7\u00e3o.";

export interface GatewayValidation {
  valido: boolean;
  motivo?: string;
  motivoCodigo?: string;
}

export interface GatewaySendPayload {
  telefone: string;
  mensagem: string;
  setor: string;
  origem_tipo: string;
  origem_id: string;
  aprovacao_id: string;
  tarefa_id: string;
  robo_id?: string;
  destinatario_tipo: string;
  destinatario_nome?: string;
  ambiente?: string;
}

export interface GatewaySendResult {
  sucesso: boolean;
  status: string;
  provider_message_id?: string | null;
  mensagem_id?: string;
  log_id?: string;
  motivo?: string;
  motivoCodigo?: string;
}

export const comunicacaoGatewayService = {

  validarPermissaoEnvio(): GatewayValidation {
    if (!isProducaoAssistida()) {
      return { valido: false, motivo: "Produ\u00e7\u00e3o assistida desligada", motivoCodigo: "PRODUCAO_ASSISTIDA_DISABLED" };
    }
    if (!isWhatsAppProducaoEnabled()) {
      return { valido: false, motivo: "WhatsApp produ\u00e7\u00e3o desligado", motivoCodigo: "WHATSAPP_PRODUCAO_DISABLED" };
    }
    return { valido: true };
  },

  validarSetorPermitido(setor: string): GatewayValidation {
    const setores = getAllowedSetores();
    if (!setores.includes(setor.toLowerCase())) {
      return { valido: false, motivo: `Setor "${setor}" n\u00e3o permitido`, motivoCodigo: "SETOR_NOT_ALLOWED" };
    }
    return { valido: true };
  },

  validarHorarioPermitido(): GatewayValidation {
    const { start, end } = getAllowedHours();
    const hora = new Date().getHours();
    if (hora < start || hora >= end) {
      return {
        valido: false,
        motivo: `Fora do hor\u00e1rio permitido (${String(start).padStart(2, "0")}:00 - ${String(end).padStart(2, "0")}:00)`,
        motivoCodigo: "HOURS_NOT_ALLOWED",
      };
    }
    return { valido: true };
  },

  async validarLimiteEnvio(): Promise<GatewayValidation> {
    const limit = getDailyLimit();
    const hoje = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("comunicacoes_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("canal", "whatsapp")
      .in("status", ["enviado_homologacao", "enviado"])
      .gte("criado_em", hoje);
    const usado = count || 0;
    if (usado >= limit) {
      return {
        valido: false,
        motivo: `Limite di\u00e1rio excedido (${usado}/${limit})`,
        motivoCodigo: "DAILY_LIMIT_EXCEEDED",
      };
    }
    return { valido: true };
  },

  async validarDestinatario(telefone: string, setor: string, ambiente?: string): Promise<GatewayValidation> {
    const apenasNumeros = telefone.replace(/\D/g, "");
    const amb = ambiente || "producao_assistida";
    const { data } = await supabase
      .from("comunicacoes_destinatarios_autorizados")
      .select("id, permitido, ambiente, telefone")
      .eq("canal", "whatsapp")
      .eq("setor", setor.toLowerCase())
      .eq("ambiente", amb)
      .eq("permitido", true);
    const autorizado = (data || []).some((d: any) => d.telefone?.replace(/\D/g, "") === apenasNumeros);
    if (!autorizado) {
      return {
        valido: false,
        motivo: "Destinat\u00e1rio n\u00e3o autorizado para produ\u00e7\u00e3o assistida",
        motivoCodigo: "DESTINATARIO_NOT_AUTHORIZED",
      };
    }
    return { valido: true };
  },

  validarMensagemSegura(conteudo: string): GatewayValidation {
    const lower = conteudo.toLowerCase();
    for (const termo of TERMOS_PROIBIDOS) {
      if (lower.includes(termo)) {
        return { valido: false, motivo: `Mensagem cont\u00e9m termo proibido: "${termo}"`, motivoCodigo: "MESSAGE_BLOCKED" };
      }
    }
    if (!conteudo.includes(FALLBACK_MSG)) {
      return { valido: false, motivo: "Mensagem n\u00e3o cont\u00e9m fallback obrigat\u00f3rio.", motivoCodigo: "MISSING_FALLBACK" };
    }
    return { valido: true };
  },

  mascararTelefone(telefone: string): string {
    if (telefone.length <= 4) return "****";
    return telefone.slice(0, 2) + "****" + telefone.slice(-4);
  },

  async registrarMensagem(params: {
    telefone: string;
    mensagem: string;
    setor: string;
    origem_tipo: string;
    origem_id: string;
    tarefa_id: string;
    robo_id?: string;
    aprovacao_id?: string;
    status: string;
    provider_message_id?: string | null;
    motivo_bloqueio?: string;
    erro?: string;
    modo_seguro?: boolean;
    modo_homologacao?: boolean;
  }): Promise<{ mensagem_id?: string; log_id?: string }> {
    const telefoneMascarado = this.mascararTelefone(params.telefone);
    const { data: msg } = await supabase
      .from("comunicacoes_mensagens")
      .insert({
        robo_id: params.robo_id || null,
        tarefa_id: params.tarefa_id,
        origem_tipo: params.origem_tipo,
        origem_id: params.origem_id,
        destinatario_tipo: "setor",
        destinatario_nome: null,
        canal: "whatsapp",
        assunto: `Produ\u00e7\u00e3o Assistida - ${params.setor}`,
        conteudo: params.mensagem,
        status: params.status,
        modo_seguro: params.modo_seguro ?? false,
        modo_homologacao: params.modo_homologacao ?? false,
        provider_message_id: params.provider_message_id || null,
        motivo_bloqueio: params.motivo_bloqueio || null,
        contexto: { telefone_mascarado: telefoneMascarado, setor: params.setor, aprovacao_id: params.aprovacao_id, fallback: FALLBACK_MSG },
      })
      .select("id")
      .single();
    const logAcao = params.status === "bloqueado" ? "whatsapp_producao_bloqueado" : params.status === "enviado" ? "whatsapp_producao_enviado" : "whatsapp_producao_erro";
    await centralIaService.registrarLog({
      robo_id: params.robo_id || undefined,
      tarefa_id: params.tarefa_id,
      acao: logAcao,
      entrada: { telefone_mascarado: telefoneMascarado, status: params.status, motivo_bloqueio: params.motivo_bloqueio },
      saida: { provider_message_id: params.provider_message_id, mensagem_id: msg?.id },
      status: params.status === "enviado" ? "sucesso" : "aviso",
      erro: params.erro || undefined,
    });
    return { mensagem_id: msg?.id };
  },

  // ============================================================
  // solicitarEnvioControlado (F25B) — gateway obrigatório
  // ============================================================
  async solicitarEnvioControlado(params: {
    canal: string;
    setor: string;
    origem_tipo: string;
    origem_id: string;
    destinatario_tipo: string;
    destinatario_nome?: string;
    destinatario_telefone?: string;
    mensagem: string;
    robo_id?: string;
    tarefa_id?: string;
    aprovacao_id?: string;
  }): Promise<GatewaySendResult> {
    const FALLBACK_MSG = "Vou direcionar para o respons\u00e1vel pelo setor e j\u00e1 retorno com uma posi\u00e7\u00e3o.";

    // 1. Validar mensagem segura (fallback + termos proibidos)
    const msgSegura = this.validarMensagemSegura(params.mensagem);
    if (!msgSegura.valido) {
      const r = await this.registrarMensagem({
        telefone: params.destinatario_telefone || "",
        mensagem: params.mensagem,
        setor: params.setor,
        origem_tipo: params.origem_tipo,
        origem_id: params.origem_id,
        tarefa_id: params.tarefa_id || "",
        robo_id: params.robo_id,
        aprovacao_id: params.aprovacao_id,
        status: "bloqueado",
        provider_message_id: null,
        modo_seguro: true,
        motivo_bloqueio: msgSegura.motivo,
      });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, motivo: msgSegura.motivo, motivoCodigo: msgSegura.motivoCodigo };
    }

    // 2. Verificar se existe aprovação humana (pender se não tiver)
    if (!params.aprovacao_id && !params.tarefa_id) {
      const r = await this.registrarMensagem({
        telefone: params.destinatario_telefone || "",
        mensagem: params.mensagem,
        setor: params.setor,
        origem_tipo: params.origem_tipo,
        origem_id: params.origem_id,
        tarefa_id: "",
        robo_id: params.robo_id,
        status: "aguardando_aprovacao",
        provider_message_id: null,
        modo_seguro: true,
        motivo_bloqueio: "Aguardando aprovação humana",
      });
      return { sucesso: false, status: "aguardando_aprovacao", mensagem_id: r.mensagem_id, motivo: "Aguardando aprovação humana", motivoCodigo: "NEEDS_HUMAN_APPROVAL" };
    }

    // 3. Validar modo seguro/homologação/produção assistida
    const permissao = this.validarPermissaoEnvio();
    if (!permissao.valido) {
      const r = await this.registrarMensagem({
        telefone: params.destinatario_telefone || "",
        mensagem: params.mensagem,
        setor: params.setor,
        origem_tipo: params.origem_tipo,
        origem_id: params.origem_id,
        tarefa_id: params.tarefa_id || "",
        robo_id: params.robo_id,
        aprovacao_id: params.aprovacao_id,
        status: "bloqueado",
        provider_message_id: null,
        modo_seguro: true,
        motivo_bloqueio: permissao.motivo,
      });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, motivo: permissao.motivo, motivoCodigo: permissao.motivoCodigo };
    }

    // 4. Validar horário
    const horario = this.validarHorarioPermitido();
    if (!horario.valido) {
      const r = await this.registrarMensagem({
        ...params,
        telefone: params.destinatario_telefone || "",
        mensagem: params.mensagem,
        tarefa_id: params.tarefa_id || "",
        status: "bloqueado",
        provider_message_id: null,
        modo_seguro: true,
        motivo_bloqueio: horario.motivo,
      });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, motivo: horario.motivo, motivoCodigo: horario.motivoCodigo };
    }

    // 5. Validar limite diário
    const limite = await this.validarLimiteEnvio();
    if (!limite.valido) {
      const r = await this.registrarMensagem({
        ...params,
        telefone: params.destinatario_telefone || "",
        mensagem: params.mensagem,
        tarefa_id: params.tarefa_id || "",
        status: "bloqueado",
        provider_message_id: null,
        modo_seguro: true,
        motivo_bloqueio: limite.motivo,
      });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, motivo: limite.motivo, motivoCodigo: limite.motivoCodigo };
    }

    // 6. Validar destinatário autorizado
    if (params.destinatario_telefone) {
      const destVal = await this.validarDestinatario(params.destinatario_telefone, params.setor);
      if (!destVal.valido) {
        const r = await this.registrarMensagem({
          ...params,
          telefone: params.destinatario_telefone,
          mensagem: params.mensagem,
          tarefa_id: params.tarefa_id || "",
          status: "bloqueado",
          provider_message_id: null,
          modo_seguro: true,
          motivo_bloqueio: destVal.motivo,
        });
        return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, motivo: destVal.motivo, motivoCodigo: destVal.motivoCodigo };
      }
    }

    // 7. Tudo válido — registrar como simulado (sem enviar real)
    const r = await this.registrarMensagem({
      ...params,
      telefone: params.destinatario_telefone || "",
      mensagem: params.mensagem,
      tarefa_id: params.tarefa_id || "",
      status: "simulado",
      provider_message_id: null,
      modo_seguro: true,
    });

    return { sucesso: true, status: "simulado", mensagem_id: r.mensagem_id, motivo: "Mensagem registrada em modo seguro. Nenhum envio real foi feito." };
  },

  async enviarWhatsAppControlado(payload: GatewaySendPayload): Promise<GatewaySendResult> {
    const permissao = this.validarPermissaoEnvio();
    if (!permissao.valido) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: permissao.motivo });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: permissao.motivo, motivoCodigo: permissao.motivoCodigo };
    }
    const setorVal = this.validarSetorPermitido(payload.setor);
    if (!setorVal.valido) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: setorVal.motivo });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: setorVal.motivo, motivoCodigo: setorVal.motivoCodigo };
    }
    const horario = this.validarHorarioPermitido();
    if (!horario.valido) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: horario.motivo });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: horario.motivo, motivoCodigo: horario.motivoCodigo };
    }
    const limite = await this.validarLimiteEnvio();
    if (!limite.valido) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: limite.motivo });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: limite.motivo, motivoCodigo: limite.motivoCodigo };
    }
    const msgSegura = this.validarMensagemSegura(payload.mensagem);
    if (!msgSegura.valido) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: msgSegura.motivo });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: msgSegura.motivo, motivoCodigo: msgSegura.motivoCodigo };
    }
    const destVal = await this.validarDestinatario(payload.telefone, payload.setor, payload.ambiente);
    if (!destVal.valido) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: destVal.motivo });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: destVal.motivo, motivoCodigo: destVal.motivoCodigo };
    }
    if (!hasEvolutionConfig()) {
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", motivo_bloqueio: "Evolution API n\u00e3o configurada", erro: "VITE_EVOLUTION_API_URL/KEY/INSTANCE ausentes" });
      return { sucesso: false, status: "bloqueado", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: "Evolution API n\u00e3o configurada", motivoCodigo: "EVOLUTION_NOT_CONFIGURED" };
    }
    try {
      const evolutionUrl = (getEnv("VITE_EVOLUTION_API_URL") || "").replace(/\/+$/, "");
      const evolutionKey = getEnv("VITE_EVOLUTION_API_KEY") || "";
      const evolutionInstance = getEnv("VITE_EVOLUTION_INSTANCE") || "";
      const response = await fetch(`${evolutionUrl}/message/sendText/${evolutionInstance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apiKey: evolutionKey },
        body: JSON.stringify({ number: payload.telefone, text: payload.mensagem, delay: 1200 }),
      });
      if (!response.ok) {
        const erroText = await response.text().catch(() => "Erro desconhecido");
        const r = await this.registrarMensagem({ ...payload, status: "bloqueado", erro: `Evolution API retornou ${response.status}: ${erroText.slice(0, 200)}`, motivo_bloqueio: `Erro Evolution: ${response.status}` });
        return { sucesso: false, status: "erro", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: `Evolution API erro ${response.status}`, motivoCodigo: "EVOLUTION_API_ERROR" };
      }
      const responseData = await response.json().catch(() => ({}));
      const providerMessageId = responseData?.key?.id || responseData?.id || null;
      const r = await this.registrarMensagem({ ...payload, status: "enviado", provider_message_id: providerMessageId, modo_seguro: false, modo_homologacao: false });
      return { sucesso: true, status: "enviado", provider_message_id: providerMessageId, mensagem_id: r.mensagem_id, log_id: r.log_id };
    } catch (err) {
      const erroMsg = err instanceof Error ? err.message : "Erro desconhecido";
      const r = await this.registrarMensagem({ ...payload, status: "bloqueado", erro: erroMsg.slice(0, 500), motivo_bloqueio: erroMsg.slice(0, 200) });
      return { sucesso: false, status: "erro", mensagem_id: r.mensagem_id, log_id: r.log_id, motivo: erroMsg, motivoCodigo: "NETWORK_ERROR" };
    }
  },
};
