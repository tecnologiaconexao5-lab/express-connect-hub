const pg = require("pg");
const c = new pg.Client({
  connectionString: "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
});
c.connect().then(async () => {
  const r = await c.query("SELECT id, cliente, valor, status FROM financeiro_receber WHERE valor = 12.34 AND status = 'pendente' ORDER BY created_at DESC LIMIT 10");
  console.log("Sentinela records (val=12.34, status=pendente):");
  r.rows.forEach(row => console.log(`  ${row.id} | cliente=${row.cliente} | val=${row.valor} | status=${row.status}`));
  await c.end();
}).catch(e => console.error(e.message));
