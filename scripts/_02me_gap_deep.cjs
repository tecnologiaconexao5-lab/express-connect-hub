const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. f_registrar_baixa_financeira — FULL source
  console.log('=== 1. f_registrar_baixa_financeira ===');
  const baixa = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_registrar_baixa_financeira'
  `);
  console.log(baixa.rows[0]?.prosrc || 'NOT FOUND');

  // 2. f_estornar_baixa_financeira — FULL source
  console.log('\n=== 2. f_estornar_baixa_financeira ===');
  const estorno = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_estornar_baixa_financeira'
  `);
  console.log(estorno.rows[0]?.prosrc || 'NOT FOUND');

  // 3. Check the trigger function name for trg_guardar_pagar_pago_sem_baixa
  console.log('\n=== 3. ALL TRIGGERS ON financeiro_pagar ===');
  const triggers = await c.query(`
    SELECT tgname, tgenabled,
           (SELECT proname FROM pg_proc WHERE oid = tgfoid) as func_name
    FROM pg_trigger
    WHERE tgrelid = 'financeiro_pagar'::regclass AND NOT tgisinternal
  `);
  console.log(JSON.stringify(triggers.rows, null, 2));

  // 4. Get the trigger guard function source
  console.log('\n=== 4. TRIGGER GUARD FUNCTION ===');
  const guardFunc = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname LIKE '%guardar%pagar%'
  `);
  for (const g of guardFunc.rows) {
    console.log(g.prosrc);
  }

  // 5. Check if there are any RPCs that handle partial payment
  console.log('\n=== 5. ALL RPCs with baixa logic ===');
  const rpcs = await c.query(`
    SELECT proname FROM pg_proc
    WHERE prosrc LIKE '%financeiro_baixas%'
    AND proname LIKE 'f_%'
  `);
  console.log(JSON.stringify(rpcs.rows.map(r => r.proname)));

  // 6. Check how the TS service handles status in ContasPagar
  console.log('\n=== 6. SEARCH: parcial in all functions ===');
  const parcial = await c.query(`
    SELECT proname, routines as src
    FROM information_schema.routines
    WHERE routine_definition LIKE '%parcial%'
    AND routine_type = 'FUNCTION'
  `);
  console.log(JSON.stringify(parcial.rows.map(r => r.proname)));

  // 7. Get the CHECK constraint definition again (confirm 'parcial')
  console.log('\n=== 7. FP CHECK CONSTRAINT (exact) ===');
  const ck = await c.query(`
    SELECT pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conname = 'ck_fp_status'
  `);
  console.log(ck.rows[0]?.def);

  // 8. Check what status the RPC actually sets for FP
  console.log('\n=== 8. RPC SET STATUS — exact lines ===');
  const rpc = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  const src = rpc.rows[0]?.prosrc || '';
  const setLines = src.split('\n').filter(l => l.includes('SET') || l.includes('status ='));
  console.log(setLines.join('\n'));

  // 9. Check the saldo validation in RPC
  console.log('\n=== 9. RPC SALDO VALIDATION — exact ===');
  const saldoLines = src.split('\n').filter(l =>
    l.includes('saldo') || l.includes('v_saldo') || l.includes('v_valor')
  );
  console.log(saldoLines.join('\n'));

  // 10. Check how many FP with os_id match PP with different values
  console.log('\n=== 10. FP vs PP VALUE DIVERGENCE ===');
  const divergence = await c.query(`
    SELECT fp.id, fp.valor as fp_valor, fp.status as fp_status,
           pp.valor_liquido as pp_valor, pp.status_pagamento as pp_status
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id
      AND pp.prestador_id = fp.fornecedor_id
    WHERE fp.status NOT IN ('pago', 'cancelado', 'cancelada')
    AND fp.valor <> pp.valor_liquido
    ORDER BY ABS(fp.valor - pp.valor_liquido) DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(divergence.rows, null, 2));

  // 11. Check: does the RPC match FP by OS + PRESTADOR + VALOR?
  console.log('\n=== 11. RPC MATCHING LOGIC — exact ===');
  const matchLines = src.split('\n').filter(l =>
    l.includes('os_id') && (l.includes('SELECT') || l.includes('WHERE'))
  );
  console.log(matchLines.join('\n'));

  // 12. Check: is there any UI/service that sets FP status to 'parcial'?
  console.log('\n=== 12. SEARCH: parcial in pg_proc (all) ===');
  const allParcial = await c.query(`
    SELECT proname FROM pg_proc
    WHERE prosrc LIKE '%parcial%'
  `);
  console.log(JSON.stringify(allParcial.rows.map(r => r.proname)));

  // 13. Check: what happens if we UPDATE FP status to 'aberto' (simulate partial)?
  console.log('\n=== 13. TRIGGER: all triggers on financeiro_pagar (with function source) ===');
  for (const t of triggers.rows) {
    console.log(`\nTrigger: ${t.tgname}, func: ${t.func_name}, enabled: ${t.tgenabled}`);
    const fnSrc = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = $1`, [t.func_name]);
    if (fnSrc.rows[0]?.prosrc) {
      const lines = fnSrc.rows[0].prosrc.split('\n').filter(l =>
        l.includes('status') || l.includes('NEW') || l.includes('OLD')
        || l.includes('RAISE') || l.includes('EXCEPTION')
      );
      console.log(lines.slice(0, 20).join('\n'));
    }
  }

  // 14. Check: the RPC matching for PP → FP (what if FP.status = 'parcial'?)
  console.log('\n=== 14. RPC FP MATCHING — status filter ===');
  const statusFilter = src.split('\n').filter(l =>
    l.includes('NOT IN') || l.includes('status')
  );
  console.log(statusFilter.join('\n'));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
