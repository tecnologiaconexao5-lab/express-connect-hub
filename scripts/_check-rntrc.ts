import { createClient } from "@supabase/supabase-js";
const s = createClient("https://uwrvzsjtpgaifkktpepn.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs");

async function main() {
  console.log("=== CONFIGURACOES FISCAIS ===");
  const { data: cf } = await s.from("configuracoes_fiscais").select("id, razao_social, cnpj, ie, rntrc, ativo, padrao, regime_tributario").limit(5);
  console.log("count:", cf?.length || 0);
  if (cf) for (const r of cf) console.log(`  ${r.razao_social} | cnpj=${r.cnpj} | ie=${r.ie} | rntrc=${r.rntrc} | ativo=${r.ativo} | padrao=${r.padrao}`);

  console.log("\n=== CT-e EMITENTE RNTRC ===");
  const { data: ctes } = await s.from("fiscal_ctes").select("id, metadata").filter("metadata->>romaneio_numero","eq","340612").limit(1);
  if (ctes) {
    const pf = (ctes[0].metadata as any)?.payload_focus;
    console.log("emitente.rntrc:", pf?.emitente?.rntrc);
  }

  if (!cf || cf.length === 0) {
    console.log("\n⚠️ Tabela configuracoes_fiscais vazia — precisa rodar o script de configuracao do emitente primeiro.");
    console.log("   Script: npx tsx scripts/configurar-emitente-real-conexao.ts");
  }
}
main();
