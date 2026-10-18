import { supabase } from "@/lib/supabase";
import { centralIaService } from "@/services/centralIaService";

const TERMOS_PROIBIDOS = [
  "sou rob\u00f4", "sou uma IA", "sou intelig\u00eancia artificial",
  "sou humano", "sou atendente humano",
];

const FALLBACK_MSG = "Vou direcionar para o respons\u00e1vel pelo setor e j\u00e1 retorno com uma posi\u00e7\u00e3o.";

const ASSINATURAS_PERMITIDAS = [
  "Opera\u00e7\u00e3o Conex\u00e3o Express",
  "Comercial Conex\u00e3o Express",
  "Financeiro Conex\u00e3o Express",
  "Suporte ao Prestador",
  "Atendimento Conex\u00e3o Express",
];

function getEnv(key: string): string | undefined {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key]?.trim();
  }
  return process.env[key]?.trim();
}

function homologEnabled(): boolean {
  return getEnv("VITE_WHATSAPP_HOMOLOG_ENABLED") === "true";
}

function getAllowlist(): string[] {
  const raw = getEnv("VITE_WHATSAPP_HOMOLOG_ALLOWLIST") || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function mascararTelefone(telefone: string): string {
  if (telefone.length <= 4) return "****";
  return telefone.slice(0, 2) + "****" + telefone.slice(-4);
}

export function telefoneEstaNaAllowlist(telefone: string): boolean {
  const apenasNumeros = telefone.replace(/\D/g, "");
  const allowlist = getAllowlist();
  return allowlist.some((t) => {
    const tLimpo = t.replace(/\D/g, "");
    return tLimpo === apenasNumeros;
  });
}

export function validarMensagemSegura(conteudo: string): {
  valida: boolean;
  motivo?: string;
} {
  const lower = conteudo.toLowerCase();
  for (const termo of TERMOS_PROIBIDOS) {
    if (lower.includes(termo)) {
      return { valida: false, motivo: `Mensagem cont\u00e9m termo proibido: "${termo}"` };
    }
  }
  if (!conteudo.includes(FALLBACK_MSG)) {
    return { valida: false, motivo: "Mensagem n\u00e3o cont\u00e9m fallback obrigat\u00f3rio." };
  }
  return { valida: true };
}

export interface HomologValidationResult {
  podeEnviar: boolean;
  motivo?: string;
  motivoCodigo?: string;
}

export function validarWhatsAppHomologacao(
  telefone: string,
  conteudo: string
): HomologValidationResult {
  if (!homologEnabled()) {
    return { podeEnviar: false, motivo: "Homologa\u00e7\u00e3o desativada", motivoCodigo: "HOMOLOG_DISABLED" };
  }
  if (!telefoneEstaNaAllowlist(telefone)) {
    return {
      podeEnviar: false,
      motivo: "Telefone fora da lista de teste autorizada",
      motivoCodigo: "PHONE_NOT_IN_ALLOWLIST",
    };
  }
  const segura = validarMensagemSegura(conteudo);
  if (!segura.valida) {
    return {
      podeEnviar: false,
      motivo: segura.motivo || "Mensagem bloqueada por seguran\u00e7a",
      motivoCodigo: "MESSAGE_BLOCKED",
    };
  }
  return { podeEnviar: true };
}

export interface WhatsAppHomologPayload {
  telefone: string;
  mensagem: string;
  setor: string;
  origem_tipo: string;
  origem_id: string;
  aprovacao_id: string;
  tarefa_id: string;
  robo_id?: string;
  modo_homologacao?: boolean;
}

export interface WhatsAppHomologResult {
  sucesso: boolean;
  status: string;
  provider_message_id?: string | null;
  mensagem_id?: string;
  log_id?: string;
  motivo?: string;
  motivoCodigo?: string;
}

export async function enviarWhatsAppHomologacao(
  payload: WhatsAppHomologPayload
): Promise<WhatsAppHomologResult> {
  const validacao = validarWhatsAppHomologacao(payload.telefone, payload.mensagem);
  const modoHomolog = payload.modo_homologacao ?? true;

  if (!validacao.podeEnviar) {
    const result = await registrarTentativaWhatsApp({
      ...payload,
      status: "bloqueado",
      modo_homologacao: modoHomolog,
      provider_message_id: null,
      motivo_bloqueio: validacao.motivo,
      erro: validacao.motivo,
    });
    return {
      sucesso: false,
      status: "bloqueado",
      mensagem_id: result.mensagem_id,
      log_id: result.log_id,
      motivo: validacao.motivo,
      motivoCodigo: validacao.motivoCodigo,
    };
  }

  try {
    const evolutionUrl = getEnv("VITE_EVOLUTION_API_URL");
    const evolutionKey = getEnv("VITE_EVOLUTION_API_KEY");
    const evolutionInstance = getEnv("VITE_EVOLUTION_INSTANCE");

    if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
      const result = await registrarTentativaWhatsApp({
        ...payload,
        status: "bloqueado",
        modo_homologacao: modoHomolog,
        provider_message_id: null,
        motivo_bloqueio: "Evolution API n\u00e3o configurada",
        erro: "VITE_EVOLUTION_API_URL, VITE_EVOLUTION_API_KEY ou VITE_EVOLUTION_INSTANCE n\u00e3o definidos no .env",
      });
      return {
        sucesso: false,
        status: "bloqueado",
        mensagem_id: result.mensagem_id,
        log_id: result.log_id,
        motivo: "Evolution API n\u00e3o configurada",
        motivoCodigo: "EVOLUTION_NOT_CONFIGURED",
      };
    }

    const parsedUrl = evolutionUrl.replace(/\/+$/, "");
    const response = await fetch(
      `${parsedUrl}/message/sendText/${evolutionInstance}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apiKey": evolutionKey,
        },
        body: JSON.stringify({
          number: payload.telefone,
          text: payload.mensagem,
          delay: 1200,
        }),
      }
    );

    if (!response.ok) {
      const erroText = await response.text().catch(() => "Erro desconhecido");
      const result = await registrarTentativaWhatsApp({
        ...payload,
        status: "erro_homologacao",
        modo_homologacao: modoHomolog,
        provider_message_id: null,
        erro: `Evolution API retornou ${response.status}: ${erroText.slice(0, 200)}`,
      });
      return {
        sucesso: false,
        status: "erro_homologacao",
        mensagem_id: result.mensagem_id,
        log_id: result.log_id,
        motivo: `Evolution API retornou erro ${response.status}`,
        motivoCodigo: "EVOLUTION_API_ERROR",
      };
    }

    const responseData = await response.json().catch(() => ({}));
    const providerMessageId = responseData?.key?.id || responseData?.id || null;

    const result = await registrarTentativaWhatsApp({
      ...payload,
      status: "enviado_homologacao",
      modo_homologacao: modoHomolog,
      provider_message_id: providerMessageId,
    });

    return {
      sucesso: true,
      status: "enviado_homologacao",
      provider_message_id: providerMessageId,
      mensagem_id: result.mensagem_id,
      log_id: result.log_id,
    };
  } catch (err) {
    const erroMsg = err instanceof Error ? err.message : "Erro desconhecido ao enviar WhatsApp";
    const result = await registrarTentativaWhatsApp({
      ...payload,
      status: "erro_homologacao",
      modo_homologacao: modoHomolog,
      provider_message_id: null,
      erro: erroMsg.slice(0, 500),
    });
    return {
      sucesso: false,
      status: "erro_homologacao",
      mensagem_id: result.mensagem_id,
      log_id: result.log_id,
      motivo: erroMsg,
      motivoCodigo: "EVOLUTION_NETWORK_ERROR",
    };
  }
}

async function registrarTentativaWhatsApp(params: {
  telefone: string;
  mensagem: string;
  setor: string;
  origem_tipo: string;
  origem_id: string;
  aprovacao_id: string;
  tarefa_id: string;
  robo_id?: string;
  status: string;
  modo_homologacao: boolean;
  provider_message_id: string | null;
  motivo_bloqueio?: string;
  erro?: string;
}): Promise<{ mensagem_id?: string; log_id?: string }> {
  const telefoneMascarado = mascararTelefone(params.telefone);

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
      assunto: `WhatsApp Homologa\u00e7\u00e3o - ${params.setor}`,
      conteudo: params.mensagem,
      status: params.status,
      modo_seguro: !params.modo_homologacao,
      modo_homologacao: params.modo_homologacao,
      provider_message_id: params.provider_message_id,
      motivo_bloqueio: params.motivo_bloqueio || null,
      contexto: {
        telefone_mascarado: telefoneMascarado,
        setor: params.setor,
        aprovacao_id: params.aprovacao_id,
        fallback: FALLBACK_MSG,
      },
    })
    .select("id")
    .single();

  const logAcao = params.status === "enviado_homologacao"
    ? "whatsapp_homolog_enviado"
    : params.status === "bloqueado"
    ? "whatsapp_homolog_bloqueado"
    : "whatsapp_homolog_erro";

  await centralIaService.registrarLog({
    robo_id: params.robo_id || undefined,
    tarefa_id: params.tarefa_id,
    acao: logAcao,
    entrada: {
      aprovacao_id: params.aprovacao_id,
      telefone_mascarado: telefoneMascarado,
      status: params.status,
      motivo_bloqueio: params.motivo_bloqueio || undefined,
    },
    saida: {
      provider_message_id: params.provider_message_id,
      mensagem_id: msg?.id,
    },
    status: params.status === "enviado_homologacao" ? "sucesso" : "aviso",
    erro: params.erro || undefined,
  });

  if (params.status === "bloqueado" || params.status === "erro_homologacao") {
    await supabase
      .from("automacoes_tarefas")
      .update({
        resultado: {
          bloqueado: true,
          motivo: params.motivo_bloqueio || params.erro,
          telefone_mascarado: telefoneMascarado,
        },
      })
      .eq("id", params.tarefa_id);
  }

  return { mensagem_id: msg?.id };
}
