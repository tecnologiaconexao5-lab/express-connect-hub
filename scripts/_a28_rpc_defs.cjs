const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const RPCS = ['f_enviar_mensagem_torre', 'f_responder_mensagem_torre', 'f_marcar_mensagens_lidas_torre', 'f_marcar_mensagens_lidas_app', 'f_contar_mensagens_nao_lidas_torre'];

(async () => {
  await client.connect();
  for (const rpc of RPCS) {
    const r = await client.query(`
      SELECT pg_get_functiondef(p.oid) AS def, p.provolatile, p.prosecdef
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname=$1`, [rpc]);
    if (!r.rows.length) { console.log(`\n##### ${rpc}: NÃO EXISTE`); continue; }
    const { def, provolatile, prosecdef } = r.rows[0];
    console.log(`\n════════════════════════════════════════════════════════`);
    console.log(`##### ${rpc} | volatile=${provolatile} securdef=${prosecdef}`);
    console.log('════════════════════════════════════════════════════════');
    console.log(def);
  }
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });