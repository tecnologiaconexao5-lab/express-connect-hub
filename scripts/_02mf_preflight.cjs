const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();

  // 1. Full definition of f_confirmar_pagamento_prestador
  const r1 = await c.query(`
    SELECT proname, proargnames, proargtypes::regtype[] as arg_types,
      pg_get_functiondef(oid) as full_def, pg_get_function_arguments(oid) as signature
    FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  console.log('=== PREFLIGHT: f_confirmar_pagamento_prestador FULL DEFINITION ===');
  for (const row of r1.rows) {
    console.log('proname:', row.proname);
    console.log('signature:', row.signature);
    console.log('proargnames:', row.proargnames);
    console.log('--- FULL SQL ---');
    console.log(row.full_def);
  }

  // 2. f_registrar_baixa_financeira
  const r2 = await c.query(`
    SELECT proname, pg_get_function_arguments(oid) as signature,
      pg_get_functiondef(oid) as full_def
    FROM pg_proc WHERE proname = 'f_registrar_baixa_financeira'
  `);
  console.log('\n=== REFERENCE: f_registrar_baixa_financeira ===');
  for (const row of r2.rows) {
    console.log('signature:', row.signature);
    console.log(row.full_def);
  }

  // 3. f_estornar_baixa_financeira
  const r3 = await c.query(`
    SELECT proname, pg_get_function_arguments(oid) as signature,
      pg_get_functiondef(oid) as full_def
    FROM pg_proc WHERE proname = 'f_estornar_baixa_financeira'
  `);
  console.log('\n=== REFERENCE: f_estornar_baixa_financeira ===');
  for (const row of r3.rows) {
    console.log('signature:', row.signature);
    console.log(row.full_def);
  }

  // 4. All callers of f_confirmar_pagamento_prestador in TS
  console.log('\n=== CALLERS ANALYSIS ===');
  
  // 5. Check trigger guard function
  const r5 = await c.query(`
    SELECT proname, pg_get_functiondef(oid) as full_def
    FROM pg_proc WHERE proname = 'trg_guardar_pagar_pago_sem_baixa'
  `);
  console.log('=== TRIGGER GUARD: trg_guardar_pagar_pago_sem_baixa ===');
  for (const row of r5.rows) {
    console.log(row.full_def);
  }

  // 6. Check all triggers on financeiro_pagar
  const r6 = await c.query(`
    SELECT tgname, tgenabled, 
      (SELECT proname FROM pg_proc WHERE oid = t.tgfoid) as func_name
    FROM pg_trigger t 
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'financeiro_pagar' AND NOT t.tgisinternal
  `);
  console.log('\n=== ALL TRIGGERS ON financeiro_pagar ===');
  console.log(JSON.stringify(r6.rows, null, 2));

  // 7. Current state of CESAR's FP (confirm untouched)
  const r7 = await c.query(`
    SELECT fp.id, fp.valor, fp.status, fp.os_id, fp.fornecedor_id, 
      fp.created_at, fp.updated_at, fp.observacoes,
      p.nome_completo as prestador_nome
    FROM financeiro_pagar fp
    LEFT JOIN prestadores p ON p.id = fp.fornecedor_id::uuid
    WHERE fp.id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'
  `);
  console.log('\n=== CESAR FP CURRENT STATE (SHOULD NOT CHANGE) ===');
  console.log(JSON.stringify(r7.rows, null, 2));

  // 8. Current state of CESAR's baixa
  const r8 = await c.query(`
    SELECT id, titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
      data_baixa, estornada, observacao
    FROM financeiro_baixas
    WHERE titulo_id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'
  `);
  console.log('\n=== CESAR BAIXA CURRENT STATE (SHOULD NOT CHANGE) ===');
  console.log(JSON.stringify(r8.rows, null, 2));

  // 9. PP callers in TS
  console.log('\n=== PP RPC SIGNATURE ===');
  const r9 = await c.query(`
    SELECT pg_get_function_arguments(oid) as args, pg_get_function_result(oid) as ret
    FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  for (const row of r9.rows) {
    console.log('INPUT:', row.args);
    console.log('RETURN:', row.ret);
  }

  await c.end();
})();
