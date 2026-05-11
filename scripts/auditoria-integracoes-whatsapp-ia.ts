/**
 * auditoria-integracoes-whatsapp-ia.ts
 * Script de auditoria das integrações WhatsApp + IA no TMS
 * Uso: npx tsx scripts/auditoria-integracoes-whatsapp-ia.ts
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
let passou = 0;
let falhou = 0;

function ok(label: string) {
  console.log(`  ✅ ${label}`);
  passou++;
}

function fail(label: string) {
  console.log(`  ❌ ${label}`);
  falhou++;
}

function check(label: string, condition: boolean) {
  condition ? ok(label) : fail(label);
}

function fileExists(relPath: string, label?: string): boolean {
  const exists = existsSync(resolve(ROOT, relPath));
  check(label || relPath, exists);
  return exists;
}

function fileContains(relPath: string, pattern: string, label: string): boolean {
  try {
    const content = readFileSync(resolve(ROOT, relPath), "utf-8");
    const found = content.includes(pattern);
    check(label, found);
    return found;
  } catch {
    fail(label + " (arquivo ilegível)");
    return false;
  }
}

console.log("\n🔍 AUDITORIA TMS — INTEGRAÇÕES WHATSAPP + IA");
console.log("=".repeat(50));

// ── 1. ARQUIVOS EXISTEM ───────────────────────────────────────────────────
console.log("\n📁 1. Arquivos criados:");
fileExists("sql/integracoes_whatsapp_ia.sql", "SQL integracoes_whatsapp_ia.sql");
fileExists("src/services/evolutionApiService.ts", "evolutionApiService.ts");
fileExists("src/services/integracoes/iaService.ts", "integracoes/iaService.ts");
fileExists("src/pages/IntegracoesTMS.tsx", "IntegracoesTMS.tsx");
fileExists("src/pages/MensagensWhatsApp.tsx", "MensagensWhatsApp.tsx");
fileExists("docs/WEBHOOK_WHATSAPP_N8N_TMS.md", "WEBHOOK_WHATSAPP_N8N_TMS.md");
fileExists("docs/n8n_recrutamento_whatsapp_workflow_exemplo.json", "n8n_workflow_exemplo.json");

// ── 2. FUNÇÕES EXPORTADAS — evolutionApiService ───────────────────────────
console.log("\n⚡ 2. Funções exportadas — evolutionApiService.ts:");
const evoFile = "src/services/evolutionApiService.ts";
fileContains(evoFile, "export async function testarConexaoEvolution", "testarConexaoEvolution()");
fileContains(evoFile, "export async function criarInstancia", "criarInstancia()");
fileContains(evoFile, "export async function conectarInstancia", "conectarInstancia()");
fileContains(evoFile, "export async function configurarWebhook", "configurarWebhook()");
fileContains(evoFile, "export async function statusInstancia", "statusInstancia()");
fileContains(evoFile, "export async function enviarMensagemTexto", "enviarMensagemTexto()");

// ── 3. FUNÇÕES EXPORTADAS — iaService ────────────────────────────────────
console.log("\n🤖 3. Funções exportadas — iaService.ts:");
const iaFile = "src/services/integracoes/iaService.ts";
fileContains(iaFile, "export async function testarGroq", "testarGroq()");
fileContains(iaFile, "export async function testarGemini", "testarGemini()");
fileContains(iaFile, "export async function gerarRespostaIA", "gerarRespostaIA()");
fileContains(iaFile, "export async function registrarLogIA", "registrarLogIA()");
fileContains(iaFile, "maskKey", "Proteção de chave (maskKey)");

// ── 4. SQL — tabelas definidas ────────────────────────────────────────────
console.log("\n🗄️  4. Tabelas SQL definidas:");
const sqlFile = "sql/integracoes_whatsapp_ia.sql";
fileContains(sqlFile, "CREATE TABLE IF NOT EXISTS integracoes_config", "integracoes_config");
fileContains(sqlFile, "CREATE TABLE IF NOT EXISTS whatsapp_instancias", "whatsapp_instancias");
fileContains(sqlFile, "CREATE TABLE IF NOT EXISTS whatsapp_conversas", "whatsapp_conversas");
fileContains(sqlFile, "CREATE TABLE IF NOT EXISTS whatsapp_mensagens", "whatsapp_mensagens");
fileContains(sqlFile, "CREATE TABLE IF NOT EXISTS ia_logs", "ia_logs");

// ── 5. .env.example atualizado ────────────────────────────────────────────
console.log("\n🔧 5. Variáveis .env.example:");
const envEx = ".env.example";
fileContains(envEx, "VITE_EVOLUTION_SERVER_URL", "VITE_EVOLUTION_SERVER_URL");
fileContains(envEx, "VITE_EVOLUTION_INSTANCE", "VITE_EVOLUTION_INSTANCE");
fileContains(envEx, "VITE_N8N_WEBHOOK_URL", "VITE_N8N_WEBHOOK_URL");
fileContains(envEx, "VITE_GROQ_API_KEY", "VITE_GROQ_API_KEY");
fileContains(envEx, "VITE_GEMINI_API_KEY", "VITE_GEMINI_API_KEY");

// ── 6. App.tsx com rotas ──────────────────────────────────────────────────
console.log("\n🗺️  6. Rotas no App.tsx:");
const appFile = "src/App.tsx";
fileContains(appFile, "IntegracoesTMS", "import IntegracoesTMS");
fileContains(appFile, "MensagensWhatsApp", "import MensagensWhatsApp");
fileContains(appFile, '"/integracoes"', 'rota /integracoes');
fileContains(appFile, '"/mensagens-whatsapp"', 'rota /mensagens-whatsapp');

// ── 7. Tela de Integrações — abas ─────────────────────────────────────────
console.log("\n🖥️  7. Tela IntegracoesTMS — funcionalidades:");
const intFile = "src/pages/IntegracoesTMS.tsx";
fileContains(intFile, "testarConexaoEvolution", "usa testarConexaoEvolution");
fileContains(intFile, "criarInstancia", "usa criarInstancia");
fileContains(intFile, "conectarInstancia", "usa conectarInstancia (QR)");
fileContains(intFile, "configurarWebhook", "usa configurarWebhook");
fileContains(intFile, "enviarMensagemTexto", "usa enviarMensagemTexto");
fileContains(intFile, "testarGroq", "usa testarGroq");
fileContains(intFile, "testarGemini", "usa testarGemini");
fileContains(intFile, "qrBase64", "exibe QR Code base64");
fileContains(intFile, "LogBox", "componente LogBox");

// ── 8. Tela de Mensagens ──────────────────────────────────────────────────
console.log("\n💬 8. Tela MensagensWhatsApp — funcionalidades:");
const msgFile = "src/pages/MensagensWhatsApp.tsx";
fileContains(msgFile, "whatsapp_conversas", "lê whatsapp_conversas");
fileContains(msgFile, "whatsapp_mensagens", "lê whatsapp_mensagens");
fileContains(msgFile, "enviarMensagemTexto", "envia via Evolution API");
fileContains(msgFile, "gerarRespostaIA", "gera resposta com IA");
fileContains(msgFile, "PainelConversa", "componente PainelConversa");
fileContains(msgFile, "sugestaoIA", "campo sugestão IA");

// ── RESUMO FINAL ───────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log(`📊 RESULTADO: ${passou} verificações passaram | ${falhou} falharam`);

if (falhou === 0) {
  console.log("🎉 Todas as verificações passaram! Execute: npm run build\n");
} else {
  console.log(`⚠️  ${falhou} item(s) precisam de atenção antes do build.\n`);
  process.exit(1);
}
