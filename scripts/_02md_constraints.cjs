const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. UNIQUE constraints on financeiro_pagar
  console.log('=== 1. UNIQUE CONSTRAINTS financeiro_pagar ===');
  const uqFP = await c.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'financeiro_pagar'::regclass AND contype = 'u'
  `);
  console.log(JSON.stringify(uqFP.rows, null, 2));

  // 2. UNIQUE constraints on financeiro_baixas
  console.log('\n=== 2. UNIQUE CONSTRAINTS financeiro_baixas ===');
  const uqFB = await c.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'financeiro_baixas'::regclass AND contype = 'u'
  `);
  console.log(JSON.stringify(uqFB.rows, null, 2));

  // 3. UNIQUE constraints on pagamentos_prestadores
  console.log('\n=== 3. UNIQUE CONSTRAINTS pagamentos_prestadores ===');
  const uqPP = await c.query(`
    SELECT conname, contype, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'pagamentos_prestadores'::regclass AND contype = 'u'
  `);
  console.log(JSON.stringify(uqPP.rows, null, 2));

  // 4. FK constraints on financeiro_pagar
  console.log('\n=== 4. FK CONSTRAINTS financeiro_pagar ===');
  const fkFP = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'financeiro_pagar'::regclass AND contype = 'f'
  `);
  console.log(JSON.stringify(fkFP.rows, null, 2));

  // 5. FK constraints on financeiro_baixas
  console.log('\n=== 5. FK CONSTRAINTS financeiro_baixas ===');
  const fkFB = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'financeiro_baixas'::regclass AND contype = 'f'
  `);
  console.log(JSON.stringify(fkFB.rows, null, 2));

  // 6. All columns on financeiro_pagar
  console.log('\n=== 6. COLUMNS financeiro_pagar ===');
  const colsFP = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'financeiro_pagar' ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(colsFP.rows, null, 2));

  // 7. All columns on financeiro_baixas
  console.log('\n=== 7. COLUMNS financeiro_baixas ===');
  const colsFB = await c.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'financeiro_baixas' ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(colsFB.rows, null, 2));

  // 8. Does the system have any 'ajuste' or 'complemento' or 'residual' mechanism?
  console.log('\n=== 8. SEARCH for ajuste/complemento/residual in codebase ===');
  const ajuste = await c.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name LIKE '%ajuste%' OR table_name LIKE '%complemento%'
       OR table_name LIKE '%residual%' OR table_name LIKE '%diferenca%'
  `);
  console.log(JSON.stringify(ajuste.rows, null, 2));

  // 9. Check if there's a 'tipo' or 'categoria' column in financeiro_pagar for marking adjustments
  console.log('\n=== 9. COLUMN: tipo/categoria in financeiro_pagar ===');
  const tipoCol = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'financeiro_pagar'
    AND (column_name LIKE '%tipo%' OR column_name LIKE '%categoria%'
         OR column_name LIKE '%descricao%' OR column_name LIKE '%observa%')
  `);
  console.log(JSON.stringify(tipoCol.rows, null, 2));

  // 10. Check what the 'observacoes' field looks like in paid FP records
  console.log('\n=== 10. FP PAGO with observacoes (sample) ===');
  const obs = await c.query(`
    SELECT id, valor, status, observacoes, descricao
    FROM financeiro_pagar
    WHERE status = 'pago' AND observacoes IS NOT NULL AND observacoes != ''
    LIMIT 5
  `);
  console.log(JSON.stringify(obs.rows, null, 2));

  // 11. Check if there's a 'saldo' or 'valor_pago' or 'valor_original' in financeiro_pagar
  console.log('\n=== 11. LOOK FOR saldo/valor_pago/valor_original columns ===');
  const saldoCols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'financeiro_pagar'
    AND (column_name LIKE '%saldo%' OR column_name LIKE '%pago%'
         OR column_name LIKE '%original%' OR column_name LIKE '%liquido%')
  `);
  console.log(JSON.stringify(saldoCols.rows, null, 2));

  // 12. Check all FP with os_id = CESAR's os_id (is there another FP for same allocation?)
  console.log('\n=== 12. ALL FP for CESAR os_id ===');
  const fpSameOS = await c.query(`
    SELECT id, valor, status, fornecedor_id, prestador, os_id, created_at, descricao
    FROM financeiro_pagar
    WHERE os_id = '58e5751e-bd54-43c5-9bcf-55fe4e575e6b'
    ORDER BY created_at
  `);
  console.log(JSON.stringify(fpSameOS.rows, null, 2));

  // 13. Check the trigger M66 for how it handles ON CONFLICT
  console.log('\n=== 13. M66 TRIGGER: ON CONFLICT behavior for FP ===');
  const fnSrc = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao'
  `);
  const src = fnSrc.rows[0]?.prosrc || '';
  // Find the FP INSERT block
  const fpBlock = src.substring(
    src.indexOf('INSERT INTO financeiro_pagar'),
    src.indexOf('INSERT INTO financeiro_pagar') + 500
  );
  console.log(fpBlock);

  // 14. Check the RPC f_confirmar_pagamento_fechamento source
  console.log('\n=== 14. RPC fechamento source (first 800 chars) ===');
  const rpcFn = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento'
  `);
  const rpcSrc = rpcFn.rows[0]?.prosrc || '';
  console.log(rpcSrc.substring(0, 800));

  // 15. Check if the TS service 'confirmarPagamento' creates FP or just baixa
  console.log('\n=== 15. Check recent baixas that reference payment IDs ===');
  const refBaixas = await c.query(`
    SELECT id, titulo_id, valor_baixado, observacao, created_at
    FROM financeiro_baixas
    WHERE observacao LIKE '%pagamento prestador%'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(refBaixas.rows, null, 2));

  // 16. Check if there's any 'estorno' mechanism
  console.log('\n=== 16. ESTORNO mechanism ===');
  const estorno = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'financeiro_baixas'
    AND (column_name LIKE '%estorno%')
  `);
  console.log(JSON.stringify(estorno.rows, null, 2));

  // 17. Check PP 32fe474f in detail — was it linked to CESAR's allocation?
  console.log('\n=== 17. PP 32fe474f detail ===');
  const pp32 = await c.query(`
    SELECT id, prestador_id, prestador_nome, os_id, valor_liquido,
           status_pagamento, status, data_pagamento, created_at
    FROM pagamentos_prestadores
    WHERE id = '32fe474f-41c7-432b-a21e-7d0b2831c1bb'
  `);
  console.log(JSON.stringify(pp32.rows, null, 2));

  // 18. Check the RPC f_confirmar_pagamento_prestador source (the one that validates FP=PP)
  console.log('\n=== 18. RPC pagamento_prestador source (first 800 chars) ===');
  const rpcPrest = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  const rpcPSrc = rpcPrest.rows[0]?.prosrc || '';
  console.log(rpcPSrc.substring(0, 800));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
