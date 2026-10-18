const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
});

async function main() {
  await c.connect();

  // Fix NULL valor record using valor_bruto as reference
  const r = await c.query(
    `UPDATE financeiro_pagar SET valor = valor_bruto WHERE id = '26e05ffe-9180-4d2b-b199-e697db3116b1' AND valor IS NULL AND valor_bruto IS NOT NULL RETURNING id, valor, valor_bruto`
  );
  console.log('Updated:', JSON.stringify(r.rows));

  // Check for any other NULL valor records
  const check = await c.query(`SELECT id, valor, valor_bruto FROM financeiro_pagar WHERE valor IS NULL`);
  console.log('Remaining NULL valor records:', check.rows.length);
  if (check.rows.length > 0) console.log(JSON.stringify(check.rows));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
