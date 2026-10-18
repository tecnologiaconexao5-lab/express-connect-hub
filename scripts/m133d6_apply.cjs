// MISSÃO 133-D.6 — APLICAÇÃO ÚNICA DA MIGRATION AUTORIZADA
// Uso: node scripts/m133d6_apply.cjs
// Requer DATABASE_URL no .env
// Parada no primeiro erro | Transação | stdout+stderr | código saída | horário

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Carrega .env
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERRO: DATABASE_URL nao encontrada no .env');
  process.exit(1);
}

// Mascarar segredo para logs
const maskedUrl = DATABASE_URL.replace(/:[^:@]+@/, ':****@');

async function main() {
  const startTime = new Date();
  console.log('=== MISSÃO 133-D.6 — APLICAÇÃO CONTROLADA ===');
  console.log(`Início: ${startTime.toISOString()}`);
  console.log(`Database: ${maskedUrl}\n`);

  // Ler migration
  const migrationPath = path.resolve(__dirname, '..',
    'supabase', 'migrations', '20260722_m133d4_fix_rpc_app_security.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`ERRO: Migration não encontrada em ${migrationPath}`);
    process.exit(2);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const lineCount = sql.split('\n').length;
  console.log(`Migration: ${path.basename(migrationPath)} (${lineCount} linhas)\n`);

  // Conectar
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60000,
  });

  await client.connect();
  console.log('Conectado ao Supabase remoto.\n');

  try {
    // Executar em transação
    await client.query('BEGIN');
    console.log('Transação INICIADA.');

    // Executar migration
    console.log('Executando migration...');
    const result = await client.query(sql);
    console.log(`Migration executada: ${result.command || 'OK (comandos múltiplos)'}\n`);

    // Validar com SELECT
    const valRes = await client.query(`
      SELECT 'M133-D.4 applied: f_avancar_etapa VOLATILE, f_atualizar_reversa auth.fix(), grants security fix 3/3' AS status
    `);
    console.log(`Validação: ${valRes.rows[0].status}`);

    // Commit
    await client.query('COMMIT');
    console.log('\nTransação COMMITADA com sucesso.');

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    console.log(`\nTérmino: ${endTime.toISOString()}`);
    console.log(`Duração: ${duration.toFixed(1)}s`);
    console.log('\n=== M133-D.6 APLICADA COM SUCESSO ===');
    
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error(`\nERRO: ${err.message}`);
    
    try {
      await client.query('ROLLBACK');
      console.log('ROLLBACK executado.');
    } catch (rbErr) {
      console.error(`Erro no ROLLBACK: ${rbErr.message}`);
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    console.log(`Duração: ${duration.toFixed(1)}s`);
    console.log('\n=== APLICAÇÃO FALHOU — ROLLBACK EXECUTADO ===');
    
    await client.end();
    process.exit(3);
  }
}

main();
