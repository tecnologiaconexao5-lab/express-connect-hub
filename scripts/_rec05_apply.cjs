const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  console.log('=== FASE 2: CRIACAO DA TABELA + MIGRATION REC-04 ===\n');

  // STEP 1: Create candidato_documentos table (without analise_ia_id FK - table doesn't exist)
  console.log('--- STEP 1: Creating candidato_documentos table ---');
  await c.query('BEGIN');
  
  try {
    await c.query(`
      CREATE TABLE IF NOT EXISTS public.candidato_documentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidato_id UUID NOT NULL,
        tipo TEXT NOT NULL,
        arquivo_url TEXT,
        status TEXT DEFAULT 'pendente',
        validade DATE,
        dados_extraidos JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('  Table created OK');

    // Enable RLS
    await c.query('ALTER TABLE public.candidato_documentos ENABLE ROW LEVEL SECURITY');
    console.log('  RLS enabled OK');

    // Create RLS policies
    await c.query(`
      DROP POLICY IF EXISTS "candidato_documentos_select" ON public.candidato_documentos;
      CREATE POLICY "candidato_documentos_select" ON public.candidato_documentos
        FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    `);
    await c.query(`
      DROP POLICY IF EXISTS "candidato_documentos_insert" ON public.candidato_documentos;
      CREATE POLICY "candidato_documentos_insert" ON public.candidato_documentos
        FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    `);
    await c.query(`
      DROP POLICY IF EXISTS "candidato_documentos_update" ON public.candidato_documentos;
      CREATE POLICY "candidato_documentos_update" ON public.candidato_documentos
        FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    `);
    await c.query(`
      DROP POLICY IF EXISTS "candidato_documentos_delete" ON public.candidato_documentos;
      CREATE POLICY "candidato_documentos_delete" ON public.candidato_documentos
        FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
    `);
    console.log('  RLS policies created OK');

    await c.query('COMMIT');
    console.log('  COMMIT OK\n');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('  STEP 1 FAILED:', e.message);
    await c.end();
    process.exit(1);
  }

  // STEP 2: Apply REC-04 migration (FK to recrutamento_candidatos)
  console.log('--- STEP 2: Applying REC-04 FK migration ---');
  await c.query('BEGIN');

  try {
    // 1.1 NULL validation
    const nullCheck = await c.query('SELECT COUNT(*) as cnt FROM public.candidato_documentos WHERE candidato_id IS NULL');
    console.log('  NULL candidato_id check:', nullCheck.rows[0].cnt, 'nulls');
    if (parseInt(nullCheck.rows[0].cnt) > 0) {
      throw new Error('REC-04 BLOCKED: candidato_documentos has NULL candidato_id');
    }

    // 1.2 Orphan check
    const orphanCheck = await c.query(`
      SELECT COUNT(*) as cnt FROM public.candidato_documentos cd
      LEFT JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
      WHERE rc.id IS NULL
    `);
    console.log('  Orphan docs (no matching recrutamento_candidatos):', orphanCheck.rows[0].cnt);
    if (parseInt(orphanCheck.rows[0].cnt) > 0) {
      throw new Error('REC-04 BLOCKED: ' + orphanCheck.rows[0].cnt + ' orphan documents');
    }

    // 1.3 Cross-tenant check
    const rcHasTenant = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='recrutamento_candidatos' AND column_name='tenant_id') as has");
    const cdHasTenant = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='candidato_documentos' AND column_name='tenant_id') as has");
    if (rcHasTenant.rows[0].has && cdHasTenant.rows[0].has) {
      const crossTenant = await c.query(`
        SELECT COUNT(*) as cnt FROM public.candidato_documentos cd
        JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
        WHERE cd.tenant_id IS NOT NULL AND rc.tenant_id IS NOT NULL AND cd.tenant_id != rc.tenant_id
      `);
      console.log('  Cross-tenant mismatches:', crossTenant.rows[0].cnt);
      if (parseInt(crossTenant.rows[0].cnt) > 0) {
        throw new Error('REC-04 BLOCKED: cross-tenant mismatch');
      }
    } else {
      console.log('  Cross-tenant check: SKIPPED (tenant_id not in both tables)');
    }

    // 2.1 Drop existing FK if any
    await c.query('ALTER TABLE public.candidato_documentos DROP CONSTRAINT IF EXISTS candidato_documentos_candidato_id_fkey');
    console.log('  Old FK dropped (if existed)');

    // 2.2 Add new FK to recrutamento_candidatos
    await c.query(`
      ALTER TABLE public.candidato_documentos
      ADD CONSTRAINT candidato_documentos_candidato_id_rc_fkey
      FOREIGN KEY (candidato_id)
      REFERENCES public.recrutamento_candidatos(id)
      ON DELETE CASCADE
    `);
    console.log('  New FK created: candidato_documentos.candidato_id -> recrutamento_candidatos(id) ON DELETE CASCADE');

    // 3. Performance index
    await c.query('CREATE INDEX IF NOT EXISTS idx_candidato_documentos_candidato_id_rc ON public.candidato_documentos(candidato_id)');
    console.log('  Performance index created');

    // 4. Comments
    await c.query(`
      COMMENT ON TABLE public.candidato_documentos IS
      'Documentos durante fase de recrutamento. FK para recrutamento_candidatos (migrado de candidatos em REC-04). NAO e tabela operacional - documentos_prestadores e a fonte canonica pos-conversao. MANTER esta tabela: possui campos (arquivo_url, dados_extraidos) ausentes no JSONB recrutamento_candidatos.documentos.'
    `);
    await c.query(`
      COMMENT ON CONSTRAINT candidato_documentos_candidato_id_rc_fkey
      ON public.candidato_documentos IS
      'FK migrada de candidatos->recrutamento_candidatos em REC-04. IDs identicos (copiados via REC-03 INSERT). Fail-closed: migration aborta se integridade nao puder ser provada.'
    `);
    console.log('  Comments added');

    // 5. Statistics
    const totalDocs = await c.query('SELECT COUNT(*) as cnt FROM public.candidato_documentos');
    const totalCandidatos = await c.query('SELECT COUNT(DISTINCT candidato_id) as cnt FROM public.candidato_documentos');
    console.log('  Statistics: ' + totalDocs.rows[0].cnt + ' documents in ' + totalCandidatos.rows[0].cnt + ' unique candidates');

    await c.query('COMMIT');
    console.log('  COMMIT OK\n');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('  STEP 2 FAILED:', e.message);
    await c.end();
    process.exit(1);
  }

  // STEP 3: Verify final state
  console.log('--- STEP 3: Verification ---');
  
  const fks = await c.query(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'candidato_documentos' AND tc.table_schema = 'public'
  `);
  console.log('  FK constraints:');
  fks.rows.forEach(r => console.log('    ' + r.constraint_name + ': ' + r.column_name + ' -> ' + r.foreign_table_name + '.' + r.foreign_column_name + ' (DELETE ' + r.delete_rule + ')'));

  const tableExists = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='candidato_documentos' AND table_schema='public') as has");
  console.log('  Table exists:', tableExists.rows[0].has);

  const cols = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='candidato_documentos' AND table_schema='public' ORDER BY ordinal_position");
  console.log('  Columns:');
  cols.rows.forEach(r => console.log('    ' + r.column_name + ' (' + r.data_type + ') nullable=' + r.is_nullable));

  const count = await c.query('SELECT COUNT(*) as cnt FROM public.candidato_documentos');
  console.log('  Record count:', count.rows[0].cnt);

  await c.end();
  console.log('\n=== FASE 2 COMPLETE ===');
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
