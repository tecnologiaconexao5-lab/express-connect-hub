/**
 * CALVO 340612 — LIMPAR RASCUNHOS ANTIGOS E VERIFICAR IBGE
 * Executar: npx tsx scripts/calvo-limpar-rascunhos-340612.ts
 */
import { createClient } from "@supabase/supabase-js";

const s = createClient(
  "https://uwrvzsjtpgaifkktpepn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs"
);

const ROMANEIO = "340612";

async function main() {
  console.log("═".repeat(60));
  console.log("  CALVO 340612 — LIMPAR RASCUNHOS ANTIGOS");
  console.log("═".repeat(60));

  // ── TAREFA 1: Confirmar IBGE ───────────────────────────────
  console.log("\n📌 TAREFA 1 — IBGE São Paulo");
  const { data: ibgeSp } = await s.from("municipios_ibge")
    .select("codigo, nome, uf")
    .eq("uf", "SP")
    .order("nome");

  console.log(`  Total SP: ${ibgeSp?.length || 0}`);
  const sp3550308 = ibgeSp?.find((m: any) => m.codigo === "3550308");
  if (sp3550308) {
    console.log(`  ✅ São Paulo: ${sp3550308.codigo} — ${sp3550308.nome}/${sp3550308.uf}`);
  } else {
    console.log("  ❌ IBGE 3550308 NÃO encontrado! Precisa popular a tabela municipios_ibge.");
    console.log("     Execute no SQL Editor do Supabase:");
    console.log("     INSERT INTO municipios_ibge (codigo, nome, uf) VALUES ('3550308','São Paulo','SP') ON CONFLICT DO NOTHING;");
  }

  if (ibgeSp && ibgeSp.length > 0) {
    console.log("  Municípios SP cadastrados:");
    for (const m of ibgeSp) console.log(`    ${m.codigo} — ${m.nome}`);
  }

  // ── TAREFA 2: Identificar rascunhos antigos ────────────────
  console.log("\n📌 TAREFA 2 — Identificar rascunhos do romaneio 340612");

  const { data: rascunhos } = await s.from("fiscal_ctes")
    .select("id, numero, valor, status, tomador_nome, metadata")
    .eq("status", "rascunho")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO)
    .order("valor", { ascending: false });

  if (!rascunhos || rascunhos.length === 0) {
    console.log("  ✅ Nenhum rascunho encontrado para o romaneio 340612.");
    console.log("  Nada a limpar.");
    return;
  }

  console.log(`  📋 ${rascunhos.length} rascunho(s) encontrado(s):\n`);
  console.log("ID".padEnd(38) + "Valor".padEnd(12) + "NF-e".padEnd(12) + "Tomador".padEnd(30) + "CFOP");
  console.log("─".repeat(130));

  let soma = 0;
  for (const r of rascunhos) {
    const meta = r.metadata || {};
    const nfe = meta.nfe_numero || "-";
    const cfop = meta.payload_focus?.carga?.cfop || meta.payload_focus?.fiscal?.cfop || "-";
    const tomador = (r.tomador_nome || meta.payload_focus?.tomador?.nome || "-").slice(0, 28);
    soma += r.valor || 0;
    console.log(
      (r.id || "").slice(0, 36).padEnd(38) +
      `R$ ${(r.valor || 0).toFixed(2)}`.padEnd(12) +
      nfe.padEnd(12) +
      tomador.padEnd(30) +
      cfop
    );
  }
  console.log(`\n  Soma: R$ ${soma.toFixed(2)}`);

  // ── TAREFA 3: Remover rascunhos ────────────────────────────
  console.log(`\n📌 TAREFA 3 — Remover ${rascunhos.length} rascunhos antigos`);

  // Remover eventos vinculados
  const ids = rascunhos.map((r: any) => r.id);
  const { error: evtErr } = await s.from("fiscal_events")
    .delete()
    .in("documento_id", ids)
    .eq("documento_tipo", "CTE");
  console.log(evtErr ? `  ⚠️ Erro eventos: ${evtErr.message}` : "  ✅ Eventos removidos");

  // Remover logs vinculados
  const { error: logErr } = await s.from("fiscal_logs")
    .delete()
    .in("entidade_id", ids)
    .eq("entidade_tipo", "CTE");
  console.log(logErr ? `  ⚠️ Erro logs: ${logErr.message}` : "  ✅ Logs removidos");

  // Remover CT-es
  const { error: cteErr } = await s.from("fiscal_ctes")
    .delete()
    .in("id", ids);
  if (cteErr) {
    console.log(`  ❌ Erro ao remover CT-es: ${cteErr.message}`);
    console.log("  Detalhes:", cteErr.details);
  } else {
    console.log(`  ✅ ${rascunhos.length} CT-es rascunho removidos`);
  }

  // ── Confirmar ──────────────────────────────────────────────
  console.log("\n📌 CONFIRMAÇÃO PÓS-REMOÇÃO");
  const { data: posRemocao } = await s.from("fiscal_ctes")
    .select("id", { count: "exact", head: true })
    .eq("status", "rascunho")
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO);
  console.log(`  Rascunhos restantes do romaneio ${ROMANEIO}: ${posRemocao?.length ?? "?"} `);

  // Documentos vinculados continuam intactos
  const { data: docs } = await s.from("fiscal_documentos_vinculados")
    .select("numero", { count: "exact", head: true })
    .filter("metadata->>romaneio_numero", "eq", ROMANEIO);
  console.log(`  Documentos fiscais intactos: ${docs?.length ?? "?"} (esperado: 16)`);

  console.log("\n" + "═".repeat(60));
  console.log("  CONCLUSÃO");
  console.log("═".repeat(60));
  console.log(`  Rascunhos removidos:     ${rascunhos.length}`);
  console.log(`  IBGE SP 3550308:         ${sp3550308 ? "✅ Encontrado" : "❌ NÃO encontrado"}`);
  console.log(`  Documentos preservados:   ${docs?.length ?? "?"}/16`);
  console.log(`  Focus chamado?            ❌ NÃO`);
  console.log("");
  console.log("  Próximos passos:");
  console.log("  1. Se IBGE estiver vazio, rodar no SQL Editor:");
  console.log("     INSERT INTO municipios_ibge (codigo,nome,uf) VALUES ('3550308','São Paulo','SP') ON CONFLICT DO NOTHING;");
  console.log("  2. Abrir /fiscal?tab=cte → Ctrl+Shift+R");
  console.log("  3. Clicar 'Prévia CT-e do Romaneio' → buscar 340612");
  console.log("  4. Confirmar 16 CT-es, R$ 600,00, 0 bloqueios");
  console.log("  5. Clicar 'Gerar rascunhos locais'");
}

main().catch(console.error);
