const pg = require("pg");
const c = new pg.Client({
  connectionString: "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
});
c.connect().then(async () => {
  const r = await c.query("DELETE FROM financeiro_receber WHERE valor = 12.34 AND status = 'pendente' AND cliente IS NULL AND cliente_id = '3d2d079d-708b-4d4d-9c0b-1ed9b894e37e' RETURNING id");
  console.log("Deleted", r.rowCount, "sentinelas");
  const r2 = await c.query("SELECT count(*) FROM financeiro_receber");
  console.log("Total receber remaining:", r2.rows[0].count);
  await c.end();
}).catch(e => console.error(e.message));
