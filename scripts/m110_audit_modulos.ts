import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, KEY);

async function count(table: string) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return { count, error };
}

async function audit() {
  console.log(`\n=========================================`);
  console.log(`  MISSAO 110 — AUDITORIA DE MODULOS`);
  console.log(`=========================================\n`);

  const checks: { module: string; status: string; details: string }[] = [];
  function ok(m: string, d: string) { checks.push({ module: m, status: 'OK', details: d }); }
  function warn(m: string, d: string) { checks.push({ module: m, status: 'WARN', details: d }); }
  function fail(m: string, d: string) { checks.push({ module: m, status: 'FAIL', details: d }); }

  const tables = [
    'clientes', 'prestadores', 'veiculos', 'ordens_servico',
    'alocacoes_escala', 'financeiro_receber', 'financeiro_pagar',
    'pagamentos_prestadores', 'entregas_protocolo', 'portal_pedidos',
    'portal_ocorrencias', 'portal_avaliacoes', 'contratos',
    'composicao_financeira_os', 'portal_tracking_realtime',
    'eventos_oficiais', 'crm_leads', 'automacoes_robos'
  ];

  for (const table of tables) {
    const { count: c, error: e } = await count(table);
    if (c !== null && c > 0) ok(table, `${c} registros`);
    else if (c === 0) warn(table, '0 registros (pode ser esperado)');
    else fail(table, `${e?.message || 'Erro ao consultar'}`);
  }

  // Check specific statuses
  const { data: osStatus } = await supabase.from('ordens_servico').select('status').limit(100);
  const statuses = [...new Set(osStatus?.map(o => o.status) || [])];
  ok('OS Status', `${statuses.length} status: ${statuses.join(', ')}`);

  const { data: escStatus } = await supabase.from('alocacoes_escala').select('status').limit(100);
  const escStatuses = [...new Set(escStatus?.map(e => e.status) || [])];
  ok('Escala Status', `${escStatuses.length} status: ${escStatuses.join(', ')}`);

  const { data: frUnique } = await supabase.from('financeiro_receber').select('os_id').limit(500);
  const osIds = frUnique?.map(f => f.os_id).filter(Boolean) || [];
  const uniqueOS = [...new Set(osIds)];
  if (osIds.length !== uniqueOS.length) {
    const diff = osIds.length - uniqueOS.length;
    warn('Financeiro Receber', `${diff} possiveis duplicatas em os_id`);
  } else {
    ok('Financeiro Receber', `0 duplicatas em os_id`);
  }

  // Print
  let totalOk = 0, totalWarn = 0, totalFail = 0;
  for (const c of checks) {
    const icon = c.status === 'OK' ? '[OK]' : c.status === 'WARN' ? '[WARN]' : '[FAIL]';
    console.log(`  ${icon} ${c.module.padEnd(30)} ${c.details}`);
    if (c.status === 'OK') totalOk++;
    else if (c.status === 'WARN') totalWarn++;
    else totalFail++;
  }

  console.log(`\n=========================================`);
  console.log(`  RESUMO: ${checks.length} modulos`);
  console.log(`  OK: ${totalOk} | WARN: ${totalWarn} | FAIL: ${totalFail}`);
  console.log(`=========================================`);
}

audit().then(() => process.exit(0));
