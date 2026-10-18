import { supabase } from "@/lib/supabase";
import type { IProvider, ProviderParams, ProviderResult, TestConnectionResult } from "./ProviderInterface";
import { getModoZoho, isProducaoAssistida, isFallbackPermitido, modoSimbolo } from "./modoProducaoAssistida";

const SENDER_FALLBACK = "contato@conexaoexpress.com.br";
const DEFAULT_TIMEOUT = 15000;

// Cache do access_token em memória (não persiste, não loga)
let cachedAccessToken: string | null = null;
let cachedExpiresAt: number = 0;

export class ZohoMailProvider implements IProvider {
  readonly nome = "Zoho Mail";
  readonly tipo = "EMAIL";
  readonly provedor = "Zoho";

  private getModo(): "homologacao" | "assistido" | "producao" {
    return getModoZoho();
  }

  private async fetchWithTimeout(url: string, options: RequestInit & { timeout?: number, signal?: AbortSignal }): Promise<Response> {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const signals = [controller.signal];
    if (options.signal) signals.push(options.signal);
    const combinedSignal = AbortSignal.any ? AbortSignal.any(signals) : controller.signal;
    try {
      return await fetch(url, { ...options, signal: combinedSignal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ==================== OAuth2 Token Management ====================

  private getEnvVars() {
    return {
      clientId: import.meta.env.VITE_ZOHO_CLIENT_ID,
      clientSecret: import.meta.env.VITE_ZOHO_CLIENT_SECRET,
      refreshToken: import.meta.env.VITE_ZOHO_REFRESH_TOKEN,
      accountId: import.meta.env.VITE_ZOHO_ACCOUNT_ID,
      dataCenter: import.meta.env.VITE_ZOHO_DATA_CENTER || "mail.zoho.com",
      fromEmail: import.meta.env.VITE_ZOHO_EMAIL_FROM,
    };
  }

  private async obterAccessToken(): Promise<string> {
    if (cachedAccessToken && Date.now() < cachedExpiresAt) {
      return cachedAccessToken;
    }

    const { clientId, clientSecret, refreshToken } = this.getEnvVars();

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Zoho Mail OAuth2 não configurado. Configure VITE_ZOHO_CLIENT_ID, VITE_ZOHO_CLIENT_SECRET e VITE_ZOHO_REFRESH_TOKEN no .env");
    }

    const tokenUrl = "https://accounts.zoho.com/oauth/v2/token";
    const params = new URLSearchParams();
    params.set("refresh_token", refreshToken);
    params.set("grant_type", "refresh_token");
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);

    const response = await this.fetchWithTimeout(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Erro desconhecido");
      throw new Error(`Zoho OAuth2 token error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error("Zoho OAuth2: access_token não retornado");
    }

    // Zoho access_token expira em 3600s (1 hora)
    const expiresIn = (data.expires_in as number) || 3600;
    cachedAccessToken = data.access_token as string;
    cachedExpiresAt = Date.now() + (expiresIn - 60) * 1000;

    return cachedAccessToken;
  }

  // ==================== Resolver Remetente ====================

  private async resolverFromAddress(params: ProviderParams): Promise<string> {
    const { payload, config, credentials, roboId } = params;

    if (payload.from && typeof payload.from === "string") return payload.from;

    if (roboId) {
      const { data: robo } = await supabase
        .from("automacoes_robos")
        .select("config")
        .eq("id", roboId)
        .maybeSingle();
      const fromRobo = (robo?.config as Record<string, unknown>)?.email as Record<string, unknown> | undefined;
      if (fromRobo?.from && typeof fromRobo.from === "string") return fromRobo.from;
    }

    if (roboId) {
      const fromByRobo = credentials.from_by_robo as Record<string, string> | undefined;
      if (fromByRobo?.[roboId]) return fromByRobo[roboId];
    }

    if (credentials.from && typeof credentials.from === "string") return credentials.from;
    if (config.from && typeof config.from === "string") return config.from;

    const envFrom = import.meta.env.VITE_ZOHO_EMAIL_FROM;
    if (envFrom) return envFrom;

    return SENDER_FALLBACK;
  }

  // ==================== Execute ====================

  async execute(params: ProviderParams): Promise<ProviderResult> {
    const modo = this.getModo();
    const modoStr = modoSimbolo(modo);

    if (!isProducaoAssistida(modo)) {
      return {
        sucesso: true,
        data: {
          status: "simulado",
          mensagem: `Zoho Mail em modo ${modoStr} — Nenhum email real foi enviado.`,
          modo,
          ambiente: "simulado",
          acao: params.acao,
          to: params.payload.to,
          subject: params.payload.subject,
        },
      };
    }

    const { acao, payload } = params;
    const fallback = isFallbackPermitido(modo);

    try {
      switch (acao) {
        case "enviar_email": {
          const env = this.getEnvVars();

          if (!env.clientId || !env.clientSecret || !env.refreshToken) {
            const msg = "Zoho Mail OAuth2 não configurado. Configure VITE_ZOHO_CLIENT_ID, VITE_ZOHO_CLIENT_SECRET e VITE_ZOHO_REFRESH_TOKEN no .env";
            console.error(`[ZohoMailProvider] ${msg}`);
            return !fallback
              ? { sucesso: false, erro: msg, data: { status: "configuracao_pendente", modo, acao } }
              : { sucesso: false, erro: msg, data: { status: "configuracao_pendente", modo, acao, pendente: true } };
          }

          if (!env.accountId) {
            const msg = "Zoho Mail accountId não configurado. Configure VITE_ZOHO_ACCOUNT_ID no .env";
            console.error(`[ZohoMailProvider] ${msg}`);
            return !fallback
              ? { sucesso: false, erro: msg, data: { status: "configuracao_pendente", modo, acao } }
              : { sucesso: false, erro: msg, data: { status: "configuracao_pendente", modo, acao, pendente: true } };
          }

          let accessToken: string;
          try {
            accessToken = await this.obterAccessToken();
          } catch (tokenErr) {
            const msg = `Falha ao obter token Zoho: ${tokenErr instanceof Error ? tokenErr.message : "Erro desconhecido"}`;
            console.error(`[ZohoMailProvider] ${msg}`);
            return { sucesso: false, erro: msg, data: { status: "token_invalido", modo, acao } };
          }

          const fromAddress = await this.resolverFromAddress(params);
          const to = payload.to as string;
          const subject = payload.subject as string;
          const html = payload.html as string || payload.body as string;
          const cc = payload.cc as string | undefined;

          if (!to || !subject || !html) {
            return { sucesso: false, erro: "Campos obrigatórios: to, subject, body/html" };
          }

          const endpoint = `https://${env.dataCenter}/api/accounts/${env.accountId}/messages`;

          let response: Response;
          try {
            response = await this.fetchWithTimeout(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Zoho-oauthtoken ${accessToken}`,
              },
              body: JSON.stringify({
                fromAddress,
                toAddress: to,
                ccAddress: cc || undefined,
                subject,
                content: html,
                mailFormat: "html",
              }),
              signal: params.signal,
              timeout: params.timeoutMs,
            });
          } catch (fetchErr) {
            const msg = `Falha de rede ao conectar com Zoho Mail: ${fetchErr instanceof Error ? fetchErr.message : "Erro desconhecido"}`;
            console.error(`[ZohoMailProvider] ${msg}`);
            return {
              sucesso: false,
              erro: msg,
              data: { status: "falha_rede", modo, acao, to, subject, ...(fallback ? { pendente: true } : {}) },
            };
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Erro desconhecido");
            if (response.status === 401) {
              cachedAccessToken = null;
              cachedExpiresAt = 0;
            }
            const msg = `Zoho Mail API error: ${response.status} - ${errorText}`;
            console.error(`[ZohoMailProvider] ${msg}`);
            return {
              sucesso: false,
              erro: msg,
              data: { status: "erro_api", modo, acao, to, subject, codigo: response.status, ...(fallback ? { pendente: true } : {}) },
            };
          }

          const data = await response.json();
          const messageId = data?.data?.messageId || data?.messageId;
          console.log(`[ZohoMailProvider] Email enviado com sucesso via Zoho [${modoStr}]: to=${to} subject="${subject}" messageId=${messageId}`);
          return {
            sucesso: true,
            data: {
              messageId,
              from: fromAddress,
              to,
              subject,
              status: "enviado",
              modo,
              ambiente: modoStr,
            },
          };
        }

        case "listar_emails":
          return { sucesso: true, data: { mensagem: "Listagem de e-mails não implementada", acao } };

        default:
          return { sucesso: false, erro: `Ação desconhecida para ZohoMail: ${acao}` };
      }
    } catch (err) {
      cachedAccessToken = null;
      cachedExpiresAt = 0;
      const msg = err instanceof Error ? err.message : "Erro desconhecido no ZohoMailProvider";
      console.error(`[ZohoMailProvider] ${msg}`);
      return {
        sucesso: false,
        erro: msg,
        data: { status: "erro_interno", modo, ...(fallback ? { pendente: true } : {}) },
      };
    }
  }

  // ==================== Test Connection ====================

  async testConnection(_config: Record<string, unknown>): Promise<TestConnectionResult> {
    const modo = this.getModo();
    const env = this.getEnvVars();

    if (!env.clientId || !env.clientSecret || !env.refreshToken) {
      return { ok: false, mensagem: "Zoho Mail OAuth2 não configurado (.env)" };
    }

    if (!env.accountId) {
      return { ok: false, mensagem: "Zoho Mail accountId não configurado (.env)" };
    }

    try {
      const accessToken = await this.obterAccessToken();

      const endpoint = `https://${env.dataCenter}/api/accounts/${env.accountId}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
      const response = await fetch(endpoint, {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return {
        ok: response.ok,
        mensagem: response.ok
          ? `Conectado ao Zoho Mail (account ${env.accountId}) — Modo: ${modoSimbolo(modo)}`
          : `Erro: ${response.status}`,
      };
    } catch (err) {
      return { ok: false, mensagem: `Falha na conexão: ${err instanceof Error ? err.message : "Erro desconhecido"}` };
    }
  }
}
