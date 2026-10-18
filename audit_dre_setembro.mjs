import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FLAG_REGEX = /TEST|SEED|DEMO|AUDITORIA|SENTINELA|HOMOLOG|HML|DUPPLICATE/i;

function isFlagged(record, fields) {
  for (const f of fields) {
    const val = record[f];
    if (val && FLAG_REGEX.test(String(val))) return `FLAG em ${f}="${val}"`;
  }
  return null;
}

function log(label, data) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(80)}`);
  if (!data || data.length === 0) {
    console.log('  (nenhum registro encontrado)');
    return;
  }
  console.table(data);
}

// ============================================================
// QUERY 1 - financeiro_receber SET 2026
// ============================================================
async function query1_receber() {
  const { data, error } = await supabase
    .from('financeiro_receber')
    .select('id, descricao, numero, valor, categoria, status, data_vencimento')
    .gte('data_vencimento', '2026-09-01')
    .lte('data_vencimento', '2026-09-30')
    .neq('status', 'cancelado')
    .order('data_vencimento', { ascending: true });

  if (error) { console.error('Q1 ERROR:', error.message); return; }

  const rows = (data || []).map(r => ({
    id: r.id?.slice(0, 8),
    descricao: r.descricao,
    numero: r.numero,
    valor: r.valor,
    categoria: r.categoria,
    status: r.status,
    vencimento: r.data_vencimento,
    FLAG: isFlagged(r, ['descricao', 'numero']) || ''
  }));

  log(`Q1: financeiro_receber SET/2026 (${rows.length} registros)`, rows);

  const flagged = rows.filter(r => r.FLAG);
  if (flagged.length > 0) {
    console.log(`\n  *** ${flagged.length} REGISTROS FLAGGED: ***`);
    flagged.forEach(f => console.log(`    - ${f.id} | ${f.descricao || f.numero} | ${f.FLAG}`));
  }

  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  console.log(`\n  TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

// ============================================================
// QUERY 2 - financeiro_pagar SET 2026 (sem OS)
// ============================================================
async function query2_pagar() {
  const { data, error } = await supabase
    .from('financeiro_pagar')
    .select('id, descricao, valor, categoria, plano_contas, status, data_vencimento, os_id')
    .gte('data_vencimento', '2026-09-01')
    .lte('data_vencimento', '2026-09-30')
    .is('os_id', null)
    .neq('status', 'cancelado')
    .order('data_vencimento', { ascending: true });

  if (error) { console.error('Q2 ERROR:', error.message); return; }

  const rows = (data || []).map(r => ({
    id: r.id?.slice(0, 8),
    descricao: r.descricao,
    valor: r.valor,
    categoria: r.categoria,
    plano_contas: r.plano_contas,
    status: r.status,
    vencimento: r.data_vencimento,
    FLAG: isFlagged(r, ['descricao']) || ''
  }));

  log(`Q2: financeiro_pagar SET/2026 sem OS (${rows.length} registros)`, rows);

  const flagged = rows.filter(r => r.FLAG);
  if (flagged.length > 0) {
    console.log(`\n  *** ${flagged.length} REGISTROS FLAGGED: ***`);
    flagged.forEach(f => console.log(`    - ${f.id} | ${f.descricao} | ${f.FLAG}`));
  }

  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  console.log(`\n  TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

// ============================================================
// QUERY 2b - TODO financeiro_pagar SET 2026 (incluindo com OS)
// ============================================================
async function query2b_pagar_total() {
  const { data, error } = await supabase
    .from('financeiro_pagar')
    .select('id, descricao, valor, categoria, plano_contas, status, data_vencimento, os_id')
    .gte('data_vencimento', '2026-09-01')
    .lte('data_vencimento', '2026-09-30')
    .neq('status', 'cancelado')
    .order('data_vencimento', { ascending: true });

  if (error) { console.error('Q2b ERROR:', error.message); return; }

  const rows = (data || []).map(r => ({
    id: r.id?.slice(0, 8),
    descricao: r.descricao,
    valor: r.valor,
    categoria: r.categoria,
    plano_contas: r.plano_contas,
    status: r.status,
    vencimento: r.data_vencimento,
    tem_os: r.os_id ? 'SIM' : 'NAO',
    FLAG: isFlagged(r, ['descricao']) || ''
  }));

  log(`Q2b: financeiro_pagar SET/2026 TODOS (${rows.length} registros)`, rows);

  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  console.log(`\n  TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

// ============================================================
// QUERY 3 - pagamentos_prestadores SET 2026
// ============================================================
async function query3_prestadores() {
  // Primeiro, descobre colunas disponíveis
  const { data: sample, error: errSample } = await supabase
    .from('pagamentos_prestadores')
    .select('*')
    .limit(1);

  if (errSample) { console.error('Q3 SAMPLE ERROR:', errSample.message); return; }

  const cols = sample && sample.length > 0 ? Object.keys(sample[0]) : [];
  console.log(`\n  Q3: Colunas disponíveis em pagamentos_prestadores: ${cols.join(', ')}`);

  const hasDescricao = cols.includes('descricao');
  const hasImpactoDre = cols.includes('impacto_dre');
  const hasValorLiquido = cols.includes('valor_liquido');
  const hasValor = cols.includes('valor');
  const hasCompetencia = cols.includes('competencia');
  const hasDataPagamento = cols.includes('data_pagamento');

  const selectCols = ['id'];
  if (hasDescricao) selectCols.push('descricao');
  if (hasValorLiquido) selectCols.push('valor_liquido');
  if (hasValor) selectCols.push('valor');
  if (hasCompetencia) selectCols.push('competencia');
  if (hasDataPagamento) selectCols.push('data_pagamento');
  selectCols.push('prestador_id', 'status_pagamento');

  let query = supabase
    .from('pagamentos_prestadores')
    .select(selectCols.join(', '));

  if (hasCompetencia) {
    query = query.gte('competencia', '2026-09-01').lte('competencia', '2026-09-30');
  } else if (hasDataPagamento) {
    query = query.gte('data_pagamento', '2026-09-01').lte('data_pagamento', '2026-09-30');
  }

  if (hasImpactoDre) {
    query = query.eq('impacto_dre', true);
  }

  const { data, error } = await query.order(hasCompetencia ? 'competencia' : 'data_pagamento', { ascending: true });

  if (error) { console.error('Q3 ERROR:', error.message); return; }

  const rows = (data || []).map(r => ({
    id: r.id?.slice(0, 8),
    descricao: r.descricao || '(sem descricao)',
    valor: r.valor_liquido || r.valor,
    competencia: r.competencia || r.data_pagamento,
    prestador_id: r.prestador_id?.slice(0, 8),
    status: r.status_pagamento,
    FLAG: hasDescricao ? (isFlagged(r, ['descricao']) || '') : ''
  }));

  log(`Q3: pagamentos_prestadores SET/2026 (${rows.length} registros)`, rows);
  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  console.log(`  TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

// ============================================================
// QUERY 4 - financeiro_receber com FLAGS em todos os meses
// ============================================================
async function query4_flagged_global() {
  const { data, error } = await supabase
    .from('financeiro_receber')
    .select('id, descricao, numero, valor, status, data_vencimento')
    .or('descricao.ilike.%TEST%,numero.ilike.%TEST%,descricao.ilike.%SEED%,numero.ilike.%SEED%,descricao.ilike.%DEMO%,numero.ilike.%DEMO%,descricao.ilike.%AUDITORIA%,numero.ilike.%AUDITORIA%,descricao.ilike.%SENTINELA%,numero.ilike.%SENTINELA%,descricao.ilike.%HML%,numero.ilike.%HML%,descricao.ilike.%HOMOLOG%,numero.ilike.%HOMOLOG%')
    .order('data_vencimento', { ascending: false });

  if (error) { console.error('Q4 ERROR:', error.message); return; }

  const rows = (data || []).map(r => ({
    id: r.id?.slice(0, 8),
    descricao: r.descricao,
    numero: r.numero,
    valor: r.valor,
    status: r.status,
    vencimento: r.data_vencimento,
    FLAG: isFlagged(r, ['descricao', 'numero']) || ''
  }));

  log(`Q4: financeiro_receber FLAGGED (todos os meses) — ${rows.length} registros`, rows);

  const byMonth = {};
  rows.forEach(r => {
    const month = r.vencimento ? r.vencimento.slice(0, 7) : 'sem_data';
    byMonth[month] = (byMonth[month] || 0) + 1;
  });
  console.log('\n  Distribuição por mês:');
  Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`    ${m}: ${c} registros`));

  const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0);
  console.log(`\n  TOTAL FLAGGED: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

// ============================================================
// QUERY 5 - ordens_servico: contagens e status
// ============================================================
async function query5_os() {
  const { count: totalOS, error: e1 } = await supabase
    .from('ordens_servico')
    .select('*', { count: 'exact', head: true });

  if (e1) console.error(`  Q5 totalOS error: ${e1.message}`);

  const { data: osAll, error: eAll } = await supabase
    .from('ordens_servico')
    .select('id, numero, status');

  if (eAll) {
    console.error(`  Q5 ERROR: ${eAll.message}`);
    return;
  }

  const testCount = (osAll || []).filter(r => r.numero && FLAG_REGEX.test(r.numero)).length;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`  Q5: ordens_servico — Resumo`);
  console.log(`${'='.repeat(80)}`);
  console.log(`  Total de OS:              ${totalOS || osAll?.length || 0}`);
  console.log(`  OS com flag TEST/SEED:    ${testCount}`);

  if (osAll && osAll.length > 0) {
    const statusCount = {};
    osAll.forEach(r => {
      const s = r.status || '(null)';
      statusCount[s] = (statusCount[s] || 0) + 1;
    });
    console.log(`\n  Distribuição por status:`);
    Object.entries(statusCount).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
      console.log(`    ${s}: ${c}`);
    });

    const flagged = osAll.filter(r => r.numero && FLAG_REGEX.test(r.numero));
    if (flagged.length > 0) {
      console.log(`\n  OS FLAGGED:`);
      flagged.slice(0, 20).forEach(r => console.log(`    ${r.id?.slice(0, 8)} | numero="${r.numero}" | status=${r.status}`));
    }
  } else {
    console.log(`  (tabela vazia)`);
  }

  const { data: compData, error: eComp } = await supabase
    .from('composicao_financeira_os')
    .select('os_id');

  if (compData && !eComp) {
    const comComp = new Set(compData.map(r => r.os_id));
    const total = totalOS || osAll?.length || 0;
    console.log(`\n  OS COM composicao_financeira_os:  ${comComp.size}`);
    console.log(`  OS SEM composicao_financeira_os:  ${total - comComp.size}`);
  } else if (eComp) {
    console.log(`  composicao_financeira_os error: ${eComp.message}`);
  }
}

// ============================================================
// MAIN
// ============================================================
console.log('AUDITORIA DRE SETEMBRO/2026 — Busca de registros TEST/SEED/DEMO');
console.log(`Iniciado em: ${new Date().toISOString()}`);
console.log(`Supabase: ${SUPABASE_URL}`);

await query1_receber();
await query2_pagar();
await query2b_pagar_total();
await query3_prestadores();
await query4_flagged_global();
await query5_os();

console.log(`\n${'='.repeat(80)}`);
console.log('  AUDITORIA CONCLUÍDA');
console.log(`${'='.repeat(80)}\n`);
