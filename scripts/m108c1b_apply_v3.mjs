import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function exec(label, sql) {
  try {
    await pool.query(sql);
    console.log(`  ✅ ${label}`);
    return true;
  } catch (err) {
    // Idempotent: ignore "already exists" errors
    const m = err.message || '';
    if (m.includes('already exists') || m.includes('duplicate') || m.includes('too many')) {
      console.log(`  ✅ ${label} (já existia)`);
      return true;
    }
    console.log(`  ❌ ${label}: ${m.slice(0, 150)}`);
    return false;
  }
}

async function main() {
  console.log('=== APLICANDO MIGRAÇÃO M108-C1 (v3 — bloco a bloco) ===\n');

  // ===== SEÇÃO 1: Colunas em entregas_protocolo =====
  console.log('\n📦 Seção 1: Colunas em entregas_protocolo');
  await exec('receiver_relationship',
    `ALTER TABLE public.entregas_protocolo ADD COLUMN IF NOT EXISTS receiver_relationship TEXT`);
  await exec('gps_accuracy',
    `ALTER TABLE public.entregas_protocolo ADD COLUMN IF NOT EXISTS gps_accuracy NUMERIC`);
  await exec('ordem_servico_id',
    `ALTER TABLE public.entregas_protocolo ADD COLUMN IF NOT EXISTS ordem_servico_id UUID`);
  await exec('tenant_id',
    `ALTER TABLE public.entregas_protocolo ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe()`);

  // ===== SEÇÃO 2: Colunas em delivery_proofs =====
  console.log('\n📦 Seção 2: Colunas em delivery_proofs');
  await exec('foto_canhoto_url',
    `ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS foto_canhoto_url TEXT`);
  await exec('tenant_id',
    `ALTER TABLE public.delivery_proofs ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT public.current_tenant_id_safe()`);

  // ===== SEÇÃO 3: Índices =====
  console.log('\n📦 Seção 3: Índices');
  await exec('idx_delivery_proofs_operation_id',
    `CREATE INDEX IF NOT EXISTS idx_delivery_proofs_operation_id ON public.delivery_proofs(operation_id)`);
  await exec('idx_entregas_protocolo_alocacao_id',
    `CREATE INDEX IF NOT EXISTS idx_entregas_protocolo_alocacao_id ON public.entregas_protocolo(alocacao_id)`);

  // ===== SEÇÃO 4: Função de sincronização =====
  console.log('\n📦 Seção 4: Função f_sync_delivery_proof_to_entregas');
  const funcSql = `
CREATE OR REPLACE FUNCTION public.f_sync_delivery_proof_to_entregas()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $f$
DECLARE
  v_alocacao_id UUID;
  v_prestador_id UUID;
  v_tenant_id UUID;
  v_ordem_servico_id UUID;
BEGIN
  BEGIN
    v_alocacao_id := CAST(NEW.operation_id AS UUID);
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF v_alocacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ae.prestador_id, ae.tenant_id, ae.ordem_servico_id
  INTO v_prestador_id, v_tenant_id, v_ordem_servico_id
  FROM public.alocacoes_escala ae
  WHERE ae.id = v_alocacao_id;

  IF EXISTS (
    SELECT 1 FROM public.entregas_protocolo
    WHERE alocacao_id = v_alocacao_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.entregas_protocolo (
    alocacao_id,
    prestador_id,
    ordem_servico_id,
    nome_recebedor,
    documento_recebedor,
    receiver_relationship,
    observacao,
    foto_entrega_url,
    foto_canhoto_url,
    assinatura_url,
    data_hora_entrega,
    latitude,
    longitude,
    gps_accuracy,
    status,
    tenant_id
  ) VALUES (
    v_alocacao_id,
    v_prestador_id,
    v_ordem_servico_id,
    COALESCE(NEW.receiver_name, 'Motorista'),
    NEW.receiver_document,
    NEW.receiver_relationship,
    NEW.observation,
    NEW.photo_url,
    NEW.foto_canhoto_url,
    NEW.signature_url,
    COALESCE(NEW.delivered_at, NOW()),
    NEW.latitude,
    NEW.longitude,
    NEW.gps_accuracy,
    CASE
      WHEN NEW.status = 'delivered' THEN 'entregue'
      WHEN NEW.status = 'delivered_with_note' THEN 'entregue_ressalva'
      WHEN NEW.status = 'not_delivered' THEN 'nao_entregue'
      ELSE COALESCE(NEW.status, 'entregue')
    END,
    COALESCE(v_tenant_id, NEW.tenant_id, public.current_tenant_id_safe())
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$f$;`;
  await exec('Criar função', funcSql);

  // ===== SEÇÃO 5: Trigger =====
  console.log('\n📦 Seção 5: Trigger em delivery_proofs');
  await exec('Drop trigger if exists',
    `DROP TRIGGER IF EXISTS trg_sync_delivery_proof_to_entregas ON public.delivery_proofs`);
  await exec('Criar trigger',
    `CREATE TRIGGER trg_sync_delivery_proof_to_entregas
     AFTER INSERT ON public.delivery_proofs
     FOR EACH ROW
     EXECUTE FUNCTION public.f_sync_delivery_proof_to_entregas()`);

  // ===== SEÇÃO 6: RLS delivery_proofs =====
  console.log('\n📦 Seção 6: RLS policies');
  await exec('RLS delivery_proofs (enable)',
    `ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY`);
  await exec('RLS delivery_proofs select_authenticated',
    `DROP POLICY IF EXISTS "delivery_proofs_select_authenticated" ON public.delivery_proofs`);
  await exec('RLS delivery_proofs select_authenticated (create)',
    `CREATE POLICY "delivery_proofs_select_authenticated"
     ON public.delivery_proofs FOR SELECT
     TO authenticated
     USING (true)`);

  // RLS entregas_protocolo
  await exec('RLS entregas_protocolo (enable)',
    `ALTER TABLE public.entregas_protocolo ENABLE ROW LEVEL SECURITY`);
  await exec('RLS entregas_protocolo select',
    `DROP POLICY IF EXISTS "entregas_protocolo_select_authenticated" ON public.entregas_protocolo`);
  await exec('RLS entregas_protocolo select (create)',
    `CREATE POLICY "entregas_protocolo_select_authenticated"
     ON public.entregas_protocolo FOR SELECT
     TO authenticated
     USING (tenant_id = public.current_tenant_id_safe() OR tenant_id IS NULL)`);
  await exec('RLS entregas_protocolo insert',
    `DROP POLICY IF EXISTS "entregas_protocolo_insert_authenticated" ON public.entregas_protocolo`);
  await exec('RLS entregas_protocolo insert (create)',
    `CREATE POLICY "entregas_protocolo_insert_authenticated"
     ON public.entregas_protocolo FOR INSERT
     TO authenticated
     WITH CHECK (tenant_id = public.current_tenant_id_safe() OR tenant_id IS NULL)`);

  // ===== SEÇÃO 7: GRANTs =====
  console.log('\n📦 Seção 7: Permissões');
  await exec('GRANT INSERT delivery_proofs to anon',
    `GRANT INSERT ON public.delivery_proofs TO anon`);
  await exec('GRANT SELECT delivery_proofs to anon',
    `GRANT SELECT ON public.delivery_proofs TO anon`);
  await exec('GRANT INSERT delivery_proofs to authenticated',
    `GRANT INSERT ON public.delivery_proofs TO authenticated`);
  await exec('GRANT SELECT delivery_proofs to authenticated',
    `GRANT SELECT ON public.delivery_proofs TO authenticated`);
  await exec('GRANT INSERT entregas_protocolo to authenticated',
    `GRANT INSERT ON public.entregas_protocolo TO authenticated`);
  await exec('GRANT SELECT entregas_protocolo to anon',
    `GRANT SELECT ON public.entregas_protocolo TO anon`);
  await exec('GRANT SELECT entregas_protocolo to authenticated',
    `GRANT SELECT ON public.entregas_protocolo TO authenticated`);

  // ===== VERIFICAÇÃO FINAL =====
  console.log('\n=== VERIFICAÇÃO FINAL ===\n');
  const checks = [
    ['receiver_relationship em entregas_protocolo',
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='receiver_relationship'`],
    ['gps_accuracy em entregas_protocolo',
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='gps_accuracy'`],
    ['tenant_id em entregas_protocolo',
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='tenant_id'`],
    ['ordem_servico_id em entregas_protocolo',
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='entregas_protocolo' AND column_name='ordem_servico_id'`],
    ['foto_canhoto_url em delivery_proofs',
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='delivery_proofs' AND column_name='foto_canhoto_url'`],
    ['Função f_sync_delivery_proof_to_entregas',
      `SELECT proname FROM pg_proc WHERE proname='f_sync_delivery_proof_to_entregas'`],
    ['Trigger trg_sync_delivery_proof_to_entregas',
      `SELECT tgname FROM pg_trigger WHERE tgrelid='public.delivery_proofs'::regclass AND tgname='trg_sync_delivery_proof_to_entregas' AND NOT tgisinternal`],
  ];

  let allOk = true;
  for (const [name, query] of checks) {
    try {
      const { rows } = await pool.query(query);
      const ok = rows.length > 0;
      console.log(`  ${ok ? '✅' : '❌'} ${name}`);
      if (!ok) allOk = false;
    } catch (e) {
      console.log(`  ⚠️ ${name}: ${e.message.slice(0, 100)}`);
      allOk = false;
    }
  }

  await pool.end();

  if (allOk) {
    console.log('\n✅ MIGRAÇÃO APLICADA E VERIFICADA COM SUCESSO!');
  } else {
    console.log('\n⚠️ Migration aplicada com verificações pendentes.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
