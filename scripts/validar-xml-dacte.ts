import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!;
const LOGS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "logs");
const CTE_ID = "a3bccf2a-7f56-41f0-8746-3adeb914ca95";

const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function main() {
  console.log("═".repeat(70));
  console.log("  VALIDACAO XML/DACTE — CT-e 2628647");
  console.log("═".repeat(70));

  // 1. Check current DB state
  console.log("\n1. Estado atual do CT-e no banco:");
  const { data: cte } = await s.from("fiscal_ctes").select("id, status, chave_acesso, xml_url, pdf_url, metadata").filter("metadata->>nfe_numero", "eq", "2628647").filter("metadata->>romaneio_numero", "eq", "340612").limit(1);
  
  const ct = cte?.[0];
  if (!ct) { console.log("   ❌ CT-e nao encontrado"); return; }
  
  console.log(`   Status: ${(ct as any).status}`);
  console.log(`   Chave: ${((ct as any).chave_acesso || "").slice(0, 30)}...`);
  console.log(`   xml_url: ${(ct as any).xml_url ? "✅ " + ((ct as any).xml_url).slice(0, 60) + "..." : "❌ VAZIO"}`);
  console.log(`   pdf_url: ${(ct as any).pdf_url ? "✅ " + ((ct as any).pdf_url).slice(0, 60) + "..." : "❌ VAZIO"}`);
  
  const meta = (ct as any).metadata || {};
  const docsStorage = meta.documentos_storage || {};
  console.log(`   documentos_storage.xml: ${docsStorage.xml?.salvo ? "✅ SALVO" : "❌ NAO SALVO"}`);
  console.log(`   documentos_storage.dacte: ${docsStorage.dacte?.salvo ? "✅ SALVO" : "❌ NAO SALVO"}`);
  if (docsStorage.xml?.storage_path) console.log(`   XML path: ${docsStorage.xml.storage_path}`);
  if (docsStorage.dacte?.storage_path) console.log(`   DACTE path: ${docsStorage.dacte.storage_path}`);

  // 2. Call focus-documentos to download and save
  console.log("\n2. Chamando focus-documentos para baixar XML + DACTE...");
  
  const t0 = Date.now();
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/focus-documentos`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tipoDocumento: "cte",
      documentoId: CTE_ID,
      ambiente: "homologacao",
      documentos: ["xml", "dacte"],
      force: false,
    }),
  });

  const result = await resp.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  
  console.log(`   HTTP ${resp.status} (${elapsed}s)`);
  console.log(`   OK: ${result.ok ? "✅" : "❌"}`);
  console.log(`   Mensagem: ${result.mensagem}`);
  
  if (result.resultados) {
    for (const [tipo, r] of Object.entries(result.resultados) as any) {
      console.log(`   ${tipo}: salvo=${r.salvo} ja_existia=${r.ja_existia || false} erro=${r.erro || "nenhum"}`);
      if (r.storage_path) console.log(`     path: ${r.storage_path}`);
    }
  }

  // 3. Re-check DB state
  console.log("\n3. Estado apos download:");
  const { data: cte2 } = await s.from("fiscal_ctes").select("id, xml_url, pdf_url, metadata").filter("metadata->>nfe_numero", "eq", "2628647").filter("metadata->>romaneio_numero", "eq", "340612").limit(1);
  
  if (cte2?.[0]) {
    const m2 = (cte2[0] as any).metadata || {};
    const ds2 = m2.documentos_storage || {};
    console.log(`   xml_url: ${(cte2[0] as any).xml_url ? "✅" : "❌"}`);
    console.log(`   pdf_url: ${(cte2[0] as any).pdf_url ? "✅" : "❌"}`);
    console.log(`   documentos_storage.xml.salvo: ${ds2.xml?.salvo ? "✅" : "❌"}`);
    console.log(`   documentos_storage.dacte.salvo: ${ds2.dacte?.salvo ? "✅" : "❌"}`);
    if (ds2.xml?.tamanho_bytes) console.log(`   XML tamanho: ${ds2.xml.tamanho_bytes} bytes`);
    if (ds2.dacte?.tamanho_bytes) console.log(`   DACTE tamanho: ${ds2.dacte.tamanho_bytes} bytes`);
    if (ds2.xml?.salvo_em) console.log(`   XML salvo em: ${ds2.xml.salvo_em}`);
  }

  // 4. Save report
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOGS_DIR, "focus-documentos-cte-2628647-homologacao.json"), JSON.stringify({
    data: new Date().toISOString(),
    cte_id: CTE_ID,
    nfe: "2628647",
    chave: "CTe35260642796040000131570010000000021318813560",
    resultado: result,
    documentos_storage_final: cte2?.[0] ? (cte2[0] as any).metadata?.documentos_storage : null,
  }, null, 2));

  console.log(`\n💾 Salvo em logs/focus-documentos-cte-2628647-homologacao.json`);
  console.log("═".repeat(70));
}

main().catch(console.error);
