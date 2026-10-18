import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('VERIFICAÇÃO: Totais globais das tabelas financeiras');
console.log(`${'='.repeat(60)}`);

const { count: totalReceber } = await supabase.from('financeiro_receber').select('*', { count: 'exact', head: true });
console.log(`financeiro_receber TOTAL: ${totalReceber}`);

const { count: totalPagar } = await supabase.from('financeiro_pagar').select('*', { count: 'exact', head: true });
console.log(`financeiro_pagar TOTAL: ${totalPagar}`);

const { count: totalPP } = await supabase.from('pagamentos_prestadores').select('*', { count: 'exact', head: true });
console.log(`pagamentos_prestadores TOTAL: ${totalPP}`);

const { count: totalOS } = await supabase.from('ordens_servico').select('*', { count: 'exact', head: true });
console.log(`ordens_servico TOTAL: ${totalOS}`);

const { count: totalComp } = await supabase.from('composicao_financeira_os').select('*', { count: 'exact', head: true });
console.log(`composicao_financeira_os TOTAL: ${totalComp}`);

// Receber por mês
console.log(`\n${'='.repeat(60)}`);
console.log('financeiro_receber — distribuição por mês de vencimento:');
const { data: receber } = await supabase
  .from('financeiro_receber')
  .select('data_vencimento, valor, status, descricao, numero');

if (receber && receber.length > 0) {
  const byMonth = {};
  receber.forEach(r => {
    const m = r.data_vencimento ? r.data_vencimento.slice(0, 7) : 'sem_data';
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c} registros`));

  // Mostrar registros com status != cancelado em todos os meses
  const FLAG_REGEX = /TEST|SEED|DEMO|AUDITORIA|SENTINELA|HOMOLOG|HML|DUPPLICATE/i;
  const flagged = receber.filter(r =>
    (r.descricao && FLAG_REGEX.test(r.descricao)) ||
    (r.numero && FLAG_REGEX.test(r.numero))
  );
  console.log(`\nRegistros FLAGGED (qualquer mês): ${flagged.length}`);
  flagged.slice(0, 30).forEach(r => {
    console.log(`  ${r.id?.slice(0, 8)} | ${r.descricao} | numero=${r.numero} | valor=${r.valor} | status=${r.status} | venc=${r.data_vencimento}`);
  });
}

// Pagar por mês
console.log(`\n${'='.repeat(60)}`);
console.log('financeiro_pagar — distribuição por mês de vencimento:');
const { data: pagar } = await supabase
  .from('financeiro_pagar')
  .select('data_vencimento, valor, status, descricao, os_id');

if (pagar && pagar.length > 0) {
  const byMonth = {};
  pagar.forEach(r => {
    const m = r.data_vencimento ? r.data_vencimento.slice(0, 7) : 'sem_data';
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c} registros`));

  const FLAG_REGEX = /TEST|SEED|DEMO|AUDITORIA|SENTINELA|HOMOLOG|HML|DUPPLICATE/i;
  const flagged = pagar.filter(r => r.descricao && FLAG_REGEX.test(r.descricao));
  console.log(`\nRegistros FLAGGED (qualquer mês): ${flagged.length}`);
  flagged.slice(0, 20).forEach(r => {
    console.log(`  ${r.id?.slice(0, 8)} | ${r.descricao} | valor=${r.valor} | status=${r.status} | venc=${r.data_vencimento}`);
  });
}

// Pagamentos prestadores por mês
console.log(`\n${'='.repeat(60)}`);
console.log('pagamentos_prestadores — distribuição por competência:');
const { data: pp } = await supabase
  .from('pagamentos_prestadores')
  .select('competencia, valor_liquido, status_pagamento, prestador_nome, impacto_dre');

if (pp && pp.length > 0) {
  const byMonth = {};
  pp.forEach(r => {
    const m = r.competencia ? r.competencia.slice(0, 7) : 'sem_data';
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c} registros`));

  const FLAG_REGEX = /TEST|SEED|DEMO|AUDITORIA|SENTINELA|HOMOLOG|HML|DUPPLICATE/i;
  const flagged = pp.filter(r => r.prestador_nome && FLAG_REGEX.test(r.prestador_nome));
  console.log(`\nPrestadores FLAGGED: ${flagged.length}`);
  flagged.forEach(r => console.log(`  ${r.prestador_nome} | comp=${r.competencia} | valor=${r.valor_liquido}`));
}

// Alocacoes escala em setembro (fonte da DRE real)
console.log(`\n${'='.repeat(60)}`);
console.log('alocacoes_escala — setembro 2026 (finalizadas):');
const { count: totalAloc } = await supabase
  .from('alocacoes_escala')
  .select('*', { count: 'exact', head: true })
  .gte('data_finalizacao', '2026-09-01')
  .lte('data_finalizacao', '2026-09-30')
  .eq('finalizada', true);
console.log(`  Alocações finalizadas SET/2026: ${totalAloc}`);

const { count: totalAlocAll } = await supabase.from('alocacoes_escala').select('*', { count: 'exact', head: true });
console.log(`  Alocações TOTAL (todas): ${totalAlocAll}`);

console.log(`\n${'='.repeat(60)}`);
console.log('VERIFICAÇÃO CONCLUÍDA');
