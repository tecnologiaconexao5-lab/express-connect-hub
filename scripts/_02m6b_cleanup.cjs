const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
const FP_ID = '9b2e56ba-0457-42a7-b731-2daba9d6ea26';
const OS_ID = 'a2ac3c46-b36f-4352-a1e7-dfecc1200387';

(async () => {
  await c.connect();

  // ============ FASE 1: PREFLIGHT ============
  console.log('=== FASE 1 — PREFLIGHT ===\n');

  const fp = await c.query(`SELECT id, os_id, prestador, valor, status, is_teste, descricao, created_at, updated_at FROM financeiro_pagar WHERE id = $1`, [FP_ID]);
  const f = fp.rows[0];
  console.log('FP LIVE:');
  console.log(`  id:          ${f.id}`);
  console.log(`  os_id:       ${f.os_id}`);
  console.log(`  prestador:   ${f.prestador}`);
  console.log(`  valor:       ${f.valor}`);
  console.log(`  status:      ${f.status}`);
  console.log(`  is_teste:    ${f.is_teste}`);
  console.log(`  descricao:   ${f.descricao}`);
  console.log(`  created_at:  ${f.created_at}`);
  console.log(`  updated_at:  ${f.updated_at}`);

  const ppCount = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores WHERE os_id = $1`, [OS_ID]);
  const bxCt = await c.query(`SELECT count(*) AS n FROM financeiro_baixas WHERE titulo_id = $1`, [FP_ID]);

  console.log(`\nPP count: ${ppCount.rows[0].n}`);
  console.log(`Baixa count: ${bxCt.rows[0].n}`);

  const checks = [
    { desc: 'id correto', ok: f.id === FP_ID },
    { desc: 'os_id correto', ok: f.os_id === OS_ID },
    { desc: 'valor = 900', ok: f.valor == 900 },
    { desc: 'status = a vencer', ok: f.status === 'a vencer' },
    { desc: 'is_teste = true', ok: f.is_teste === true },
    { desc: 'descricao contem teste', ok: f.descricao && f.descricao.toLowerCase().includes('teste') },
    { desc: 'PP = 0', ok: parseInt(ppCount.rows[0].n) === 0 },
    { desc: 'Baixa = 0', ok: parseInt(bxCt.rows[0].n) === 0 },
  ];

  console.log('\nCHECKS:');
  let allOk = true;
  for (const ch of checks) {
    const s = ch.ok ? 'PASS' : 'FAIL';
    if (!ch.ok) allOk = false;
    console.log(`  ${ch.desc} ... ${s}`);
  }

  if (!allOk) {
    console.log('\nBLOCKED — preflight falhou');
    await c.end();
    process.exit(1);
  }
  console.log('\nPREFLIGHT: PASS');

  // Check valid cancel statuses
  const statusCheck = await c.query(`
    SELECT DISTINCT status FROM financeiro_pagar
    WHERE status IN ('cancelado', 'cancelada', 'cancelado por teste')
    LIMIT 10
  `);
  console.log(`\nStatus de cancelamento existentes: ${statusCheck.rows.map(r => r.status).join(', ')}`);

  // Check CHECK constraint
  const ck = await c.query(`
    SELECT pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE conname = 'ck_fp_status'
  `);
  if (ck.rows.length > 0) {
    console.log(`CHECK constraint: ${ck.rows[0].def}`);
  }

  // ============ FASE 2: CANCEL ============
  console.log('\n=== FASE 2 — CANCELAMENTO ===\n');

  const cancelStatus = 'cancelado';
  console.log(`Status escolhido: ${cancelStatus}`);

  await c.query('BEGIN');
  const upd = await c.query(
    `UPDATE financeiro_pagar SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, valor, is_teste, updated_at`,
    [cancelStatus, FP_ID]
  );
  console.log(`UPDATE: ${JSON.stringify(upd.rows[0])}`);
  await c.query('COMMIT');
  console.log('COMMIT OK');

  // ============ FASE 3: VALIDATION ============
  console.log('\n=== FASE 3 — VALIDACAO ===\n');

  const after = await c.query(`SELECT id, os_id, valor, status, is_teste, updated_at FROM financeiro_pagar WHERE id = $1`, [FP_ID]);
  const a = after.rows[0];
  console.log('FP AFTER:');
  console.log(`  id:       ${a.id}`);
  console.log(`  os_id:    ${a.os_id}`);
  console.log(`  valor:    ${a.valor}`);
  console.log(`  status:   ${a.status}`);
  console.log(`  is_teste: ${a.is_teste}`);

  const ppAfter = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores WHERE os_id = $1`, [OS_ID]);
  const bxAfter = await c.query(`SELECT count(*) AS n FROM financeiro_baixas WHERE titulo_id = $1`, [FP_ID]);

  console.log(`\nPP count: ${ppAfter.rows[0].n}`);
  console.log(`Baixa count: ${bxAfter.rows[0].n}`);

  // Check no other FP was altered
  const outroFP = await c.query(`SELECT count(*) AS n FROM financeiro_pagar WHERE updated_at > NOW() - INTERVAL '1 minute' AND id != $1`, [FP_ID]);
  console.log(`Outros FP alterados: ${outroFP.rows[0].n}`);

  const valChecks = [
    { desc: 'FP continua existindo', ok: a !== undefined },
    { desc: 'FP.valor = 900.00', ok: a.valor == 900 },
    { desc: 'FP.is_teste = true', ok: a.is_teste === true },
    { desc: 'FP.status = cancelado', ok: a.status === cancelStatus },
    { desc: 'PP = 0', ok: parseInt(ppAfter.rows[0].n) === 0 },
    { desc: 'Baixa = 0', ok: parseInt(bxAfter.rows[0].n) === 0 },
    { desc: 'Nenhum outro FP alterado', ok: parseInt(outroFP.rows[0].n) === 0 },
  ];

  console.log('\nVALIDACAO:');
  let vAllOk = true;
  for (const ch of valChecks) {
    const s = ch.ok ? 'PASS' : 'FAIL';
    if (!ch.ok) vAllOk = false;
    console.log(`  ${ch.desc} ... ${s}`);
  }

  // Final query: FP sem PP
  console.log('\n=== CONSULTA FINAL: FP SEM PP ===');
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
  console.log(`Total FP sem PP: ${finalFPs.rows.length}`);
  finalFPs.rows.forEach(r => {
    const tag = r.status === 'cancelado' ? 'CANCELADO' : (r.status === 'cancelada' ? 'CANCELADO' : (r.is_teste ? 'TESTE' : 'ATIVO'));
    console.log(`  ${r.id.substring(0,8)}... status=${r.status}, teste=${r.is_teste}, valor=${r.valor} [${tag}]`);
  });

  // Count ativos vs cancelados
  const ativos = finalFPs.rows.filter(r => r.status !== 'cancelado' && r.status !== 'cancelada' && !r.is_teste);
  console.log(`\nAtivos (obrigacao real): ${ativos.length}`);
  console.log(`Cancelados/teste: ${finalFPs.rows.length - ativos.length}`);

  if (ativos.length === 0) {
    console.log('\n✅ FP_ATIVO_SEM_PP_COM_OBRIGACAO_REAL = 0');
  }

  // CESAR check
  const cesar = await c.query(`SELECT id, valor, status FROM financeiro_pagar WHERE id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'`);
  console.log(`\nCESAR: ${JSON.stringify(cesar.rows[0])}`);

  console.log(`\n=== RESULTADO: ${vAllOk ? 'PASS' : 'BLOCKED'} ===`);

  await c.end();
})();
