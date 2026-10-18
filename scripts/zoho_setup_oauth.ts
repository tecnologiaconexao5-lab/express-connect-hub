/**
 * Zoho Mail OAuth2 Setup — Gera Refresh Token e Account ID
 *
 * Uso:
 *   npx tsx scripts/zoho_setup_oauth.ts
 *
 * Fluxo:
 *   1. Informe Client ID e Client Secret (criados em https://api-console.zoho.com/)
 *   2. Abra a URL de autorização no navegador
 *   3. Autorize e copie o código de redirecionamento
 *   4. O script troca o código por access_token + refresh_token
 *   5. O script busca o Account ID
 *   6. Resultados mascarados + instruções para .env
 *
 * Segurança:
 *   - Nada é salvo em disco ou logado
 *   - Tokens exibidos apenas mascarados (primeiros 4 + últimos 4 caracteres)
 *   - Credenciais mantidas apenas em memória durante a execução
 */
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const SCOPE = "ZohoMail.messages.CREATE,ZohoMail.accounts.READ";
const REDIRECT_URI = "http://localhost:8800/zoho/callback";
const AUTH_URL_BASE = "https://accounts.zoho.com/oauth/v2/auth";
const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const ZOHO_API_BASE = "https://mail.zoho.com";

function mascara(valor: string): string {
  if (valor.length <= 8) return "****";
  return `${valor.slice(0, 4)}...${valor.slice(-4)}`;
}

function linha(titulo: string, valor: string, mascarar = true): void {
  console.log(`  ${titulo}: ${mascarar ? mascara(valor) : valor}`);
}

async function perguntar(prompt: string, secreto = false): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const resposta = await rl.question(`${secreto ? "" : "👉 "}${prompt}: `);
  rl.close();
  return resposta.trim();
}

// ============================================================
// PASSOS
// ============================================================
async function passo1_obterCredenciais(): Promise<{ clientId: string; clientSecret: string }> {
  console.log("\n" + "=".repeat(60));
  console.log("  PASSO 1 — Credenciais do Zoho API Console");
  console.log("=".repeat(60));
  console.log("  Acesse https://api-console.zoho.com/ e crie um Client");
  console.log(`  Redirect URI: ${REDIRECT_URI}`);
  console.log("  Escopos: " + SCOPE);
  console.log();

  const clientId = await perguntar("Client ID");
  if (!clientId) {
    console.log("\n❌ Client ID é obrigatório. Abortando.");
    process.exit(1);
  }

  const clientSecret = await perguntar("Client Secret", true);
  if (!clientSecret) {
    console.log("\n❌ Client Secret é obrigatório. Abortando.");
    process.exit(1);
  }

  console.log("\n✅ Credenciais recebidas (não serão salvas em disco).");
  return { clientId, clientSecret };
}

async function passo2_gerarUrlAutorizacao(clientId: string): Promise<string> {
  console.log("\n" + "=".repeat(60));
  console.log("  PASSO 2 — Autorização no Zoho");
  console.log("=".repeat(60));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    scope: SCOPE,
  });

  const authUrl = `${AUTH_URL_BASE}?${params.toString()}`;

  console.log("\n  Abra esta URL no navegador:");
  console.log(`\n  ${authUrl}\n`);
  console.log("  Faça login na conta Zoho que tem acesso ao Zoho Mail.");
  console.log(`  Após autorizar, você será redirecionado para ${REDIRECT_URI}?code=...`);
  console.log("  Copie o código do parâmetro 'code' na URL.");

  return authUrl;
}

async function passo3_trocarCodePorToken(
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  console.log("\n" + "=".repeat(60));
  console.log("  PASSO 3 — Trocar código por tokens");
  console.log("=".repeat(60));

  const code = await perguntar("Código de autorização (authorization_code)");
  if (!code) {
    console.log("\n❌ Código obrigatório. Abortando.");
    process.exit(1);
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  console.log("\n  Solicitando tokens...");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.refresh_token) {
    console.log(`\n❌ Erro ao obter tokens: ${JSON.stringify(data)}`);
    console.log("  Possíveis causas:");
    console.log("  - Código expirado (válido por alguns minutos apenas)");
    console.log("  - Client ID ou Client Secret incorretos");
    console.log("  - Redirect URI não corresponde ao cadastrado no Zoho");
    process.exit(1);
  }

  console.log("\n✅ Access Token obtido!");
  console.log("✅ Refresh Token obtido!");

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
  };
}

async function passo4_buscarAccountId(accessToken: string): Promise<string> {
  console.log("\n" + "=".repeat(60));
  console.log("  PASSO 4 — Buscar Account ID");
  console.log("=".repeat(60));

  console.log("\n  Consultando contas disponíveis...");

  const response = await fetch(`${ZOHO_API_BASE}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.log(`\n❌ Erro ao buscar accounts: ${response.status} ${text.slice(0, 200)}`);
    console.log("  Você pode descobrir manualmente:");
    console.log("  1. Faça login no Zoho Mail");
    console.log("  2. Acesse Configurações > Contas");
    console.log("  3. O Account ID aparece na URL da página");
    return "DESCONHECIDO";
  }

  const data = await response.json();
  const accounts = data?.data || data?.accounts;

  if (Array.isArray(accounts) && accounts.length > 0) {
    const account = accounts[0];
    const accountId = String(account.accountId || account.id || "");
    const email = account.email || account.displayName || "";
    console.log(`\n  Conta encontrada: ${email} (ID: ${accountId})`);
    return accountId;
  }

  if (data?.data?.accountId) {
    return String(data.data.accountId);
  }

  console.log("\n  Resposta da API de accounts:");
  console.log(JSON.stringify(data, null, 2).slice(0, 500));
  console.log("\n  Não foi possível extrair o Account ID automaticamente.");
  console.log("  Tente acessar o Zoho Mail e verificar nas configurações da conta.");
  return "DESCONHECIDO";
}

// ============================================================
// RELATÓRIO
// ============================================================
function gerarInstrucoes(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
  accountId: string,
): void {
  console.log("\n" + "=".repeat(60));
  console.log("  ✅ SETUP CONCLUÍDO — Adicione ao .env");
  console.log("=".repeat(60));
  console.log();

  console.log("  Copie estas linhas para seu arquivo .env:\n");

  console.log("  # Zoho Mail — OAuth2");
  linha("VITE_ZOHO_CLIENT_ID", clientId, false);
  linha("VITE_ZOHO_CLIENT_SECRET", clientSecret, false);
  linha("VITE_ZOHO_REFRESH_TOKEN", refreshToken);
  console.log(`  VITE_ZOHO_ACCOUNT_ID=${accountId === "DESCONHECIDO" ? "" : accountId}`);
  console.log(`  VITE_ZOHO_DATA_CENTER=mail.zoho.com`);
  console.log(`  VITE_ZOHO_EMAIL_FROM=contato@conexaoexpress.com.br`);
  console.log();

  if (accountId === "DESCONHECIDO") {
    console.log("  ⚠️  Account ID não foi detectado automaticamente.");
    console.log("     Descubra manualmente e preencha VITE_ZOHO_ACCOUNT_ID.");
    console.log();
  }

  console.log("  📋 Próximos passos:");
  console.log("  1. Salve os valores acima no .env");
  console.log(`  2. Execute a migration: supabase db push --include-all`);
  console.log(`  3. Ative o conector:`);
  console.log(`     UPDATE ia_conectores SET modo = 'PRODUCAO_ASSISTIDA'`);
  console.log(`     WHERE codigo_unico = 'CON_ZOHO_EMAIL';`);
  console.log(`  4. Teste: npx tsx scripts/f2c_test_zoho_oauth2.ts`);
  console.log();
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("\n" + "🚀  Zoho Mail OAuth2 Setup");
  console.log("=".repeat(60));
  console.log("  Gera Refresh Token e Account ID para o Zoho Mail");
  console.log("  Nenhuma credencial será salva em disco.");
  console.log("  Tokens exibidos apenas mascarados.");
  console.log("=".repeat(60));

  const { clientId, clientSecret } = await passo1_obterCredenciais();
  await passo2_gerarUrlAutorizacao(clientId);
  const { accessToken, refreshToken } = await passo3_trocarCodePorToken(clientId, clientSecret);
  const accountId = await passo4_buscarAccountId(accessToken);
  await gerarInstrucoes(clientId, clientSecret, refreshToken, accountId);
}

main().catch((err) => {
  console.error("Erro no setup:", err);
  process.exit(1);
});
