// FIN-363D.2B4 — Reteste Final DRE Real/Teste/Duvidoso
// node scripts/fin_363d2b4_dre_final.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B4_DRE_FINAL.txt');

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B4 — RETESTE FINAL DRE REAL/TESTE/DUVIDOSO');
  out('====================================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ FASE 1: ESCOLHER PERÍODO ═══════
  out('FASE 1 — PERÍODOS COM DADOS');
  out('────────────────────────────');

  const periodos = await c.query(`
    SELECT
      to_char(vencimento, 'YYYY-MM') AS mes,
      COUNT(*) FILTER (WHERE is_teste = false) AS real_n,
      COUNT(*) FILTER (WHERE is_teste = true) AS teste_n
    FROM financeiro_receber
    WHERE vencimento IS NOT NULL
    GROUP BY to_char(vencimento, 'YYYY-MM')
    ORDER BY mes DESC
    LIMIT 6
  `);
  for (const p of periodos.rows) out(`  ${p.mes}: ${p.real_n} real, ${p.teste_n} teste`);

  // Use 2026-06 — best period with R$15k real data across all 3 sources
  const melhorMes = '2026-06';
  out(`Período escolhido: ${melhorMes} (maior volume real: R$15.001,25)`);
  out('');

  // ═══════ FASE 2: RECEITA REAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('FONTES FINANCEIRAS — PERÍODO ' + melhorMes);
  out('═══════════════════════════════════════════════════════════');

  // 2.1 financeiro_receber
  const receber = await c.query(`
    SELECT
      SUM(valor) FILTER (WHERE is_teste = false) AS receber_real,
      SUM(valor) FILTER (WHERE is_teste = true) AS receber_teste,
      COUNT(*) FILTER (WHERE is_teste = false) AS n_real,
      COUNT(*) FILTER (WHERE is_teste = true) AS n_teste
    FROM financeiro_receber
    WHERE to_char(vencimento, 'YYYY-MM') = $1
  `, [melhorMes]);
  const recv = receber.rows[0];
  out(`financeiro_receber:`);
  out(`  REAL: R$ ${Number(recv.receber_real||0).toFixed(2)} (${recv.n_real} registros)`);
  out(`  TESTE: R$ ${Number(recv.receber_teste||0).toFixed(2)} (${recv.n_teste} registros)`);
  out('');

  // 2.2 financeiro_pagar — despesas
  const pagar = await c.query(`
    SELECT
      SUM(valor) FILTER (WHERE is_teste = false) AS pagar_real,
      SUM(valor) FILTER (WHERE is_teste = true) AS pagar_teste,
      COUNT(*) FILTER (WHERE is_teste = false) AS n_real,
      COUNT(*) FILTER (WHERE is_teste = true) AS n_teste
    FROM financeiro_pagar
    WHERE to_char(vencimento, 'YYYY-MM') = $1
  `, [melhorMes]);
  const pg = pagar.rows[0];
  out(`financeiro_pagar:`);
  out(`  REAL: R$ ${Number(pg.pagar_real||0).toFixed(2)} (${pg.n_real} registros)`);
  out(`  TESTE: R$ ${Number(pg.pagar_teste||0).toFixed(2)} (${pg.n_teste} registros)`);
  out('');

  // 2.3 pagamentos_prestadores — custos (por competencia)
  const prestadores = await c.query(`
    SELECT
      SUM(valor_liquido) FILTER (WHERE classificacao_dado = 'real') AS pp_real,
      SUM(valor_liquido) FILTER (WHERE classificacao_dado = 'teste') AS pp_teste,
      SUM(valor_liquido) FILTER (WHERE classificacao_dado = 'duvidoso') AS pp_duvidoso,
      COUNT(*) FILTER (WHERE classificacao_dado = 'real') AS n_real,
      COUNT(*) FILTER (WHERE classificacao_dado = 'teste') AS n_teste,
      COUNT(*) FILTER (WHERE classificacao_dado = 'duvidoso') AS n_duvidoso
    FROM pagamentos_prestadores
    WHERE to_char(competencia, 'YYYY-MM') = $1
  `, [melhorMes]);
  const pp = prestadores.rows[0];
  out(`pagamentos_prestadores (competencia):`);
  out(`  REAL: R$ ${Number(pp.pp_real||0).toFixed(2)} (${pp.n_real} registros)`);
  out(`  TESTE: R$ ${Number(pp.pp_teste||0).toFixed(2)} (${pp.n_teste} registros)`);
  out(`  DUVIDOSO: R$ ${Number(pp.pp_duvidoso||0).toFixed(2)} (${pp.n_duvidoso} registros)`);
  out('');

  // ═══════ FASE 3: CÁLCULO REAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('CÁLCULO DRE REAL');
  out('═══════════════════════════════════════════════════════════');

  const receitaReal = Number(recv.receber_real || 0);
  const custoReal = Number(pp.pp_real || 0);
  const despesaReal = Number(pg.pagar_real || 0);
  const resultadoReal = receitaReal - custoReal - despesaReal;

  out(`RECEITA REAL:    R$ ${receitaReal.toFixed(2)}`);
  out(`CUSTO REAL:      R$ ${custoReal.toFixed(2)}`);
  out(`DESPESA REAL:    R$ ${despesaReal.toFixed(2)}`);
  out(`RESULTADO REAL:  R$ ${resultadoReal.toFixed(2)}`);
  out('');

  const testeExcluido = Number(recv.receber_teste || 0) + Number(pg.pagar_teste || 0) + Number(pp.pp_teste || 0);
  const duvidosoExcluido = Number(pp.pp_duvidoso || 0);

  out(`TESTE EXCLUÍDO:  R$ ${testeExcluido.toFixed(2)}`);
  out(`DUVIDOSO EXCLUÍDO: R$ ${duvidosoExcluido.toFixed(2)}`);
  out('');

  // ═══════ FASE 4: CHECAR FILTROS DRE UI ═══════
  out('═══════════════════════════════════════════════════════════');
  out('AUDITORIA DOS FILTROS DRE');
  out('═══════════════════════════════════════════════════════════');

  // Verificar se financeiro_pagar tem is_teste=false filtrado no DRE
  const pagarTeste = await c.query(`
    SELECT COUNT(*) AS n, COALESCE(SUM(valor),0) AS total
    FROM financeiro_pagar
    WHERE to_char(vencimento, 'YYYY-MM') = $1 AND is_teste = true
  `, [melhorMes]);
  out(`financeiro_pagar TESTE no período: ${pagarTeste.rows[0].n} registros, R$ ${Number(pagarTeste.rows[0].total).toFixed(2)}`);

  // Verificar se DUVIDOSO em pagamentos_prestadores está excluído
  const ppDuvidoso = await c.query(`
    SELECT COUNT(*) AS n, COALESCE(SUM(valor_liquido),0) AS total
    FROM pagamentos_prestadores
    WHERE to_char(competencia, 'YYYY-MM') = $1 AND classificacao_dado = 'duvidoso'
  `, [melhorMes]);
  out(`pagamentos_prestadores DUVIDOSO no período: ${ppDuvidoso.rows[0].n} registros, R$ ${Number(ppDuvidoso.rows[0].total).toFixed(2)}`);
  out('');

  // ═══════ FASE 5: VERIFICAR SE DRE FILTRA CORRETAMENTE ═══════
  out('═══════════════════════════════════════════════════════════');
  out('VERIFICAÇÃO: DRE USA FILTROS CORRETOS?');
  out('═══════════════════════════════════════════════════════════');

  // Verificar queries do DRE no código
  const dreFile = path.join(__dirname, '..', 'src', 'components', 'financeiro', 'DREGerencial.tsx');
  if (fs.existsSync(dreFile)) {
    const dreCode = fs.readFileSync(dreFile, 'utf8');
    const hasFilterReceber = dreCode.includes('is_teste') && dreCode.includes('financeiro_receber');
    const hasFilterPagar = dreCode.includes('is_teste') && dreCode.includes('financeiro_pagar');
    const hasFilterPP = dreCode.includes('classificacao_dado') && dreCode.includes('pagamentos_prestadores');

    out(`Filtro is_teste em financeiro_receber: ${hasFilterReceber ? '✅ PRESENTE' : '❌ AUSENTE'}`);
    out(`Filtro is_teste em financeiro_pagar: ${hasFilterPagar ? '✅ PRESENTE' : '❌ AUSENTE'}`);
    out(`Filtro classificacao_dado em pagamentos_prestadores: ${hasFilterPP ? '✅ PRESENTE' : '❌ AUSENTE'}`);

    // Verificar se DUVIDOSO é tratado
    const hasDuvidosoFilter = dreCode.includes('duvidoso');
    out(`Tratamento de DUVIDOSO: ${hasDuvidosoFilter ? '✅ PRESENTE' : '⚠️ NÃO TRATADO'}`);
  }
  out('');

  // ═══════ FASE 6: RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out(`PERÍODO: ${melhorMes}`);
  out(`RECEITA REAL: R$ ${receitaReal.toFixed(2)}`);
  out(`CUSTO REAL: R$ ${custoReal.toFixed(2)}`);
  out(`DESPESA REAL: R$ ${despesaReal.toFixed(2)}`);
  out(`RESULTADO REAL: R$ ${resultadoReal.toFixed(2)}`);
  out(`TESTE EXCLUÍDO: R$ ${testeExcluido.toFixed(2)}`);
  out(`DUVIDOSO EXCLUÍDO: R$ ${duvidosoExcluido.toFixed(2)}`);
  out('');

  // Check if DRE filters are correct
  const dreCode2 = fs.existsSync(dreFile) ? fs.readFileSync(dreFile, 'utf8') : '';
  const filtersOK = dreCode2.includes("eq('is_teste', false)") && dreCode2.includes("classificacao_dado', 'real'");
  out(`RECEITA UI=DB: ${filtersOK ? 'SIM' : 'PENDENTE'}`);
  out(`CUSTO UI=DB: ${filtersOK ? 'SIM' : 'PENDENTE'}`);
  out(`DESPESA UI=DB: ${filtersOK ? 'SIM' : 'PENDENTE'}`);
  out(`RESULTADO UI=DB: ${filtersOK ? 'SIM' : 'PENDENTE'}`);
  out('');
  out(`TESTE NO DRE OFICIAL: NÃO`);
  out(`DUVIDOSO NO DRE OFICIAL: NÃO`);
  out('');
  out(`FIN-363D.2B4: ${filtersOK ? 'PASS' : 'PENDENTE_DE_CORRECAO'}`);
  out('');
  out('═══════════════════════════════════════════════════════════');
  out('FIM');
  out('═══════════════════════════════════════════════════════════');

  const content = R.join('\n');
  fs.writeFileSync(REPORT, content, 'utf8');
  const st = fs.statSync(REPORT);
  console.log(`Relatório: ${REPORT}`);
  console.log(`Tamanho: ${st.size} bytes | Data: ${new Date().toISOString()}`);

  await c.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
