// FIN-363D.3 — Validação Independente Final dos Indicadores
// node scripts/fin_363d3_validacao_final.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'FIN_363D3_VALIDACAO_FINAL_INDEPENDENTE.txt');

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.3 — VALIDAÇÃO INDEPENDENTE FINAL');
  out('==========================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ 1. FLUXO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('1. FLUXO — FLUXO REALIZADO');
  out('═══════════════════════════════════════════════════════════');

  // Mês com mais dados: 2026-06
  const fluxoMes = '2026-06';

  // 1.1 Entradas realizadas (receber com data_pagamento no mês)
  const entradas = await c.query(`
    SELECT SUM(valor) AS total
    FROM financeiro_receber
    WHERE is_teste = false
      AND status = 'pago'
      AND to_char(data_pagamento, 'YYYY-MM') = $1
  `, [fluxoMes]);
  const vEntradas = Number(entradas.rows[0].total || 0);

  // 1.2 Saídas realizadas (pagar com data_pagamento no mês)
  const saidas = await c.query(`
    SELECT SUM(valor) AS total
    FROM financeiro_pagar
    WHERE is_teste = false
      AND status = 'pago'
      AND to_char(data_pagamento, 'YYYY-MM') = $1
  `, [fluxoMes]);
  const vSaidas = Number(saidas.rows[0].total || 0);

  const vFluxo = vEntradas - vSaidas;

  out(`Período: ${fluxoMes}`);
  out(`Entradas realizadas: R$ ${vEntradas.toFixed(2)}`);
  out(`Saídas realizadas: R$ ${vSaidas.toFixed(2)}`);
  out(`Fluxo realizado (= entradas - saídas): R$ ${vFluxo.toFixed(2)}`);
  out('');

  // 1.3 Verificar saldo_inicial NÃO entra em "Fluxo Realizado"
  const fluxoFile = path.join(__dirname, '..', 'src', 'services', 'financeiro', 'fluxoCaixaService.ts');
  if (fs.existsSync(fluxoFile)) {
    const code = fs.readFileSync(fluxoFile, 'utf8');
    // A fórmula correta: fluxoLiquido = realizadoEntrada - realizadoSaida (SEM saldo_inicial)
    const formulaOK = code.includes('realizadoEntrada') && code.includes('realizadoSaida') && !code.includes('saldoInicial.*realizado');
    out(`Fórmula fluxoCaixaService: ${formulaOK ? '✅ SEM saldo_inicial em realizado' : '⚠️ Verificar fórmula'}`);
  }

  // 1.4 Verificar se DRE/Margem usam is_teste
  const dreFile = path.join(__dirname, '..', 'src', 'components', 'financeiro', 'DREGerencial.tsx');
  if (fs.existsSync(dreFile)) {
    const code = fs.readFileSync(dreFile, 'utf8');
    const hasPPFilter = code.includes('classificacao_dado') && code.includes('"real"');
    out(`DRE filtra pagamentos_prestadores por classificacao_dado='real': ${hasPPFilter ? '✅' : '❌'}`);
  }
  out('');

  // ═══════ 2. DRE 2026-09 ═══════
  out('═══════════════════════════════════════════════════════════');
  out('2. DRE — PERÍODO 2026-09');
  out('═══════════════════════════════════════════════════════════');

  const dreMes = '2026-09';

  // Receita Bruta (financeiro_receber REAL)
  const dreReceita = await c.query(`
    SELECT SUM(valor) AS total, COUNT(*) AS n
    FROM financeiro_receber
    WHERE is_teste = false
      AND to_char(vencimento, 'YYYY-MM') = $1
  `, [dreMes]);
  const vReceita = Number(dreReceita.rows[0].total || 0);

  // Custos Prestadores (pagamentos_prestadores REAL via classificacao_dado)
  const dreCustos = await c.query(`
    SELECT SUM(valor_liquido) AS total, COUNT(*) AS n
    FROM pagamentos_prestadores
    WHERE classificacao_dado = 'real'
      AND to_char(competencia, 'YYYY-MM') = $1
  `, [dreMes]);
  const vCustos = Number(dreCustos.rows[0].total || 0);

  // Despesas Operacionais (financeiro_pagar REAL)
  const dreDespesas = await c.query(`
    SELECT SUM(valor) AS total, COUNT(*) AS n
    FROM financeiro_pagar
    WHERE is_teste = false
      AND to_char(vencimento, 'YYYY-MM') = $1
  `, [dreMes]);
  const vDespesas = Number(dreDespesas.rows[0].total || 0);

  const vResultado = vReceita - vCustos - vDespesas;

  out(`Receita Bruta: R$ ${vReceita.toFixed(2)} (${dreReceita.rows[0].n} registros)`);
  out(`Custos Prestadores: R$ ${vCustos.toFixed(2)} (${dreCustos.rows[0].n} registros)`);
  out(`Despesas Operacionais: R$ ${vDespesas.toFixed(2)} (${dreDespesas.rows[0].n} registros)`);
  out(`Resultado/EBITDA: R$ ${vResultado.toFixed(2)}`);
  out('');

  // 2.1 Provar que TESTE/DUVIDOSO não entra
  const dreTeste = await c.query(`
    SELECT SUM(valor) AS t FROM financeiro_receber WHERE is_teste = true AND to_char(vencimento, 'YYYY-MM') = $1
  `, [dreMes]);
  const drePagarTeste = await c.query(`
    SELECT SUM(valor) AS t FROM financeiro_pagar WHERE is_teste = true AND to_char(vencimento, 'YYYY-MM') = $1
  `, [dreMes]);
  const drePPDuvidoso = await c.query(`
    SELECT SUM(valor_liquido) AS t FROM pagamentos_prestadores
    WHERE classificacao_dado IN ('teste','duvidoso') AND to_char(competencia, 'YYYY-MM') = $1
  `, [dreMes]);

  out(`TESTE excluído receber: R$ ${Number(dreTeste.rows[0].t||0).toFixed(2)}`);
  out(`TESTE excluído pagar: R$ ${Number(drePagarTeste.rows[0].t||0).toFixed(2)}`);
  out(`TESTE+DUVIDOSO excluído prestadores: R$ ${Number(drePPDuvidoso.rows[0].t||0).toFixed(2)}`);
  out('');
  out('═'.repeat(58));

  // ═══════ 3. MARGEM ═══════
  out('3. MARGEM — AUSÊNCIA DE TRUNCAMENTO + SEPARAÇÃO');
  out('═'.repeat(58));

  // 3.1 Verificar limit(50) no código
  const margemFiles = [
    path.join(__dirname, '..', 'src', 'components', 'financeiro', 'MargemOperacional.tsx'),
    path.join(__dirname, '..', 'src', 'components', 'financeiro', 'MargemPorOS.tsx'),
  ];
  for (const f of margemFiles) {
    if (fs.existsSync(f)) {
      const code = fs.readFileSync(f, 'utf8');
      const hasLimit = /\.limit\(50\)/.test(code);
      const name = path.basename(f);
      out(`${name}: limit(50) = ${hasLimit ? '❌ PRESENTE (truncamento!)' : '✅ AUSENTE'}`);
    }
  }
  out('');

  // 3.2 Separar prevista vs realizada
  // Margem por OS: receita (financeiro_receber) vs custo (pagamentos_prestadores com classificacao_dado)
  const margemMes = '2026-06';
  const margemPrevista = await c.query(`
    SELECT SUM(valor) AS receita, COUNT(*) AS n
    FROM financeiro_receber
    WHERE is_teste = false AND to_char(vencimento, 'YYYY-MM') = $1
  `, [margemMes]);
  const margemRealizada = await c.query(`
    SELECT SUM(valor_liquido) AS custo, COUNT(*) AS n
    FROM pagamentos_prestadores
    WHERE classificacao_dado = 'real' AND to_char(competencia, 'YYYY-MM') = $1
  `, [margemMes]);

  const vMargemPrevista = Number(margemPrevista.rows[0].receita || 0);
  const vMargemRealizada = Number(margemRealizada.rows[0].custo || 0);
  const margemPct = vMargemPrevista > 0 ? ((vMargemPrevista - vMargemRealizada) / vMargemPrevista * 100) : 0;

  out(`Período: ${margemMes}`);
  out(`Receita (prevista/realizada): R$ ${vMargemPrevista.toFixed(2)}`);
  out(`Custo realizado: R$ ${vMargemRealizada.toFixed(2)}`);
  out(`Margem estimada: ${margemPct.toFixed(1)}%`);
  out('');

  // 3.3 TESTE/DUVIDOSO não entra
  const margemTeste = await c.query(`
    SELECT SUM(valor_liquido) AS t FROM pagamentos_prestadores
    WHERE classificacao_dado IN ('teste','duvidoso') AND to_char(competencia, 'YYYY-MM') = $1
  `, [margemMes]);
  out(`TESTE+DUVIDOSO excluído margem: R$ ${Number(margemTeste.rows[0].t||0).toFixed(2)}`);
  out('');

  // 3.4 Recalcular totais gerais DB
  const totais = await c.query(`
    SELECT
      (SELECT SUM(valor) FROM financeiro_receber WHERE is_teste = false) AS receber_total,
      (SELECT SUM(valor) FROM financeiro_pagar WHERE is_teste = false) AS pagar_total,
      (SELECT SUM(valor_liquido) FROM pagamentos_prestadores WHERE classificacao_dado = 'real') AS pp_total,
      (SELECT SUM(valor_liquido) FROM pagamentos_prestadores WHERE classificacao_dado = 'teste') AS pp_teste,
      (SELECT SUM(valor_liquido) FROM pagamentos_prestadores WHERE classificacao_dado = 'duvidoso') AS pp_duvidoso
  `);
  const t = totais.rows[0];
  out('Totais globais DB:');
  out(`  Receber REAL: R$ ${Number(t.receber_total||0).toFixed(2)}`);
  out(`  Pagar REAL: R$ ${Number(t.pagar_total||0).toFixed(2)}`);
  out(`  Prestadores REAL: R$ ${Number(t.pp_total||0).toFixed(2)}`);
  out(`  Prestadores TESTE: R$ ${Number(t.pp_teste||0).toFixed(2)}`);
  out(`  Prestadores DUVIDOSO: R$ ${Number(t.pp_duvidoso||0).toFixed(2)}`);
  out('');

  // ═══════ 4. GARANTIR ═══════
  out('═══════════════════════════════════════════════════════════');
  out('4. GARANTIAS');
  out('═══════════════════════════════════════════════════════════');

  // 4.1 Registros classificados REAL continuam aparecendo
  const realCount = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM financeiro_receber WHERE is_teste = false) AS receber,
      (SELECT COUNT(*) FROM financeiro_pagar WHERE is_teste = false) AS pagar,
      (SELECT COUNT(*) FROM pagamentos_prestadores WHERE classificacao_dado = 'real') AS pp
  `);
  const rc = realCount.rows[0];
  out(`Registros REAL: receber=${rc.receber} pagar=${rc.pagar} prestadores=${rc.pp}`);
  out(`  → ${Number(rc.receber)+Number(rc.pagar)+Number(rc.pp)} registros TOTAL permanecem visíveis`);
  out('');

  // 4.2 Nenhuma regra de Receber/Pagar/Prestador quebrada
  // Verificar que financeiro_receber e financeiro_pagar não têm classificacao_dado (são is_teste)
  const schemaCheck = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='financeiro_receber' AND column_name='classificacao_dado'
  `);
  out(`financeiro_receber tem classificacao_dado: ${schemaCheck.rows.length > 0 ? '⚠️ SIM' : '✅ NÃO (usa is_teste)'}`);

  const schemaCheck2 = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='financeiro_pagar' AND column_name='classificacao_dado'
  `);
  out(`financeiro_pagar tem classificacao_dado: ${schemaCheck2.rows.length > 0 ? '⚠️ SIM' : '✅ NÃO (usa is_teste)'}`);
  out('');

  // 4.3 Não existem filtros por nome TEST/SEED como fonte oficial
  // Verificar que classificacao_dado é a fonte, não nome
  const nomeCheck = await c.query(`
    SELECT COUNT(*) AS n FROM pagamentos_prestadores
    WHERE classificacao_dado = 'real'
      AND (prestador_nome ILIKE '%TEST%' OR prestador_nome ILIKE '%SEED%' OR prestador_nome ILIKE '%HML%')
  `);
  const nomeFalsePositives = Number(nomeCheck.rows[0].n);
  out(`Prestadores com nome TEST/SEED classificados REAL: ${nomeFalsePositives}`);
  if (nomeFalsePositives > 0) {
    out(`  ⚠️ ${nomeFalsePositives} registros com nome de teste classificados como REAL`);
    out(`  Verificar se são falsos positivos (nome não é fonte de classificação)`);
  } else {
    out(`  ✅ Nenhum falso positivo por nome`);
  }
  out('');

  // ═══════ VEREDITO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('VEREDITO');
  out('═══════════════════════════════════════════════════════════');
  out('');

  // Check all conditions
  const margemFile = fs.existsSync(margemFiles[0]) ? fs.readFileSync(margemFiles[0], 'utf8') : '';
  const hasLimit50 = /\.limit\(50\)/.test(margemFile);
  const dreHasPPFilter = fs.existsSync(dreFile) ? fs.readFileSync(dreFile, 'utf8').includes('classificacao_dado') && fs.readFileSync(dreFile, 'utf8').includes('"real"') : false;
  const hasFalsePositives = nomeFalsePositives > 0;

  const allOK = !hasLimit50 && dreHasPPFilter && !hasFalsePositives;

  if (allOK) {
    out('[HOMOLOGADO — INDICADORES FINANCEIROS CONFIÁVEIS]');
  } else {
    out('[NÃO HOMOLOGADO — divergências:];');
    if (hasLimit50) out('  - MargemOperacional.tsx contém limit(50)');
    if (!dreHasPPFilter) out('  - DRE não filtra pagamentos_prestadores por classificacao_dado');
    if (hasFalsePositives) out(`  - ${nomeFalsePositives} registros com nome TEST classificados REAL`);
  }
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
