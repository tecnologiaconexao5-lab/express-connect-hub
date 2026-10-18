import type { IProvider, ProviderParams, ProviderResult, TestConnectionResult } from "./ProviderInterface";
import { getModoWhatsApp, isProducaoAssistida, isFallbackPermitido, modoSimbolo } from "./modoProducaoAssistida";

export class WhatsAppProvider implements IProvider {
  readonly nome = "Evolution API WhatsApp";
  readonly tipo = "WHATSAPP";
  readonly provedor = "Evolution API";

  private getModo(): "homologacao" | "assistido" | "producao" {
    return getModoWhatsApp();
  }

  private DEFAULT_TIMEOUT = 15000;

  private getEvolutionConfig(credentials: Record<string, unknown>) {
    const serverUrl = (credentials?.url as string) || import.meta.env.VITE_EVOLUTION_API_URL || "";
    const apiKey = (credentials?.api_key as string) || import.meta.env.VITE_EVOLUTION_API_KEY || "";
    const instanceName = (credentials?.instancia as string) || "conexao-express";
    if (!serverUrl || !apiKey) {
      console.warn("[WhatsAppProvider] Evolution API nao configurada. Configure VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY");
    }
    return { serverUrl, apiKey, instanceName };
  }

  private async fetchWithTimeout(url: string, options: RequestInit & { timeout?: number, signal?: AbortSignal }): Promise<Response> {
    const timeout = options.timeout || this.DEFAULT_TIMEOUT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const signals = [controller.signal];
    if (options.signal) signals.push(options.signal);
    const combinedSignal = AbortSignal.any ? AbortSignal.any(signals) : controller.signal;
    try {
      const response = await fetch(url, { ...options, signal: combinedSignal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async execute(params: ProviderParams): Promise<ProviderResult> {
    const modo = this.getModo();
    const modoStr = modoSimbolo(modo);

    if (!isProducaoAssistida(modo)) {
      return {
        sucesso: true,
        data: {
          status: "simulado",
          mensagem: `WhatsApp em modo ${modoStr} — Nenhuma mensagem real foi enviada.`,
          modo,
          ambiente: "simulado",
          acao: params.acao,
          telefone: params.payload.telefone,
        },
      };
    }

    const { acao, payload, credentials } = params;
    const fallback = isFallbackPermitido(modo);

    try {
      const { serverUrl, apiKey, instanceName } = this.getEvolutionConfig(credentials);

      switch (acao) {
        case "enviar_mensagem": {
          const telefone = payload.telefone as string;
          const mensagem = payload.mensagem as string;

          if (!telefone || !mensagem) {
            return { sucesso: false, erro: "Campos obrigatórios: telefone, mensagem" };
          }

          let response: Response;
          try {
            response = await this.fetchWithTimeout(`${serverUrl}/message/sendText/${instanceName}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apiKey": apiKey,
              },
              body: JSON.stringify({
                number: telefone,
                text: mensagem,
                delay: 1200,
              }),
              signal: params.signal,
              timeout: params.timeoutMs,
            });
          } catch (fetchErr) {
            const msg = `Falha de rede ao conectar com Evolution API: ${fetchErr instanceof Error ? fetchErr.message : "Erro desconhecido"}`;
            console.error(`[WhatsAppProvider] ${msg}`);
            return {
              sucesso: false,
              erro: msg,
              data: { status: "falha_rede", modo, acao, telefone, ...(fallback ? { pendente: true } : {}) },
            };
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Erro desconhecido");
            const msg = `Evolution API error: ${response.status} - ${errorText}`;
            console.error(`[WhatsAppProvider] ${msg}`);
            return {
              sucesso: false,
              erro: msg,
              data: { status: "erro_api", modo, acao, telefone, codigo: response.status, ...(fallback ? { pendente: true } : {}) },
            };
          }

          const data = await response.json();
          const messageId = data?.key?.id || data?.id;
          return { sucesso: true, data: { messageId, telefone, status: "enviado", modo, ambiente: modoStr, key: data?.key } };
        }

        case "status_conexao": {
          const response = await this.fetchWithTimeout(`${serverUrl}/instance/connectionState/${instanceName}`, {
            headers: { "apiKey": apiKey },
            signal: params.signal,
            timeout: params.timeoutMs,
          });
          if (!response.ok) return { sucesso: false, erro: `Erro ao obter status: ${response.status}` };
          const data = await response.json();
          return { sucesso: true, data: { state: data?.state?.state || data?.state || "desconhecido", instance: instanceName, modo } };
        }

        case "buscar_qrcode": {
          const response = await this.fetchWithTimeout(`${serverUrl}/instance/connect/${instanceName}`, {
            headers: { "apiKey": apiKey },
            signal: params.signal,
            timeout: params.timeoutMs,
          });
          if (!response.ok) return { sucesso: false, erro: `Erro ao obter QR code: ${response.status}` };
          const data = await response.json();
          return { sucesso: true, data: { qrcode: data?.base64 || data?.code || data, instance: instanceName } };
        }

        case "health_check": {
          return await this.execute({ ...params, acao: "status_conexao" });
        }

        default:
          return { sucesso: false, erro: `Ação desconhecida para WhatsApp: ${acao}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido no WhatsAppProvider";
      console.error(`[WhatsAppProvider] ${msg}`);
      return { sucesso: false, erro: msg, data: { status: "erro_interno", modo, ...(fallback ? { pendente: true } : {}) } };
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<TestConnectionResult> {
    const modo = this.getModo();
    const { serverUrl, apiKey } = this.getEvolutionConfig(config);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);
      const response = await fetch(`${serverUrl}/instance/fetchInstances`, {
        headers: { "apiKey": apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        return { ok: false, mensagem: `Evolution API retornou ${response.status}` };
      }
      const data = await response.json();
      const instances = Array.isArray(data) ? data : (data?.instances || []);
      return { ok: true, mensagem: `Conectado à Evolution API. Instâncias: ${instances.length} — Modo: ${modoSimbolo(modo)}` };
    } catch (err) {
      return { ok: false, mensagem: `Falha na conexão: ${err instanceof Error ? err.message : "Erro desconhecido"}` };
    }
  }
}
