const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260906_fin_master_363a3_bloqueio_receber_pago_sem_baixa.sql');

const sql = fs.readFileSync(migrationFile, 'utf8');
const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();
    console.log('Conectado. Aplicando migration...');
    await client.query(sql);
    console.log('✓ Migration aplicada com sucesso!');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
