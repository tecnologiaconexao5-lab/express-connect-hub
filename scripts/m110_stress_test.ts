import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(URL, KEY);

async function stressTest() {
  console.log("MISSAO 110 — TESTE DE STRESS");
  console.log("===========================\n");

  const checks: { check: string; status: string; detail: string }[] = [];
  function ok(c: string, d: string) { checks.push({ check: c, status: "OK", detail: d }); }
  function warn(c: string, d: string) { checks.push({ check: c, status: "WARN", detail: d }); }
  function fail(c: string, d: string) { checks.push({ check: c, status: "FAIL", detail: d }); }

  // 1. Listar clientes ativos
  const { data: clientes } = await supabase.from("clientes").select("id, razao_social").limit(5);
  if (!clientes || clientes.length === 0) {
    console.log("Sem clientes para teste\n");
    return;
  }
  ok("Clientes disponiveis", `${clientes.length} clientes`);

  const cliente = clientes[0];

  // 2. Listar prestadores ativos
  const { data: prestadores } = await supabase.from("prestadores").select("id, nome_completo, cpf_cnpj").limit(5);
  if (!prestadores || prestadores.length === 0) {
    console.log("Sem prestadores para teste\n");
    return;
  }
  ok("Prestadores disponiveis", `${prestadores.length} prestadores`);
  const prestador = prestadores[0];

  // 3. Listar veiculos
  const { data: veiculos } = await supabase.from("veiculos").select("id, placa").limit(5);
  ok("Veiculos disponiveis", `${veiculos?.length || 0} veiculos`);

  // 4. Verificar financeiro_receber duplicatas
  const { data: fr } = await supabase.from("financeiro_receber").select("os_id").limit(1000);
  if (fr) {
    const osIds = fr.map((f: any) => f.os_id).filter(Boolean);
    const uniqueOsIds = [...new Set(osIds)];
    if (osIds.length !== uniqueOsIds.length) {
      const diff = osIds.length - uniqueOsIds.length;
      fail("Financeiro Receber duplicatas", `${diff} possiveis duplicatas em os_id (${osIds.length} total, ${uniqueOsIds.length} unicos)`);
    } else {
      ok("Financeiro Receber duplicatas", `0 duplicatas (${osIds.length} registros, ${uniqueOsIds.length} unicos)`);
    }
  }

  // 5. Verificar financeiro_pagar duplicatas
  const { data: fp } = await supabase.from("financeiro_pagar").select("os_id").limit(1000);
  if (fp) {
    const osIds2 = fp.map((f: any) => f.os_id).filter(Boolean);
    const uniqueOsIds2 = [...new Set(osIds2)];
    if (osIds2.length !== uniqueOsIds2.length) {
      const diff = osIds2.length - uniqueOsIds2.length;
      fail("Financeiro Pagar duplicatas", `${diff} possiveis duplicatas em os_id (${osIds2.length} total, ${uniqueOsIds2.length} unicos)`);
    } else {
      ok("Financeiro Pagar duplicatas", `0 duplicatas (${osIds2.length} registros, ${uniqueOsIds2.length} unicos)`);
    }
  }

  // 6. Verificar pagamentos_prestadores duplicatas
  const { data: pp } = await supabase.from("pagamentos_prestadores").select("os_id").limit(1000);
  if (pp) {
    const osIds3 = pp.map((p: any) => p.os_id).filter(Boolean);
    const uniqueOsIds3 = [...new Set(osIds3)];
    if (osIds3.length !== uniqueOsIds3.length) {
      const diff = osIds3.length - uniqueOsIds3.length;
      fail("Pagamentos Prestadores duplicatas", `${diff} possiveis duplicatas (${osIds3.length} total, ${uniqueOsIds3.length} unicos)`);
    } else {
      ok("Pagamentos Prestadores duplicatas", `0 duplicatas (${osIds3.length} registros, ${uniqueOsIds3.length} unicos)`);
    }
  }

  // 7. Verificar composicao_financeira_os duplicatas
  const { data: cf } = await supabase.from("composicao_financeira_os").select("os_id").limit(1000);
  if (cf) {
    const osIds4 = cf.map((c: any) => c.os_id).filter(Boolean);
    const uniqueOsIds4 = [...new Set(osIds4)];
    if (osIds4.length !== uniqueOsIds4.length) {
      const diff = osIds4.length - uniqueOsIds4.length;
      fail("Composicao Financeira duplicatas", `${diff} possiveis duplicatas (${osIds4.length} total, ${uniqueOsIds4.length} unicos)`);
    } else {
      ok("Composicao Financeira duplicatas", `0 duplicatas (${osIds4.length} registros, ${uniqueOsIds4.length} unicos)`);
    }
  }

  // 8. Verificar alocacoes_escala duplicatas (os_id)
  const { data: ae } = await supabase.from("alocacoes_escala").select("os_id").limit(1000);
  if (ae) {
    const osIds5 = ae.map((a: any) => a.os_id).filter(Boolean);
    const uniqueOsIds5 = [...new Set(osIds5)];
    if (osIds5.length !== uniqueOsIds5.length) {
      const diff = osIds5.length - uniqueOsIds5.length;
      warn("Alocacoes Escala duplicatas", `${diff} OS com multiplas alocacoes (esperado — permite 1+N)`);
    } else {
      ok("Alocacoes Escala duplicatas", `0 duplicatas (${osIds5.length} registros, ${uniqueOsIds5.length} unicos)`);
    }
  }

  // 9. Verificar eventos_oficiais — eventos por OS
  const { data: ev } = await supabase.from("eventos_oficiais").select("tipo, origem").limit(200);
  if (ev) {
    const tipos = [...new Set(ev.map((e: any) => e.tipo))];
    const origens = [...new Set(ev.map((e: any) => e.origem))];
    const triggerCount = ev.filter((e: any) => e.origem === "sql_trigger" || e.origem?.startsWith("trigger")).length;
    const total = ev.length;
    ok("Event Bus variedade", `${total} eventos, ${tipos.length} tipos, ${triggerCount} via trigger (${Math.round(triggerCount/total*100)}%)`);
  }

  // 10. Multiplos status
  const { data: allOs } = await supabase.from("ordens_servico").select("status").limit(500);
  if (allOs) {
    const statusCount: Record<string, number> = {};
    for (const o of allOs) { statusCount[o.status] = (statusCount[o.status] || 0) + 1; }
    const statusStr = Object.entries(statusCount).map(([k, v]) => `${k}:${v}`).join(", ");
    ok("OS Multiplos status", Object.keys(statusCount).length + " status: " + statusStr);
  }

  // RESULT
  console.log(`\n===========================`);
  console.log(`  RESULTADO STRESS TEST`);
  console.log(`===========================`);
  let okc = 0, warnc = 0, failc = 0;
  for (const c of checks) {
    const icon = c.status === "OK" ? "[OK]" : c.status === "WARN" ? "[WARN]" : "[FAIL]";
    console.log(`  ${icon} ${c.check.padEnd(40)} ${c.detail}`);
    if (c.status === "OK") okc++; else if (c.status === "WARN") warnc++; else failc++;
  }
  console.log(`\n  OK: ${okc} | WARN: ${warnc} | FAIL: ${failc} | Total: ${checks.length}`);
}

stressTest().then(() => process.exit(0));
