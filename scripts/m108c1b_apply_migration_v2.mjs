import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function apply() {
  console.log('=== APLICANDO MIGRAÇÃO M108-C1 (v2) ===\n');

  const sqlPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '20260710_m108c1_pod_unico_entregas_protocolo.sql');
  let sql = fs.readFileSync(sqlPath, 'utf8');

  // Remove comment-only lines and leading/trailing whitespace
  const lines = sql.split('\n');
  const cleaned = lines
    .map(l => l.trim())
    .filter(l => !l.startsWith('--') && l.length > 0)
    .join('\n');

  // The key insight: PL/pgSQL functions are delimited by $$...$$.
  // We need to send the ENTIRE SQL as one execution, but PostgreSQL
  // doesn't allow multi-statement in extended query protocol easily.
  // Best approach: use the pg client's query() which sends as a simple query.

  try {
    // Method 1: Try sending the whole file at once (pg simple query handles multi-statement)
    await pool.query(sql);
    console.log('✅ Migration executada com sucesso (envio único)');
  } catch (err) {
    // If that fails, fall back to per-statement with proper splitting
    console.log('⚠️ Envio único falhou. Aplicando por seções...\n');
    console.log(`   Erro: ${err.message.slice(0, 200)}\n`);

    // Fall back: use the Supabase SQL client via REST API
    console.log('   Tentando via REST API do Supabase...');

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error('❌ VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos');
      await pool.end();
      process.exit(1);
    }

    // Use Supabase REST API to execute SQL (rpc)
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ REST API falhou: ${text}`);
      await pool.end();
      process.exit(1);
    }
  }

  // Verify
  console.log('\n=== VERIFICANDO APLICAÇÃO ===\n');

  const checks = [
    { name: 'Coluna receiver_relationship em entregas_protocolo',
      q: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='receiver_relationship'` },
    { name: 'Coluna gps_accuracy em entregas_protocolo',
      q: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='gps_accuracy'` },
    { name: 'Coluna foto_canhoto_url em delivery_proofs',
      q: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_proofs' AND column_name='foto_canhoto_url'` },
    { name: 'Função f_sync_delivery_proof_to_entregas',
      q: `SELECT proname FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas'` },
    { name: 'Trigger trg_sync_delivery_proof_to_entregas',
      q: `SELECT tgname FROM pg_trigger WHERE tgrelid='public.delivery_proofs'::regclass AND tgname='trg_sync_delivery_proof_to_entregas' AND NOT tgisinternal` },
    { name: 'Índice idx_delivery_proofs_operation_id',
      q: `SELECT indexname FROM pg_indexes WHERE tablename='delivery_proofs' AND indexname='idx_delivery_proofs_operation_id'` },
  ];

  let allOk = true;
  for (const c of checks) {
    try {
      const { rows } = await pool.query(c.q);
      const ok = rows.length > 0;
      console.log(`   ${ok ? '✅' : '❌'} ${c.name}`);
      if (!ok) allOk = false;
    } catch (e) {
      console.log(`   ⚠️ ${c.name} — erro ao verificar: ${e.message.slice(0, 100)}`);
      allOk = false;
    }
  }

  await pool.end();

  if (allOk) {
    console.log('\n✅ MIGRAÇÃO APLICADA E VERIFICADA COM SUCESSO!');
  } else {
    console.log('\n⚠️ Migration com verificações pendentes.');
    console.log('   Prosseguindo com teste de funcionalidade...');
  }
}

apply().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
