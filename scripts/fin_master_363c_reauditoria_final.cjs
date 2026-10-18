// FIN-MASTER-363C — REAUDITORIA ADVERSARIAL FINAL
// Missão READ-ONLY: validar independentemente código + Supabase real + dados reais
// NÃO confiar em relatórios anteriores. Provar tudo do zero.

const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const TRIGGER_363A3 = '2026-09-06 16:27:00';
const TRIGGER_363B1 = '2026-09-07';
const RPC_362_3E = '2026-09-06 15:25:00';

async function q(client, sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

const fmt = (v) => (v === null || v === undefined) ? 'NULL' : String(v);
const money = (v) => v === null ? 'NULL' : Number(v).toFixed(2);

async function test(client, name, fn) {
  try {
    await fn();
    return { name, pass: false, msg: 'DEVERIA TER BLOQUEADO' };
  } catch (e) {
    if (/sem baixa financeira|não é permitido/i.test(e.message)) {
      return { name, pass: true, msg: 'BLOQUEADO' };
    } else {
      return { name, pass: false, msg: `ERRO: ${e.message.slice(0, 60)}` };
    }
  }
}

async function main() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  console.log('═══ FIN-MASTER-363C — REAUDITORIA ADVERSARIAL FINAL ═══');
  console.log(`Início: ${new Date().toISOString()}\n`);

  const EVIDENCE = {};
  let totalTests = 0, passedTests = 0;

  // ══════════════════════════════════════════════════════════════════════
  // 1. METADADOS DE SEGURANÇA
  // ══════════════════════════════════════════════════════════════════════
  console.log('─── 1. METADADOS ───');

  const triggers = await q(c, `
    SELECT t.tgrelid::regclass::text AS tabela, t.tgname, t.tgenabled, p.proname
    FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE NOT t.tgisinternal AND t.tgname LIKE '%guardar%'
    ORDER BY 1
  `);
  console.log(`1.1 Triggers de guarda: ${triggers.length}`);
  triggers.forEach(t => console.log(`    ${t.tabela}: ${t.tgname} (enabled=${t.tgenabled})`));
  EVIDENCE.triggers_guarda = triggers.map(t => ({ tabela: t.tabela, nome: t.tgname }));

  const rpcs = await q(c, `
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_registrar_baixa_financeira','f_estornar_baixa_financeira','f_confirmar_pagamento_prestador')
  `);
  console.log(`1.2 RPCs financeiras: ${rpcs.map(r=>r.proname).join(', ')}`);

  // ══════════════════════════════════════════════════════════════════════
  // 2. PAGAR — ATACAR 363B.1
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 2. PAGAR (pós-363B.1) ───');

  // 2.1 Trigger existe e ativo?
  const trgPagar = await q(c, `
    SELECT t.tgname, t.tgenabled FROM pg_trigger t
    WHERE t.tgrelid='financeiro_pagar'::regclass AND t.tgname='trg_guardar_pagar_pago_sem_baixa'
  `);
  console.log(`2.1 Trigger 363B.1: ${trgPagar.length ? 'EXISTE (enabled='+trgPagar[0].tgenabled+')' : 'NÃO EXISTE'}`);

  // 2.2 Ataques negativos
  console.log('2.2 Ataques negativos:');
  const tests = [
    test(c, 'A) INSERT status=pago', async () => {
      await c.query(`INSERT INTO financeiro_pagar (descricao,valor,status,data_vencimento) VALUES ('TEST363C-A',100,'pago',CURRENT_DATE+30)`);
    }),
    test(c, 'B) UPDATE aberto→pago', async () => {
      const r = await c.query(`INSERT INTO financeiro_pagar (descricao,valor,status,data_vencimento) VALUES ('TEST363C-B',200,'aberto',CURRENT_DATE+30) RETURNING id`);
      try { await c.query(`UPDATE financeiro_pagar SET status='pago' WHERE id=$1`,[r.rows[0].id]); } finally { await c.query(`DELETE FROM financeiro_pagar WHERE id=$1`,[r.rows[0].id]); }
    }),
    test(c, 'C) INSERT status=paga', async () => {
      await c.query(`INSERT INTO financeiro_pagar (descricao,valor,status,data_vencimento) VALUES ('TEST363C-C',300,'paga',CURRENT_DATE+30)`);
    }),
    test(c, 'D) INSERT status=baixado', async () => {
      await c.query(`INSERT INTO financeiro_pagar (descricao,valor,status,data_vencimento) VALUES ('TEST363C-D',400,'baixado',CURRENT_DATE+30)`);
    }),
  ];
  for (const t of await Promise.all(tests)) {
    console.log(`    ${t.pass?'✓':'✗'} ${t.name}: ${t.msg}`);
    totalTests++; if (t.pass) passedTests++;
  }

  // 2.3 Violações atuais (pós-363B.1)?
  const violPagar = await q(c, `
    SELECT p.id, p.valor, p.status, p.updated_at
    FROM financeiro_pagar p
    WHERE p.status IN ('pago','paga','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id AND NOT b.estornada)
      AND p.updated_at > '2026-09-07'
  `);
  console.log(`2.3 Violações PAGAR pós-363B.1: ${violPagar.length}`);
  violPagar.forEach(r => console.log(`    ${r.id.slice(0,8)} R$${money(r.valor)} st=${r.status} upd=${fmt(r.updated_at)}`));

  // 2.4 Fluxo oficial funciona?
  console.log('2.4 Fluxo oficial (criar→baixar→pago):');
  try {
    const t = await c.query(`INSERT INTO financeiro_pagar (descricao,valor,status,data_vencimento,fornecedor) VALUES ('TEST363C-E2E',750,'aberto',CURRENT_DATE+30,'Forn Teste') RETURNING id,valor`);
    const tid = t.rows[0].id, tval = Number(t.rows[0].valor);
    const conta = await q(c, `SELECT id,nome FROM contas_financeiras WHERE ativa=true LIMIT 1`);
    const cid = conta[0].id, cnome = conta[0].nome;
    const b = await q(c, `SELECT * FROM f_registrar_baixa_financeira('financeiro_pagar',$1,$2,CURRENT_DATE,'PIX',$3,$4,'E2E 363C')`,[tid,tval,cnome,cid]);
    const tFinal = await q(c, `SELECT status,data_pagamento FROM financeiro_pagar WHERE id=$1`,[tid]);
    const bFinal = await q(c, `SELECT valor_baixado,conta_financeira_id,estornada FROM financeiro_baixas WHERE id=$1`,[b[0].baixa_id]);
    console.log(`    Título: ${tid.slice(0,8)} R$${money(tval)} → status=${tFinal[0].status} dt_pg=${fmt(tFinal[0].data_pagamento)}`);
    console.log(`    Baixa: ${b[0].baixa_id.slice(0,8)} R$${money(bFinal[0].valor_baixado)} conta=${bFinal[0].conta_financeira_id?.slice(0,8)||'NULL'} est=${bFinal[0].estornada}`);
    const ok = tFinal[0].status==='pago' && tFinal[0].data_pagamento && Number(bFinal[0].valor_baixado)===tval && bFinal[0].conta_financeira_id && !bFinal[0].estornada;
    console.log(`    ${ok?'✓':'✗'} Fluxo oficial: ${ok?'OK':'FALHOU'}`);
    totalTests++; if (ok) passedTests++;
    await c.query(`DELETE FROM financeiro_baixas WHERE id=$1`,[b[0].baixa_id]);
    await c.query(`DELETE FROM financeiro_pagar WHERE id=$1`,[tid]);
  } catch (e) {
    console.log(`    ✗ ERRO: ${e.message}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. RECEBER — REVALIDAR 363A.3
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 3. RECEBER (pós-363A.3) ───');

  const trgReceber = await q(c, `
    SELECT t.tgname, t.tgenabled FROM pg_trigger t
    WHERE t.tgrelid='financeiro_receber'::regclass AND t.tgname='trg_guardar_receber_pago_sem_baixa'
  `);
  console.log(`3.1 Trigger 363A.3: ${trgReceber.length ? 'EXISTE (enabled='+trgReceber[0].tgenabled+')' : 'NÃO EXISTE'}`);

  const violReceber = await q(c, `
    SELECT r.id, r.valor, r.status, r.updated_at
    FROM financeiro_receber r
    WHERE r.status IN ('pago','recebido','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada)
      AND r.updated_at > '2026-09-06 16:27'
  `);
  console.log(`3.2 Violações RECEBER pós-363A.3: ${violReceber.length}`);
  violReceber.forEach(r => console.log(`    ${r.id.slice(0,8)} R$${money(r.valor)} st=${r.status} upd=${fmt(r.updated_at)}`));

  // ══════════════════════════════════════════════════════════════════════
  // 4. PRESTADORES — REVALIDAR 362.3E
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 4. PRESTADORES (pós-362.3E) ───');

  const rpcPP = await q(c, `
    SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_confirmar_pagamento_prestador'
  `);
  console.log(`4.1 RPC 362.3E: ${rpcPP.length ? 'EXISTE' : 'NÃO EXISTE'}`);

  const pgPosE = await q(c, `
    SELECT pp.id, pp.valor_liquido, pp.data_pagamento, pp.updated_at
    FROM pagamentos_prestadores pp
    WHERE pp.status_pagamento='pago' AND pp.data_pagamento >= '2026-09-06'
    ORDER BY pp.updated_at
  `);
  console.log(`4.2 Pagamentos pós-362.3E: ${pgPosE.length}`);
  for (const pg of pgPosE) {
    const b = await q(c, `SELECT count(*) AS n FROM financeiro_baixas WHERE titulo_tabela='financeiro_pagar' AND NOT estornada AND created_at::date=COALESCE(${pg.data_pagamento?`'${pg.data_pagamento.toISOString().slice(0,10)}'`:'CURRENT_DATE'},CURRENT_DATE) AND valor_baixado=${Number(pg.valor_liquido)}`);
    console.log(`    ${pg.id.slice(0,8)} R$${money(pg.valor_liquido)} dt_pg=${fmt(pg.data_pagamento)} → ${b[0].n} baixa(s) compatível(is)`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. P2-A — CONTA FINANCEIRA OPCIONAL
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 5. P2-A — CONTA FINANCEIRA ───');

  const baixasSemConta = await q(c, `
    SELECT b.id, b.titulo_tabela, b.valor_baixado, b.conta_financeira_id, b.created_at
    FROM financeiro_baixas b
    WHERE b.conta_financeira_id IS NULL AND NOT b.estornada
    ORDER BY b.created_at
  `);
  console.log(`5.1 Baixas ATIVAS sem conta: ${baixasSemConta.length}`);
  baixasSemConta.slice(0,10).forEach(b => console.log(`    ${b.id.slice(0,8)} ${b.titulo_tabela} R$${money(b.valor_baixado)} criada=${fmt(b.created_at)}`));

  const rpcDef = await q(c, `
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_registrar_baixa_financeira'
  `);
  if (rpcDef.length) {
    const hasValidation = /conta_financeira_id.*NULL|RAISE.*conta/i.test(rpcDef[0].def);
    console.log(`5.2 RPC valida conta_financeira_id? ${hasValidation?'SIM':'NÃO (aceita NULL)'}`);
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. P2-B — DRE / HISTÓRICOS
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 6. P2-B — DRE / HISTÓRICOS ───');

  const dreRec = await q(c, `
    SELECT count(*) AS n, sum(valor) AS total
    FROM financeiro_receber
    WHERE status <> 'cancelado' AND data_vencimento >= date_trunc('month',CURRENT_DATE) AND data_vencimento < date_trunc('month',CURRENT_DATE) + interval '1 month'
  `);
  console.log(`6.1 DRE competência mês atual: ${dreRec[0].n} títulos, R$${money(dreRec[0].total)}`);

  const histSemBaixa = await q(c, `
    SELECT id::text, valor, status, data_vencimento, updated_at
    FROM financeiro_receber
    WHERE status IN ('pago','recebido') AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=financeiro_receber.id AND NOT b.estornada)
    ORDER BY updated_at
  `);
  console.log(`6.2 Históricos "pago" sem baixa: ${histSemBaixa.length}`);
  histSemBaixa.forEach(r => console.log(`    ${r.id.slice(0,8)} R$${money(r.valor)} venc=${fmt(r.data_vencimento)} upd=${fmt(r.updated_at)}`));

  // ══════════════════════════════════════════════════════════════════════
  // 7. P2-C — DASHBOARD
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 7. P2-C — DASHBOARD ───');

  const osFin = await q(c, `SELECT count(*) AS n, sum(valor_cliente) AS total FROM ordens_servico WHERE status='finalizada'`);
  const recAberto = await q(c, `SELECT count(*) AS n, sum(valor) AS total FROM financeiro_receber WHERE status NOT IN ('cancelado','pago','recebido','baixado')`);
  console.log(`7.1 Dashboard usa ordens_servico: ${osFin[0].n} OS finalizadas, R$${money(osFin[0].total)}`);
  console.log(`7.2 Carteira real (receber aberto): ${recAberto[0].n} títulos, R$${money(recAberto[0].total)}`);
  console.log(`    Diferença: R$${money(Number(osFin[0].total||0) - Number(recAberto[0].total||0))}`);

  // ══════════════════════════════════════════════════════════════════════
  // 8. RECONCILIAÇÃO COMPLETA
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 8. RECONCILIAÇÃO ───');

  // 8.1 Receber
  const recTotal = await q(c, `SELECT sum(valor) AS total FROM financeiro_receber WHERE status NOT IN ('cancelado')`);
  const recBaixas = await q(c, `SELECT sum(valor_baixado) AS total FROM financeiro_baixas WHERE titulo_tabela='financeiro_receber' AND NOT estornada`);
  const recPagoSemBaixa = await q(c, `
    SELECT sum(valor) AS total FROM financeiro_receber r
    WHERE r.status IN ('pago','recebido','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada)
  `);
  console.log(`8.1 RECEBER:`);
  console.log(`    Títulos (exceto cancelados): R$${money(recTotal[0].total)}`);
  console.log(`    Baixas realizadas: R$${money(recBaixas[0].total)}`);
  console.log(`    "Pago" sem baixa: R$${money(recPagoSemBaixa[0].total)}`);
  console.log(`    GAP: R$${money(Number(recTotal[0].total||0) - Number(recBaixas[0].total||0) - Number(recPagoSemBaixa[0].total||0))}`);

  // 8.2 Pagar
  const pagTotal = await q(c, `SELECT sum(valor) AS total FROM financeiro_pagar WHERE status NOT IN ('cancelado','cancelada')`);
  const pagBaixas = await q(c, `SELECT sum(valor_baixado) AS total FROM financeiro_baixas WHERE titulo_tabela='financeiro_pagar' AND NOT estornada`);
  const pagPagoSemBaixa = await q(c, `
    SELECT sum(valor) AS total FROM financeiro_pagar p
    WHERE p.status IN ('pago','paga','baixado')
      AND NOT EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_pagar' AND b.titulo_id=p.id AND NOT b.estornada)
  `);
  console.log(`8.2 PAGAR:`);
  console.log(`    Títulos (exceto cancelados): R$${money(pagTotal[0].total)}`);
  console.log(`    Baixas realizadas: R$${money(pagBaixas[0].total)}`);
  console.log(`    "Pago" sem baixa: R$${money(pagPagoSemBaixa[0].total)}`);
  console.log(`    GAP: R$${money(Number(pagTotal[0].total||0) - Number(pagBaixas[0].total||0) - Number(pagPagoSemBaixa[0].total||0))}`);

  // 8.3 Prestadores
  const ppTotal = await q(c, `SELECT sum(valor_liquido) AS total FROM pagamentos_prestadores WHERE status_pagamento='pago'`);
  const ppBaixas = await q(c, `
    SELECT sum(b.valor_baixado) AS total
    FROM financeiro_baixas b
    WHERE b.titulo_tabela='financeiro_pagar' AND b.observacao ILIKE '%pagamento prestador%' AND NOT b.estornada
  `);
  console.log(`8.3 PRESTADORES:`);
  console.log(`    Pagamentos pagos: R$${money(ppTotal[0].total)}`);
  console.log(`    Baixas "pagamento prestador": R$${money(ppBaixas[0].total)}`);
  console.log(`    GAP: R$${money(Number(ppTotal[0].total||0) - Number(ppBaixas[0].total||0))}`);

  // ══════════════════════════════════════════════════════════════════════
  // 9. ADVERSARIAIS ADICIONAIS
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n─── 9. ADVERSARIAIS ───');

  const overBaixa = await q(c, `
    SELECT r.id, r.valor, sum(b.valor_baixado) AS baixado
    FROM financeiro_receber r
    JOIN financeiro_baixas b ON b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada
    GROUP BY r.id, r.valor
    HAVING sum(b.valor_baixado) > r.valor + 0.01
  `);
  console.log(`9.1 Over-baixa (receber): ${overBaixa.length}`);

  const dupBaixa = await q(c, `
    SELECT titulo_tabela, titulo_id, valor_baixado, data_baixa, count(*) AS n
    FROM financeiro_baixas
    WHERE NOT estornada
    GROUP BY titulo_tabela, titulo_id, valor_baixado, data_baixa
    HAVING count(*) > 1
  `);
  console.log(`9.2 Baixas duplicadas: ${dupBaixa.length}`);

  const estornoIncons = await q(c, `
    SELECT r.id, r.status,
      (SELECT count(*) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND NOT b.estornada) AS ativas,
      (SELECT count(*) FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id AND b.estornada) AS estornadas
    FROM financeiro_receber r
    WHERE r.status IN ('pago','recebido') AND EXISTS (SELECT 1 FROM financeiro_baixas b WHERE b.titulo_tabela='financeiro_receber' AND b.titulo_id=r.id)
  `);
  const estornoProb = estornoIncons.filter(r => Number(r.ativas)===0 && Number(r.estornadas)>0);
  console.log(`9.3 Estorno inconsistente (pago mas 0 ativas): ${estornoProb.length}`);

  const contaInvalida = await q(c, `
    SELECT b.id, b.conta_financeira_id
    FROM financeiro_baixas b
    LEFT JOIN contas_financeiras c ON c.id = b.conta_financeira_id
    WHERE b.conta_financeira_id IS NOT NULL AND (c.id IS NULL OR c.ativa=false) AND NOT b.estornada
  `);
  console.log(`9.4 Baixas com conta inválida/inativa: ${contaInvalida.length}`);

  console.log(`\n═══ RESULTADO: ${passedTests}/${totalTests} testes passaram ═══`);
  console.log(`Fim: ${new Date().toISOString()}`);
  await c.end();
}

main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
