const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.resolve('.env'), 'utf8');
const m = env.match(/^DATABASE_URL=(.+)$/m);
if (!m) { console.error('no DATABASE_URL'); process.exit(1); }
const url = m[1].replace(/^["']|["']$/g, '');

async function main() {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'alocacoes_escala'
    ORDER BY ordinal_position
  `);
  console.log('ALOCACOES_ESCALA columns:');
  for (const r of cols.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ')');

  const aloc = await c.query(`
    SELECT ae.id, ae.ordem_servico_id, ae.status, ae.prestador_id, ae.tenant_id, ae.created_at
    FROM alocacoes_escala ae
    WHERE ae.prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
    ORDER BY ae.created_at DESC
    LIMIT 20
  `);
  console.log('\nALOCACOES for prestador:');
  for (const r of aloc.rows) {
    console.log('  id=' + r.id + ' os=' + (r.ordem_servico_id||'NULL') + ' status=' + r.status + ' created=' + (r.created_at||'').toString().substring(0,19));
  }

  const rpCols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rota_paradas'
    ORDER BY ordinal_position
  `);
  console.log('\nROTA_PARADAS columns:');
  for (const r of rpCols.rows) console.log('  ' + r.column_name + ' (' + r.data_type + ')');

  const tenant = await c.query(`SELECT id, nome FROM tenants LIMIT 5`);
  console.log('\nTENANTS:');
  for (const r of tenant.rows) console.log('  ' + r.id + ' | ' + r.nome);

  const veics = await c.query(`SELECT id, placa, prestador_vinculado FROM veiculos WHERE prestador_vinculado = 'e6646799-fbac-453e-a3ef-afdfc01a7085' LIMIT 5`);
  console.log('\nVEICULOS do prestador:');
  for (const r of veics.rows) console.log('  ' + r.id + ' | placa=' + r.placa + ' | prest_vinculado=' + r.prestador_vinculado);

  await c.end();
}
main().catch(console.error);
