import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const LOGS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY ausentes no .env");
  process.exit(1);
}

const CTE_ID = "a3bccf2a-7f56-41f0-8746-3adeb914ca95";
const REF = `cte-${CTE_ID}`;
const NFE = "2628647";
const AMBIENTE = "homologacao";

function mask(s: string | null | undefined): string {
  if (!s) return "(vazio)";
  if (s.length <= 8) return s.slice(0, 4) + "***";
  return s.slice(0, 5) + "***" + s.slice(-4);
}

async function main() {
  console.log("═".repeat(70));
  console.log(`  CONSULTA STATUS FOCUS — CT-e NF-e ${NFE}`);
  console.log("═".repeat(70));
  console.log(`  Ambiente: ${AMBIENTE.toUpperCase()}`);
  console.log(`  Ref: ${REF}`);
  console.log("  ⚠️  APENAS CONSULTA — NENHUM REENVIO");
  console.log("═".repeat(70));

  // Get token from ping
  console.log("\n1. Obtendo token Focus...");
  const pingResp = await fetch(`${SUPABASE_URL}/functions/v1/focus-emissao`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ping" }),
  });
  if (!pingResp.ok) { console.error(`❌ Ping falhou: HTTP ${pingResp.status}`); process.exit(1); }
  const pingData = await pingResp.json();
  console.log(`   Token: ${pingData?.secrets?.focus_token_homologacao_preview || "?"}`);

  // Call focus-consulta Edge Function
  console.log("\n2. Chamando focus-consulta...");
  const consultaResp = await fetch(`${SUPABASE_URL}/functions/v1/focus-consulta`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tipoDocumento: "cte",
      documentoId: CTE_ID,
      ambiente: AMBIENTE,
    }),
  });

  const consultaStatus = consultaResp.status;
  let consultaBody: any;
  try { consultaBody = await consultaResp.json(); } catch { consultaBody = { erro: "nao foi possivel parsear JSON" }; }

  console.log(`\n  HTTP Status: ${consultaStatus}`);
  console.log(`  OK: ${consultaBody?.ok ? "✅" : "❌"}`);
  console.log(`\n  Body completo:`);
  console.log(JSON.stringify(consultaBody, null, 2));

  // Extract status
  const focusStatus = consultaBody?.status || consultaBody?.statusAtual || "desconhecido";
  const autorizado = focusStatus === "autorizado";
  const rejeitado = focusStatus === "rejeitado" || consultaBody?.motivo;
  const processando = focusStatus === "processando_autorizacao" || focusStatus === "processando";
  
  console.log(`\n  ─── RESUMO ───`);
  console.log(`  Status Focus: ${focusStatus}`);
  console.log(`  Autorizado? ${autorizado ? "✅ SIM" : "❌ NAO"}`);
  console.log(`  Rejeitado? ${rejeitado ? "❌ SIM" : "✅ NAO"}`);
  console.log(`  Processando? ${processando ? "⏳ SIM" : "✅ NAO"}`);
  if (consultaBody?.motivo) console.log(`  Motivo: ${consultaBody.motivo}`);
  if (consultaBody?.protocolo) console.log(`  Protocolo: ${consultaBody.protocolo}`);
  if (consultaBody?.chave) console.log(`  Chave: ${consultaBody.chave}`);
  if (consultaBody?.xml_url) console.log(`  XML: ${consultaBody.xml_url}`);
  if (consultaBody?.pdf_url) console.log(`  DACTE: ${consultaBody.pdf_url}`);

  // Save
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, "focus-consulta-cte-2628647-homologacao.json"), JSON.stringify({
    data: new Date().toISOString(),
    ref: REF,
    nfe: NFE,
    ambiente: AMBIENTE,
    http_status: consultaStatus,
    body: consultaBody,
    status_focus: focusStatus,
    autorizado, rejeitado, processando,
  }, null, 2));

  console.log(`\n  💾 Salvo em logs/focus-consulta-cte-2628647-homologacao.json`);

  // ═══ SEGURANCA ═══
  console.log("\n" + "═".repeat(70));
  console.log("  SEGURANCA");
  console.log("═".repeat(70));
  console.log("  POST emissao feito?       NAO (apenas consulta)");
  console.log("  Producao chamada?         NAO");
  console.log("  Lote enviado?             NAO");
  console.log("  Outros 15 rascunhos?      NAO VERIFICADOS (sem acesso DB nesta execucao)");
  console.log("  Token exposto?            NAO");

  console.log("\n" + "═".repeat(70));
  console.log("  CONSULTA CONCLUIDA");
  console.log("═".repeat(70));
}

main().catch(console.error);
