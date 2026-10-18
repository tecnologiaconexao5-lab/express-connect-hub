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

  // 1. Check if HOMOLOGAÇÃO APP client already exists (by CNPJ test)
  const existing = await c.query(`
    SELECT id, razao_social, nome_fantasia, cnpj, status, tenant_id
    FROM clientes WHERE cnpj = '00.000.000/0000-00'
  `);
  if (existing.rows.length > 0) {
    console.log('CLIENTE JA EXISTE:', JSON.stringify(existing.rows[0]));
  } else {
    console.log('Cliente nao existe - sera criado');
  }

  // 2. Check if HML-APP-001 already exists
  const existingOS = await c.query(`
    SELECT id, numero, status, cliente, prestador
    FROM ordens_servico WHERE numero = 'HML-APP-001'
  `);
  if (existingOS.rows.length > 0) {
    console.log('OS JA EXISTE:', JSON.stringify(existingOS.rows[0]));
  } else {
    console.log('OS nao existe - sera criada');
  }

  // 3. Check if there's an existing alocação for the test prestador with this client
  // We'll check after creating

  await c.end();
}
main().catch(console.error);
