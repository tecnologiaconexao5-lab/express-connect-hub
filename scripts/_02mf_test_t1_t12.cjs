const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

let passed = 0, failed = 0, total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(`  T${total}: ${name} ... PASS`);
  } catch (e) {
    failed++;
    console.log(`  T${total}: ${name} ... FAIL: ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  await c.connect();
  console.log('=== 02M.5F TESTES T1-T12 — DADOS CONTROLADOS ===\n');

  const contaRes = await c.query("SELECT id, nome FROM contas_financeiras WHERE ativa = true ORDER BY principal DESC LIMIT 1");
  const conta = contaRes.rows[0];
  console.log('Conta ativa:', conta.nome, conta.id);

  const prestId = 'aaaa1111-bbbb-cccc-dddd-eeeeeeee0001';
  const prestNome = 'TESTE PRESTADOR 02MF';
  await c.query(`INSERT INTO prestadores (id, nome_completo, cpf_cnpj, created_at)
    VALUES ($1, $2, '00000000000000', now())
    ON CONFLICT (id) DO UPDATE SET nome_completo = EXCLUDED.nome_completo`, [prestId, prestNome]);

  async function createLinkedFP_PP(valor) {
    const osId = crypto.randomUUID();
    const fpId = crypto.randomUUID();
    const ppId = crypto.randomUUID();
    await c.query(`INSERT INTO financeiro_pagar (id, valor, status, fornecedor_id, prestador, fornecedor_nome, os_id, created_at, updated_at)
      VALUES ($1, $2, 'aberto', $3, $4, $5, $6, now(), now())`, [fpId, valor, prestId, prestId, prestNome, osId]);
    await c.query(`INSERT INTO pagamentos_prestadores (id, valor_liquido, valor_servicos, status, status_pagamento, prestador_id, prestador_nome, os_id, periodo_inicio, periodo_fim, created_at, updated_at)
      VALUES ($1, $2, $3, 'pendente', 'pendente', $4, $5, $6, CURRENT_DATE, CURRENT_DATE, now(), now())`, [ppId, valor, valor, prestId, prestNome, osId]);
    return { fpId, ppId, osId };
  }

  async function cleanup(fpId, ppId) {
    if (fpId) await c.query(`DELETE FROM financeiro_baixas WHERE titulo_id = $1`, [fpId]);
    if (fpId) await c.query(`DELETE FROM financeiro_pagar WHERE id = $1`, [fpId]);
    if (ppId) await c.query(`DELETE FROM pagamentos_prestadores WHERE id = $1`, [ppId]);
  }

  // T1: Pagamento integral normal
  await test('Pagamento integral normal', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      const r = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE)`, [ppId]);
      const row = r.rows[0];
      assert(row.sucesso === true, `sucesso=false: ${row.mensagem}`);
      assert(row.valor_pagamento == 1000, `valor_pagamento=${row.valor_pagamento}`);
      assert(row.saldo_restante == 0, `saldo_restante=${row.saldo_restante}`);
      const fp = await c.query(`SELECT status FROM financeiro_pagar WHERE id = $1`, [fpId]);
      assert(fp.rows[0].status === 'pago', `FP status=${fp.rows[0].status}`);
      const bx = await c.query(`SELECT * FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      assert(bx.rows.length === 1, `baixas=${bx.rows.length}`);
      assert(Number(bx.rows[0].valor_baixado) === 1000, `valor_baixado=${bx.rows[0].valor_baixado}`);
      assert(Number(bx.rows[0].saldo_restante) === 0, `saldo_restante=${bx.rows[0].saldo_restante}`);
      const pp = await c.query(`SELECT status_pagamento FROM pagamentos_prestadores WHERE id = $1`, [ppId]);
      assert(pp.rows[0].status_pagamento === 'pago', `PP status=${pp.rows[0].status_pagamento}`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T2: Pagamento parcial
  await test('Pagamento parcial', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      const r1 = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      assert(r1.rows[0].sucesso === true, `1a parcial sucesso=false: ${r1.rows[0].mensagem}`);
      assert(r1.rows[0].saldo_restante == 400, `saldo_restante=${r1.rows[0].saldo_restante}`);
      const fp = await c.query(`SELECT status FROM financeiro_pagar WHERE id = $1`, [fpId]);
      assert(fp.rows[0].status === 'parcial', `FP status=${fp.rows[0].status}`);
      const bx = await c.query(`SELECT * FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      assert(bx.rows.length === 1, `baixas=${bx.rows.length}`);
      assert(Number(bx.rows[0].valor_baixado) === 600, `valor_baixado=${bx.rows[0].valor_baixado}`);
      assert(Number(bx.rows[0].saldo_restante) === 400, `saldo_restante=${bx.rows[0].saldo_restante}`);
      const pp = await c.query(`SELECT status_pagamento FROM pagamentos_prestadores WHERE id = $1`, [ppId]);
      assert(pp.rows[0].status_pagamento === 'pendente', `PP status=${pp.rows[0].status_pagamento}`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T3: Segunda baixa quitando saldo
  await test('Segunda baixa quitando saldo', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const r2 = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 400)`, [ppId]);
      assert(r2.rows[0].sucesso === true, `2a baixa sucesso=false: ${r2.rows[0].mensagem}`);
      assert(r2.rows[0].saldo_restante == 0, `saldo_restante=${r2.rows[0].saldo_restante}`);
      const fp = await c.query(`SELECT status FROM financeiro_pagar WHERE id = $1`, [fpId]);
      assert(fp.rows[0].status === 'pago', `FP status=${fp.rows[0].status}`);
      const bx = await c.query(`SELECT * FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      assert(bx.rows.length === 2, `baixas=${bx.rows.length}`);
      const pp = await c.query(`SELECT status_pagamento FROM pagamentos_prestadores WHERE id = $1`, [ppId]);
      assert(pp.rows[0].status_pagamento === 'pago', `PP status=${pp.rows[0].status_pagamento}`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T4: Pagamento maior que saldo
  await test('Pagamento maior que saldo → rejeitar', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const r = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 500)`, [ppId]);
      assert(r.rows[0].sucesso === false, `deveria rejeitar`);
      assert(r.rows[0].mensagem.includes('excede'), `mensagem: ${r.rows[0].mensagem}`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T5: Valor zero
  await test('Valor zero → rejeitar', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      const r = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 0)`, [ppId]);
      assert(r.rows[0].sucesso === false, `deveria rejeitar`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T6: Valor negativo
  await test('Valor negativo → rejeitar', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      const r = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, -100)`, [ppId]);
      assert(r.rows[0].sucesso === false, `deveria rejeitar`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T7: Retry
  await test('Retry da mesma operacao → nao duplicar', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE)`, [ppId]);
      const r2 = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE)`, [ppId]);
      assert(r2.rows[0].sucesso === false, `deveria rejeitar retry`);
      const bx = await c.query(`SELECT COUNT(*)::int as cnt FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      assert(bx.rows[0].cnt === 1, `baixas=${bx.rows[0].cnt}, deveria ser 1`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T8: Concorrência
  await test('Concorrencia/duplo clique → nao pagar duas vezes', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      const r1 = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const r2 = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const successCount = [r1.rows[0], r2.rows[0]].filter(r => r.sucesso === true).length;
      assert(successCount === 1, `sucessCount=${successCount}, deveria ser 1`);
      const bx = await c.query(`SELECT SUM(valor_baixado)::numeric as total FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      assert(Number(bx.rows[0].total) === 600, `total_baixado=${bx.rows[0].total}`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T9: FP já pago
  await test('FP ja pago → rejeitar', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE)`, [ppId]);
      const ppId2 = crypto.randomUUID();
      const osId2 = crypto.randomUUID();
      await c.query(`INSERT INTO pagamentos_prestadores (id, valor_liquido, valor_servicos, status, status_pagamento, prestador_id, prestador_nome, os_id, periodo_inicio, periodo_fim, created_at, updated_at)
        VALUES ($1, 1000, 1000, 'pendente', 'pendente', $2, $3, $4, CURRENT_DATE, CURRENT_DATE, now(), now())`, [ppId2, prestId, prestNome, osId2]);
      try {
        const r = await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE)`, [ppId2]);
        assert(r.rows[0].sucesso === false, `deveria rejeitar FP ja pago`);
      } finally {
        await c.query(`DELETE FROM pagamentos_prestadores WHERE id = $1`, [ppId2]);
      }
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T10: Estorno após parcial
  await test('Estorno apos parcial → saldo/status coerentes', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const bxRes = await c.query(`SELECT id FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      const baixaId = bxRes.rows[0].id;
      const r = await c.query(`SELECT * FROM f_estornar_baixa_financeira($1, 'teste 02mf')`, [baixaId]);
      assert(r.rows[0].sucesso === true, `estorno sucesso=false: ${r.rows[0].mensagem}`);
      const fp = await c.query(`SELECT status FROM financeiro_pagar WHERE id = $1`, [fpId]);
      assert(fp.rows[0].status === 'aberto', `FP status=${fp.rows[0].status}`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T11: DRE sem duplicidade
  await test('DRE sem duplicidade', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const pp = await c.query(`SELECT valor_liquido, status_pagamento FROM pagamentos_prestadores WHERE id = $1`, [ppId]);
      assert(Number(pp.rows[0].valor_liquido) === 1000, `PP valor_liquido=${pp.rows[0].valor_liquido}`);
      assert(pp.rows[0].status_pagamento === 'pendente', `PP status=${pp.rows[0].status_pagamento}`);
      const bx = await c.query(`SELECT SUM(valor_baixado)::numeric as total FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      assert(Number(bx.rows[0].total) === 600, `FC realizado=${bx.rows[0].total}`);
      assert(Number(pp.rows[0].valor_liquido) !== Number(bx.rows[0].total), `DRE=FC, deveria ser diferente`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // T12: Fluxo de Caixa previsto/realizado
  await test('Fluxo de Caixa previsto/realizado coerente', async () => {
    const { fpId, ppId } = await createLinkedFP_PP(1000);
    try {
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 600)`, [ppId]);
      const fp = await c.query(`SELECT valor, status FROM financeiro_pagar WHERE id = $1`, [fpId]);
      const fcPrevisto = Number(fp.rows[0].valor);
      assert(fcPrevisto === 1000, `FC previsto=${fcPrevisto}`);
      const bx = await c.query(`SELECT SUM(valor_baixado)::numeric as total FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      const fcRealizado = Number(bx.rows[0].total);
      assert(fcRealizado === 600, `FC realizado=${fcRealizado}`);
      assert(fcRealizado <= fcPrevisto, `realizado > previsto`);
      await c.query(`SELECT * FROM f_confirmar_pagamento_prestador($1, CURRENT_DATE, 400)`, [ppId]);
      const bx2 = await c.query(`SELECT SUM(valor_baixado)::numeric as total FROM financeiro_baixas WHERE titulo_id = $1 AND NOT estornada`, [fpId]);
      const fcRealizado2 = Number(bx2.rows[0].total);
      assert(fcRealizado2 === 1000, `FC realizado apos quitacao=${fcRealizado2}`);
      assert(fcRealizado2 === fcPrevisto, `realizado != previsto apos quitacao`);
      await cleanup(fpId, ppId);
    } catch (e) { await cleanup(fpId, ppId); throw e; }
  });

  // CESAR VERIFICATION
  console.log('\n=== CESAR VERIFICATION ===');
  const cesarFp = await c.query(`SELECT id, valor, status, updated_at FROM financeiro_pagar WHERE id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'`);
  const cesarBx = await c.query(`SELECT id, valor_original, valor_baixado, saldo_restante, estornada FROM financeiro_baixas WHERE titulo_id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'`);
  console.log('CESAR FP:', JSON.stringify(cesarFp.rows[0]));
  console.log('CESAR Baixa:', JSON.stringify(cesarBx.rows[0]));
  assert(cesarFp.rows[0].valor == 652.86, 'CESAR valor nao reconciliado!');
  assert(cesarFp.rows[0].status === 'parcial', 'CESAR status nao reconciliado!');
  assert(Number(cesarBx.rows[0].valor_baixado) === 520, 'CESAR baixa historical changed!');
  assert(Number(cesarBx.rows[0].saldo_restante) === 132.86, 'CESAR saldo pendente wrong!');
  console.log('CESAR: RECONCILIADO (valor=652.86, status=parcial, pago=520, saldo=132.86)');

  await c.query(`DELETE FROM prestadores WHERE id = $1`, [prestId]);

  console.log(`\n=== RESULTADO: ${passed}/${total} PASS, ${failed} FAIL ===`);
  if (failed > 0) process.exit(1);
  await c.end();
})();
