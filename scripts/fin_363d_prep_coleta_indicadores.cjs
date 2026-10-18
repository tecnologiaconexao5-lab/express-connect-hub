// FIN-363D-PREP v3 — CORRETO: usa fórmulas reais dos services
const { Client } = require('pg');
const DB = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const fmt = v => v==null?'NULL':Number(v).toFixed(2);
const q = async (c,s,p=[]) => (await c.query(s,p)).rows;

async function main() {
  const c = new Client({ connectionString: DB });
  await c.connect();
  const R = [];
  const add = (cat,kpi,fonte,formula,db,exp,contam,evid) =>
    R.push({cat,kpi,fonte,formula,db,exp,contam,evid});

  // ════════════════════════════════════════════════════════════════
  // FLUXO DE CAIXA
  // ════════════════════════════════════════════════════════════════

  const entr = await q(c,`SELECT sum(valor_baixado) AS total, count(*) AS n FROM financeiro_baixas WHERE titulo_tabela='financeiro_receber' AND NOT estornada`);
  add('FLUXO','Entradas realizadas','financeiro_baixas',
    'SUM(valor_baixado) WHERE titulo_tabela=financeiro_receber AND NOT estornada',
    fmt(entr[0].total),'74.06',Number(entr[0].total)==74.06?'SIM':'DIFERE',`${entr[0].n} registros`);

  const said = await q(c,`SELECT sum(valor_baixado) AS total, count(*) AS n FROM financeiro_baixas WHERE titulo_tabela='financeiro_pagar' AND NOT estornada`);
  add('FLUXO','Saídas realizadas','financeiro_baixas',
    'SUM(valor_baixado) WHERE titulo_tabela=financeiro_pagar AND NOT estornada',
    fmt(said[0].total),'1656.53',fmt(said[0].total)==='1656.53'?'SIM':'DIFERE',`${said[0].n} registros`);

  const fluxoR = (Number(entr[0].total)||0)-(Number(said[0].total)||0);
  add('FLUXO','Fluxo realizado','financeiro_baixas','entradas-saídas',
    fmt(fluxoR),'-1581.54',Math.abs(fluxoR-(-1581.54))<0.02?'SIM':'DIFERE',
    `${fmt(entr[0].total)} - ${fmt(said[0].total)} = ${fmt(fluxoR)}`);

  // Por conta
  const fc = await q(c,`SELECT c.id::text, c.nome, c.saldo_inicial, COALESCE(SUM(CASE WHEN b.titulo_tabela='financeiro_receber' THEN b.valor_baixado ELSE 0 END),0) AS entradas, COALESCE(SUM(CASE WHEN b.titulo_tabela='financeiro_pagar' THEN b.valor_baixado ELSE 0 END),0) AS saidas, count(b.id) AS n_baixas FROM contas_financeiras c LEFT JOIN financeiro_baixas b ON b.conta_financeira_id=c.id AND NOT b.estornada WHERE c.ativa=true GROUP BY c.id,c.nome,c.saldo_inicial ORDER BY c.nome`);
  for (const r of fc) {
    const fx = Number(r.entradas)-Number(r.saidas);
    add('FLUXO',`Conta: ${r.nome}`,'contas_financeiras+baixas',
      `saldo_ini=${fmt(r.saldo_inicial)} entradas=${fmt(r.entradas)} saidas=${fmt(r.saidas)}`,
      fmt(fx),'n/a','n/a',`ID=${r.id.slice(0,8)} ${r.n_baixas} baixas`);
  }

  const saldoIni = await q(c,`SELECT sum(saldo_inicial) AS total FROM contas_financeiras WHERE ativa=true`);
  add('FLUXO','Saldo inicial (soma contas)','contas_financeiras','SUM(saldo_inicial) WHERE ativa=true',
    fmt(saldoIni[0].total),'n/a','n/a','Soma dos saldos iniciais');

  const recPrev = await q(c,`SELECT count(*) AS n, sum(valor) AS total FROM financeiro_receber WHERE status NOT IN ('cancelado') AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=financeiro_receber.id AND NOT b.estornada)`);
  add('FLUXO','Entradas previstas','financeiro_receber','COUNT/SUM WHERE 0 baixas',
    fmt(recPrev[0].total),'n/a','n/a',`${recPrev[0].n} títulos`);

  const pagPrev = await q(c,`SELECT count(*) AS n, sum(valor) AS total FROM financeiro_pagar WHERE status NOT IN ('cancelado','cancelada') AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=financeiro_pagar.id AND NOT b.estornada)`);
  add('FLUXO','Saídas previstas','financeiro_pagar','COUNT/SUM WHERE 0 baixas',
    fmt(pagPrev[0].total),'n/a','n/a',`${pagPrev[0].n} títulos`);

  // Baixas sem conta
  const bc = await q(c,`SELECT titulo_tabela, count(*) AS n, sum(valor_baixado) AS total FROM financeiro_baixas WHERE conta_financeira_id IS NULL AND NOT estornada GROUP BY titulo_tabela`);
  for (const b of bc) {
    add('FLUXO',`Baixas s/ conta: ${b.titulo_tabela}`,'financeiro_baixas',
      'WHERE conta_financeira_id IS NULL AND NOT estornada',
      `${b.n} baixas, R$${fmt(b.total)}`,`${b.titulo_tabela} sem conta`,
      b.total>0?'CONTAMINADO':'LIMPO','Dados test/legacy');
  }

  // ════════════════════════════════════════════════════════════════
  // DRE — COMPETÊNCIA ECONÔMICA (setembro 2026)
  // Fonte REAL: dreService.ts
  // L1: financeiro_receber WHERE classificarReceita(categoria)='operacional'
  // L2: financeiro_pagar WHERE classificarDespesa(categoria+plano_conta)='imposto'
  // L4: pagamentos_prestadores WHERE impacto_dre=true
  // L6: financeiro_pagar WHERE os_id IS NULL AND classificarDespesa() IN (admin,comercial,outras)
  // ════════════════════════════════════════════════════════════════

  // 1. Receita bruta = financeiro_receber (operacional = tudo que não é financeira)
  const recBruta = await q(c,`
    SELECT sum(valor) AS total, count(*) AS n
    FROM financeiro_receber
    WHERE status NOT IN ('cancelado')
      AND data_vencimento >= date_trunc('month',CURRENT_DATE)
      AND data_vencimento < date_trunc('month',CURRENT_DATE)+interval '1 month'
      AND NOT (upper(coalesce(categoria,'')) ~ 'FINANCEIR|JUROS|APLICAC|RENDIMENTO')`);
  add('DRE','Receita Bruta','financeiro_receber',
    'SUM(valor) WHERE status<>cancelado AND vencimento no mês AND categoria NOT ~ financeira',
    fmt(recBruta[0].total),'14870.54',Math.abs(Number(recBruta[0].total)-14870.54)<0.01?'SIM':'DIFERE',
    `${recBruta[0].n} títulos`);

  // 2. Deduções (impostos) — regex classificarDespesa: categoria+plano_conta ~ imposto|tributo|iss|pis|cofins|icms|irrf|inss
  const deducoes = await q(c,`
    SELECT sum(valor) AS total, count(*) AS n
    FROM financeiro_pagar
    WHERE status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= date_trunc('month',CURRENT_DATE)
      AND data_vencimento < date_trunc('month',CURRENT_DATE)+interval '1 month'
      AND (upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'IMPOSTO|TRIBUTO|ISS|PIS|COFINS|ICMS|IRRF|INSS')`);
  add('DRE','(-) Deduções (impostos)','financeiro_pagar',
    'SUM(valor) WHERE (categoria||plano_contas) ~ imposto/tributo/ISS/PIS/COFINS/ICMS/IRRF/INSS',
    fmt(deducoes[0].total),'0.00',Number(deducoes[0].total||0)===0?'SIM':'DIFERE',
    `${deducoes[0].n} registros`);

  const recLiq = Number(recBruta[0].total||0) - Number(deducoes[0].total||0);
  add('DRE','Receita Líquida','DRE','Receita Bruta - Deduções',fmt(recLiq),'14870.54',
    Math.abs(recLiq-14870.54)<0.01?'SIM':'DIFERE',`${fmt(recBruta[0].total)} - ${fmt(deducoes[0].total)}`);

  // 4. Custos prestadores = pagamentos_prestadores WHERE impacto_dre=true
  const custoPP = await q(c,`
    SELECT sum(valor_liquido) AS total, count(*) AS n
    FROM pagamentos_prestadores
    WHERE impacto_dre = true
      AND competencia >= date_trunc('month',CURRENT_DATE)
      AND competencia < date_trunc('month',CURRENT_DATE)+interval '1 month'`);
  add('DRE','Custos Prestadores','pagamentos_prestadores',
    'SUM(valor_liquido) WHERE impacto_dre=true AND competencia BETWEEN mes',
    fmt(custoPP[0].total),'3150.34',Math.abs(Number(custoPP[0].total)-3150.34)<0.01?'SIM':'DIFERE',
    `${custoPP[0].n} pagamentos`);

  const resBruto = recLiq - Number(custoPP[0].total||0);
  add('DRE','Resultado Bruto','DRE','Receita Líquida - Custos Prestadores',
    fmt(resBruto),'11720.20',Math.abs(resBruto-11720.20)<0.01?'SIM':'DIFERE',
    `${fmt(recLiq)} - ${fmt(custoPP[0].total)}`);

  // 6. Despesas operacionais — classificarDespesa: admin|comercial|outras (exclui imposto e financeira)
  // Os_id IS NULL para excluir custos de prestador que já entraram via pagamentos_prestadores
  const despOp = await q(c,`
    SELECT sum(valor) AS total, count(*) AS n
    FROM financeiro_pagar
    WHERE status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= date_trunc('month',CURRENT_DATE)
      AND data_vencimento < date_trunc('month',CURRENT_DATE)+interval '1 month'
      AND os_id IS NULL
      AND NOT (upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'IMPOSTO|TRIBUTO|ISS|PIS|COFINS|ICMS|IRRF|INSS')
      AND NOT (upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'FINANCEIR|JUROS|TARIFA|TAXA BANC')`);
  add('DRE','Despesas Operacionais','financeiro_pagar',
    'SUM(valor) WHERE os_id IS NULL AND (categoria||plano_contas) NOT ~ imposto/financeira',
    fmt(despOp[0].total),'137.89',Math.abs(Number(despOp[0].total||0)-137.89)<0.01?'SIM':'DIFERE',
    `${despOp[0].n} despesas`);

  // 6b. Detalhar categorias de despesa (usando a mesma lógica do classificarDespesa)
  const despDet = await q(c,`
    SELECT
      CASE
        WHEN upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'IMPOSTO|TRIBUTO|ISS|PIS|COFINS|ICMS|IRRF|INSS' THEN 'imposto'
        WHEN upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'FINANCEIR|JUROS|TARIFA|TAXA BANC' THEN 'financeira'
        WHEN upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'ADMIN|ALUGUEL|SALARI|FOLHA|PRO-LABORE|SOFTWARE|TECNOLOG|CONTABIL|TELEFONE|INTERNET|MATERIAL|LIMPEZA|ENERGIA|AGUA' THEN 'administrativa'
        WHEN upper(coalesce(categoria,'')||coalesce(plano_contas,'')) ~ 'COMERCIAL|MARKETING|COMISS|PROPAGANDA|PUBLICIDADE|VENDA' THEN 'comercial'
        ELSE 'outras'
      END AS tipo,
      count(*) AS n, sum(valor) AS total
    FROM financeiro_pagar
    WHERE status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= date_trunc('month',CURRENT_DATE)
      AND data_vencimento < date_trunc('month',CURRENT_DATE)+interval '1 month'
      AND os_id IS NULL
    GROUP BY 1 ORDER BY total DESC`);
  for (const d of despDet) {
    add('DRE',`Despesa class: ${d.tipo}`,'financeiro_pagar',
      'classificarDespesa(categoria+plano_contas)',fmt(d.total),'n/a','n/a',`${d.n} registros`);
  }

  // Todas categorias de pagar no mês
  const catPag = await q(c,`
    SELECT COALESCE(categoria,'(vazia)') AS cat, COALESCE(plano_contas,'(vazio)') AS pc, count(*) AS n, sum(valor) AS total
    FROM financeiro_pagar
    WHERE status NOT IN ('cancelado','cancelada')
      AND data_vencimento >= date_trunc('month',CURRENT_DATE)
      AND data_vencimento < date_trunc('month',CURRENT_DATE)+interval '1 month'
    GROUP BY 1,2 ORDER BY total DESC`);
  add('DRE','Pagar categorias (detalhe)','financeiro_pagar',
    'GROUP BY categoria, plano_contas',
    JSON.stringify(catPag.map(r=>({c:r.cat,pc:r.pc,n:r.n,t:fmt(r.total)}))),'n/a','n/a',
    `${catPag.length} combinações`);

  const ebitda = resBruto - Number(despOp[0].total||0);
  add('DRE','EBITDA/Lucro Líquido','DRE','Resultado Bruto - Despesas Operacionais',
    fmt(ebitda),'11582.31',Math.abs(ebitda-11582.31)<0.01?'SIM':'DIFERE',
    `${fmt(resBruto)} - ${fmt(despOp[0].total)}`);

  const margB = Number(recLiq)>0?(resBruto/recLiq*100):0;
  const margL = Number(recLiq)>0?(ebitda/recLiq*100):0;
  add('DRE','Margem Bruta %','DRE','(Resultado Bruto / Receita Líquida) × 100',
    `${margB.toFixed(1)}%`,'78.9%',Math.abs(margB-78.9)<0.2?'SIM':'DIFERE','n/a');
  add('DRE','Margem Líquida %','DRE','(EBITDA / Receita Líquida) × 100',
    `${margL.toFixed(1)}%`,'77.9%',Math.abs(margL-77.9)<0.2?'SIM':'DIFERE','n/a');

  // DRE competência por mês
  const dreComp = await q(c,`SELECT date_trunc('month',data_vencimento)::date AS mes, sum(valor) AS total, count(*) AS n FROM financeiro_receber WHERE status NOT IN ('cancelado') GROUP BY 1 ORDER BY 1`);
  for (const d of dreComp) {
    add('DRE',`Receita comp. ${d.mes.toISOString().slice(0,7)}`,'financeiro_receber',
      'SUM(valor) WHERE vencimento BETWEEN mes',fmt(d.total),'n/a','n/a',`${d.n} títulos`);
  }

  // ════════════════════════════════════════════════════════════════
  // MARGEM POR OS — fórmula REAL do margemOsService.ts
  // Receita: financeiro_receber (faturamento) OU ordens_servico.valor_cliente (prevista)
  // CustoPrestador: pagamentos_prestadores.valor_liquido WHERE impacto_dre=true AND os_id/os_numero match
  // OutrosCustos: financeiro_pagar WHERE os_id match AND NOT repasse
  // ════════════════════════════════════════════════════════════════

  // 1. Buscar todas as OS (limit 500, como o componente)
  const allOS = await q(c,`
    SELECT id::text, numero, cliente, status, valor_cliente, data
    FROM ordens_servico ORDER BY data DESC LIMIT 500`);

  // 2. Buscar financeiro_receber (sem filtro)
  const allRec = await q(c,`
    SELECT id::text, os_id::text, os_vinculadas, valor, status, categoria
    FROM financeiro_receber WHERE status NOT IN ('cancelado')`);

  // 3. Buscar pagamentos_prestadores
  const allPP = await q(c,`
    SELECT id::text, os_id::text, os_numero, valor_liquido, impacto_dre
    FROM pagamentos_prestadores`);

  // 4. Buscar financeiro_pagar
  const allPag = await q(c,`
    SELECT id::text, os_id::text, descricao, valor
    FROM financeiro_pagar WHERE status NOT IN ('cancelado','cancelada')`);

  // 5. Calcular margem por OS (replicando margemOsService.calcularMargemOs)
  const linhas = [];
  for (const os of allOS) {
    const osId = os.id;
    const osNum = os.numero || '';

    // Receita
    const recs = allRec.filter(r =>
      (r.os_id && r.os_id === osId) ||
      (r.os_vinculadas && String(r.os_vinculadas).includes(osNum))
    );
    let receita = 0, receitaFonte = 'sem_receita';
    const recFaturada = recs.reduce((s,r) => s + (Number(r.valor)||0), 0);
    if (recFaturada > 0) { receita = recFaturada; receitaFonte = 'faturamento'; }
    else if (Number(os.valor_cliente) > 0) { receita = Number(os.valor_cliente); receitaFonte = 'operacional'; }

    // CustoPrestador
    const ppMatch = allPP.filter(p =>
      p.impacto_dre && (p.os_id === osId || (p.os_numero && String(p.os_numero) === osNum))
    );
    const custoPrestador = ppMatch.reduce((s,p) => s + (Number(p.valor_liquido)||0), 0);

    // OutrosCustos
    const pagMatch = allPag.filter(p =>
      p.os_id === osId && !String(p.descricao||'').toLowerCase().startsWith('repasse')
    );
    const outrosCustos = pagMatch.reduce((s,p) => s + (Number(p.valor)||0), 0);

    const margem = receita - custoPrestador - outrosCustos;
    const margemPct = receita > 0 ? (margem / receita * 100) : 0;
    const statusMargem = receitaFonte === 'faturamento' ? 'real' :
      receitaFonte === 'operacional' ? 'prevista' : 'pendente';

    linhas.push({
      osId, osNum: osNum.slice(0,20), cliente: (os.cliente||'').slice(0,20),
      status: os.status, receita, custoPrestador, outrosCustos, margem, margemPct,
      receitaFonte, statusMargem
    });
  }

  // 6. Indicadores (todas as OS)
  const recTotal = linhas.reduce((s,l) => s + l.receita, 0);
  const custoTotal = linhas.reduce((s,l) => s + l.custoPrestador + l.outrosCustos, 0);
  const margemTotal = linhas.reduce((s,l) => s + l.margem, 0);
  const margemMedia = recTotal > 0 ? (margemTotal / recTotal * 100) : 0;
  const osNegativas = linhas.filter(l => l.margem < 0).length;

  add('MARGEM','Receita Total','margemOsService',
    'SUM(receita) — fonte: financeiro_receber OU ordens_servico.valor_cliente',
    fmt(recTotal),'152731.99',Math.abs(recTotal-152731.99)<1?'SIM':'DIFERE',
    `${linhas.length} OS`);

  add('MARGEM','Custo Total','margemOsService',
    'SUM(custoPrestador+outrosCustos) — fonte: pagamentos_prestadores+financeiro_pagar',
    fmt(custoTotal),'44258.00',Math.abs(custoTotal-44258.00)<1?'SIM':'DIFERE',
    `pp=${fmt(linhas.reduce((s,l)=>s+l.custoPrestador,0))} + pag=${fmt(linhas.reduce((s,l)=>s+l.outrosCustos,0))}`);

  add('MARGEM','Margem Total','margemOsService','Receita - Custo',
    fmt(margemTotal),'108473.99',Math.abs(margemTotal-108473.99)<1?'SIM':'DIFERE',
    `${fmt(recTotal)} - ${fmt(custoTotal)}`);

  add('MARGEM','Margem Média %','margemOsService','(Margem/Receita)×100',
    `${margemMedia.toFixed(1)}%`,'71.0%',Math.abs(margemMedia-71.0)<0.5?'SIM':'DIFERE',
    `${fmt(margemTotal)}/${fmt(recTotal)}×100`);

  add('MARGEM','Quantidade OS','margemOsService','linhas.length',
    String(linhas.length),'103',String(linhas.length)==='103'?'SIM':'DIFERE','Todas OS');

  add('MARGEM','OS negativas','margemOsService','COUNT WHERE margem<0',
    String(osNegativas),'5',String(osNegativas)==='5'?'SIM':'DIFERE','Todas OS');

  // 7. Contaminação TEST/SEED/DEMO/AUDITORIA
  const testLinhas = linhas.filter(l =>
    /TEST|AUDITORIA|DEV|DEMO/i.test(l.osNum + l.cliente));
  const realLinhas = linhas.filter(l =>
    !/TEST|AUDITORIA|DEV|DEMO/i.test(l.osNum + l.cliente));

  const testRec = testLinhas.reduce((s,l)=>s+l.receita,0);
  const testCusto = testLinhas.reduce((s,l)=>s+l.custoPrestador+l.outrosCustos,0);
  const testMargem = testLinhas.reduce((s,l)=>s+l.margem,0);
  const realRec = realLinhas.reduce((s,l)=>s+l.receita,0);
  const realCusto = realLinhas.reduce((s,l)=>s+l.custoPrestador+l.outrosCustos,0);
  const realMargem = realLinhas.reduce((s,l)=>s+l.margem,0);

  add('CONTAM','OS TEST/DEMO/AUDITORIA','ordens_servico',
    'UPPER LIKE test/auditoria/dev/demo',
    `${testLinhas.length} OS, receita=${fmt(testRec)} custo=${fmt(testCusto)} margem=${fmt(testMargem)}`,
    '0, R$0',testRec>0?'CONTAMINADO':'LIMPO',
    testLinhas.length>0?testLinhas.map(l=>`${l.osNum.slice(0,25)} R$${fmt(l.receita)}`).join('; '):'NENHUM');

  add('CONTAM','OS REAIS','ordens_servico','Filtro exclude test/auditoria/dev/demo',
    `${realLinhas.length} OS, receita=${fmt(realRec)} custo=${fmt(realCusto)} margem=${fmt(realMargem)}`,
    'n/a','n/a','Apenas OS reais');

  const pctTest = recTotal>0?(testRec/recTotal*100).toFixed(1):'0';
  add('CONTAM','Impacto %','margemOsService','TEST_RECEITA / TOTAL_RECEITA × 100',
    `${pctTest}%`,'0%',testRec>0?'CONTAMINADO':'LIMPO',
    `test=${fmt(testRec)} / total=${fmt(recTotal)}`);

  // Financeiro test
  const testRecFin = await q(c,`SELECT count(*) AS n, sum(valor) AS total FROM financeiro_receber WHERE upper(coalesce(descricao,'')) ~ 'TEST|AUDITORIA|DEV|DEMO|SENTINELA'`);
  add('CONTAM','Receber TEST','financeiro_receber','UPPER LIKE test/auditoria/dev/demo/sentinela',
    `${testRecFin[0].n} registros, ${fmt(testRecFin[0].total)}`,`${0}, R$0`,
    Number(testRecFin[0].total||0)>0?'CONTAMINADO':'LIMPO','n/a');

  const testPagFin = await q(c,`SELECT count(*) AS n, sum(valor) AS total FROM financeiro_pagar WHERE upper(coalesce(descricao,'')) ~ 'TEST|AUDITORIA|DEV|DEMO|SENTINELA'`);
  add('CONTAM','Pagar TEST','financeiro_pagar','UPPER LIKE test/auditoria/dev/demo/sentinela',
    `${testPagFin[0].n} registros, ${fmt(testPagFin[0].total)}`,`${0}, R$0`,
    Number(testPagFin[0].total||0)>0?'CONTAMINADO':'LIMPO','n/a');

  // ════════════════════════════════════════════════════════════════
  // DASHBOARD — status
  // ════════════════════════════════════════════════════════════════

  const recSt = await q(c,`SELECT status,count(*) AS n, sum(valor) AS total FROM financeiro_receber GROUP BY status ORDER BY n DESC`);
  add('DASH','Receber por status','financeiro_receber','GROUP BY status',
    JSON.stringify(recSt.map(r=>({s:r.status,n:r.n,t:fmt(r.total)}))),'n/a','n/a','Distribuição');

  const pagSt = await q(c,`SELECT status,count(*) AS n, sum(valor) AS total FROM financeiro_pagar GROUP BY status ORDER BY n DESC`);
  add('DASH','Pagar por status','financeiro_pagar','GROUP BY status',
    JSON.stringify(pagSt.map(r=>({s:r.status,n:r.n,t:fmt(r.total)}))),'n/a','n/a','Distribuição');

  const osSt = await q(c,`SELECT status,count(*) AS n, sum(valor_cliente) AS total FROM ordens_servico GROUP BY status ORDER BY n DESC`);
  add('DASH','OS por status','ordens_servico','GROUP BY status',
    JSON.stringify(osSt.map(r=>({s:r.status,n:r.n,t:fmt(r.total)}))),'n/a','n/a','Distribuição');

  // ════════════════════════════════════════════════════════════════
  // GERAR SAÍDA
  // ════════════════════════════════════════════════════════════════

  const L = [];
  L.push('FIN-363D-PREP — COLETA DE PROVAS DOS INDICADORES');
  L.push('=================================================');
  L.push(`Data: ${new Date().toISOString()}`);
  L.push('Ambiente: PRODUCAO (Supabase remoto)');
  L.push('');
  L.push('NENHUM CODIGO/BANCO/DADO ALTERADO');

  L.push('');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('MATRIZ DE CONFIANCA');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push('CAT | KPI | FONTE | FORMULA | VALOR DB | ESPERADO | CONTAM | EVIDÊNCIA');
  L.push('----|-----|-------|---------|----------|----------|--------|----------');
  for (const r of R) L.push(`${r.cat} | ${r.kpi} | ${r.fonte} | ${r.formula} | ${r.db} | ${r.exp} | ${r.contam} | ${r.evid}`);

  L.push('');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('FLUXO DE CAIXA — MATEMATICA');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push(`ENTRADAS REALIZADAS = R$${fmt(entr[0].total)} (${entr[0].n} registros)`);
  L.push(`SAIDAS REALIZADAS   = R$${fmt(said[0].total)} (${said[0].n} registros)`);
  L.push(`FLUXO REALIZADO     = R$${fmt(entr[0].total)} - R$${fmt(said[0].total)} = R$${fmt(fluxoR)}`);
  L.push('');
  L.push('FLUXO POR CONTA:');
  for (const r of fc) {
    const fx = Number(r.entradas)-Number(r.saidas);
    L.push(`  ${r.nome}: saldo_ini=${fmt(r.saldo_inicial)} entradas=${fmt(r.entradas)} saidas=${fmt(r.saidas)} fluxo=${fmt(fx)}`);
  }
  L.push(`SALDO INICIAL: R$${fmt(saldoIni[0].total)}`);
  L.push(`ENTRADAS PREVISTAS: R$${fmt(recPrev[0].total)} (${recPrev[0].n} titulos)`);
  L.push(`SAIDAS PREVISTAS:   R$${fmt(pagPrev[0].total)} (${pagPrev[0].n} titulos)`);

  L.push('');
  L.push('BAIXAS SEM CONTA FINANCEIRA (4 sentinelas FIN-362.1):');
  for (const b of bc) L.push(`  ${b.titulo_tabela}: ${b.n} baixas, R$${fmt(b.total)}`);

  L.push('');
  L.push('NOTA: Diferença de R$0,93 no fluxo (74,06 - 1656,53 = -1582,47 vs -1581,54)');
  L.push('  Saldo inicial Cora = R$0,93. Fluxo realizado inclui saldo inicial = R$0,93 + 24,70 - 1656,53 = -1630,90');
  L.push('  Ou: fluxo = entradas - saídas = 74,06 - 1656,53 = -1582,47 (sem saldo inicial)');
  L.push('  Verificar se UI inclui saldo inicial no cálculo.');

  L.push('');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('DRE — COMPETENCIA ECONOMICA (setembro 2026)');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push('DRE = COMPETENCIA (vencimento), NAO FLUXO DE CAIXA (recebimento).');
  L.push('');
  L.push(`1. Receita Bruta:     R$${fmt(recBruta[0].total)} (${recBruta[0].n} titulos)`);
  L.push(`   fonte: financeiro_receber WHERE categoria NOT ~ financeira`);
  L.push(`2. (-) Deducoes:      R$${fmt(deducoes[0].total)} (${deducoes[0].n} registros)`);
  L.push(`   fonte: financeiro_pagar WHERE (categoria+plano_contas) ~ imposto`);
  L.push(`3. = Receita Liquida: R$${fmt(recLiq)}`);
  L.push(`4. (-) Custos Prest.: R$${fmt(custoPP[0].total)} (${custoPP[0].n} pagamentos impacto_dre=true)`);
  L.push(`   fonte: pagamentos_prestadores WHERE impacto_dre=true`);
  L.push(`5. = Resultado Bruto: R$${fmt(resBruto)}`);
  L.push(`6. (-) Despesas Op.:  R$${fmt(despOp[0].total)} (${despOp[0].n} despesas)`);
  L.push(`   fonte: financeiro_pagar WHERE os_id IS NULL AND NOT imposto/financeira`);
  L.push(`7. = EBITDA:          R$${fmt(ebitda)}`);
  L.push(`8. Margem Bruta:      ${margB.toFixed(1)}%`);
  L.push(`9. Margem Liquida:    ${margL.toFixed(1)}%`);
  L.push('');
  L.push('Por que Receita DRE >> Recebido no Fluxo:');
  L.push('  DRE: R$14.870,54 de titulos VENCIDOS no mes (competencia)');
  L.push('  Caixa: R$74,06 de baixas EFETIVAS (recebimento)');
  L.push('  Diferenca = titulos vencidos mas nao pagos = carteira a receber');

  L.push('');
  L.push('DETALHE CATEGORIAS PAGAR (mes):');
  for (const d of catPag) L.push(`  cat="${d.cat}" plano="${d.pc}" ${d.n}x R$${fmt(d.total)}`);

  L.push('');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('MARGEM POR OS — formulas reais do margemOsService.ts');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push('FORMULA POR OS:');
  L.push('  Receita = financeiro_receber (faturamento) OU ordens_servico.valor_cliente (prevista)');
  L.push('  CustoPrestador = pagamentos_prestadores.valor_liquido WHERE impacto_dre=true AND os match');
  L.push('  OutrosCustos = financeiro_pagar WHERE os_id match AND NOT repasse');
  L.push('  Margem = Receita - CustoPrestador - OutrosCustos');
  L.push('');
  L.push(`TODAS OS: ${linhas.length} OS, receita=${fmt(recTotal)}, custo=${fmt(custoTotal)}, margem=${fmt(margemTotal)}, media=${margemMedia.toFixed(1)}%, negativas=${osNegativas}`);
  L.push('');
  L.push('CONTAMINACAO:');
  L.push(`  TEST/DEMO/AUDITORIA: ${testLinhas.length} OS, receita=${fmt(testRec)}, custo=${fmt(testCusto)}, margem=${fmt(testMargem)}`);
  L.push(`  REAIS: ${realLinhas.length} OS, receita=${fmt(realRec)}, custo=${fmt(realCusto)}, margem=${fmt(realMargem)}`);
  L.push(`  Impacto: ${pctTest}% da receita total`);
  if (testLinhas.length > 0) {
    L.push('  OS TEST identificadas:');
    for (const t of testLinhas) L.push(`    ${t.osNum} st=${t.status} receita=${fmt(t.receita)} custo=${fmt(t.custoPrestador)}+${fmt(t.outrosCustos)} margem=${fmt(t.margem)}`);
  }

  L.push('');
  L.push('Receber TEST/DEV/AUDITORIA/SENTINELA: '+testRecFin[0].n+' registros, R$'+fmt(testRecFin[0].total));
  L.push('Pagar TEST/DEV/AUDITORIA/SENTINELA: '+testPagFin[0].n+' registros, R$'+fmt(testPagFin[0].total));

  L.push('');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('DASHBOARD — STATUS');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('');
  L.push('Receber por status:');
  for (const r of recSt) L.push(`  ${r.status}: ${r.n} titulos, R$${fmt(r.total)}`);
  L.push('Pagar por status:');
  for (const r of pagSt) L.push(`  ${r.status}: ${r.n} titulos, R$${fmt(r.total)}`);
  L.push('OS por status:');
  for (const r of osSt) L.push(`  ${r.status}: ${r.n} OS, R$${fmt(r.total)}`);

  L.push('');
  L.push('═══════════════════════════════════════════════════════════════');
  L.push('FIM DA COLETA');
  L.push('═══════════════════════════════════════════════════════════════');

  const fs = require('fs');
  const path = require('path');
  const out = path.join(__dirname,'..','FIN_363D_PREP_COLETA_INDICADORES.txt');
  fs.writeFileSync(out, L.join('\n'), 'utf8');
  const st = fs.statSync(out);
  console.log(`Relatorio: ${out}`);
  console.log(`Tamanho: ${st.size} bytes`);
  console.log(`Data: ${new Date().toISOString()}`);
  await c.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
