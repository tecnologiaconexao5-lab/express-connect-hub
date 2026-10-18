const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();
  const rpc = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_buscar_oportunidades_para_prestador'`);
  const rdef = rpc.rows[0].def;

  // localizar posições das strings sensíveis e exibir a linha onde ocorrem
  const lines = rdef.split('\n');
  lines.forEach((ln, i) => {
    if (/valor_cliente|margem|custo/.test(ln)) {
      console.log(`L${i + 1}: ${ln.trim()}`);
    }
  });
  console.log('\n--- total linhas da função:', lines.length, '---');
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });