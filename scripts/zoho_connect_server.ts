/**
 * Zoho Connect Server — endpoints empresariais para OAuth2
 *
 * Uso:
 *   npx tsx scripts/zoho_connect_server.ts
 *
 * Endpoints:
 *   GET  /api/integracoes/zoho/status     — status da conexão
 *   POST /api/integracoes/zoho/exchange   — troca code → tokens e salva no banco
 *   POST /api/integracoes/zoho/test       — envia email de homologação (com aprovação)
 *   POST /api/integracoes/zoho/disconnect — remove credenciais
 *
 * Segurança:
 *   - refresh_token criptografado com AES-256-GCM (Node.js crypto)
 *   - client_secret nunca vai para o navegador
 *   - tokens nunca são logados
 *   - aprovação da diretoria obrigatória para envio de email
 */
import * as http from "node:http";
import * as crypto from "node:crypto";
import * as dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local"), override: true });

const DEBUG = process.env.ZOHO_OAUTH_DEBUG === "true";

function debugLog(...args: unknown[]) {
  if (DEBUG) console.log("[ZOHO_OAUTH_DEBUG]", ...args);
}

if (!process.env.VITE_SUPABASE_URL) {
  console.error("VITE_SUPABASE_URL ausente");
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY ausente. Defina no .env (Service Role do Supabase)");
  process.exit(1);
}

const { createServiceClient } = await import("../src/lib/supabase");
const supabaseAdmin = createServiceClient(process.env.SUPABASE_SERVICE_ROLE_KEY);

const PORT = Number(process.env.ZOHO_CONNECT_PORT) || 3031;
const ALLOWED_ORIGIN = process.env.VITE_FRONTEND_URL || "http://localhost:8800";
const FRONTEND_URL = process.env.VITE_FRONTEND_URL || "http://localhost:8800";
const REDIRECT_URI_FALLBACK = `${FRONTEND_URL}/zoho/callback`;

const CLIENT_ID = process.env.VITE_ZOHO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.VITE_ZOHO_CLIENT_SECRET || "";
const CHAVE_CRIPTOGRAFIA = process.env.VITE_ZOHO_ENCRYPTION_KEY || "zoho_enc_key_p2d_2026";
const DATA_CENTER = process.env.VITE_ZOHO_DATA_CENTER || "mail.zoho.com";

const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_API_BASE = "https://mail.zoho.com";

const ALGORITMO = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function encriptar(texto: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITMO, crypto.createHash("sha256").update(CHAVE_CRIPTOGRAFIA).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

function decriptar(dados: string): string {
  const partes = dados.split(":");
  if (partes.length !== 3) throw new Error("Formato criptográfico inválido");
  const iv = Buffer.from(partes[0], "hex");
  const tag = Buffer.from(partes[1], "hex");
  const encrypted = Buffer.from(partes[2], "hex");
  const decipher = crypto.createDecipheriv(ALGORITMO, crypto.createHash("sha256").update(CHAVE_CRIPTOGRAFIA).digest(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

function corsHeaders(origin: string | undefined) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function mascara(valor: string): string {
  if (!valor || valor.length <= 8) return "****";
  return `${valor.slice(0, 4)}...${valor.slice(-4)}`;
}

function send(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string>) {
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function trocarCodePorToken(code: string, redirectUri: string) {
  debugLog("Token exchange: redirect_uri =", redirectUri);
  debugLog("Token exchange: token_url =", TOKEN_URL);
  const params = new URLSearchParams({
    code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri, grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await response.json();
  debugLog("Token exchange: HTTP status =", response.status);
  debugLog("Token exchange: Zoho response error =", data.error || "(nenhum)");
  debugLog("Token exchange: Zoho response error_description =", data.error_description || "(nenhum)");
  if (!response.ok || !data.refresh_token) {
    const msg = data.error_description ? `${data.error}: ${data.error_description}` : (data.error || "Falha ao obter tokens do Zoho");
    throw new Error(msg);
  }
  return { accessToken: data.access_token as string, refreshToken: data.refresh_token as string };
}

async function obterAccessTokenPorRefreshToken(refreshToken: string) {
  const params = new URLSearchParams({
    refresh_token: refreshToken, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(data.error || "Falha ao renovar access token");
  }
  return data.access_token as string;
}

async function buscarAccountId(accessToken: string) {
  const response = await fetch(`${ZOHO_API_BASE}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Erro ao buscar contas: ${response.status}`);
  }
  const data = await response.json();
  const accounts = data?.data || data?.accounts;
  if (Array.isArray(accounts) && accounts.length > 0) {
    return { accountId: String(accounts[0].accountId || accounts[0].id || ""), email: accounts[0].email || "" };
  }
  if (data?.data?.accountId) {
    return { accountId: String(data.data.accountId), email: data.data.email || "" };
  }
  return { accountId: "DESCONHECIDO", email: "" };
}

async function buscarCredenciaisAtivas() {
  const { data } = await supabaseAdmin
    .from("ia_credenciais_zoho")
    .select("id, client_id, account_id, data_center, email_conectado, refresh_token_criptografado, status, criado_em, atualizado_em")
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(1)
    .single();
  return data as {
    id: string; client_id: string; account_id: string; data_center: string;
    email_conectado: string; refresh_token_criptografado: string; status: string;
    criado_em: string; atualizado_em: string;
  } | null;
}

async function enviarEmailZoho(accessToken: string, accountId: string, destinatario: string): Promise<{ messageId: string }> {
  const url = `${ZOHO_API_BASE}/api/accounts/${accountId}/messages`;
  const body = {
    fromAddress: destinatario,
    toAddress: destinatario,
    subject: "[Teste] Conexão Express — Homologação Zoho Mail",
    content: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Teste de Integração Zoho Mail</h2>
      <p>Este e-mail foi enviado automaticamente pelo <strong>Zoho Connect Server</strong> da Conexão Express.</p>
      <p>Se você recebeu este e-mail, a integração com o Zoho Mail está funcionando corretamente.</p>
      <hr style="border: 1px solid #e5e7eb;" />
      <p style="color: #6b7280; font-size: 12px;">
        Enviado em ${new Date().toLocaleString("pt-BR")} · Conexão Express · Sistema de Funcionários Digitais
      </p>
    </div>`,
    mailFormat: "html",
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Zoho Mail API error: ${data.message || data.error || response.statusText} (${response.status})`);
  }
  const messageId = String(data?.data?.messageId || data?.messageId || "unknown");
  return { messageId };
}

async function criarAprovacaoTeste(credencialId: string, emailDestino: string) {
  const { data: tarefa, error } = await supabaseAdmin
    .from("automacoes_tarefas")
    .insert({
      robo_id: null,
      setor: "TI",
      tipo_tarefa: "aprovacao",
      origem_tipo: "zoho_test",
      titulo: "Envio de email de homologação Zoho Mail",
      descricao: `Solicitação de envio de email de teste via Zoho Mail`,
      prioridade: "normal",
      status: "aguardando_aprovacao",
      payload: { acao: "zoho_test_email", credencial_id: credencialId, destinatario: emailDestino },
      resultado: {},
      max_tentativas: 1,
    })
    .select()
    .single();
  if (error) throw new Error(`Erro ao criar tarefa: ${error.message}`);

  const { error: apError } = await supabaseAdmin
    .from("automacoes_aprovacoes")
    .insert({
      tarefa_id: tarefa.id,
      tipo_aprovacao: "outro",
      conteudo_original: { acao: "zoho_test_email", credencial_id: credencialId },
      conteudo_sugerido: { destinatario: emailDestino, assunto: "[Teste] Conexão Express — Homologação Zoho Mail" },
      status: "pendente",
    });
  if (apError) throw new Error(`Erro ao criar registro de aprovação: ${apError.message}`);

  return tarefa;
}

async function registrarLog(acao: string, detalhe: string, erro?: string) {
  try {
    await supabaseAdmin.from("automacoes_logs").insert({
      robo_id: null, acao, tipo: "integracao",
      descricao: detalhe, erro: erro || null, metadata: { modulo: "zoho_connect" },
    });
  } catch { /* fail silent */ }
}

const server = http.createServer(async (req, res) => {
  const headers = corsHeaders(req.headers.origin);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // GET /api/integracoes/zoho/status
    if (req.method === "GET" && pathname === "/api/integracoes/zoho/status") {
      const ativas = await buscarCredenciaisAtivas();
      send(res, 200, {
        conectado: !!ativas,
        credencial: ativas ? {
          id: ativas.id,
          account_id: ativas.account_id,
          data_center: ativas.data_center,
          email: ativas.email_conectado || null,
          status: ativas.status,
          criado_em: ativas.criado_em,
          atualizado_em: ativas.atualizado_em,
        } : null,
        configurado: Boolean(CLIENT_ID && CLIENT_SECRET),
      }, headers);
      return;
    }

    // POST /api/integracoes/zoho/exchange
    if (req.method === "POST" && pathname === "/api/integracoes/zoho/exchange") {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        send(res, 400, { erro: "Zoho não configurado. Defina VITE_ZOHO_CLIENT_ID e VITE_ZOHO_CLIENT_SECRET no .env" }, headers);
        return;
      }

      let body = "";
      for await (const chunk of req) body += chunk;
      const { code, redirect_uri } = JSON.parse(body);

      if (!code) {
        send(res, 400, { erro: "Campo 'code' é obrigatório" }, headers);
        return;
      }

      const redirectUri = redirect_uri || REDIRECT_URI_FALLBACK;
      debugLog("Exchange handler: code received (máscara) =", code.slice(0, 8) + "...");
      debugLog("Exchange handler: redirect_uri from frontend =", redirect_uri || "(não enviado, usando fallback)");
      debugLog("Exchange handler: redirect_uri usado na troca =", redirectUri);

      const tokens = await trocarCodePorToken(code, redirectUri);
      const { accountId, email } = await buscarAccountId(tokens.accessToken);
      const tokenCriptografado = encriptar(tokens.refreshToken);

      const { error: insertError } = await supabaseAdmin
        .from("ia_credenciais_zoho")
        .insert({
          client_id: CLIENT_ID,
          account_id: accountId,
          data_center: DATA_CENTER,
          email_conectado: email,
          refresh_token_criptografado: tokenCriptografado,
          status: "ativo",
        });

      if (insertError) throw new Error(`Erro ao salvar credenciais: ${insertError.message}`);

      await registrarLog("zoho_conectado", `Zoho Mail conectado (${email || accountId})`);

      send(res, 200, {
        refreshTokenMasked: mascara(tokens.refreshToken),
        accountId, email, conectado: true,
      }, headers);
      return;
    }

    // POST /api/integracoes/zoho/test
    if (req.method === "POST" && pathname === "/api/integracoes/zoho/test") {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        send(res, 400, { erro: "Zoho não configurado no .env" }, headers);
        return;
      }

      const ativas = await buscarCredenciaisAtivas();
      if (!ativas) {
        send(res, 400, { erro: "Nenhuma credencial Zoho ativa. Conecte-se primeiro." }, headers);
        return;
      }

      const emailDestino = process.env.VITE_ZOHO_EMAIL_FROM || "contato@conexaoexpress.com.br";
      const tarefa = await criarAprovacaoTeste(ativas.id, emailDestino);

      await registrarLog("zoho_test_solicitado",
        `Teste Zoho Mail solicitado — tarefa ${tarefa.id} — aguardando aprovação da diretoria`);

      send(res, 200, {
        mensagem: "Solicitação de teste enviada para aprovação da diretoria.",
        tarefa_id: tarefa.id,
        status: "aguardando_aprovacao",
      }, headers);
      return;
    }

    // POST /api/integracoes/zoho/disconnect
    if (req.method === "POST" && pathname === "/api/integracoes/zoho/disconnect") {
      const { error } = await supabaseAdmin
        .from("ia_credenciais_zoho")
        .update({ status: "revogado" })
        .eq("status", "ativo");

      if (error) throw new Error(`Erro ao revogar credenciais: ${error.message}`);

      await registrarLog("zoho_desconectado", "Zoho Mail desconectado");

      send(res, 200, { desconectado: true }, headers);
      return;
    }

    // GET /api/integracoes/zoho/test-status?tarefa_id=X
    if (req.method === "GET" && pathname === "/api/integracoes/zoho/test-status") {
      const tarefaId = url.searchParams.get("tarefa_id");
      if (!tarefaId) {
        send(res, 400, { erro: "Parâmetro 'tarefa_id' é obrigatório" }, headers);
        return;
      }

      const { data: aprovacao, error: apErr } = await supabaseAdmin
        .from("automacoes_aprovacoes")
        .select("id, status, aprovado_por, aprovado_em, observacao, criado_em")
        .eq("tarefa_id", tarefaId)
        .maybeSingle();
      if (apErr) throw new Error(`Erro ao buscar status: ${apErr.message}`);

      const { data: tarefa, error: tErr } = await supabaseAdmin
        .from("automacoes_tarefas")
        .select("id, status, resultado")
        .eq("id", tarefaId)
        .maybeSingle();
      if (tErr) throw new Error(`Erro ao buscar tarefa: ${tErr.message}`);

      send(res, 200, {
        aprovacao_id: aprovacao?.id || null,
        status_aprovacao: aprovacao?.status || "nao_encontrado",
        status_tarefa: tarefa?.status || "nao_encontrado",
        resultado_tarefa: tarefa?.resultado || null,
        aprovado_por: aprovacao?.aprovado_por || null,
        aprovado_em: aprovacao?.aprovado_em || null,
        observacao: aprovacao?.observacao || null,
      }, headers);
      return;
    }

    // POST /api/integracoes/zoho/executar-teste
    if (req.method === "POST" && pathname === "/api/integracoes/zoho/executar-teste") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { tarefa_id } = JSON.parse(body);

      if (!tarefa_id) {
        send(res, 400, { erro: "Campo 'tarefa_id' é obrigatório" }, headers);
        return;
      }

      // Buscar aprovação
      const { data: aprovacao, error: apErr } = await supabaseAdmin
        .from("automacoes_aprovacoes")
        .select("id, status")
        .eq("tarefa_id", tarefa_id)
        .maybeSingle();
      if (apErr) throw new Error(`Erro ao buscar aprovação: ${apErr.message}`);
      if (!aprovacao) {
        send(res, 400, { erro: "Nenhuma aprovação encontrada para esta tarefa. Solicite o teste primeiro." }, headers);
        return;
      }
      if (aprovacao.status !== "aprovado") {
        send(res, 400, {
          erro: "Aprovação pendente. Aprove primeiro na Central IA → Aprovações Humanas.",
          status_aprovacao: aprovacao.status,
        }, headers);
        return;
      }

      // Já foi executado?
      const { data: tarefaAtual } = await supabaseAdmin
        .from("automacoes_tarefas")
        .select("status, resultado, payload")
        .eq("id", tarefa_id)
        .single();
      if (tarefaAtual?.status === "concluida" && tarefaAtual?.resultado?.enviado_em) {
        send(res, 200, { mensagem: "Este teste já foi executado.", ...tarefaAtual.resultado }, headers);
        return;
      }

      const payload = tarefaAtual?.payload as Record<string, unknown> || {};
      const credencialId = payload.credencial_id as string;
      const destinatario = (payload.destinatario as string) || process.env.VITE_ZOHO_EMAIL_FROM || "contato@conexaoexpress.com.br";

      // Buscar credencial
      const { data: credencial } = await supabaseAdmin
        .from("ia_credenciais_zoho")
        .select("account_id, refresh_token_criptografado, data_center")
        .eq("id", credencialId)
        .single();
      if (!credencial) {
        send(res, 400, { erro: "Credencial não encontrada" }, headers);
        return;
      }

      const refreshToken = decriptar(credencial.refresh_token_criptografado);
      const accessToken = await obterAccessTokenPorRefreshToken(refreshToken);
      const accountId = credencial.account_id;

      // Enviar email
      const { messageId } = await enviarEmailZoho(accessToken, accountId, destinatario);

      // Atualizar tarefa
      await supabaseAdmin
        .from("automacoes_tarefas")
        .update({
          status: "concluida",
          resultado: {
            enviado: true,
            destinatario,
            message_id: messageId,
            enviado_em: new Date().toISOString(),
          },
        })
        .eq("id", tarefa_id);

      await registrarLog("zoho_teste_executado",
        `Email de teste enviado para ${destinatario} — messageId: ${messageId}`);

      send(res, 200, {
        mensagem: `Email de teste enviado com sucesso para ${destinatario}!`,
        destinatario,
        message_id: messageId,
        enviado_em: new Date().toISOString(),
      }, headers);
      return;
    }

    send(res, 404, { erro: "Rota não encontrada" }, headers);
  } catch (err: any) {
    await registrarLog("zoho_erro", `Erro: ${err.message}`, err.stack);
    send(res, 500, { erro: err.message }, headers);
  }
});

server.listen(PORT, () => {
  console.log(`\n🔌 Zoho Connect Server rodando em http://localhost:${PORT}`);
  console.log(`   GET  /api/integracoes/zoho/status     — status da conexão`);
  console.log(`   POST /api/integracoes/zoho/exchange   — trocar code por tokens`);
  console.log(`   POST /api/integracoes/zoho/test       — teste com aprovação`);
  console.log(`   POST /api/integracoes/zoho/disconnect — desconectar`);
  console.log(`   Client ID: ${CLIENT_ID ? "✓" : "✗"}  |  Client Secret: ${CLIENT_SECRET ? "✓" : "✗"}`);
  console.log(`   🔒 Nenhum token é logado. Client Secret nunca vai para o navegador.\n`);
});
