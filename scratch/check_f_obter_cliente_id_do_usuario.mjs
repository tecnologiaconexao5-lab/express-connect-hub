import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
c.connect().then(() => c.query("select prosrc from pg_proc where proname = 'f_obter_cliente_id_do_usuario'")).then(res => { console.log(res.rows[0]); c.end(); });
