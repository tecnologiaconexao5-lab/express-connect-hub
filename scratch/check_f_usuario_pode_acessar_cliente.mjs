import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });
c.connect().then(() => c.query("select prosrc from pg_proc where proname = 'f_usuario_pode_acessar_cliente'")).then(res => { console.log(res.rows[0]); c.end(); });
