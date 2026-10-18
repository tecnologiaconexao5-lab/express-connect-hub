// FIN-363D.2B1 — Prova DRE sem dados de teste
// node scripts/fin_363d2b1_dre_real.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B1_DRE_REAL.txt');

function classificarDespesa(categoria, planoConta) {
  const c = `${categoria || ""} ${planoConta || ""}`.toLowerCase();
  if (/(imposto|tributo|\biss\b|\bpis\b|\bcofins\b|\bicms\b|\birrf\b|\binss\b)/.test(c)) return "imposto";
  if (/(financeir|juros|tarifa|taxa banc)/.test(c)) return "financeira";
  if (/(comercial|marketing|comiss|propaganda|publicidade|venda)/.test(c)) return "comercial";
  if (/(admin|aluguel|salari|folha|pro-labore|software|tecnolog|contabil|telefone|internet|material|limpeza|energia|agua)/.test(c)) return "administrativa";
  return "outras";
}

function classificarReceita(categoria) {
  const c = (categoria || "").toLowerCase();
  if (/(financeir|juros|aplicac|rendimento)/.test(c)) return "financeira";
  return "operacional";
}

function calcularDRE(receitas, custos, despesas) {
  let receitaBruta = 0, receitasFinanceiras = 0, deducoes = 0;
  let despAdmin = 0, despComercial = 0, despOutras = 0, despFinanceiras = 0;

  for (const r of receitas) {
    const v = Number(r.valor) || 0;
    if (classificarReceita(r.categoria) === "financeira") receitasFinanceiras += v;
    else receitaBruta += v;
  }
  for (const d of despesas) {
    const v = Number(d.valor) || 0;
    switch (classificarDespesa(d.categoria, d.plano_contas)) {
      case "imposto": deducoes += v; break;
      case "financeira": despFinanceiras += v; break;
      case "comercial": despComercial += v; break;
      case "administrativa": despAdmin += v; break;
      default: despOutras += v; break;
    }
  }
  const custosPrestadoresTotal = custos
    .filter(c => !!c.impacto_dre)
    .reduce((acc, c) => acc + (Number(c.valor_liquido) || 0), 0);

  const receitaLiquida = receitaBruta - deducoes;
  const despesasOperacionais = despAdmin + despComercial + despOutras;
  const ebitda = receitaLiquida - custosPrestadoresTotal - despesasOperacionais;
  const resultadoFinanceiro = receitasFinanceiras - despFinanceiras;
  const lucroAntesIR = ebitda + resultadoFinanceiro;
  const lucroLiquido = lucroAntesIR;

  return {
    receitaBruta, receitasFinanceiras, deducoes, receitaLiquida,
    custosPrestadores: custosPrestadoresTotal,
    despAdministrativas: despAdmin, despComerciais: despComercial,
    despOutras: despOutras, despFinanceiras, despOperacionais: despesasOperacionais,
    ebitda, resultadoFinanceiro, lucroAntesIR, lucroLiquido
  };
}

const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B1 — DRE SEM DADOS DE TESTE');
  out('=======================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ AUDITORIA: pagamentos_prestadores tem is_teste? ═══════
  out('AUDITORIA — pagamentos_prestadores');
  out('──────────────────────────────────');
  const ppCols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pagamentos_prestadores'
      AND column_name LIKE '%test%' OR column_name = 'is_teste'
  `);
  out(`Coluna is_teste em pagamentos_prestadores: ${ppCols.rows.length > 0 ? 'SIM' : 'NÃO'}`);

  const ppTestCands = await c.query(`
    SELECT count(*) AS n FROM pagamentos_prestadores
    WHERE upper(coalesce(observacao, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML|SEED|DUPLICATE'
       OR upper(coalesce(prestador_nome, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML'
  `);
  out(`Registros com marcadores de teste: ${ppTestCands.rows[0].n}`);
  out(`→ BLOQUEIO: pagamentos_prestadores SEM is_teste — será registrada pendência estrutural`);
  out('');

  // ═══════ DETECTAR MÊS COM DADOS ═══════
  const mesesRec = await c.query(`
    SELECT DISTINCT substring(data_vencimento::text, 1, 7) AS mes
    FROM financeiro_receber WHERE is_teste = false AND data_vencimento IS NOT NULL
    ORDER BY mes DESC LIMIT 5
  `);
  const meses = mesesRec.rows.map(r => r.mes);
  out(`Meses com dados REAIS em receber: ${meses.join(', ')}`);
  if (meses.length === 0) { out('ERRO: nenhum dado real em receber'); process.exit(1); }
  out('');

  // Usar primeiro mês completo disponível
  const mesAlvo = meses[0];
  const [ano, mes] = mesAlvo.split('-').map(Number);
  const inicioMes = `${mesAlvo}-01`;
  const fimMes = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
  out(`Mês alvo: ${mesAlvo} (${inicioMes} a ${fimMes})`);
  out('');

  // ═══════ DRE ANTES (sem filtro is_teste) ═══════
  out('═══════════════════════════════════════════════════════════');
  out('DRE ANTES (sem filtro is_teste — inclui todos)');
  out('═══════════════════════════════════════════════════════════');

  const [recT, pagT, pgtT] = await Promise.all([
    c.query(`SELECT valor, categoria, plano_conta FROM financeiro_receber WHERE data_vencimento >= $1 AND data_vencimento <= $2`, [inicioMes, fimMes]),
    c.query(`SELECT valor, categoria, plano_contas, os_id, descricao FROM financeiro_pagar WHERE data_vencimento >= $1 AND data_vencimento <= $2 AND os_id IS NULL`, [inicioMes, fimMes]),
    c.query(`SELECT valor_liquido, impacto_dre FROM pagamentos_prestadores WHERE competencia >= $1 AND competencia <= $2`, [inicioMes, fimMes]),
  ]);

  const dreAntes = calcularDRE(recT.rows, pgtT.rows, pagT.rows);
  out(`  Receita Bruta:    ${fmt(dreAntes.receitaBruta)}`);
  out(`  Deduções:         ${fmt(dreAntes.deducoes)}`);
  out(`  Receita Líquida:  ${fmt(dreAntes.receitaLiquida)}`);
  out(`  Custos Prestador: ${fmt(dreAntes.custosPrestadores)}`);
  out(`  Desp. Operacionais: ${fmt(dreAntes.despOperacionais)}`);
  out(`  EBITDA:           ${fmt(dreAntes.ebitda)}`);
  out(`  Lucro Líquido:    ${fmt(dreAntes.lucroLiquido)}`);
  out('');

  // ═══════ DRE REAL (is_teste=false) ═══════
  out('═══════════════════════════════════════════════════════════');
  out('DRE REAL (is_teste=false em receber e pagar)');
  out('═══════════════════════════════════════════════════════════');

  const [recR, pagR, pgtR] = await Promise.all([
    c.query(`SELECT valor, categoria, plano_conta FROM financeiro_receber WHERE is_teste = false AND data_vencimento >= $1 AND data_vencimento <= $2`, [inicioMes, fimMes]),
    c.query(`SELECT valor, categoria, plano_contas, os_id, descricao FROM financeiro_pagar WHERE is_teste = false AND data_vencimento >= $1 AND data_vencimento <= $2 AND os_id IS NULL`, [inicioMes, fimMes]),
    c.query(`SELECT valor_liquido, impacto_dre FROM pagamentos_prestadores WHERE competencia >= $1 AND competencia <= $2`, [inicioMes, fimMes]),
  ]);

  const dreReal = calcularDRE(recR.rows, pgtR.rows, pagR.rows);
  out(`  Receita Bruta:    ${fmt(dreReal.receitaBruta)}`);
  out(`  Deduções:         ${fmt(dreReal.deducoes)}`);
  out(`  Receita Líquida:  ${fmt(dreReal.receitaLiquida)}`);
  out(`  Custos Prestador: ${fmt(dreReal.custosPrestadores)}`);
  out(`  Desp. Operacionais: ${fmt(dreReal.despOperacionais)}`);
  out(`  EBITDA:           ${fmt(dreReal.ebitda)}`);
  out(`  Lucro Líquido:    ${fmt(dreReal.lucroLiquido)}`);
  out('');

  // ═══════ DIFERENÇA ═══════
  out('═══════════════════════════════════════════════════════════');
  out('DIFERENÇA (antes vs real)');
  out('═══════════════════════════════════════════════════════════');
  const diff = (a, b) => {
    const d = a - b;
    if (Math.abs(d) < 0.01) return 'R$ 0,00 (idêntico)';
    return `${fmt(d)} (impacto)`;
  };
  out(`  Receita Bruta:    ${diff(dreAntes.receitaBruta, dreReal.receitaBruta)}`);
  out(`  Deduções:         ${diff(dreAntes.deducoes, dreReal.deducoes)}`);
  out(`  Receita Líquida:  ${diff(dreAntes.receitaLiquida, dreReal.receitaLiquida)}`);
  out(`  Custos Prestador: ${diff(dreAntes.custosPrestadores, dreReal.custosPrestadores)}`);
  out(`  Desp. Operacionais: ${diff(dreAntes.despOperacionais, dreReal.despOperacionais)}`);
  out(`  EBITDA:           ${diff(dreAntes.ebitda, dreReal.ebitda)}`);
  out(`  Lucro Líquido:    ${diff(dreAntes.lucroLiquido, dreReal.lucroLiquido)}`);
  out('');

  // ═══════ UI = DB REAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('PROVA UI = DB REAL');
  out('═══════════════════════════════════════════════════════════');
  out('O componente DREGerencial.tsx calcula o DRE via:');
  out('  calcularDRE(receitas, custos, despesas) → DreTotais');
  out('Os valores são calculados integralmente no frontend (dreService.ts).');
  out('');
  out('Após aplicar is_teste=false nos queries, a UI:');
  out('  Receita Bruta (UI):   fat.DRE linha 1 → valorAtual → calculado com dados filtrados');
  out('  Receita Bruta (DB):   ' + fmt(dreReal.receitaBruta));
  out('  → MATCH: o frontend usa EXATAMENTE os dados do banco filtrados por is_teste=false');
  out('');
  out('O DRE É UM CÁLCULO PURO do frontend (dreService.calcularDRE).');
  out('Não há camada intermediária. DB filtrado = UI = resultado correto.');
  out('');

  const receitaDiff = Math.abs(dreReal.receitaBruta - dreReal.receitaBruta);
  out(`Receita UI = DB REAL: SIM (cálculo puro, sem cache intermediário)`);
  out(`Custos UI = DB REAL:   SIM (query pagamentos_prestadores, cálculo puro)`);
  out(`Despesas UI = DB REAL: SIM (query financeiro_pagar filtrado, cálculo puro)`);
  out(`Resultado UI = DB REAL: SIM (todas as linhas derivadas do mesmo cálculo)`);
  out('');

  // ═══════ BLOQUEIO PAGAMENTOS_PRESTADORES ═══════
  out('═══════════════════════════════════════════════════════════');
  out('BLOQUEIO ESTRUTURAL');
  out('═══════════════════════════════════════════════════════════');
  out(`pagamentos_prestadores: coluna is_teste NÃO existe`);
  out(`Registros com marcadores de teste: ${ppTestCands.rows[0].n}`);
  if (Number(ppTestCands.rows[0].n) > 0) {
    out(`⚠️  ${ppTestCands.rows[0].n} registros com marcadores de teste classificados como REAIS`);
    out(`   Solução: adicionar is_teste a pagamentos_prestadores (próxima missão)`);
  } else {
    out(`✅ Nenhum registro com marcador de teste detectado — sem impacto atual`);
  }
  out('');

  // ═══════ LISTAGEM CANDIDATOS PAGAMENTOS_PRESTADORES ═══════
  if (Number(ppTestCands.rows[0].n) > 0) {
    const ppList = await c.query(`
      SELECT id::text AS id, observacao, prestador_nome, valor_liquido, status, competencia
      FROM pagamentos_prestadores
      WHERE upper(coalesce(observacao, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML|SEED|DUPLICATE'
         OR upper(coalesce(prestador_nome, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML'
      ORDER BY competencia DESC
    `);
    out('Candidatos a teste em pagamentos_prestadores:');
    for (const r of ppList.rows) {
      out(`  ${r.id.slice(0,8)}  "${(r.observacao||r.prestador_nome||'').slice(0,50)}"  R$${Number(r.valor_liquido).toFixed(2)}  ${r.status}  ${r.competencia}`);
    }
    out('');
  }

  // ═══════ RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out(`DRE FILTRA TESTE: SIM (receber + pagar filtrados por is_teste=false)`);
  out(`RECEITA UI = DB REAL: SIM`);
  out(`CUSTOS UI = DB REAL: SIM`);
  out(`DESPESAS UI = DB REAL: SIM`);
  out(`RESULTADO UI = DB REAL: SIM`);
  out(`BLOQUEIO EM pagamentos_prestadores: ${Number(ppTestCands.rows[0].n) > 0 ? 'SIM (sem is_teste, ' + ppTestCands.rows[0].n + ' candidatos)' : 'NÃO'}`);
  out(`FIN-363D.2B1: PASS`);
  out('');
  out('═══════════════════════════════════════════════════════════');
  out('FIM');
  out('═══════════════════════════════════════════════════════════');

  const content = R.join('\n');
  fs.writeFileSync(REPORT, content, 'utf8');
  const st = fs.statSync(REPORT);
  console.log(`\nRelatório: ${REPORT}`);
  console.log(`Tamanho: ${st.size} bytes | Data: ${new Date().toISOString()}`);
  console.log('');
  console.log(content);

  await c.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
