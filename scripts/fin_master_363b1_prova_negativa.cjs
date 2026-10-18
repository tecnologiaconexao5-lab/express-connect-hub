// FIN-MASTER-363B.1 — Prova negativa do bloqueio PAGAR pago sem baixa
// Testes A, B, C, D: trigger DB impede status pago/paga/baixado sem baixa
const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function test(client, name, fn) {
  try {
    await fn();
    console.log(`✗ ${name}: FALHOU (deveria ter bloqueado)`);
    return false;
  } catch (e) {
    if (/sem baixa financeira/i.test(e.message)) {
      console.log(`✓ ${name}: BLOQUEADO — ${e.message.slice(0, 80)}`);
      return true;
    } else {
      console.log(`✗ ${name}: ERRO INESPERADO — ${e.message}`);
      return false;
    }
  }
}

async function main() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  console.log('═══ FIN-MASTER-363B.1 — PROVA NEGATIVA ═══\n');

  let pass = 0, total = 0;

  // TESTE A: INSERT direto com status='pago' (sem baixa)
  total++;
  if (await test(c, 'A) INSERT financeiro_pagar status=pago', async () => {
    await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento)
      VALUES ('TESTE 363B.1-A', 100.00, 'pago', CURRENT_DATE + interval '30 days')
    `);
  })) pass++;

  // TESTE B: UPDATE de 'aberto' para 'pago' (sem baixa)
  total++;
  if (await test(c, 'B) UPDATE financeiro_pagar aberto→pago', async () => {
    const r = await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento)
      VALUES ('TESTE 363B.1-B', 200.00, 'aberto', CURRENT_DATE + interval '30 days')
      RETURNING id
    `);
    const id = r.rows[0].id;
    try {
      await c.query(`UPDATE financeiro_pagar SET status='pago' WHERE id=$1`, [id]);
    } finally {
      await c.query(`DELETE FROM financeiro_pagar WHERE id=$1`, [id]);
    }
  })) pass++;

  // TESTE C: Variantes 'paga' e 'baixado'
  total++;
  if (await test(c, 'C) INSERT status=paga', async () => {
    await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento)
      VALUES ('TESTE 363B.1-C1', 300.00, 'paga', CURRENT_DATE + interval '30 days')
    `);
  })) pass++;

  total++;
  if (await test(c, 'C) INSERT status=baixado', async () => {
    await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento)
      VALUES ('TESTE 363B.1-C2', 400.00, 'baixado', CURRENT_DATE + interval '30 days')
    `);
  })) pass++;

  // TESTE D: Bypass direto via UPDATE com status='paga' (UI path)
  total++;
  if (await test(c, 'D) UPDATE aberto→paga (bypass UI)', async () => {
    const r = await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento)
      VALUES ('TESTE 363B.1-D', 500.00, 'aberto', CURRENT_DATE + interval '30 days')
      RETURNING id
    `);
    const id = r.rows[0].id;
    try {
      await c.query(`UPDATE financeiro_pagar SET status='paga' WHERE id=$1`, [id]);
    } finally {
      await c.query(`DELETE FROM financeiro_pagar WHERE id=$1`, [id]);
    }
  })) pass++;

  // TESTE E: Trigger permite quando baixa existe (prova de que RPC funciona)
  total++;
  try {
    const r = await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento)
      VALUES ('TESTE 363B.1-E', 600.00, 'aberto', CURRENT_DATE + interval '30 days')
      RETURNING id
    `);
    const tituloId = r.rows[0].id;
    
    // Criar baixa (simulando RPC)
    await c.query(`
      INSERT INTO financeiro_baixas (titulo_tabela, titulo_id, valor_baixado, valor_original, saldo_restante, data_baixa, forma_pagamento, estornada)
      VALUES ('financeiro_pagar', $1, 600.00, 600.00, 0.00, CURRENT_DATE, 'PIX', false)
    `, [tituloId]);
    
    // Agora UPDATE para 'pago' deve funcionar
    await c.query(`UPDATE financeiro_pagar SET status='pago' WHERE id=$1`, [tituloId]);
    
    // Verificar
    const check = await c.query(`SELECT status FROM financeiro_pagar WHERE id=$1`, [tituloId]);
    if (check.rows[0].status === 'pago') {
      console.log('✓ E) Trigger permite pago QUANDO baixa existe: OK');
      pass++;
    } else {
      console.log('✗ E) Trigger não atualizou status');
    }
    
    // Limpar
    await c.query(`DELETE FROM financeiro_baixas WHERE titulo_id=$1`, [tituloId]);
    await c.query(`DELETE FROM financeiro_pagar WHERE id=$1`, [tituloId]);
  } catch (e) {
    console.log(`✗ E) ERRO: ${e.message}`);
  }

  console.log(`\n═══ RESULTADO: ${pass}/${total} testes passaram ═══`);
  await c.end();
  
  if (pass < total) {
    console.log('\n⚠ ALGUNS TESTES FALHARAM — bloqueio pode estar incompleto');
    process.exit(1);
  } else {
    console.log('\n✓ TODOS OS TESTES PASSARAM — P1-A CORRIGIDO');
  }
}

main().catch(e => { console.error('ERRO FATAL:', e.message); process.exit(1); });
