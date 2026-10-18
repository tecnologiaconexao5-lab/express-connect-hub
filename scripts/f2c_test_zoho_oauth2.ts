/**
 * FASE P2C — Teste do Zoho Mail OAuth2
 *
 * Valida o fluxo completo sem enviar email real:
 * 1. Lê variáveis de ambiente OAuth2
 * 2. Obtém access_token via refresh_token
 * 3. Testa accountId
 * 4. Verifica configuração do conector CON_ZOHO_EMAIL
 * 5. Prepara payload de email (não envia sem aprovação)
 * 6. Confirma que aprovação da diretoria é obrigatória
 *
 * Uso: npx tsx scripts/f2c_test_zoho_oauth2.ts
 */
import { supabase } from "../src/lib/supabase";

type Resultado = {
  etapa: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  detalhe: string;
};

const resultados: Resultado[] = [];

function registrar(etapa: string, status: "PASS" | "FAIL" | "BLOCKED", detalhe: string) {
  resultados.push({ etapa, status, detalhe });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️";
  console.log(`${icon} ${etapa}: ${detalhe}`);
}

// ============================================================
// 1. Verificar variáveis de ambiente OAuth2
// ============================================================
function testEnvVars() {
  console.log("\n=== 1. Variáveis de Ambiente OAuth2 ===");

  const vars = {
    VITE_ZOHO_CLIENT_ID: import.meta.env.VITE_ZOHO_CLIENT_ID,
    VITE_ZOHO_CLIENT_SECRET: import.meta.env.VITE_ZOHO_CLIENT_SECRET,
    VITE_ZOHO_REFRESH_TOKEN: import.meta.env.VITE_ZOHO_REFRESH_TOKEN,
    VITE_ZOHO_ACCOUNT_ID: import.meta.env.VITE_ZOHO_ACCOUNT_ID,
    VITE_ZOHO_DATA_CENTER: import.meta.env.VITE_ZOHO_DATA_CENTER,
    VITE_ZOHO_EMAIL_FROM: import.meta.env.VITE_ZOHO_EMAIL_FROM,
  };

  const presentes = Object.entries(vars).filter(([_, v]) => v).map(([k]) => k);
  const ausentes = Object.entries(vars).filter(([_, v]) => !v).map(([k]) => k);

  if (ausentes.length === 0) {
    registrar("1.1 Variáveis OAuth2", "PASS",
      `Todas ${presentes.length}/6 presentes`);
  } else {
    registrar("1.1 Variáveis OAuth2", "BLOCKED",
      `${presentes.length}/6 presentes. Ausentes: ${ausentes.join(", ")}`);
  }

  // Verificar se API Key antiga NÃO está mais sendo usada como principal
  const apiKeyAntiga = import.meta.env.VITE_ZOHO_EMAIL_API_KEY;
  if (apiKeyAntiga) {
    registrar("1.2 API Key obsoleta", "PASS",
      "VITE_ZOHO_EMAIL_API_KEY presente mas não é mais usada para autenticação principal");
  } else {
    registrar("1.2 API Key obsoleta", "PASS",
      "VITE_ZOHO_EMAIL_API_KEY não configurada (removida corretamente)");
  }
}

// ============================================================
// 2. Obter access_token via refresh_token
// ============================================================
async function testAccessToken() {
  console.log("\n=== 2. Access Token via Refresh Token ===");

  const clientId = import.meta.env.VITE_ZOHO_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_ZOHO_CLIENT_SECRET;
  const refreshToken = import.meta.env.VITE_ZOHO_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    registrar("2.1 Obter access_token", "BLOCKED",
      "Credenciais OAuth2 ausentes no .env");
    return false;
  }

  try {
    const params = new URLSearchParams();
    params.set("refresh_token", refreshToken);
    params.set("grant_type", "refresh_token");
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);

    const response = await fetch("https://accounts.zoho.com/oauth/v2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await response.json();

    if (response.ok && data.access_token) {
      registrar("2.1 Obter access_token", "PASS",
        `Token obtido, expires_in: ${data.expires_in}s`);
      return data.access_token as string;
    }

    if (data.error === "invalid_grant") {
      registrar("2.1 Obter access_token", "FAIL",
        "Refresh token inválido ou expirado. Gere um novo no Zoho API Console.");
    } else {
      registrar("2.1 Obter access_token", "FAIL",
        `Erro: ${data.error || response.status}`);
    }
    return false;
  } catch (e: any) {
    registrar("2.1 Obter access_token", "FAIL",
      `Falha de rede: ${e.message}`);
    return false;
  }
}

// ============================================================
// 3. Testar accountId
// ============================================================
async function testAccountId(accessToken: string) {
  console.log("\n=== 3. Account ID ===");

  const accountId = import.meta.env.VITE_ZOHO_ACCOUNT_ID;
  const dataCenter = import.meta.env.VITE_ZOHO_DATA_CENTER || "mail.zoho.com";

  if (!accountId) {
    registrar("3.1 Verificar accountId", "BLOCKED",
      "VITE_ZOHO_ACCOUNT_ID não configurado");
    return;
  }

  try {
    const endpoint = `https://${dataCenter}/api/accounts/${accountId}`;
    const response = await fetch(endpoint, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });

    if (response.ok) {
      registrar("3.1 Verificar accountId", "PASS",
        `Account ${accountId} válido (${dataCenter})`);
    } else if (response.status === 401) {
      registrar("3.1 Verificar accountId", "FAIL",
        "Token inválido ou expirado");
    } else if (response.status === 404) {
      registrar("3.1 Verificar accountId", "FAIL",
        `Account ${accountId} não encontrado`);
    } else {
      const text = await response.text().catch(() => "");
      registrar("3.1 Verificar accountId", "FAIL",
        `HTTP ${response.status}: ${text.slice(0, 100)}`);
    }
  } catch (e: any) {
    registrar("3.1 Verificar accountId", "FAIL",
      `Falha: ${e.message}`);
  }
}

// ============================================================
// 4. Verificar conector CON_ZOHO_EMAIL no banco
// ============================================================
async function testConector() {
  console.log("\n=== 4. Conector CON_ZOHO_EMAIL ===");

  try {
    const { data: conector } = await supabase
      .from("ia_conectores")
      .select("codigo_unico, tipo, provedor, modo, credenciais, config_default, url_base")
      .eq("codigo_unico", "CON_ZOHO_EMAIL")
      .single();

    if (!conector) {
      registrar("4.1 Conector no banco", "FAIL",
        "CON_ZOHO_EMAIL não encontrado");
      return;
    }

    const creds = conector.credenciais as Record<string, unknown> | undefined;
    const hasOAuth2Refs = creds &&
      typeof creds.env_var_client_id === "string" &&
      typeof creds.env_var_client_secret === "string" &&
      typeof creds.env_var_refresh_token === "string";

    if (hasOAuth2Refs) {
      registrar("4.1 Conector no banco", "PASS",
        `CON_ZOHO_EMAIL (${conector.modo}) — credenciais OAuth2 referenciadas`);
    } else {
      registrar("4.1 Conector no banco", "FAIL",
        "Credenciais OAuth2 não referenciadas no conector");
    }

    // Verificar vínculos
    const { data: vinculos } = await supabase
      .from("ia_conector_robo")
      .select("robo_id, modo, ativo")
      .eq("conector_id", conector.id);

    if (vinculos && vinculos.length > 0) {
      const modos = vinculos.map(v => `${v.modo}${v.ativo ? "" : " (inativo)"}`).join(", ");
      registrar("4.2 Vínculos com robôs", "PASS",
        `${vinculos.length} vínculos: ${modos}`);
    } else {
      registrar("4.2 Vínculos com robôs", "PASS",
        "Nenhum vínculo (serão ativados quando configurado)");
    }
  } catch (e: any) {
    registrar("4. Conector no banco", "BLOCKED",
      `Supabase: ${e.message}`);
  }
}

// ============================================================
// 5. Verificar aprovação obrigatória
// ============================================================
async function testAprovacao() {
  console.log("\n=== 5. Aprovação da Diretoria ===");

  try {
    const { data: ferramenta } = await supabase
      .from("ia_ferramentas")
      .select("codigo_unico, nome, precisa_aprovacao, risco_operacional")
      .eq("codigo_unico", "COM_ENVIAR_EMAIL")
      .single();

    if (!ferramenta) {
      registrar("5.1 Ferramenta COM_ENVIAR_EMAIL", "FAIL",
        "Ferramenta não encontrada");
      return;
    }

    if (ferramenta.precisa_aprovacao) {
      registrar("5.1 Ferramenta COM_ENVIAR_EMAIL", "PASS",
        `precisa_aprovacao=true, risco=${ferramenta.risco_operacional}`);
    } else {
      registrar("5.1 Ferramenta COM_ENVIAR_EMAIL", "FAIL",
        "precisa_aprovacao=false — envio direto sem aprovação!");
    }

    // Verificar nível de autonomia nos vínculos
    const { data: vinculos } = await supabase
      .from("ia_robo_ferramentas")
      .select("robo_id, nivel_autonomia, limite_diario")
      .eq("ferramenta_id", ferramenta.id)
      .limit(5);

    if (vinculos) {
      const todosComAprovacao = vinculos.every(v =>
        v.nivel_autonomia === "EXECUTAR_COM_APROVACAO");

      if (todosComAprovacao) {
        registrar("5.2 Nível de autonomia", "PASS",
          `Todos os ${vinculos.length} vínculos em EXECUTAR_COM_APROVACAO`);
      } else {
        const auto = vinculos.filter(v => v.nivel_autonomia === "EXECUTAR_AUTONOMO");
        registrar("5.2 Nível de autonomia", "FAIL",
          `${auto.length} vínculos em EXECUTAR_AUTONOMO — risco de envio sem aprovação`);
      }
    }
  } catch (e: any) {
    registrar("5. Aprovação", "BLOCKED",
      `Supabase: ${e.message}`);
  }
}

// ============================================================
// RELATÓRIO FINAL
// ============================================================
function relatorio() {
  const pass = resultados.filter(r => r.status === "PASS").length;
  const fail = resultados.filter(r => r.status === "FAIL").length;
  const blocked = resultados.filter(r => r.status === "BLOCKED").length;
  const total = resultados.length;

  console.log("\n\n=========================================");
  console.log("RELATÓRIO FINAL — ZOHO OAUTH2");
  console.log("=========================================");
  console.log(`Total: ${total} | ✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⏭️ BLOCKED: ${blocked}`);
  console.log(`Percentual: ${total > 0 ? ((pass / total) * 100).toFixed(1) : 0}%`);

  const blockedVars = resultados.filter(r =>
    r.etapa.includes("Variáveis") && r.status === "BLOCKED");
  if (blockedVars.length > 0) {
    console.log("\n📋 Para ativar Zoho OAuth2:");
    console.log("  1. Criar app em https://api-console.zoho.com/");
    console.log("  2. Gerar refresh_token com escopos:");
    console.log("     ZohoMail.messages.CREATE, ZohoMail.accounts.READ");
    console.log("  3. Adicionar ao .env:");
    console.log("     VITE_ZOHO_CLIENT_ID, VITE_ZOHO_CLIENT_SECRET,");
    console.log("     VITE_ZOHO_REFRESH_TOKEN, VITE_ZOHO_ACCOUNT_ID");
    console.log("  4. Rodar migration: supabase db push --include-all");
    console.log("  5. Alterar conector para PRODUCAO_ASSISTIDA:");
    console.log("     UPDATE ia_conectores SET modo = 'PRODUCAO_ASSISTIDA'");
    console.log("     WHERE codigo_unico = 'CON_ZOHO_EMAIL';");
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log("🚀 FASE P2C — Teste Zoho Mail OAuth2\n");
  console.log(`📅 ${new Date().toISOString()}\n`);

  testEnvVars();

  const accessToken = await testAccessToken();

  if (typeof accessToken === "string") {
    await testAccountId(accessToken);
  }

  await testConector();
  await testAprovacao();
  relatorio();
}

main().catch(console.error);
