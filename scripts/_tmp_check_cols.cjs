require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await c.connect();
  const ae = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'alocacoes_escala' ORDER BY ordinal_position");
  console.log('alocacoes_escala:', ae.rows.map(x => x.column_name).join(', '));
  const os = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ordens_servico' ORDER BY ordinal_position");
  console.log('ordens_servico:', os.rows.map(x => x.column_name).join(', '));
  const dp = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'delivery_proofs' ORDER BY ordinal_position");
  console.log('delivery_proofs:', dp.rows.map(x => x.column_name).join(', '));
  const ep = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'entregas_protocolo' ORDER BY ordinal_position");
  console.log('entregas_protocolo:', ep.rows.map(x => x.column_name).join(', '));
  const ha = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'historico_alocacoes_escala' ORDER BY ordinal_position");
  console.log('historico_alocacoes_escala:', ha.rows.map(x => x.column_name).join(', '));
  await c.end();
})();
