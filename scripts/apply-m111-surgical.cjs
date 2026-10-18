const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`✅ ${label}`);
    return true;
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log(`⏭️ ${label} (already exists)`);
      return true;
    }
    console.log(`❌ ${label}: ${err.message.substring(0, 150)}`);
    return false;
  }
}

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected!\n');

  // STEP 1: Add columns to existing tables
  console.log('=== STEP 1: ALTER TABLES ===');
  await run(client, 'os_historico add acao', `ALTER TABLE public.os_historico ADD COLUMN IF NOT EXISTS acao TEXT`);
  await run(client, 'os_historico add status_novo', `ALTER TABLE public.os_historico ADD COLUMN IF NOT EXISTS status_novo TEXT`);
  await run(client, 'os_historico add usuario', `ALTER TABLE public.os_historico ADD COLUMN IF NOT EXISTS usuario TEXT`);
  await run(client, 'os_historico add os_id', `ALTER TABLE public.os_historico ADD COLUMN IF NOT EXISTS os_id UUID`);
  
  await run(client, 'notificacoes add prestador_id', `ALTER TABLE public.portal_notificacoes ADD COLUMN IF NOT EXISTS prestador_id UUID REFERENCES public.prestadores(id) ON DELETE SET NULL`);
  await run(client, 'notificacoes add origem_id', `ALTER TABLE public.portal_notificacoes ADD COLUMN IF NOT EXISTS origem_id UUID`);
  await run(client, 'notificacoes add origem_tipo', `ALTER TABLE public.portal_notificacoes ADD COLUMN IF NOT EXISTS origem_tipo TEXT`);

  await run(client, 'rotas add os_id', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL`);
  await run(client, 'rotas add cliente_id', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL`);
  await run(client, 'rotas add tenant_id', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT current_tenant_id_safe()`);
  await run(client, 'rotas add motorista', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS motorista TEXT`);
  await run(client, 'rotas add veiculo', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS veiculo TEXT`);
  await run(client, 'rotas add horario_previsto', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS horario_previsto TIMESTAMPTZ`);
  await run(client, 'rotas add horario_realizado', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS horario_realizado TIMESTAMPTZ`);
  await run(client, 'rotas add sla', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS sla TEXT`);
  await run(client, 'rotas add destino_final', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS destino_final TEXT`);
  await run(client, 'rotas add numero_paradas', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS numero_paradas INTEGER DEFAULT 0`);
  await run(client, 'rotas add paradas_pendentes', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS paradas_pendentes INTEGER DEFAULT 0`);
  await run(client, 'rotas add operation_mode', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS operation_mode TEXT DEFAULT 'standard_delivery'`);
  await run(client, 'rotas add instrucoes', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS instrucoes TEXT`);
  await run(client, 'rotas add alocacao_id', `ALTER TABLE public.rotas ADD COLUMN IF NOT EXISTS alocacao_id UUID REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL`);

  await run(client, 'rota_paradas add os_id', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL`);
  await run(client, 'rota_paradas add alocacao_id', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS alocacao_id UUID REFERENCES public.alocacoes_escala(id) ON DELETE SET NULL`);
  await run(client, 'rota_paradas add pedido', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS pedido TEXT`);
  await run(client, 'rota_paradas add nota_fiscal', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS nota_fiscal TEXT`);
  await run(client, 'rota_paradas add destinatario', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS destinatario TEXT`);
  await run(client, 'rota_paradas add contato', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS contato TEXT`);
  await run(client, 'rota_paradas add tipo_carga', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS tipo_carga TEXT`);
  await run(client, 'rota_paradas add janela_entrega', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS janela_entrega TEXT`);
  await run(client, 'rota_paradas add prioridade', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'normal'`);
  await run(client, 'rota_paradas add instrucoes', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS instrucoes TEXT`);
  await run(client, 'rota_paradas add recebedor', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS recebedor TEXT`);
  await run(client, 'rota_paradas add assinatura_url', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS assinatura_url TEXT`);
  await run(client, 'rota_paradas add pod_url', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS pod_url TEXT`);
  await run(client, 'rota_paradas add fotos', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]'::jsonb`);
  await run(client, 'rota_paradas add ocorrencia', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS ocorrencia TEXT`);
  await run(client, 'rota_paradas add data_hora', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS data_hora TIMESTAMPTZ`);
  await run(client, 'rota_paradas add latitude_fim', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS latitude_fim NUMERIC`);
  await run(client, 'rota_paradas add longitude_fim', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS longitude_fim NUMERIC`);
  await run(client, 'rota_paradas add data_entrega', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS data_entrega TIMESTAMPTZ`);
  await run(client, 'rota_paradas add volumes_entregues', `ALTER TABLE public.rota_paradas ADD COLUMN IF NOT EXISTS volumes_entregues INTEGER DEFAULT 0`);

  // STEP 2: Update existing data
  console.log('\n=== STEP 2: DATA MIGRATION ===');
  await run(client, 'Update os_historico.os_id', `UPDATE public.os_historico SET os_id = ordem_servico_id WHERE os_id IS NULL AND ordem_servico_id IS NOT NULL`);
  await run(client, 'Update os_historico.acao', `UPDATE public.os_historico SET acao = descricao WHERE acao IS NULL AND descricao IS NOT NULL`);
  await run(client, 'Update os_historico.usuario', `UPDATE public.os_historico SET usuario = 'Sistema' WHERE usuario IS NULL`);

  // STEP 3: UNIQUE constraint on rotas.os_id
  console.log('\n=== STEP 3: CONSTRAINTS ===');
  try {
    await client.query(`DELETE FROM public.rotas a USING (SELECT os_id, MIN(id) as min_id FROM public.rotas WHERE os_id IS NOT NULL GROUP BY os_id HAVING COUNT(*) > 1) b WHERE a.os_id = b.os_id AND a.id != b.min_id`);
    await client.query(`ALTER TABLE public.rotas ADD CONSTRAINT rotas_os_id_key UNIQUE (os_id)`);
    console.log('✅ UNIQUE constraint rotas.os_id');
  } catch(e) {
    if (e.message.includes('already exists')) console.log('⏭️ UNIQUE constraint (exists)');
    else console.log(`❌ UNIQUE constraint: ${e.message.substring(0, 100)}`);
  }

  // STEP 4: Create INDEXES
  console.log('\n=== STEP 4: INDEXES ===');
  await run(client, 'idx_rotas_os_id', 'CREATE INDEX IF NOT EXISTS idx_rotas_os_id ON public.rotas(os_id)');
  await run(client, 'idx_rotas_prestador_id', 'CREATE INDEX IF NOT EXISTS idx_rotas_prestador_id ON public.rotas(prestador_id)');
  await run(client, 'idx_rotas_status', 'CREATE INDEX IF NOT EXISTS idx_rotas_status ON public.rotas(status)');
  await run(client, 'idx_rotas_data', 'CREATE INDEX IF NOT EXISTS idx_rotas_data ON public.rotas(data_rota)');
  await run(client, 'idx_rotas_operation_mode', 'CREATE INDEX IF NOT EXISTS idx_rotas_operation_mode ON public.rotas(operation_mode)');
  await run(client, 'idx_rota_paradas_rota_id', 'CREATE INDEX IF NOT EXISTS idx_rota_paradas_rota_id ON public.rota_paradas(rota_id)');
  await run(client, 'idx_rota_paradas_status', 'CREATE INDEX IF NOT EXISTS idx_rota_paradas_status ON public.rota_paradas(status)');
  await run(client, 'idx_rota_paradas_os_id', 'CREATE INDEX IF NOT EXISTS idx_rota_paradas_os_id ON public.rota_paradas(os_id)');
  await run(client, 'idx_notificacoes_prestador', 'CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_prestador ON public.portal_notificacoes(prestador_id)');
  await run(client, 'idx_notificacoes_lida', 'CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_lida ON public.portal_notificacoes(lida)');
  await run(client, 'idx_notificacoes_origem', 'CREATE INDEX IF NOT EXISTS idx_portal_notificacoes_origem ON public.portal_notificacoes(origem_id, origem_tipo)');

  // STEP 5: Create RPCs
  console.log('\n=== STEP 5: RPC FUNCTIONS ===');

  const rpc1 = fs => fs.readFileSync(require('path').join(__dirname, '..', 'supabase', 'migrations', 'rpc_aceitar_oportunidade.sql'), 'utf8');
  
  // Read the migration file and extract function bodies using the === markers
  const fullSql = require('fs').readFileSync(require('path').join(__dirname, '..', 'supabase/migrations/20260713_m111_app_integracao_tms.sql'), 'utf8');
  
  // Extract CREATE OR REPLACE FUNCTION blocks
  const funcBlocks = fullSql.split(/(?=CREATE OR REPLACE FUNCTION)/);
  for (const block of funcBlocks) {
    if (!block.trim() || block.trim().startsWith('--')) continue;
    try {
      await client.query(block.trim());
      const fnName = block.match(/CREATE OR REPLACE FUNCTION\s+(\S+)/)?.[1] || 'unknown';
      console.log(`✅ ${fnName}`);
    } catch(e) {
      const fnName = block.match(/CREATE OR REPLACE FUNCTION\s+(\S+)/)?.[1] || 'unknown';
      if (e.message.includes('already exists')) console.log(`⏭️ ${fnName} (exists)`);
      else console.log(`❌ ${fnName}: ${e.message.substring(0, 100)}`);
    }
  }

  // STEP 6: CREATE VIEWS
  console.log('\n=== STEP 6: VIEWS ===');
  const viewBlocks = fullSql.split(/(?=CREATE OR REPLACE VIEW)/);
  for (const block of viewBlocks) {
    if (!block.trim()) continue;
    try { await client.query(block.trim());
      const vName = block.match(/CREATE OR REPLACE VIEW\s+(\S+)/)?.[1] || 'unknown';
      console.log(`✅ ${vName}`);
    } catch(e) {
      const vName = block.match(/CREATE OR REPLACE VIEW\s+(\S+)/)?.[1] || 'unknown';
      console.log(`❌ ${vName}: ${e.message.substring(0, 100)}`);
    }
  }

  // STEP 7: CREATE TRIGGERS
  console.log('\n=== STEP 7: TRIGGERS ===');
  // Extract trigger blocks
  const triggerBlocks = fullSql.split(/(?=CREATE OR REPLACE FUNCTION.*f_trg_)/);
  for (const block of triggerBlocks) {
    if (!block.trim() || block.trim().startsWith('--') || !block.includes('f_trg_')) continue;
    try { await client.query(block.trim());
      const tName = block.match(/f_trg_\w+/)?.[0] || 'unknown';
      console.log(`✅ ${tName}`);
    } catch(e) {
      const tName = block.match(/f_trg_\w+/)?.[0] || 'unknown';
      console.log(`❌ ${tName}: ${e.message.substring(0, 100)}`);
    }
  }

  // STEP 8: RLS POLICIES
  console.log('\n=== STEP 8: RLS POLICIES ===');
  await run(client, 'RLS rotas', 'ALTER TABLE public.rotas ENABLE ROW LEVEL SECURITY');
  await run(client, 'RLS rota_paradas', 'ALTER TABLE public.rota_paradas ENABLE ROW LEVEL SECURITY');
  
  // Drop old policies
  for (const [tbl, pol] of [['rotas', 'rotas_all_authenticated'], ['rota_paradas', 'rota_paradas_all_authenticated'], ['rede_oportunidades', 'rede_oportunidades_all_anon'], ['alocacoes_escala', 'alocacoes_escala_all_anon'], ['portal_notificacoes', 'notificacoes_all_authenticated'], ['portal_notificacoes', 'notificacoes_select_anon']]) {
    try { await client.query(`DROP POLICY IF EXISTS "${pol}" ON public.${tbl}`); } catch(e) {}
  }
  
  // Create new policies
  await run(client, 'pol rotas_select_auth', `CREATE POLICY "rotas_select_authenticated" ON public.rotas FOR SELECT TO authenticated USING (true)`);
  await run(client, 'pol rotas_insert_auth', `CREATE POLICY "rotas_insert_authenticated" ON public.rotas FOR INSERT TO authenticated WITH CHECK (true)`);
  await run(client, 'pol rotas_update_auth', `CREATE POLICY "rotas_update_authenticated" ON public.rotas FOR UPDATE TO authenticated USING (true)`);
  await run(client, 'pol rotas_select_anon', `CREATE POLICY "rotas_select_anon_suas" ON public.rotas FOR SELECT TO anon USING (prestador_id IN (SELECT id FROM public.prestadores WHERE tenant_id = current_tenant_id_safe()))`);
  await run(client, 'pol rp_select_auth', `CREATE POLICY "rota_paradas_select_authenticated" ON public.rota_paradas FOR SELECT TO authenticated USING (true)`);
  await run(client, 'pol rp_insert_auth', `CREATE POLICY "rota_paradas_insert_authenticated" ON public.rota_paradas FOR INSERT TO authenticated WITH CHECK (true)`);
  await run(client, 'pol rp_update_auth', `CREATE POLICY "rota_paradas_update_authenticated" ON public.rota_paradas FOR UPDATE TO authenticated USING (true)`);
  await run(client, 'pol rp_select_anon', `CREATE POLICY "rota_paradas_select_anon" ON public.rota_paradas FOR SELECT TO anon USING (rota_id IN (SELECT id FROM public.rotas WHERE prestador_id IN (SELECT id FROM public.prestadores WHERE tenant_id = current_tenant_id_safe())))`);
  await run(client, 'pol rede_select_anon', `CREATE POLICY "rede_oportunidades_select_anon" ON public.rede_oportunidades FOR SELECT TO anon USING (status IN ('publicada', 'visualizada', 'interessada'))`);
  await run(client, 'pol aloc_select_anon', `CREATE POLICY "alocacoes_escala_select_anon" ON public.alocacoes_escala FOR SELECT TO anon USING (prestador_id IN (SELECT id FROM public.prestadores WHERE tenant_id = current_tenant_id_safe()))`);
  await run(client, 'pol notif_select_auth', `CREATE POLICY "notificacoes_select_authenticated" ON public.portal_notificacoes FOR SELECT TO authenticated USING (true)`);
  await run(client, 'pol notif_insert_service', `CREATE POLICY "notificacoes_insert_service" ON public.portal_notificacoes FOR INSERT TO authenticated WITH CHECK (true)`);
  await run(client, 'pol notif_select_anon', `CREATE POLICY "notificacoes_select_anon" ON public.portal_notificacoes FOR SELECT TO anon USING (prestador_id IN (SELECT id FROM public.prestadores WHERE tenant_id = current_tenant_id_safe()))`);

  // STEP 9: GRANTS
  console.log('\n=== STEP 9: GRANTS ===');
  for (const [tbl, perms] of [['public.rotas', 'SELECT, INSERT, UPDATE'], ['public.rota_paradas', 'SELECT, INSERT, UPDATE'], ['public.portal_notificacoes', 'SELECT'], ['public.rede_oportunidades', 'SELECT'], ['public.alocacoes_escala', 'SELECT']]) {
    await run(client, `GRANT ${tbl}`, `GRANT ${perms} ON ${tbl} TO anon`);
  }
  await run(client, 'GRANT views', `GRANT SELECT ON public.vw_app_motorista_operacoes, public.vw_app_motorista_paradas, public.vw_app_notificacoes_pendentes TO anon, authenticated`);
  
  // Revoke INSERT/UPDATE/DELETE on rede_oportunidades from anon
  await run(client, 'REVOKE rede anon write', `REVOKE INSERT, UPDATE, DELETE ON public.rede_oportunidades FROM anon`);

  // STEP 10: GRANT EXECUTE ON FUNCTIONS
  for (const fn of ['f_aceitar_oportunidade_rede', 'f_calcular_financeiro_operacao', 'f_registrar_notificacao_app', 'f_buscar_operacoes_motorista', 'f_atualizar_status_parada']) {
    await run(client, `GRANT EXEC ${fn}`, `GRANT EXECUTE ON FUNCTION public.${fn} TO anon, authenticated`);
  }

  // VERIFICATION
  console.log('\n=== VERIFICATION ===');
  const checks = [
    `SELECT '1. os_historico.acao' q FROM information_schema.columns WHERE table_name='os_historico' AND column_name='acao'`,
    `SELECT '2. rotas.operation_mode' q FROM information_schema.columns WHERE table_name='rotas' AND column_name='operation_mode'`,
    `SELECT '3. rota_paradas.fotos' q FROM information_schema.columns WHERE table_name='rota_paradas' AND column_name='fotos'`,
    `SELECT '4. notificacoes.prestador_id' q FROM information_schema.columns WHERE table_name='portal_notificacoes' AND column_name='prestador_id'`,
    `SELECT '5. RPC f_aceitar_oportunidade_rede' q FROM pg_proc WHERE proname='f_aceitar_oportunidade_rede'`,
    `SELECT '6. RPC f_calcular_financeiro_operacao' q FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`,
    `SELECT '7. RPC f_buscar_operacoes_motorista' q FROM pg_proc WHERE proname='f_buscar_operacoes_motorista'`,
    `SELECT '8. RPC f_atualizar_status_parada' q FROM pg_proc WHERE proname='f_atualizar_status_parada'`,
    `SELECT '9. View vw_app_motorista_operacoes' q FROM pg_views WHERE viewname='vw_app_motorista_operacoes'`,
    `SELECT '10. View vw_app_motorista_paradas' q FROM pg_views WHERE viewname='vw_app_motorista_paradas'`,
    `SELECT '11. View vw_app_notificacoes_pendentes' q FROM pg_views WHERE viewname='vw_app_notificacoes_pendentes'`,
    `SELECT '12. Trigger trg_notificar_os_para_app' q FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' AND NOT tgisinternal`,
    `SELECT '13. Policy rotas_select_anon_suas' q FROM pg_policies WHERE policyname='rotas_select_anon_suas'`,
    `SELECT '14. idx_rotas_operation_mode' q FROM pg_indexes WHERE indexname='idx_rotas_operation_mode'`,
  ];
  
  for (const check of checks) {
    try {
      const r = await client.query(check);
      const label = r.rows[0]?.q || '?';
      console.log(`${r.rows.length > 0 ? '✅' : '❌'} ${label}`);
    } catch(e) {
      const label = check.match(/'(\d+\.\s[^']+)'/)?.[1] || '?';
      console.log(`❌ ${label}: ${e.message.substring(0, 60)}`);
    }
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
