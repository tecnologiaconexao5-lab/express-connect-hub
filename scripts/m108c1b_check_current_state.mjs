import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function checkState() {
  console.log('=== VERIFICAÇÃO DO ESTADO ATUAL DO SUPABASE ===\n');

  // 1. Check tables exist
  const tables = ['delivery_proofs', 'entregas_protocolo', 'alocacoes_escala'];
  for (const t of tables) {
    const { rows } = await pool.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) as exists`,
      [t]
    );
    console.log(`📋 Tabela ${t}: ${rows[0].exists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);
  }

  // 2. Check columns of entregas_protocolo
  console.log('\n📋 Colunas de entregas_protocolo:');
  const { rows: colsEp } = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'entregas_protocolo'
     ORDER BY ordinal_position`
  );
  if (colsEp.length > 0) {
    for (const c of colsEp) {
      console.log(`   ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`);
    }
  } else {
    console.log('   (tabela não existe)');
  }

  // 3. Check columns of delivery_proofs
  console.log('\n📋 Colunas de delivery_proofs:');
  const { rows: colsDp } = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'delivery_proofs'
     ORDER BY ordinal_position`
  );
  if (colsDp.length > 0) {
    for (const c of colsDp) {
      console.log(`   ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`);
    }
  } else {
    console.log('   (tabela não existe)');
  }

  // 4. Check trigger exists
  console.log('\n📋 Triggers em delivery_proofs:');
  const { rows: triggers } = await pool.query(
    `SELECT tgname, proname
     FROM pg_trigger t
     JOIN pg_proc p ON t.tgfoid = p.oid
     WHERE tgrelid = 'public.delivery_proofs'::regclass
       AND NOT tgisinternal`
  );
  if (triggers.length > 0) {
    for (const tr of triggers) {
      console.log(`   ${tr.tgname} → função: ${tr.proname}`);
    }
  } else {
    console.log('   (nenhum trigger)');
  }

  // 5. Check function exists
  console.log('\n📋 Função f_sync_delivery_proof_to_entregas:');
  const { rows: func } = await pool.query(
    `SELECT EXISTS (
      SELECT FROM pg_proc WHERE proname = 'f_sync_delivery_proof_to_entregas'
    ) as exists`
  );
  console.log(`   ${func[0].exists ? '✅ EXISTE' : '❌ NÃO EXISTE'}`);

  // 6. Check RLS policies on entregas_protocolo
  console.log('\n📋 RLS policies em entregas_protocolo:');
  const { rows: policies } = await pool.query(
    `SELECT policyname, permissive, roles, cmd
     FROM pg_policies
     WHERE tablename = 'entregas_protocolo'
       AND schemaname = 'public'`
  );
  if (policies.length > 0) {
    for (const p of policies) {
      console.log(`   ${p.policyname} (${p.cmd}) roles: ${p.roles.join(', ')}`);
    }
  } else {
    console.log('   (nenhuma policy)');
  }

  // 7. Check existing data
  console.log('\n📋 Dados existentes:');
  const { rows: countEp } = await pool.query('SELECT COUNT(*) FROM public.entregas_protocolo');
  console.log(`   entregas_protocolo: ${countEp[0].count} registros`);

  try {
    const { rows: countDp } = await pool.query('SELECT COUNT(*) FROM public.delivery_proofs');
    console.log(`   delivery_proofs: ${countDp[0].count} registros`);
  } catch {
    console.log('   delivery_proofs: tabela não existe');
  }

  const { rows: countAloc } = await pool.query(
    `SELECT COUNT(*) FROM public.alocacoes_escala WHERE status NOT IN ('cancelada', 'recusada')`
  );
  console.log(`   alocacoes_escala ativas: ${countAloc[0].count} registros`);

  // 8. Check if there's an alocacao we can use for testing
  if (parseInt(countAloc[0].count) > 0) {
    const { rows: sample } = await pool.query(
      `SELECT id, prestador_id, tenant_id, status
       FROM public.alocacoes_escala
       WHERE status NOT IN ('cancelada', 'recusada')
       LIMIT 1`
    );
    console.log(`\n📋 Alocação de exemplo para teste:`);
    console.log(`   ID: ${sample[0].id}`);
    console.log(`   prestador_id: ${sample[0].prestador_id}`);
    console.log(`   status: ${sample[0].status}`);
    console.log(`   tenant_id: ${sample[0].tenant_id}`);
  }

  await pool.end();
}

checkState().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
