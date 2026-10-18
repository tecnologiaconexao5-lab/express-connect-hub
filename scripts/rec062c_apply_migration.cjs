const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PG_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026!%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function applyMigration() {
  const client = new Client({ connectionString: PG_URL });
  await client.connect();
  console.log('Conectado ao Supabase remoto');

  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations', '20260907_rec_062c_automacoes.sql'),
    'utf8'
  );

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration aplicada com sucesso');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERRO:', err.message);
    process.exit(1);
  }

  // Verificar
  const { rows } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'recrutamento_automacoes' ORDER BY ordinal_position
  `);
  console.log('\nColunas recrutamento_automacoes:');
  for (const r of rows) console.log('  ', r.column_name, '-', r.data_type);

  const { rows: policies } = await client.query(`
    SELECT policyname, cmd, roles::text FROM pg_policies
    WHERE tablename = 'recrutamento_automacoes'
  `);
  console.log('\nPolicies:');
  for (const p of policies) console.log('  ', p.policyname, '-', p.cmd, '-', p.roles);

  await client.end();
}

applyMigration();
