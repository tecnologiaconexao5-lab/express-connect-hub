import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
c.connect().then(() => c.query("select relrowsecurity from pg_class where relname = 'ordens_servico'")).then(res => { console.log(res.rows); c.end(); });
