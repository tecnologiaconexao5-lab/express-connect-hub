/**
 * scripts/auditoria-financeiro-enterprise.ts
 * 
 * Auditoria automatizada dos módulos financeiros Enterprise do TMS Conexão Express.
 * Valida integridade dos dados Supabase, cálculos de KPI e exportações.
 * 
 * Execução: npx ts-node scripts/auditoria-financeiro-enterprise.ts
 */

import { createClient } from "@supabase/supabase-js";

// ── Configuração ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY devem estar definidos.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

function section(title: string) {
  console.log(`\n━━ ${title} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ── Verificações ─────────────────────────────────────────────────────────────

async function auditarConexao() {
  section("CONEXÃO SUPABASE");
  try {
    const { error } = await supabase.from("ordens_servico").select("id").limit(1);
    if (error) fail("Conexão Supabase", error.message);
    else ok("Conexão Supabase OK");
  } catch (e: any) {
    fail("Conexão Supabase", e.message);
  }
}

async function auditarContasReceber() {
  section("CONTAS A RECEBER (financeiro_receber)");
  try {
    const { data, error } = await supabase.from("financeiro_receber").select("*").limit(100);
    if (error) { fail("financeiro_receber acessível", error.message); return; }
    if (!data || data.length === 0) { fail("financeiro_receber tem dados", "Tabela vazia"); return; }
    ok(`financeiro_receber tem dados (${data.length} registros)`);

    // KPI: total a receber (sem NaN)
    const total = data
      .filter((r: any) => ["pendente", "vencido", "parcial"].includes(r.status))
      .reduce((acc: number, r: any) => acc + (parseFloat(r.valor_liquido || r.valor || "0") || 0), 0);
    if (isNaN(total)) fail("KPI Total a Receber sem NaN", `resultado: ${total}`);
    else ok("KPI Total a Receber sem NaN", fmtBRL(total));

    // KPI: inadimplência
    const vencidos = data
      .filter((r: any) => r.status === "vencido")
      .reduce((acc: number, r: any) => acc + (parseFloat(r.valor_liquido || r.valor || "0") || 0), 0);
    const inadimplencia = total > 0 ? (vencidos / total) * 100 : 0;
    if (isNaN(inadimplencia)) fail("KPI Inadimplência sem NaN");
    else ok("KPI Inadimplência sem NaN", `${inadimplencia.toFixed(1)}%`);

    // Verificar campos não nulos críticos
    const semVencimento = data.filter((r: any) => !r.data_vencimento).length;
    if (semVencimento > 0) fail(`${semVencimento} registros sem data_vencimento`);
    else ok("Todos registros têm data_vencimento");

    // Verificar toLocaleString em undefined
    const semValor = data.filter((r: any) => r.valor == null && r.valor_liquido == null).length;
    if (semValor > 0) fail(`${semValor} registros sem valor (risco de NaN no toLocaleString)`);
    else ok("Todos registros têm valor definido");

  } catch (e: any) {
    fail("Auditoria financeiro_receber", e.message);
  }
}

async function auditarContasPagar() {
  section("CONTAS A PAGAR (financeiro_pagar)");
  try {
    const { data, error } = await supabase.from("financeiro_pagar").select("*").limit(100);
    if (error) { fail("financeiro_pagar acessível", error.message); return; }
    if (!data || data.length === 0) { fail("financeiro_pagar tem dados", "Tabela vazia"); return; }
    ok(`financeiro_pagar tem dados (${data.length} registros)`);

    // KPI total a pagar
    const total = data
      .filter((r: any) => ["a vencer", "a_vencer", "parcial"].includes(r.status))
      .reduce((acc: number, r: any) => acc + (parseFloat(r.valor_liquido || r.valor || "0") || 0), 0);
    if (isNaN(total)) fail("KPI Total a Pagar sem NaN");
    else ok("KPI Total a Pagar sem NaN", fmtBRL(total));

    // Verificar campos não nulos
    const semFornecedor = data.filter((r: any) => !r.fornecedor && !r.favorecido).length;
    if (semFornecedor > 5) fail(`${semFornecedor} registros sem fornecedor`);
    else ok("Fornecedores preenchidos adequadamente");

  } catch (e: any) {
    fail("Auditoria financeiro_pagar", e.message);
  }
}

async function auditarComposicaoOS() {
  section("MARGEM REAL (composicao_financeira_os)");
  try {
    const { data, error } = await supabase.from("composicao_financeira_os").select("*").limit(100);
    if (error) { fail("composicao_financeira_os acessível", error.message); return; }
    if (!data || data.length === 0) { fail("composicao_financeira_os tem dados", "Tabela vazia"); return; }
    ok(`composicao_financeira_os tem dados (${data.length} registros)`);

    // KPI margem
    const receitaTotal = data.reduce((s: number, d: any) => s + (d.valor_cliente || 0), 0);
    const margemLiquida = data.reduce((s: number, d: any) => s + (d.margem_liquida || 0), 0);
    const pct = receitaTotal > 0 ? (margemLiquida / receitaTotal) * 100 : 0;
    if (isNaN(pct)) fail("KPI Margem Líquida % sem NaN");
    else ok("KPI Margem Líquida % sem NaN", `${pct.toFixed(1)}%`);

    // Exportação CSV simulada
    try {
      const headers = ["OS", "Data", "Valor Cliente", "Margem Bruta", "Margem Líquida", "% Margem"];
      const rows = data.map((d: any) => [
        d.os_id?.slice(0, 8) || "-",
        d.created_at?.split("T")[0] || "-",
        (d.valor_cliente || 0).toFixed(2),
        (d.margem_bruta || 0).toFixed(2),
        (d.margem_liquida || 0).toFixed(2),
        (d.percentual_margem_liquida || 0).toFixed(2),
      ]);
      const csv = [headers.join(";"), ...rows.map((r: string[]) => r.join(";"))].join("\n");
      if (typeof csv === "string" && csv.length > 0) ok("Exportação CSV não quebra", `${rows.length} linhas`);
      else fail("Exportação CSV");
    } catch (csvErr: any) {
      fail("Exportação CSV", csvErr.message);
    }

    // Verificar campos sem undefined/null que causariam toLocaleString crash
    const problemasValor = data.filter((d: any) =>
      d.valor_cliente === null || d.margem_liquida === null
    ).length;
    if (problemasValor > 0) fail(`${problemasValor} registros com valor_cliente ou margem_liquida NULL (risco toLocaleString)`);
    else ok("Nenhum valor_cliente/margem_liquida NULL em composicao");

  } catch (e: any) {
    fail("Auditoria composicao_financeira_os", e.message);
  }
}

async function auditarPagamentoPrestadores() {
  section("PAGAMENTO PRESTADORES (pagamentos_prestadores)");
  try {
    const { data, error } = await supabase.from("pagamentos_prestadores").select("*").limit(50);
    if (error && error.code !== "PGRST116") {
      fail("pagamentos_prestadores acessível", error.message);
      return;
    }
    if (!data || data.length === 0) {
      ok("pagamentos_prestadores existe (sem dados ainda — OK)");
      return;
    }
    ok(`pagamentos_prestadores tem dados (${data.length} registros)`);

    // KPI ticket médio
    const totalLiquido = data.reduce((s: number, p: any) => s + (p.valor_liquido || 0), 0);
    const ticketMedio = data.length > 0 ? totalLiquido / data.length : 0;
    if (isNaN(ticketMedio)) fail("Ticket médio prestador sem NaN");
    else ok("Ticket médio prestador sem NaN", fmtBRL(ticketMedio));

  } catch (e: any) {
    fail("Auditoria pagamentos_prestadores", e.message);
  }
}

async function auditarFluxoCaixa() {
  section("FLUXO DE CAIXA");
  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 30 * 86400000).toISOString().split("T")[0];
    const fim = new Date(hoje.getTime() + 30 * 86400000).toISOString().split("T")[0];

    const { data: receber } = await supabase
      .from("financeiro_receber")
      .select("id, valor_liquido, valor, data_vencimento, status")
      .gte("data_vencimento", inicio)
      .lte("data_vencimento", fim);

    const { data: pagar } = await supabase
      .from("financeiro_pagar")
      .select("id, valor_liquido, valor, data_vencimento, status")
      .gte("data_vencimento", inicio)
      .lte("data_vencimento", fim);

    const entradas = (receber || []).reduce((s: number, r: any) => s + (parseFloat(r.valor_liquido || r.valor || "0") || 0), 0);
    const saidas = (pagar || []).reduce((s: number, p: any) => s + (parseFloat(p.valor_liquido || p.valor || "0") || 0), 0);
    const saldo = entradas - saidas;

    if (isNaN(entradas) || isNaN(saidas) || isNaN(saldo)) fail("Fluxo de caixa 30 dias sem NaN");
    else ok("Fluxo de caixa 30 dias sem NaN", `Entradas: ${fmtBRL(entradas)} | Saídas: ${fmtBRL(saidas)} | Saldo: ${fmtBRL(saldo)}`);

  } catch (e: any) {
    fail("Auditoria Fluxo de Caixa", e.message);
  }
}

async function auditarDRE() {
  section("DRE GERENCIAL");
  try {
    const { data: receber, error: errReceber } = await supabase
      .from("financeiro_receber")
      .select("valor, categoria");
    const { data: pagar, error: errPagar } = await supabase
      .from("financeiro_pagar")
      .select("valor, categoria");

    if (errReceber || errPagar) {
      fail("Dados para DRE acessíveis", (errReceber || errPagar)?.message);
      return;
    }

    const receita = (receber || []).reduce((s: number, r: any) => s + (parseFloat(r.valor || "0") || 0), 0);
    const custos = (pagar || []).reduce((s: number, p: any) => s + (parseFloat(p.valor || "0") || 0), 0);
    const lucroBruto = receita - custos;
    const margemBruta = receita > 0 ? (lucroBruto / receita) * 100 : 0;

    if (isNaN(margemBruta)) fail("DRE Margem Bruta sem NaN");
    else ok("DRE Margem Bruta sem NaN", `${margemBruta.toFixed(1)}%`);

    if (isNaN(lucroBruto)) fail("DRE Lucro Bruto sem NaN");
    else ok("DRE Lucro Bruto sem NaN", fmtBRL(lucroBruto));

  } catch (e: any) {
    fail("Auditoria DRE", e.message);
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runAuditoria() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   AUDITORIA FINANCEIRO ENTERPRISE — TMS Conexão Express  ║");
  console.log(`║   ${new Date().toLocaleString("pt-BR")}                         ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  await auditarConexao();
  await auditarContasReceber();
  await auditarContasPagar();
  await auditarComposicaoOS();
  await auditarPagamentoPrestadores();
  await auditarFluxoCaixa();
  await auditarDRE();

  console.log("\n══════════════════════════════════════════════════════════");
  console.log(`\n  RESULTADO FINAL: ${passed} ✅ aprovados | ${failed} ❌ falhas`);

  if (failed === 0) {
    console.log("\n  🎉 Todos os checks passaram! Sistema financeiro validado.");
  } else {
    console.log(`\n  ⚠️  ${failed} verificação(ões) falharam. Revise os logs acima.`);
    process.exit(1);
  }
}

runAuditoria().catch((e) => {
  console.error("Erro fatal na auditoria:", e);
  process.exit(1);
});
