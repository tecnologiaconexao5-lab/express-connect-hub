import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function applyMigration() {
  console.log('=== APLICANDO MIGRAÇÃO M108-C1 ===\n');

  const sqlPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '20260710_m108c1_pod_unico_entregas_protocolo.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolons and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let success = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    // Get first meaningful line for logging
    const firstLine = stmt.split('\n').find(l => l.trim().length > 0 && !l.trim().startsWith('--')) || stmt.slice(0, 80);
    try {
      await pool.query(stmt);
      success++;
      if (i % 5 === 0) process.stdout.write('.');
    } catch (err) {
      // Ignore "already exists" errors for idempotency
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('IF NOT EXISTS')) {
        success++;
        if (i % 5 === 0) process.stdout.write('.');
      } else {
        failed++;
        console.log(`\n❌ [${i}] Erro: ${msg.slice(0, 150)}`);
        console.log(`   Statement: ${firstLine.slice(0, 100)}`);
      }
    }
  }

  console.log(`\n\n✅ ${success} statements executados`);
  if (failed > 0) {
    console.log(`❌ ${failed} statements com erro`);
  }

  // Verify
  console.log('\n=== VERIFICANDO APLICAÇÃO ===\n');

  const checks = [
    { name: 'Coluna receiver_relationship em entregas_protocolo',
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='receiver_relationship'` },
    { name: 'Coluna gps_accuracy em entregas_protocolo',
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='gps_accuracy'` },
    { name: 'Coluna foto_canhoto_url em delivery_proofs',
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_proofs' AND column_name='foto_canhoto_url'` },
    { name: 'Coluna tenant_id em delivery_proofs',
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_proofs' AND column_name='tenant_id'` },
    { name: 'Função f_sync_delivery_proof_to_entregas',
      query: `SELECT proname FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas'` },
    { name: 'Trigger trg_sync_delivery_proof_to_entregas',
      query: `SELECT tgname FROM pg_trigger WHERE tgrelid='public.delivery_proofs'::regclass AND tgname='trg_sync_delivery_proof_to_entregas' AND NOT tgisinternal` },
    { name: 'Índice idx_delivery_proofs_operation_id',
      query: `SELECT indexname FROM pg_indexes WHERE tablename='delivery_proofs' AND indexname='idx_delivery_proofs_operation_id'` },
    { name: 'Índice idx_entregas_protocolo_alocacao_id_tenant',
      query: `SELECT indexname FROM pg_indexes WHERE tablename='entregas_protocolo' AND indexname='idx_entregas_protocolo_alocacao_id_tenant'` },
  ];

  let allOk = true;
  for (const check of checks) {
    const { rows } = await pool.query(check.query);
    const ok = rows.length > 0;
    console.log(`   ${ok ? '✅' : '❌'} ${check.name}`);
    if (!ok) allOk = false;
  }

  await pool.end();

  if (allOk) {
    console.log('\n✅ MIGRAÇÃO APLICADA COM SUCESSO!');
  } else {
    console.log('\n⚠️ Migration aplicada parcialmente. Verificar erros acima.');
    process.exit(1);
  }
}

applyMigration().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
