const { Client } = require('pg');
const fs = require('fs');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();
  const sql = fs.readFileSync('C:/Users/DIEGO BALBINO/Desktop/Pasta Compartilhada/DOCUMENTOS EMPRESA/08_TECNOLOGIA_SISTEMAS/express-connect-hub/supabase/migrations/20260920_02mf_fix_rpc_pagamento_prestador_parcial.sql', 'utf8');
  await c.query(sql);
  console.log('MIGRATION APPLIED OK');
  
  // Verify new signature
  const r = await c.query("SELECT pg_get_function_arguments(oid) as args FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'");
  console.log('NEW SIGNATURE:', r.rows[0].args);
  
  await c.end();
})();
