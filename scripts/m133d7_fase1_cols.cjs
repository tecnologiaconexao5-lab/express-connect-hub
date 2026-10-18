// Descobrir colunas text/numeric das tabelas de interesse
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL'); process.exit(1); }

const TABLES = ['ordens_servico','alocacoes_escala','prestadores','clientes','veiculos','eventos_oficiais','operation_timeline_events','financeiro_receber','financeiro_pagar','pagamentos_prestadores','composicao_financeira_os'];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await client.connect();

  for (const tbl of TABLES) {
    const res = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`, [tbl]);
    const textCols = res.rows.filter(r => r.data_type === 'text' || r.data_type === 'character varying' || r.data_type === 'character' || r.data_type === 'uuid').map(r => r.column_name);
    const tsCols = res.rows.filter(r => r.data_type === 'timestamp with time zone' || r.data_type === 'timestamp without time zone').map(r => r.column_name);
    const numCols = res.rows.filter(r => r.data_type === 'numeric' || r.data_type === 'integer' || r.data_type === 'bigint').map(r => r.column_name);
    console.log(`${tbl}:`);
    console.log(`  TEXT: ${textCols.slice(0,10).join(', ')}${textCols.length > 10 ? ` ... (+${textCols.length - 10})` : ''}`);
    console.log(`  TS: ${tsCols.slice(0,5).join(', ')}${tsCols.length > 5 ? ` ... (+${tsCols.length - 5})` : ''}`);
    console.log(`  NUM: ${numCols.slice(0,5).join(', ')}`);
    console.log();
  }

  await client.end();
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
