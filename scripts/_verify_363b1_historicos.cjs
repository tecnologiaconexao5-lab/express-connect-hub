const {Client} = require('pg');
const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const c = new Client({connectionString: DB_URL});
c.connect()
  .then(() => c.query(`
    SELECT 'receber' AS tabela, id::text, status, valor::text AS valor, updated_at::text
    FROM financeiro_receber WHERE id::text LIKE '2d625b18%' OR id::text LIKE '17e857d8%' OR id::text LIKE 'fb30838a%' OR id::text LIKE 'cf6eea7b%'
    UNION ALL
    SELECT 'pagar', id::text, status, valor::text, updated_at::text
    FROM financeiro_pagar WHERE id::text LIKE 'f83a3249%' OR id::text LIKE '9e07494b%'
    UNION ALL
    SELECT 'pp', id::text, status_pagamento, valor_liquido::text, updated_at::text
    FROM pagamentos_prestadores WHERE id::text LIKE '32fe474f%' OR id::text LIKE '6266f2a1%'
    ORDER BY 1, 2
  `))
  .then(r => {
    console.log('Históricos (devem estar intactos):');
    r.rows.forEach(row => console.log(`  ${row.tabela} ${row.id.slice(0,8)} st=${row.status} valor=${row.valor} upd=${row.updated_at}`));
    return c.end();
  })
  .catch(e => { console.error('ERRO:', e.message); c.end(); process.exit(1); });
