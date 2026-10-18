import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});
const r = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'financeiro_receber' ORDER BY ordinal_position");
console.table(r.rows);
await pool.end();
