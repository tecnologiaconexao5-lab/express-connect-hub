const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
const FP_ID = '9b2e56ba-0457-42a7-b731-2daba9d6ea26';
const OS_ID = 'a2ac3c46-b36f-4352-a1e7-dfecc1200387';

(async () => {
  await c.connect();
  console.log('=== VALIDACAO POS-CANCELAMENTO ===\n');

  const fp = await c.query(`SELECT id, os_id, valor, status, is_teste, descricao, updated_at FROM financeiro_pagar WHERE id = $1`, [FP_ID]);
  const f = fp.rows[0];
  console.log('FP:', JSON.stringify(f));

  const ppCount = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores WHERE os_id = $1`, [OS_ID]);
  const bxCt = await c.query(`SELECT count(*) AS n FROM financeiro_baixas WHERE titulo_id = $1`, [FP_ID]);

  const checks = [
    { desc: '1. FP continua existindo', ok: f !== undefined },
    { desc: '2. FP.valor = 900.00', ok: f.valor == 900 },
    { desc: '3. FP.is_teste = true', ok: f.is_teste === true },
    { desc: '4. FP.status = cancelado', ok: f.status === 'cancelado' },
    { desc: '5. PP = 0', ok: parseInt(ppCount.rows[0].n) === 0 },
    { desc: '6. Baixa = 0', ok: parseInt(bxCt.rows[0].n) === 0 },
    { desc: '7. R$900 nao e obrigacao ativa', ok: f.status === 'cancelado' },
    { desc: '8. Nenhum pagamento criado', ok: parseInt(ppCount.rows[0].n) === 0 },
  ];

  // Check no other FP was altered in last 5 minutes
  const outroFP = await c.query(`SELECT id, status FROM financeiro_pagar WHERE updated_at > NOW() - INTERVAL '5 minutes' AND id != $1`, [FP_ID]);
  checks.push({ desc: '9. Nenhum outro FP alterado', ok: outroFP.rows.length === 0 });

  // Check CESAR unchanged
  const cesar = await c.query(`SELECT id, valor, status FROM financeiro_pagar WHERE id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'`);
  checks.push({ desc: '10. CESAR intocado', ok: cesar.rows[0].status === 'parcial' && cesar.rows[0].valor == 652.86 });

  // Final query: FP sem PP
  const finalFPs = await c.query(`
    SELECT fp.id, fp.os_id, fp.status, fp.is_teste, fp.valor
    FROM financeiro_pagar fp
    WHERE fp.os_id IS NOT NULL
      AND fp.os_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND NOT EXISTS (
        SELECT 1 FROM pagamentos_prestadores pp
        WHERE pp.os_id = fp.os_id::uuid
      )
    ORDER BY fp.created_at
  `);

  const ativos = finalFPs.rows.filter(r => r.status !== 'cancelado' && r.status !== 'cancelada' && !r.is_teste);
  checks.push({ desc: '11. FP_ATIVO_SEM_PP = 0', ok: ativos.length === 0 });

  console.log('\nRESULTADOS:');
  let pass = 0, fail = 0;
  for (const ch of checks) {
    const s = ch.ok ? 'PASS' : 'FAIL';
    if (ch.ok) pass++; else fail++;
    console.log(`  ${ch.desc} ... ${s}`);
  }

  console.log(`\nFP sem PP: ${finalFPs.rows.length} total`);
  console.log(`  Ativos (obrigacao real): ${ativos.length}`);
  console.log(`  Cancelados/teste: ${finalFPs.rows.length - ativos.length}`);
  console.log(`\nCESAR: ${JSON.stringify(cesar.rows[0])}`);
  console.log(`\nTOTAL: ${pass}/${checks.length} PASS, ${fail} FAIL`);

  if (fail === 0) {
    console.log('\nFP900_TEST_CLEANUP = PASS');
  } else {
    console.log('\nFP900_TEST_CLEANUP = BLOCKED');
  }

  await c.end();
})();
