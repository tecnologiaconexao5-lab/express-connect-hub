const {Client} = require('pg');
const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const c = new Client({connectionString: DB_URL});
c.connect()
  .then(() => c.query(`SELECT t.tgname, t.tgenabled, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='financeiro_pagar'::regclass AND NOT t.tgisinternal`))
  .then(r => {
    console.log('Triggers financeiro_pagar:');
    r.rows.forEach(t => console.log('  ', t.tgname, 'enabled=' + t.tgenabled, 'fn=' + t.proname));
    return c.end();
  })
  .catch(e => { console.error('ERRO:', e.message); c.end(); process.exit(1); });
