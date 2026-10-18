// FIN-MASTER-363B — AUDITORIA FINAL ADVERSARIAL DO FINANCEIRO
// 100% READ-ONLY. Nenhum INSERT/UPDATE/DELETE. Somente SELECT em catálogos e tabelas.
// Objetivo: TENTAR DERRUBAR a hipótese de que o Financeiro está correto.

const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const TRIGGER_363A3_APPLIED = '2026-09-06 16:27:00'; // horário de aplicação do bloqueio RECEBER
const FIN362_3E_APPLIED = '2026-09-06 15:25:00';

async function q(client, sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

const fmt = (v) => (v === null || v === undefined) ? 'NULL' : String(v);
const money = (v) => v === null ? 'NULL' : Number(v).toFixed(2);

async function main() {
  const client = new Client({ connectionString: DB_URL });
  const EVIDENCE = {};
  await client.connect();
  console.log('═══ FIN-MASTER-363B — AUDITORIA ADVERSARIAL READ-ONLY ═══');
  console.log(`Início: ${new Date().toISOString()}\n`);

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 1 — RECEBER
  // ══════════════════════════════════════════════════════════════════════
  console.log('─── 1. RECEBER ───');

  // 1.1 Trigger 363A.3 existe e está ativo?
  const trg = await q(client, `
    SELECT t.tgname, t.tgenabled, p.proname
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'financeiro_receber'::regclass AND NOT t.tgisinternal
  `);
  console.log('1.1 Triggers em financeiro_receber:');
  trg.forEach(t => console.log(`    ${t.tgname} (enabled=${t.tgenabled}, fn=${t.proname})`));
  EVIDENCE.receber_triggers = trg.map(t => ({ name: t.tgname, enabled: t.tgenabled }));

  // 1.2 Pago sem baixa (estado atual — universo completo)
  const pagoSemBaixa = await q(client, `
    SELECT r.id, r.valor, r.status, r.data_pagamento, r.cliente, r.created_at, r.updated_at,
           (SELECT count(*) FROM financeiro_baixas b
             WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada) AS baixas
    FROM financeiro_receber r
    WHERE r.status IN ('pago','recebido','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b
                      WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada)
    ORDER BY r.updated_at DESC
  `);
  console.log(`1.2 RECEBER pago sem baixa (universo): ${pagoSemBaixa.length} casos`);
  pagoSemBaixa.forEach(r => console.log(`    ${r.id.slice(0,8)} R$ ${money(r.valor)} st=${r.status} dt_pg=${fmt(r.data_pagamento)} upd=${fmt(r.updated_at)} baixas=${r.baixas}`));
  EVIDENCE.receber_pago_sem_baixa = pagoSemBaixa.map(r => ({
    id: r.id, valor: Number(r.valor), status: r.status, updated_at: fmt(r.updated_at)
  }));

  // 1.3 VIOLAÇÕES NOVAS pós-trigger (adversarial crítico)
  const violacoesNovas = (pagoSemBaixa || []).filter(r =>
    r.updated_at && new Date(r.updated_at) > new Date(TRIGGER_363A3_APPLIED));
  console.log(`1.3 Violações NOVAS pós-363A.3 (updated_at > ${TRIGGER_363A3_APPLIED}): ${violacoesNovas.length}`);
  violacoesNovas.forEach(r => console.log(`    NOVA: ${r.id} R$ ${money(r.valor)} upd=${fmt(r.updated_at)}`));

  // 1.4 Baixa com valor divergente do título (soma baixas ≠ valor)
  const divBaixa = await q(client, `
    SELECT r.id, r.valor, r.status,
           COALESCE(SUM(b.valor_baixado) FILTER (WHERE NOT b.estornada),0) AS baixado
    FROM financeiro_receber r
    LEFT JOIN financeiro_baixas b ON b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id
    GROUP BY r.id, r.valor, r.status
    HAVING COALESCE(SUM(b.valor_baixado) FILTER (WHERE NOT b.estornada),0) > r.valor + 0.005
  `);
  console.log(`1.4 Recebíveis com baixa ACIMA do valor (over-baixa): ${divBaixa.length}`);
  divBaixa.forEach(r => console.log(`    ${r.id.slice(0,8)} valor=R$ ${money(r.valor)} baixado=R$ ${money(r.baixado)}`));

  // 1.5 data_pagamento preenchida sem baixa E sem status pago (incoerência)
  const dataPgIncoerente = await q(client, `
    SELECT id, status, data_pagamento, valor FROM financeiro_receber
    WHERE data_pagamento IS NOT NULL AND status NOT IN ('pago','recebido','baixado')
  `);
  console.log(`1.5 data_pagamento preenchida com status NÃO pago: ${dataPgIncoerente.length}`);
  dataPgIncoerente.forEach(r => console.log(`    ${r.id.slice(0,8)} st=${r.status} dt_pg=${fmt(r.data_pagamento)}`));

  // 1.6 Status pago mas data_pagamento NULL (incoerência de 2ª ordem)
  const pagoSemData = await q(client, `
    SELECT id, valor, data_pagamento FROM financeiro_receber
    WHERE status IN ('pago','recebido','baixado') AND data_pagamento IS NULL
  `);
  console.log(`1.6 Pago com data_pagamento NULL: ${pagoSemData.length}`);
  pagoSemData.forEach(r => console.log(`    ${r.id.slice(0,8)} R$ ${money(r.valor)}`));

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 2 — PAGAR
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 2. PAGAR ───');

  // 2.1 Triggers de guarda em financeiro_pagar? (adversarial: esperamos NENHUM de guarda)
  const trgPagar = await q(client, `
    SELECT t.tgname, t.tgenabled, p.proname
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'financeiro_pagar'::regclass AND NOT t.tgisinternal
  `);
  console.log(`2.1 Triggers em financeiro_pagar: ${trgPagar.length}`);
  trgPagar.forEach(t => console.log(`    ${t.tgname} (enabled=${t.tgenabled}, fn=${t.proname})`));
  EVIDENCE.pagar_triggers = trgPagar.map(t => ({ name: t.tgname, enabled: t.tgenabled, fn: t.proname }));
  const temGuardaPagar = trgPagar.some(t => /pago|baixa|guard/i.test(t.proname + t.tgname));
  console.log(`    >>> Trigger de GUARDA (pago sem baixa) em financeiro_pagar: ${temGuardaPagar ? 'SIM' : 'NÃO — CONFIRMADO'}`);

  // 2.2 Distribuição de status em financeiro_pagar (valores 'paga' existem?)
  const statusDist = await q(client, `
    SELECT status, count(*) AS n, sum(valor) AS total FROM financeiro_pagar GROUP BY status ORDER BY n DESC
  `);
  console.log('2.2 Distribuição de status financeiro_pagar:');
  statusDist.forEach(s => console.log(`    ${JSON.stringify(s.status)}: ${s.n} registros, R$ ${money(s.total)}`));
  EVIDENCE.pagar_status_dist = statusDist.map(s => ({ status: s.status, n: Number(s.n), total: Number(s.total) }));

  // 2.3 Pagar pago/paga sem baixa (universo)
  const pagarSemBaixa = await q(client, `
    SELECT p.id, p.valor, p.status, p.data_pagamento, p.descricao, p.created_at, p.updated_at
    FROM financeiro_pagar p
    WHERE p.status IN ('pago','paga','recebido','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b
                      WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id AND NOT b.estornada)
    ORDER BY p.updated_at DESC
  `);
  console.log(`2.3 PAGAR pago sem baixa (universo): ${pagarSemBaixa.length}`);
  pagarSemBaixa.forEach(r => console.log(`    ${r.id.slice(0,8)} R$ ${money(r.valor)} st=${r.status} desc="${String(r.descricao||'').slice(0,40)}" criado=${fmt(r.created_at)} upd=${fmt(r.updated_at)}`));
  EVIDENCE.pagar_pago_sem_baixa = pagarSemBaixa.map(r => ({
    id: r.id, valor: Number(r.valor), status: r.status, desc: String(r.descricao||'').slice(0,60),
    created_at: fmt(r.created_at), updated_at: fmt(r.updated_at)
  }));

  // 2.4 Casos NOVOS pós-362.3E/363A.3 (bypass atual vivo)
  const pagarNovo = (pagarSemBaixa || []).filter(r => r.updated_at && new Date(r.updated_at) > new Date(FIN362_3E_APPLIED));
  console.log(`2.4 PAGAR pago sem baixa com updated_at > ${FIN362_3E_APPLIED}: ${pagarNovo.length}`);
  pagarNovo.forEach(r => console.log(`    NOVO: ${r.id} st=${r.status} upd=${fmt(r.updated_at)}`));

  // 2.5 Over-baixa em pagar
  const divPagar = await q(client, `
    SELECT p.id, p.valor, COALESCE(SUM(b.valor_baixado) FILTER (WHERE NOT b.estornada),0) AS baixado
    FROM financeiro_pagar p
    LEFT JOIN financeiro_baixas b ON b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id
    GROUP BY p.id, p.valor
    HAVING COALESCE(SUM(b.valor_baixado) FILTER (WHERE NOT b.estornada),0) > p.valor + 0.005
  `);
  console.log(`2.5 Pagar com baixa ACIMA do valor: ${divPagar.length}`);

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 3 — PRESTADORES (pagamentos_prestadores)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 3. PRESTADORES ───');

  // 3.1 RPC f_confirmar_pagamento_prestador existe?
  const rpcExiste = await q(client, `
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_confirmar_pagamento_prestador'
  `);
  console.log(`3.1 RPC f_confirmar_pagamento_prestador: ${rpcExiste.length ? 'EXISTE (' + rpcExiste[0].args + ')' : 'NÃO EXISTE'}`);

  // 3.2 Pagamentos pagos sem baixa correspondente (universo)
  const pgSemBaixa = await q(client, `
    SELECT pp.id, pp.valor_liquido, pp.status_pagamento, pp.data_pagamento, pp.origem_lancamento,
           pp.prestador_nome, pp.created_at, pp.updated_at,
           (SELECT count(*) FROM financeiro_baixas b
             WHERE b.titulo_tabela='financeiro_pagar' AND b.observacao ILIKE '%pagamento prestador%'
               AND b.created_at >= pp.created_at - interval '1 day' AND NOT b.estornada) AS baixas_aprox
    FROM pagamentos_prestadores pp
    WHERE pp.status_pagamento='pago'
      AND NOT EXISTS (
        SELECT 1 FROM financeiro_baixas b
        WHERE b.titulo_tabela='financeiro_pagar'
          AND b.valor_baixado = pp.valor_liquido
          AND b.data_baixa::date <= COALESCE(pp.data_pagamento::date, CURRENT_DATE)
          AND b.data_baixa::date >= (pp.updated_at - interval '7 days')::date
          AND NOT b.estornada)
    ORDER BY pp.updated_at DESC
  `);
  console.log(`3.2 Pagamentos prestador PAGOS sem baixa compatível: ${pgSemBaixa.length}`);
  pgSemBaixa.forEach(r => console.log(`    ${r.id.slice(0,8)} R$ ${money(r.valor_liquido)} origem=${r.origem_lancamento} prestador=${r.prestador_nome} dt_pg=${fmt(r.data_pagamento)} upd=${fmt(r.updated_at)}`));
  EVIDENCE.prestador_pago_sem_baixa_aprox = pgSemBaixa.length;

  // 3.3 Pagamentos pagos pós-362.3E — regra atômica
  const pgPosE = await q(client, `
    SELECT pp.id, pp.valor_liquido, pp.data_pagamento, pp.updated_at, pp.os_id
    FROM pagamentos_prestadores pp
    WHERE pp.status_pagamento='pago' AND pp.data_pagamento >= '2026-09-06'
    ORDER BY pp.updated_at
  `);
  console.log(`3.3 Pagamentos confirmados pós-362.3E (data_pagamento >= 2026-09-06): ${pgPosE.length}`);
  for (const pg of pgPosE) {
    const baixas = await q(client, `
      SELECT b.id, b.valor_baixado, b.data_baixa, b.titulo_id, b.estornada, b.conta_financeira_id
      FROM financeiro_baixas b
      WHERE b.titulo_tabela='financeiro_pagar' AND NOT b.estornada
        AND b.created_at::date = COALESCE(${pg.data_pagamento ? `'${pg.data_pagamento.toISOString().slice(0,10)}'` : 'CURRENT_DATE'}, CURRENT_DATE)
        AND b.valor_baixado = ${Number(pg.valor_liquido)}
    `);
    console.log(`    ${pg.id.slice(0,8)} R$ ${money(pg.valor_liquido)} → baixas compatíveis: ${baixas.length}`);
  }

  // 3.4 status_pagamento atualizado SEM data_pagamento (bypass por update direto)
  const pgPagoSemData = await q(client, `
    SELECT id, valor_liquido, status_pagamento, data_pagamento, updated_at
    FROM pagamentos_prestadores
    WHERE status_pagamento='pago' AND data_pagamento IS NULL
  `);
  console.log(`3.4 Pagamentos PAGOS com data_pagamento NULL: ${pgPagoSemData.length}`);
  pgPagoSemData.forEach(r => console.log(`    ${r.id.slice(0,8)} R$ ${money(r.valor_liquido)} upd=${fmt(r.updated_at)}`));

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 4 — TESOURARIA
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 4. TESOURARIA ───');

  const contas = await q(client, `
    SELECT id, nome, banco, ativa, saldo_inicial FROM contas_financeiras ORDER BY nome
  `);
  console.log(`4.1 Contas financeiras: ${contas.length}`);
  contas.forEach(c => console.log(`    ${c.id.slice(0,8)} ${c.nome} banco=${c.banco} ativa=${c.ativa} saldo_ini=${money(c.saldo_inicial)}`));

  // 4.2 Baixas com conta_financeira_id inexistente (FK órfã / NULL)
  const baixasSemConta = await q(client, `
    SELECT b.id, b.titulo_tabela, b.valor_baixado, b.data_baixa, b.conta_financeira_id
    FROM financeiro_baixas b
    LEFT JOIN contas_financeiras c ON c.id = b.conta_financeira_id
    WHERE (b.conta_financeira_id IS NULL OR c.id IS NULL) AND NOT b.estornada
  `);
  console.log(`4.2 Baixas ATIVAS sem conta válida: ${baixasSemConta.length}`);
  baixasSemConta.forEach(b => console.log(`    ${b.id.slice(0,8)} ${b.titulo_tabela} R$ ${money(b.valor_baixado)} conta=${fmt(b.conta_financeira_id)}`));
  EVIDENCE.baixas_sem_conta = baixasSemConta.length;

  // 4.3 Estornos
  const estornos = await q(client, `
    SELECT b.id, b.titulo_tabela, b.valor_baixado, b.data_baixa, b.estornada
    FROM financeiro_baixas b WHERE b.estornada = true
  `);
  console.log(`4.3 Baixas estornadas: ${estornos.length}`);
  estornos.forEach(b => console.log(`    ${b.id.slice(0,8)} ${b.titulo_tabela} R$ ${money(b.valor_baixado)} estornada=true`));

  // 4.4 Título reaberto após estorno? (estorno + status ainda pago)
  const estornoDivergente = await q(client, `
    SELECT r.id AS rec_id, r.status,
      (SELECT count(*) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada) AS ativas,
      (SELECT count(*) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND b.estornada) AS estornadas
    FROM financeiro_receber r
    WHERE r.status IN ('pago','recebido','baixado')
      AND EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id)
  `);
  const estornoProblemaRec = estornoDivergente.filter(r => Number(r.ativas) === 0 && Number(r.estornadas) > 0);
  console.log(`4.4a Recebíveis PAGOS com TODAS as baixas estornadas: ${estornoProblemaRec.length}`);
  estornoProblemaRec.forEach(r => console.log(`    ${r.rec_id.slice(0,8)} status=${r.status} ativas=0 estornadas=${r.estornadas}`));

  const estornoDivergentePag = await q(client, `
    SELECT p.id AS pag_id, p.status,
      (SELECT count(*) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id AND NOT b.estornada) AS ativas,
      (SELECT count(*) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id AND b.estornada) AS estornadas
    FROM financeiro_pagar p
    WHERE p.status IN ('pago','paga')
      AND EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id)
  `);
  const estornoProblemaPag = estornoDivergentePag.filter(r => Number(r.ativas) === 0 && Number(r.estornadas) > 0);
  console.log(`4.4b Pagar PAGOS com TODAS as baixas estornadas: ${estornoProblemaPag.length}`);
  estornoProblemaPag.forEach(r => console.log(`    ${r.pag_id.slice(0,8)} status=${r.status} ativas=0 estornadas=${r.estornadas}`));

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 5 — FLUXO DE CAIXA
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 5. FLUXO DE CAIXA ───');

  const fluxo = await q(client, `
    SELECT titulo_tabela,
           count(*) AS n,
           sum(valor_baixado) AS total
    FROM financeiro_baixas
    WHERE NOT estornada
    GROUP BY titulo_tabela
  `);
  console.log('5.1 Realizado (baixas ativas) por tabela:');
  fluxo.forEach(f => console.log(`    ${f.titulo_tabela}: ${f.n} baixas, R$ ${money(f.total)}`));

  // 5.2 Baixa duplicada exata (mesmo título, mesmo valor, mesmo dia, ambas ativas)
  const dupExact = await q(client, `
    SELECT titulo_tabela, titulo_id, valor_baixado, data_baixa, count(*) AS n
    FROM financeiro_baixas
    WHERE NOT estornada
    GROUP BY titulo_tabela, titulo_id, valor_baixado, data_baixa
    HAVING count(*) > 1
  `);
  console.log(`5.2 Baixas DUPLICADAS exatas (mesmo título+valor+data, ativas): ${dupExact.length}`);
  dupExact.forEach(d => console.log(`    ${d.titulo_tabela} ${String(d.titulo_id).slice(0,8)} R$ ${money(d.valor_baixado)} x${d.n} em ${fmt(d.data_baixa)}`));

  // 5.3 Múltiplas baixas ativas no mesmo título (parcial legítimo vs somatório)
  const multiBaixa = await q(client, `
    SELECT b.titulo_tabela, b.titulo_id, count(*) AS n, sum(b.valor_baixado) AS total_baixado
    FROM financeiro_baixas b
    WHERE NOT b.estornada AND b.titulo_id IS NOT NULL
    GROUP BY b.titulo_tabela, b.titulo_id
    HAVING count(*) > 1
  `);
  console.log(`5.3 Títulos com MÚLTIPLAS baixas ativas: ${multiBaixa.length}`);
  for (const m of multiBaixa.slice(0, 10)) {
    const tabela = m.titulo_tabela;
    const t = await q(client, `SELECT id, valor, status FROM ${tabela} WHERE id = $1`, [m.titulo_id]);
    const valorTitulo = t.length ? Number(t[0].valor) : null;
    const statusTitulo = t.length ? t[0].status : '?';
    const over = valorTitulo !== null && Number(m.total_baixado) > valorTitulo + 0.005;
    console.log(`    ${tabela} ${String(m.titulo_id).slice(0,8)}: ${m.n} baixas, total=R$ ${money(m.total_baixado)}, título=R$ ${money(valorTitulo)} st=${statusTitulo} ${over ? '>>> OVER-BAIXA' : 'ok'}`);
  }

  // 5.4 Baixas com titulo_id NULL (avulsas — sem rastreio)
  const baixasAvulsas = await q(client, `
    SELECT id, titulo_tabela, valor_baixado, data_baixa, observacao
    FROM financeiro_baixas WHERE titulo_id IS NULL AND NOT estornada
  `);
  console.log(`5.4 Baixas ATIVAS sem titulo_id (avulsas): ${baixasAvulsas.length}`);
  baixasAvulsas.forEach(b => console.log(`    ${b.id.slice(0,8)} ${b.titulo_tabela} R$ ${money(b.valor_baixado)} obs="${String(b.observacao||'').slice(0,50)}"`));

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 6 — DRE
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 6. DRE ───');

  const dreRec = await q(client, `
    SELECT count(*) AS n, COALESCE(sum(valor),0) AS total
    FROM financeiro_receber
    WHERE status <> 'cancelado' AND data_vencimento >= date_trunc('month', CURRENT_DATE)
  `);
  console.log(`6.1 Receita DRE (vencimentos mês atual, exceto cancelado): ${dreRec[0].n} títulos, R$ ${money(dreRec[0].total)}`);

  // 6.2 Registros fake 'pago' sem baixa ainda contam no DRE? (2d625b18 etc.)
  const fakeReceber = await q(client, `
    SELECT id::text, valor, status, data_vencimento FROM financeiro_receber
    WHERE status IN ('pago','recebido','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=financeiro_receber.id AND NOT b.estornada)
  `);
  console.log(`6.2 Registros 'pago sem baixa' (contam como receita no DRE por vencimento): ${fakeReceber.length} — R$ ${money(fakeReceber.reduce((a,r)=>a+Number(r.valor||0),0))}`);
  fakeReceber.forEach(r => console.log(`    ${String(r.id).slice(0,8)} R$ ${money(r.valor)} venc=${fmt(r.data_vencimento)}`));

  // 6.3 Double-count repasse: financeiro_pagar com os_id NOT NULL (excluídos do DRE)
  const repasseCount = await q(client, `
    SELECT count(*) AS n, COALESCE(sum(valor),0) AS total FROM financeiro_pagar WHERE os_id IS NOT NULL
  `);
  console.log(`6.3 Repasses em financeiro_pagar (os_id NOT NULL, excluídos do DRE): ${repasseCount[0].n}, R$ ${money(repasseCount[0].total)}`);

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 7 — DASHBOARD/KPIs
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 7. DASHBOARD/KPIs ───');

  const osCount = await q(client, `SELECT count(*) AS n FROM ordens_servico`);
  const osFin = await q(client, `SELECT count(*) AS n FROM ordens_servico WHERE status = 'finalizada'`);
  console.log(`7.1 ordens_servico (fonte do Dashboard Enterprise): total=${osCount[0].n}, finalizadas=${osFin[0].n}`);
  console.log('    Dashboard usa ordens_servico para KPIs de receita — inconsistência de fonte conhecida (363A P2).');

  // 7.2 KPI "a receber" do Dashboard vs carteira real
  const receberAberto = await q(client, `
    SELECT count(*) AS n, COALESCE(sum(valor),0) AS total FROM financeiro_receber
    WHERE status NOT IN ('cancelado','pago','recebido','baixado')
  `);
  console.log(`7.2 Carteira real a receber (aberto/parcial): ${receberAberto[0].n} títulos, R$ ${money(receberAberto[0].total)}`);

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 8 — HISTÓRICOS (exceções conhecidas intactas?)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 8. HISTÓRICOS ───');

  const histIds = ['2d625b18','17e857d8','fb30838a','cf6eea7b'];
  for (const prefix of histIds) {
    const r = await q(client, `SELECT id::text, status, valor, data_pagamento, updated_at FROM financeiro_receber WHERE id::text LIKE '${prefix}%'`);
    if (r.length) console.log(`    RECEBER ${prefix}: st=${r[0].status} R$ ${money(r[0].valor)} dt_pg=${fmt(r[0].data_pagamento)} upd=${fmt(r[0].updated_at)}`);
    else console.log(`    RECEBER ${prefix}: NÃO ENCONTRADO`);
  }
  const rPagar = await q(client, `SELECT id::text, status, valor, updated_at FROM financeiro_pagar WHERE id::text LIKE 'f83a3249%'`);
  if (rPagar.length) console.log(`    PAGAR f83a3249: st=${rPagar[0].status} R$ ${money(rPagar[0].valor)} upd=${fmt(rPagar[0].updated_at)}`);
  const rPp1 = await q(client, `SELECT id::text, status_pagamento, valor_liquido, updated_at FROM pagamentos_prestadores WHERE id::text LIKE '32fe474f%'`);
  if (rPp1.length) console.log(`    PP 32fe474f: st_pg=${rPp1[0].status_pagamento} R$ ${money(rPp1[0].valor_liquido)} upd=${fmt(rPp1[0].updated_at)}`);
  const rPp2 = await q(client, `SELECT id::text, status_pagamento, valor_liquido, updated_at FROM pagamentos_prestadores WHERE id::text LIKE '6266f2a1%'`);
  if (rPp2.length) console.log(`    PP 6266f2a1: st_pg=${rPp2[0].status_pagamento} R$ ${money(rPp2[0].valor_liquido)} upd=${fmt(rPp2[0].updated_at)}`);

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 9 — METADADOS DE SEGURANÇA (RPCs e triggers de propagação)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 9. METADADOS ───');

  const rpcs = await q(client, `
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_registrar_baixa_financeira','f_estornar_baixa_financeira','f_confirmar_pagamento_prestador')
  `);
  console.log(`9.1 RPCs financeiras presentes: ${rpcs.map(r=>r.proname).join(', ') || 'NENHUMA'}`);

  const trgProp = await q(client, `
    SELECT t.tgrelid::regclass::text AS tabela, t.tgname
    FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgname LIKE 'trg_%financeiro%'
    ORDER BY 1
  `);
  console.log('9.2 Triggers de propagação financeira:');
  trgProp.forEach(t => console.log(`    ${t.tabela}: ${t.tgname}`));

  // ══════════════════════════════════════════════════════════════════════
  // ÁREA 10 — ADVERSARIAL: BYPASS ATUAL VIVO (janela pós-bloqueio)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 10. BYPASS VIVO (pós-bloqueios 06/09) ───');

  // Qualquer UPDATE em financeiro_receber pós-trigger que tenha setado status pago SEM baixa — coberto em 1.3.
  // Novos pagamentos_prestadores pagos via update direto (updated_at > data_pagamento + 1min)?
  const ppSuspeito = await q(client, `
    SELECT id::text, status_pagamento, valor_liquido, data_pagamento, updated_at
    FROM pagamentos_prestadores
    WHERE status_pagamento='pago' AND data_pagamento IS NOT NULL
      AND updated_at > data_pagamento + interval '1 day'
  `);
  console.log(`10.1 PP pago com updated_at > data_pagamento+1d (possível update pós-confirmação): ${ppSuspeito.length}`);
  ppSuspeito.forEach(r => console.log(`    ${r.id.slice(0,8)} R$ ${money(r.valor_liquido)} dt_pg=${fmt(r.data_pagamento)} upd=${fmt(r.updated_at)}`));

  // ALTERAÇÕES de valor em títulos com baixa integral (valor mutado pós-baixa)?
  const valorMutado = await q(client, `
    SELECT r.id::text, r.valor, r.status, r.updated_at,
      (SELECT sum(b.valor_baixado) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada) AS baixado
    FROM financeiro_receber r
    WHERE r.status IN ('pago','recebido','baixado')
      AND r.updated_at > r.created_at
      AND EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada)
  `);
  console.log(`10.2 Recebíveis pagos com baixa E updated_at > created_at (valor mutável pós-baixa): ${valorMutado.length}`);
  valorMutado.forEach(r => console.log(`    ${r.id.slice(0,8)} valor=R$ ${money(r.valor)} baixado=R$ ${money(r.baixado)} upd=${fmt(r.updated_at)}`));

  console.log(`\nFim: ${new Date().toISOString()}`);
  await client.end();
}

main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
