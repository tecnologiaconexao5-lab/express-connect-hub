const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

const FP_ID  = '9f2be89f-5ece-4cc5-be29-50010b64e64e';
const BX_ID  = '286c2c2d-90e4-403a-9692-8e68ccfd2a6c';

(async () => {
  await c.connect();

  console.log('=== 02M.5G — RECONCILIAÇÃO CESAR ===');
  console.log('Iniciando transação...\n');

  await c.query('BEGIN');

  try {
    // WRITE 1: FP.valor 520.00 → 652.86
    const w1 = await c.query(
      "UPDATE financeiro_pagar SET valor = 652.86, updated_at = NOW() WHERE id = $1 RETURNING id, valor, status",
      [FP_ID]
    );
    console.log('WRITE 1 — FP.valor → 652.86:', JSON.stringify(w1.rows[0]));

    // WRITE 2: FP.status pago → parcial
    const w2 = await c.query(
      "UPDATE financeiro_pagar SET status = 'parcial', updated_at = NOW() WHERE id = $1 RETURNING id, valor, status",
      [FP_ID]
    );
    console.log('WRITE 2 — FP.status → parcial:', JSON.stringify(w2.rows[0]));

    // WRITE 3: baixa.valor_original 520.00 → 652.86
    const w3 = await c.query(
      "UPDATE financeiro_baixas SET valor_original = 652.86 WHERE id = $1 RETURNING id, valor_original, valor_baixado, saldo_restante",
      [BX_ID]
    );
    console.log('WRITE 3 — baixa.valor_original → 652.86:', JSON.stringify(w3.rows[0]));

    // WRITE 4: baixa.saldo_restante 0.00 → 132.86
    const w4 = await c.query(
      "UPDATE financeiro_baixas SET saldo_restante = 132.86 WHERE id = $1 RETURNING id, valor_original, valor_baixado, saldo_restante",
      [BX_ID]
    );
    console.log('WRITE 4 — baixa.saldo_restante → 132.86:', JSON.stringify(w4.rows[0]));

    // NÃO ALTERAR: valor_baixado permanece 520.00
    // NÃO ALTERAR: PP permanece pendente
    // NÃO ALTERAR: nenhum outro registro

    await c.query('COMMIT');
    console.log('\n✅ COMMIT OK — 4 writes executados atomicamente');

  } catch (e) {
    await c.query('ROLLBACK');
    console.error('\n❌ ERRO — ROLLBACK executado:', e.message);
    process.exit(1);
  }

  // FASE 3 — Validação LIVE
  console.log('\n=== FASE 3 — VALIDAÇÃO LIVE ===');

  const fp = await c.query("SELECT id, valor, status, updated_at FROM financeiro_pagar WHERE id = $1", [FP_ID]);
  const fpRow = fp.rows[0];
  console.log('FP LIVE:', JSON.stringify(fpRow));

  const bx = await c.query("SELECT id, valor_original, valor_baixado, saldo_restante, estornada FROM financeiro_baixas WHERE id = $1", [BX_ID]);
  const bxRow = bx.rows[0];
  console.log('BAIXA LIVE:', JSON.stringify(bxRow));

  const pp = await c.query("SELECT id, valor_liquido, status_pagamento, status FROM pagamentos_prestadores WHERE id = '7461daf6-438b-43b3-abde-4d30e1609574'");
  console.log('PP LIVE:', JSON.stringify(pp.rows[0]));

  // Contagens
  const cntFP = await c.query("SELECT COUNT(*) AS n FROM financeiro_pagar WHERE os_id = '58e5751e-bd54-43c5-9bcf-55fe4e575e6b'");
  console.log('FPs no os_id:', cntFP.rows[0].n);

  const cntBx = await c.query("SELECT COUNT(*) AS n FROM financeiro_baixas WHERE titulo_id = $1 AND estornada = false", [FP_ID]);
  console.log('Baixas ativas FP:', cntBx.rows[0].n);

  // Validações
  const checks = [
    { desc: 'FP.valor = 652.86', ok: fpRow.valor === '652.86' },
    { desc: 'FP.status = parcial', ok: fpRow.status === 'parcial' },
    { desc: 'baixa.valor_original = 652.86', ok: bxRow.valor_original === '652.86' },
    { desc: 'baixa.valor_baixado = 520.00 (NÃO ALTERADO)', ok: bxRow.valor_baixado === '520.00' },
    { desc: 'baixa.saldo_restante = 132.86', ok: bxRow.saldo_restante === '132.86' },
    { desc: 'baixa.estornada = false', ok: bxRow.estornada === false },
    { desc: '652.86 - 520.00 = 132.86 (prova matemática)', ok: parseFloat(bxRow.valor_original) - parseFloat(bxRow.valor_baixado) === parseFloat(bxRow.saldo_restante) },
    { desc: 'PP não alterado (valor_liquido=652.86)', ok: pp.rows[0].valor_liquido === '652.86' },
    { desc: 'PP não alterado (status=pendente)', ok: pp.rows[0].status === 'pendente' },
    { desc: '1 FP no os_id (sem duplicação)', ok: parseInt(cntFP.rows[0].n) === 1 },
    { desc: '1 baixa ativa (sem duplicação)', ok: parseInt(cntBx.rows[0].n) === 1 },
  ];

  console.log('\n=== RESULTADOS ===');
  let pass = 0, fail = 0;
  for (const ch of checks) {
    const s = ch.ok ? 'PASS' : 'FAIL';
    if (ch.ok) pass++; else fail++;
    console.log(`  ${ch.desc} ... ${s}`);
  }
  console.log(`\nTOTAL: ${pass}/${checks.length} PASS, ${fail} FAIL`);

  if (fail > 0) {
    console.log('\n❌ RECONCILIAÇÃO FALHOU — executar rollback');
    process.exit(1);
  }

  console.log('\n✅ CESAR_RECONCILIATION_EXEC = PASS');

  await c.end();
})();
