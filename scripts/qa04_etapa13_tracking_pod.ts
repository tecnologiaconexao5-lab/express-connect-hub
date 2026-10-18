import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

async function main() {
  const s = createClient(URL, ANON_KEY);
  const { error: ae } = await s.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
  });
  if (ae) { console.error("Auth:", ae.message); return; }
  console.log("Auth OK");

  // Check portal_tracking_realtime (2 records found earlier)
  const { data: tr, error: trE } = await s.from("portal_tracking_realtime").select("*");
  if (trE) console.log("tracking ERR:", trE.message);
  else {
    console.log("portal_tracking_realtime:", tr?.length || 0, "records");
    if (tr && tr.length > 0) {
      tr.forEach((t, i) => console.log(`  ${i+1}. alocacao_id=${(t.alocacao_id||"").slice(0,8)} status=${t.status} created=${t.created_at}`));
    }
  }

  // Check tracking_links
  const { data: tl } = await s.from("tracking_links").select("id, token, os_id, created_at").limit(5);
  console.log("tracking_links:", tl?.length || 0, "records");
  if (tl && tl.length > 0) tl.forEach(t => console.log(`  token=${t.token?.slice(0,16)} os_id=${(t.os_id||"").slice(0,8)}`));

  // Check entregas_protocolo (POD)
  const { data: ep } = await s.from("entregas_protocolo").select("id, alocacao_id, data_hora_entrega, nome_recebedor").limit(10);
  console.log("\nentregas_protocolo (POD):", ep?.length || 0);
  if (ep && ep.length > 0) {
    ep.forEach((e, i) => console.log(`  ${i+1}. aloc_id=${(e.alocacao_id||"").slice(0,8)} data=${e.data_hora_entrega?.slice(0,10)} recebedor=${e.nome_recebedor || "?"}`));
  }

  // Check trigger M66 status (by checking if composicao_financeira_os has records with os_id matching ordens_servico)
  const { data: cfo } = await s.from("composicao_financeira_os").select("os_id, cliente_valor, prestador_valor").limit(5);
  console.log("\ncomposicao_financeira_os:", cfo?.length || 0);
  if (cfo && cfo.length > 0) {
    cfo.forEach((c, i) => console.log(`  ${i+1}. os_id=${(c.os_id||"").slice(0,8)} cliente=${c.cliente_valor} prestador=${c.prestador_valor}`));
  }

  // Verify os_id matches in composicao_financeira_os vs ordens_servico
  const { data: cfoAll } = await s.from("composicao_financeira_os").select("os_id");
  if (cfoAll && cfoAll.length > 0) {
    const cfOsIds = [...new Set(cfoAll.map(c => c.os_id).filter(Boolean))] as string[];
    console.log(`\nUnique os_id in composicao_financeira_os: ${cfOsIds.length}`);
    
    // Cross-reference with ordens_servico
    let cfFound = 0, cfErr = 0;
    for (const oid of cfOsIds.slice(0, 20)) {
      const { data: r, error: e } = await s.from("ordens_servico").select("id").eq("id", oid).maybeSingle();
      if (e) cfErr++;
      else if (r) cfFound++;
    }
    console.log(`Cross-ref (first 20): ${cfFound} found, ${cfErr} errors`);
  }

  // Check M66 trigger by looking at one alocacao and seeing if it generated financeiro
  const { data: aloc } = await s.from("alocacoes_escala").select("id, ordem_servico_id, created_at").order("created_at", { ascending: false }).limit(3);
  if (aloc && aloc.length > 0) {
    console.log("\nLast 3 alocacoes:");
    for (const a of aloc) {
      // Check if this aloc generated financeiro
      const { data: fr } = await s.from("financeiro_receber").select("id, valor").eq("alocacao_id", a.id);
      console.log(`  Aloc ${(a.id||"").slice(0,8)} OS=${(a.ordem_servico_id||"").slice(0,8)||"null"} -> financeiro_receber: ${fr?.length || 0} records`);
    }
  }

  console.log("\n=== ETAPA 13 DONE ===");
}
main().catch(console.error);
