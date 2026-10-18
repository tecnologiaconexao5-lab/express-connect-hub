// Find exact prestador ID
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 10000 });
  await c.connect();
  
  // Find the prestador with auth_user_id
  const r = await c.query(`SELECT id, nome_completo, status, auth_user_id, LEFT(cpf_cnpj,20) AS doc, email FROM public.prestadores WHERE auth_user_id IS NOT NULL`);
  console.log(`Prestadores with auth_user_id: ${r.rows.length}`);
  for (const row of r.rows) {
    console.log(`  ID: ${row.id}`);
    console.log(`  Nome: ${row.nome_completo}`);
    console.log(`  Status: ${row.status}`);
    console.log(`  auth_user_id: ${row.auth_user_id}`);
    console.log(`  Email: ${row.email || '(null)'}`);
    console.log(`  CPF/CNPJ: ${row.doc || '(null)'}`);
    console.log('');
  }
  await c.end();
})();
