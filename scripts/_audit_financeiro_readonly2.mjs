import pg from 'pg';
const { Client } = pg;

const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const queries = [
  { name: '5b. FK integrity - financeiro_pagar orfas os_id (cast)', sql: `
SELECT COUNT(*) as orfas_os
FROM financeiro_pagar fp
WHERE fp.os_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ordens_servico os WHERE os.id = fp.os_id::uuid);` },

  { name: '6b. FK integrity - financeiro_receber orfas os_id (cast)', sql: `
SELECT COUNT(*) as orfas_os
FROM financeiro_receber fr
WHERE fr.os_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ordens_servico os WHERE os.id = fr.os_id::uuid);` },

  { name: '7b. Tenant_id check - find correct column name', sql: `
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'financeiro_pagar' AND column_name LIKE '%tenant%' ORDER BY column_name;` },

  { name: '9c. Status pago sem data_pagamento (pagar) - find columns', sql: `
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'financeiro_pagar' AND column_name LIKE '%data%' ORDER BY column_name;` },

  { name: '9d. Status pago sem data_pagamento (receber) - find columns', sql: `
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'financeiro_receber' AND column_name LIKE '%data%' ORDER BY column_name;` },

  { name: '5c. FK integrity pagar - os_id type check', sql: `
SELECT pg_typeof(fp.os_id) as os_id_type, fp.os_id 
FROM financeiro_pagar fp WHERE fp.os_id IS NOT NULL LIMIT 3;` },
];

(async () => {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  for (const q of queries) {
    console.log('\n' + '='.repeat(80));
    console.log(q.name);
    console.log('='.repeat(80));
    try {
      const res = await client.query(q.sql);
      if (res.rows.length === 0) {
        console.log('(0 rows returned)');
      } else {
        console.table(res.rows);
      }
    } catch(e) {
      console.log('ERROR:', e.message);
    }
  }
  
  await client.end();
  console.log('\n✅ Schema check complete');
})();
