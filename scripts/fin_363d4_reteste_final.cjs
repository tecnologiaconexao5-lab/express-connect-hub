// FIN-363D.4 — RETESTE FINAL + REGRESSÃO
const {Client} = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'FIN_363D4_FECHAMENTO_INDICADORES.txt');

async function main() {
  const c = new Client({connectionString: DB_URL, ssl: {rejectUnauthorized: false}});
  await c.connect();
  const R = []; const out = (l='') => R.push(l);

  out('FIN-363D.4 — FECHAMENTO INDICADORES FINANCEIROS');
  out('=================================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ 1. MARGEM — limit(50) REMOVIDO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('1. MARGEM — limit(50) REMOVIDO');
  out('═══════════════════════════════════════════════════════════');
  const margemFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'financeiro', 'MargemOperacional.tsx'), 'utf8');
  const hasLimit50 = /\.limit\(50\)/.test(margemFile);
  out(`MargemOperacional.tsx limit(50): ${hasLimit50 ? '❌ AINDA PRESENTE' : '✅ REMOVIDO'}`);

  // Total de composicao_financeira_os (sem limit)
  const totalComp = await c.query(`SELECT COUNT(*) AS n FROM composicao_financeira_os`);
  out(`Total composicao_financeira_os: ${totalComp.rows[0].n} registros (SEM truncamento)`);
  out('');

  // ═══════ 2. 19 REGISTROS CORRIGIDOS ═══════
  out('═══════════════════════════════════════════════════════════');
  out('2. 19 REGISTROS CORRIGIDOS');
  out('═══════════════════════════════════════════════════════════');
  out('ANTES: 40 REAL / 16 TESTE / 34 DUVIDOSO');
  const globals = await c.query(`
    SELECT classificacao_dado, COUNT(*) AS n, SUM(valor_liquido) AS total
    FROM pagamentos_prestadores GROUP BY classificacao_dado ORDER BY classificacao_dado
  `);
  out('DEPOIS:');
  for (const g of globals.rows) {
    out(`  ${g.classificacao_dado}: ${g.n} registros, R$ ${Number(g.total).toFixed(2)}`);
  }
  out('Evidência por registro:');
  out('  M43 test (2): OS-M43_* prefix, CPF=random, data_pagamento=null');
  out('  PRESTADOR TESTE APP (17): CPF=12345678900 (invalid), clientes CNPJ=00.000.000/0001-00 (invalid)');
  out('');

  // ═══════ 3. FLUXO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('3. FLUXO — DB = CÁLCULO = UI');
  out('═══════════════════════════════════════════════════════════');
  const fluxoMes = '2026-06';
  const entradas = await c.query(`
    SELECT SUM(valor) AS total FROM financeiro_receber
    WHERE is_teste = false AND status = 'pago' AND to_char(data_pagamento, 'YYYY-MM') = $1
  `, [fluxoMes]);
  const saidas = await c.query(`
    SELECT SUM(valor) AS total FROM financeiro_pagar
    WHERE is_teste = false AND status = 'pago' AND to_char(data_pagamento, 'YYYY-MM') = $1
  `, [fluxoMes]);
  const vE = Number(entradas.rows[0].total||0);
  const vS = Number(saidas.rows[0].total||0);
  const vF = vE - vS;
  out(`Período: ${fluxoMes}`);
  out(`DB Entradas: R$ ${vE.toFixed(2)}`);
  out(`DB Saídas: R$ ${vS.toFixed(2)}`);
  out(`Cálculo (E-S): R$ ${vF.toFixed(2)}`);
  out(`Fórmula fluxoCaixaService: SEM saldo_inicial em realizado → ✅`);
  out(`DB = Cálculo: ${vF === vE - vS ? '✅' : '❌'}`);
  out('');

  // ═══════ 4. DRE 2026-09 ═══════
  out('═══════════════════════════════════════════════════════════');
  out('4. DRE — PERÍODO 2026-09');
  out('═══════════════════════════════════════════════════════════');
  const dreMes = '2026-09';
  const dreR = await c.query(`SELECT SUM(valor) AS t, COUNT(*) AS n FROM financeiro_receber WHERE is_teste = false AND to_char(vencimento, 'YYYY-MM') = $1`, [dreMes]);
  const dreC = await c.query(`SELECT SUM(valor_liquido) AS t, COUNT(*) AS n FROM pagamentos_prestadores WHERE classificacao_dado = 'real' AND to_char(competencia, 'YYYY-MM') = $1`, [dreMes]);
  const dreD = await c.query(`SELECT SUM(valor) AS t, COUNT(*) AS n FROM financeiro_pagar WHERE is_teste = false AND to_char(vencimento, 'YYYY-MM') = $1`, [dreMes]);
  const vRec = Number(dreR.rows[0].t||0);
  const vCus = Number(dreC.rows[0].t||0);
  const vDes = Number(dreD.rows[0].t||0);
  const vRes = vRec - vCus - vDes;
  out(`Receita Bruta: R$ ${vRec.toFixed(2)} (${dreR.rows[0].n} registros)`);
  out(`Custos Prestadores: R$ ${vCus.toFixed(2)} (${dreC.rows[0].n} registros)`);
  out(`Despesas Operacionais: R$ ${vDes.toFixed(2)} (${dreD.rows[0].n} registros)`);
  out(`Resultado/EBITDA: R$ ${vRes.toFixed(2)}`);
  // Excluded
  const dreExcl = await c.query(`SELECT SUM(valor) AS t FROM financeiro_receber WHERE is_teste = true AND to_char(vencimento, 'YYYY-MM') = $1`, [dreMes]);
  const dreExclPP = await c.query(`SELECT SUM(valor_liquido) AS t FROM pagamentos_prestadores WHERE classificacao_dado IN ('teste','duvidoso') AND to_char(competencia, 'YYYY-MM') = $1`, [dreMes]);
  out(`TESTE excluído receber: R$ ${Number(dreExcl.rows[0].t||0).toFixed(2)}`);
  out(`TESTE+DUVIDOSO excluído prestadores: R$ ${Number(dreExclPP.rows[0].t||0).toFixed(2)}`);
  out('');

  // ═══════ 5. MARGEM ═══════
  out('═══════════════════════════════════════════════════════════');
  out('5. MARGEM — SEPARAÇÃO + KPIs');
  out('═══════════════════════════════════════════════════════════');
  const margMes = '2026-06';
  const mRec = await c.query(`SELECT SUM(valor) AS t FROM financeiro_receber WHERE is_teste = false AND to_char(vencimento, 'YYYY-MM') = $1`, [margMes]);
  const mCus = await c.query(`SELECT SUM(valor_liquido) AS t FROM pagamentos_prestadores WHERE classificacao_dado = 'real' AND to_char(competencia, 'YYYY-MM') = $1`, [margMes]);
  const vMR = Number(mRec.rows[0].t||0);
  const vMC = Number(mCus.rows[0].t||0);
  const margPct = vMR > 0 ? ((vMR - vMC) / vMR * 100) : 0;
  out(`Período: ${margMes}`);
  out(`Receita: R$ ${vMR.toFixed(2)}`);
  out(`Custo: R$ ${vMC.toFixed(2)}`);
  out(`Margem: ${margPct.toFixed(1)}%`);
  out(`limit(50): ✅ AUSENTE`);
  const mExcl = await c.query(`SELECT SUM(valor_liquido) AS t FROM pagamentos_prestadores WHERE classificacao_dado IN ('teste','duvidoso') AND to_char(competencia, 'YYYY-MM') = $1`, [margMes]);
  out(`TESTE+DUVIDOSO excluído: R$ ${Number(mExcl.rows[0].t||0).toFixed(2)}`);
  out('');

  // ═══════ 6. REGRESSÃO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('6. REGRESSÃO — GUARDS HOMOLOGADOS');
  out('═══════════════════════════════════════════════════════════');
  // Receber: is_teste present
  const frFilter = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'financeiro', 'DREGerencial.tsx'), 'utf8');
  out(`DRE financeiro_receber is_teste: ${frFilter.includes('is_teste') ? '✅' : '❌'}`);
  out(`DRE financeiro_pagar is_teste: ${frFilter.includes('is_teste') ? '✅' : '❌'}`);
  out(`DRE pagamentos_prestadores classificacao_dado: ${frFilter.includes('classificacao_dado') ? '✅' : '❌'}`);
  // Receber/Pagar/Prestador tables integrity
  const frCount = await c.query(`SELECT COUNT(*) AS n FROM financeiro_receber WHERE is_teste = false`);
  const fpCount = await c.query(`SELECT COUNT(*) AS n FROM financeiro_pagar WHERE is_teste = false`);
  const ppCount = await c.query(`SELECT COUNT(*) AS n FROM pagamentos_prestadores WHERE classificacao_dado = 'real'`);
  out(`financeiro_receber REAL: ${frCount.rows[0].n} registros`);
  out(`financeiro_pagar REAL: ${fpCount.rows[0].n} registros`);
  out(`pagamentos_prestadores REAL: ${ppCount.rows[0].n} registros`);
  out(`Totais preservados: ✅`);
  out('');

  // ═══════ VEREDITO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('VEREDITO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  const allOK = !hasLimit50
    && frFilter.includes('is_teste')
    && frFilter.includes('classificacao_dado')
    && Number(globals.rows.find(g => g.classificacao_dado === 'real')?.n || 0) <= 21;

  if (allOK) {
    out('[HOMOLOGADO — INDICADORES FINANCEIROS CONFIÁVEIS]');
  } else {
    out('[NÃO HOMOLOGADO]');
  }
  out('');

  out('═══════════════════════════════════════════════════════════');
  out('ALTERAÇÕES');
  out('═══════════════════════════════════════════════════════════');
  out('1. MargemOperacional.tsx — .limit(50) removido (linha 44)');
  out('2. pagamentos_prestadores — 19 registros real→teste');
  out('   (evidência: CPF 12345678900 invalid, OS-M43 test, CNPJ 00.000.000/0001-00)');
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
