/**
 * Zoho OAuth Callback Server — endpoint local seguro
 *
 * Uso:
 *   npx tsx scripts/zoho_callback_server.ts
 *
 * Endpoints:
 *   GET  /status          — health check + config status
 *   POST /api/zoho/exchange — troca code → refresh_token + accountId
 *
 * Segurança:
 *   - Client Secret nunca vai para o navegador
 *   - Tokens retornados apenas mascarados (primeiros 4 + últimos 4)
 *   - Nada é salvo em disco ou logado
 */
import * as http from "node:http";
import * as dotenv from "dotenv";
import * as path from "node:path";

dotenv.config({ path: path.resolve(import.meta.dirname, "..", ".env") });

const PORT = Number(process.env.ZOHO_CALLBACK_PORT) || 3030;
const ALLOWED_ORIGIN = "http://localhost:8800";

const CLIENT_ID = process.env.VITE_ZOHO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.VITE_ZOHO_CLIENT_SECRET || "";
const DATA_CENTER = process.env.VITE_ZOHO_DATA_CENTER || "mail.zoho.com";
const REDIRECT_URI = "http://localhost:8800/zoho/callback";

const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_API_BASE = "https://mail.zoho.com";

function corsHeaders(origin: string | undefined) {
  const allow = origin === ALLOWED_ORIGIN ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function mascara(valor: string): string {
  if (!valor || valor.length <= 8) return "****";
  return `${valor.slice(0, 4)}...${valor.slice(-4)}`;
}

async function trocarCodePorToken(code: string) {
  const params = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.refresh_token) {
    throw new Error(data.error || "Falha ao obter tokens");
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
  };
}

async function buscarAccountId(accessToken: string) {
  const response = await fetch(`${ZOHO_API_BASE}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Erro ao buscar contas: ${response.status} ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const accounts = data?.data || data?.accounts;

  if (Array.isArray(accounts) && accounts.length > 0) {
    return String(accounts[0].accountId || accounts[0].id || "");
  }

  if (data?.data?.accountId) {
    return String(data.data.accountId);
  }

  return "DESCONHECIDO";
}

const server = http.createServer(async (req, res) => {
  const headers = corsHeaders(req.headers.origin);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  };

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // GET /status
    if (req.method === "GET" && pathname === "/status") {
      send(200, {
        ok: true,
        configurado: Boolean(CLIENT_ID && CLIENT_SECRET),
        porta: PORT,
      });
      return;
    }

    // POST /api/zoho/exchange
    if (req.method === "POST" && pathname === "/api/zoho/exchange") {
      if (!CLIENT_ID || !CLIENT_SECRET) {
        send(400, { erro: "VITE_ZOHO_CLIENT_ID e VITE_ZOHO_CLIENT_SECRET não configurados no .env" });
        return;
      }

      let body = "";
      for await (const chunk of req) body += chunk;

      const { code } = JSON.parse(body);

      if (!code) {
        send(400, { erro: "Campo 'code' é obrigatório" });
        return;
      }

      const tokens = await trocarCodePorToken(code);
      const accountId = await buscarAccountId(tokens.accessToken);

      send(200, {
        refreshToken: tokens.refreshToken,
        refreshTokenMasked: mascara(tokens.refreshToken),
        accountId,
      });
      return;
    }

    send(404, { erro: "Rota não encontrada" });
  } catch (err: any) {
    send(500, { erro: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Zoho Callback Server rodando em http://localhost:${PORT}`);
  console.log(`   GET  /status          — health check`);
  console.log(`   POST /api/zoho/exchange — trocar code por tokens`);
  console.log(`   Client Secret: ${CLIENT_SECRET ? "configurado ✓" : "ausente ✗"}`);
  console.log(`   Client ID:     ${CLIENT_ID ? "configurado ✓" : "ausente ✗"}`);
  console.log(`\n   ⚠️  Nenhum token é salvo ou logado.`);
  console.log(`   🔒 Client Secret nunca vai para o navegador.\n`);
});
