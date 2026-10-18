import { supabase } from "@/lib/supabase";
import { comunicacaoGatewayService } from "@/services/comunicacao/comunicacaoGatewayService";

export interface ConversaWhatsApp {
  id: string;
  cliente_id?: string;
  lead_id?: string;
  canal: string;
  telefone?: string;
  email?: string;
  nome_contato?: string;
  setor?: string;
  status: string;
  ultima_mensagem?: string;
  ultimo_evento_em?: string;
  created_at: string;
  mensagens_count?: number;
}

export interface MensagemWhatsApp {
  id: string;
  conversa_id: string;
  lead_id?: string;
  cliente_id?: string;
  canal: string;
  tipo: string;
  direction: string;
  remetente?: string;
  destinatario?: string;
  mensagem: string;
  status: string;
  anexo_url?: string;
  external_id?: string;
  erro?: string;
  created_at: string;
}

export interface TemplateMensagem {
  id: string;
  nome: string;
  canal: string;
  setor: string;
  assunto?: string;
  mensagem: string;
  ativo: boolean;
}

export interface StatusConexao {
  conectado: boolean;
  mode: string;
  mensagem: string;
}

export interface EnvioResultado {
  sucesso: boolean;
  status: string;
  motivo?: string;
  mensagem_id?: string;
}

function getEnv(key: string): string | undefined {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env[key]?.trim();
  } catch { /* fallback */ }
  try { return (process as any).env[key]?.trim(); } catch { return undefined; }
}

export const portalWhatsAppService = {
  async buscarConversas(clienteId?: string): Promise<ConversaWhatsApp[]> {
    if (!clienteId) return [];
    try {
      const [{ data: conversas }, { data: cliente }] = await Promise.all([
        supabase
          .from("crm_conversas")
          .select("*")
          .eq("cliente_id", clienteId)
          .eq("canal", "whatsapp")
          .order("ultimo_evento_em", { ascending: false })
          .limit(50),
        supabase
          .from("clientes")
          .select("whatsapp, telefone")
          .eq("id", clienteId)
          .single(),
      ]);
      const result = conversas || [];

      if (cliente?.whatsapp) {
        const telefone = cliente.whatsapp.replace(/\D/g, "");
        const convTelefone = result.find((c: any) => c.telefone?.replace(/\D/g, "") === telefone);
        if (!convTelefone) {
          result.push({
            id: `tel-${telefone}`,
            cliente_id: clienteId,
            canal: "whatsapp",
            telefone: cliente.whatsapp,
            nome_contato: "Meu N\u00famero",
            status: "aberta",
            created_at: new Date().toISOString(),
          });
        }
      }

      for (const conv of result) {
        const { count } = await supabase
          .from("crm_mensagens")
          .select("id", { count: "exact", head: true })
          .eq("conversa_id", conv.id)
          .limit(1);
        conv.mensagens_count = count || 0;
      }
      return result;
    } catch (error) {
      console.warn("[portalWhatsAppService] Erro ao buscar conversas:", error);
      return [];
    }
  },

  async buscarMensagens(conversaId: string): Promise<MensagemWhatsApp[]> {
    try {
      const { data } = await supabase
        .from("crm_mensagens")
        .select("*")
        .eq("conversa_id", conversaId)
        .order("created_at", { ascending: true })
        .limit(200);
      return data || [];
    } catch (error) {
      console.warn("[portalWhatsAppService] Erro ao buscar mensagens:", error);
      return [];
    }
  },

  async buscarTemplates(): Promise<TemplateMensagem[]> {
    try {
      const { data } = await supabase
        .from("crm_templates_mensagem")
        .select("*")
        .eq("canal", "whatsapp")
        .eq("ativo", true)
        .limit(50);
      return data || [];
    } catch {
      return [];
    }
  },

  async enviarMensagem(params: {
    conversaId: string;
    mensagem: string;
    clienteId: string;
    telefone?: string;
  }): Promise<EnvioResultado> {
    const { conversaId, mensagem, clienteId, telefone } = params;
    if (!mensagem.trim()) {
      return { sucesso: false, status: "erro", motivo: "Mensagem vazia" };
    }

    const result = await comunicacaoGatewayService.solicitarEnvioControlado({
      canal: "whatsapp",
      setor: "operacional",
      origem_tipo: "portal_cliente",
      origem_id: clienteId,
      destinatario_tipo: "cliente",
      destinatario_nome: undefined,
      destinatario_telefone: telefone,
      mensagem: mensagem,
    });

    if (result.sucesso || result.status === "simulado") {
      const { error: insertError } = await supabase.from("crm_mensagens").insert({
        conversa_id: conversaId,
        cliente_id: clienteId,
        canal: "whatsapp",
        tipo: "texto",
        direction: "sent",
        mensagem: mensagem,
        status: result.status === "enviado" ? "enviada" : result.status === "simulado" ? "pendente" : result.status,
        metadata: { gateway_status: result.status, gateway_motivo: result.motivo },
      });
      if (insertError) {
        console.warn("[portalWhatsAppService] Erro ao registrar mensagem no CRM:", insertError);
      }
    }

    return {
      sucesso: result.sucesso,
      status: result.status,
      motivo: result.motivo,
      mensagem_id: result.mensagem_id,
    };
  },

  async verificarStatusConexao(): Promise<StatusConexao> {
    const serverUrl = getEnv("VITE_EVOLUTION_API_URL");
    const apiKey = getEnv("VITE_EVOLUTION_API_KEY");
    const instance = getEnv("VITE_EVOLUTION_INSTANCE") || "conexao-express";
    const mode = getEnv("VITE_WHATSAPP_MODE") || (getEnv("VITE_WHATSAPP_PRODUCAO_ENABLED") === "true" ? "assistido" : "homologacao");

    if (!serverUrl || !apiKey) {
      return {
        conectado: false,
        mode,
        mensagem: "Evolution API n\u00e3o configurada (URL ou chave ausentes)",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${serverUrl.replace(/\/+$/, "")}/instance/connectionState/${instance}`, {
        headers: { apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const state = data?.state?.state || data?.state || "desconhecido";
        const conectado = state === "open" || state === "connected";
        return {
          conectado,
          mode,
          mensagem: conectado ? `Conectado (${mode})` : `Desconectado (estado: ${state})`,
        };
      }
      return {
        conectado: false,
        mode,
        mensagem: `Evolution API indispon\u00edvel (HTTP ${response.status})`,
      };
    } catch {
      return {
        conectado: false,
        mode,
        mensagem: "Evolution API inacess\u00edvel (servidor pode estar offline)",
      };
    }
  },

  inscreverMensagens(
    clienteId: string,
    callback: (mensagem: MensagemWhatsApp) => void
  ): () => void {
    const channel = supabase
      .channel("portal-whatsapp-mensagens")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "crm_mensagens",
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload: any) => {
          callback(payload.new as MensagemWhatsApp);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
