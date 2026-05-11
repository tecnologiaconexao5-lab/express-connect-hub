/**
 * scripts/auditoria-relatorios.ts
 * 
 * Auditoria automatizada dos relatórios e PDFs.
 * Execução: npx ts-node scripts/auditoria-relatorios.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ✅ ${label}${detail ? " — " + detail : ""}`);
}

function fail(label: string, detail?: string) {
  failed++;
  console.error(`  ❌ ${label}${detail ? " — " + detail : ""}`);
}

async function auditarRelatorioFaturamento() {
  console.log("\n━━ RELATÓRIO FATURAMENTO ━━━━━━━━━━━━━━━━━━");
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("id, numero, created_at, cliente_id, valor_total, status")
      .limit(50);
      
    if (error) { fail("Busca faturamento", error.message); return; }
    if (!data || data.length === 0) { fail("Busca faturamento", "Sem dados para testar"); return; }
    ok("Busca faturamento OK", `${data.length} registros retornados`);

    const faturamento = data.reduce((a: number, b: any) => a + (b.valor_total || 0), 0);
    if (isNaN(faturamento)) fail("KPI Faturamento sem NaN");
    else ok("KPI Faturamento validado", faturamento.toFixed(2));
    
    const badData = data.filter((d: any) => d.valor_total === undefined || d.valor_total === null).length;
    if (badData > 0) fail(`Valores inválidos encontrados: ${badData}`);
    else ok("Todos os registros têm valor_total parseável");
    
  } catch (e: any) {
    fail("Erro execução", e.message);
  }
}

async function auditarRelatorioPrestadores() {
  console.log("\n━━ RELATÓRIO PRESTADORES ━━━━━━━━━━━━━━━━━━");
  try {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select("id, numero, data_finalizacao, prestador_id, veiculo_tipo, custo_prestador, status")
      .limit(50);
      
    if (error) { fail("Busca prestadores", error.message); return; }
    if (!data || data.length === 0) { fail("Busca prestadores", "Sem dados para testar"); return; }
    ok("Busca prestadores OK", `${data.length} registros retornados`);

    const pago = data.reduce((a: number, b: any) => a + (b.custo_prestador || 0), 0);
    if (isNaN(pago)) fail("KPI Valor Pago sem NaN");
    else ok("KPI Valor Pago validado", pago.toFixed(2));
    
    const badData = data.filter((d: any) => d.custo_prestador === undefined || d.custo_prestador === null).length;
    if (badData > 0) fail(`Valores inválidos encontrados: ${badData}`);
    else ok("Todos os registros têm custo_prestador parseável");
    
  } catch (e: any) {
    fail("Erro execução", e.message);
  }
}

async function run() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   AUDITORIA RELATÓRIOS ENTERPRISE — TMS Conexão Express  ║");
  console.log(`║   ${new Date().toLocaleString("pt-BR")}                         ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");
  
  await auditarRelatorioFaturamento();
  await auditarRelatorioPrestadores();
  
  console.log(`\n  RESULTADO FINAL: ${passed} ✅ aprovados | ${failed} ❌ falhas`);
  if (failed > 0) process.exit(1);
}

run();
