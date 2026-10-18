const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();
  
  // Check all args including defaults
  const r1 = await c.query(`
    SELECT proname, proargnames, 
      pg_get_function_arguments(oid) as args,
      pg_get_function_result(oid) as ret
    FROM pg_proc 
    WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  console.log('=== SIGNATURE ===');
  console.log('args:', r1.rows[0].args);
  console.log('ret:', r1.rows[0].ret);
  console.log('proargnames:', r1.rows[0].proargnames);
  
  // Check if p_valor_pago exists
  const hasValor = r1.rows[0].proargnames.includes('p_valor_pago');
  console.log('Has p_valor_pago:', hasValor);
  
  // Get full definition
  const r2 = await c.query(`
    SELECT pg_get_functiondef(oid) as full_def
    FROM pg_proc 
    WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  // Check for parcial support in the definition
  const def = r2.rows[0].full_def;
  console.log('Has parcial logic:', def.includes('parcial'));
  console.log('Has p_valor_pago param:', def.includes('p_valor_pago'));
  console.log('Lines:', def.split('\n').length);
  
  await c.end();
})();
