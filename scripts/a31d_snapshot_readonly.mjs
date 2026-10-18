// =============================================================================
// A31D — Snapshot read-only dos objetos App/OS/Central em PRODUÇÃO.
// MISSÃO A31-D, seção 3 (Decisão de aplicação): documentar estado atual antes
// de qualquer proposta. NENHUMA escrita. Apenas leitura via pg.
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const linha = (t) => console.log('\n' + '='.repeat(72) + '\n' + t + '\n' + '='.repeat(72));

  // 1. Definição da RPC f_avancar_etapa_app_motorista (assinatura + corpo)
  linha('1. f_avancar_etapa_app_motorista — definição completa');
  const rpc = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_avancar_etapa_app_motorista'
  `);
  if (rpc.rows[0]) {
    const def = rpc.rows[0].def;
    console.log(def.split('\n').slice(0, 30).join('\n'));
    console.log('...');
    const grants = await c.query(`
      SELECT p.proname, p.prosecdef, p.provolatile, p.proretset, p.pronargs,
             array_to_string(p.proargnames, ', ') AS argnames,
             pg_get_function_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'f_avancar_etapa_app_motorista'
    `);
    console.log('SECURITY_DEFINER=', grants.rows[0].prosecdef,
      '| VOLATILE=', grants.rows[0].provolatile,
      '| ARGS=', grants.rows[0].args);
    // Grants efetivos
    const acl = await c.query(`
      SELECT a.grantee, a.privilege_type
      FROM information_schema.routine_privileges a
      JOIN pg_proc p ON p.proname = a.routine_name
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'f_avancar_etapa_app_motorista'
      ORDER BY a.grantee
    `);
    console.log('GRANTS:');
    for (const g of acl.rows) console.log(`  ${g.grantee}: ${g.privilege_type}`);
  } else {
    console.log('NÃO ENCONTRADA');
  }

  // 2. Definição da view vw_app_motorista_operacoes
  linha('2. vw_app_motorista_operacoes — definição');
  const view = await c.query(`
    SELECT pg_get_viewdef(v.oid, true) AS def
    FROM pg_class v JOIN pg_namespace n ON n.oid = v.relnamespace
    WHERE n.nspname = 'public' AND v.relname = 'vw_app_motorista_operacoes' AND v.relkind = 'v'
  `);
  if (view.rows[0]) {
    const def = view.rows[0].def;
    console.log(def.slice(0, 1400));
    console.log('\n... (completo em arquivo de evidência)');
    const cols = await c.query(`
      SELECT a.attname
      FROM pg_attribute a
      JOIN pg_class v ON v.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = v.relnamespace
      WHERE n.nspname = 'public' AND v.relname = 'vw_app_motorista_operacoes'
        AND a.attnum > 0 AND NOT a.attisdropped
      ORDER BY a.attnum
    `);
    console.log(`COLUNAS (${cols.rows.length}): ${cols.rows.map(x => x.attname).join(', ')}`);
    console.log('TEM romaneio?', cols.rows.some(x => x.attname === 'romaneio'));
  } else {
    console.log('NÃO ENCONTRADA');
  }

  // 3. Grants da view
  linha('3. Grants da view vw_app_motorista_operacoes');
  const vg = await c.query(`
    SELECT grantee, privilege_type FROM information_schema.table_privileges
    WHERE table_schema='public' AND table_name='vw_app_motorista_operacoes'
    ORDER BY grantee, privilege_type
  `);
  for (const g of vg.rows) console.log(`  ${g.grantee}: ${g.privilege_type}`);

  // 4. Contagens relevantes
  linha('4. Contagens de romaneio/OS/alocações');
  const cnt = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM public.alocacoes_escala) AS total_alloc,
      (SELECT COUNT(*) FROM public.alocacoes_escala WHERE metadata ? 'app_motorista') AS alloc_app_meta,
      (SELECT COUNT(*) FROM public.alocacoes_escala
         WHERE metadata->'app_motorista' ? 'romaneio'
           AND NULLIF(BTRIM(metadata->'app_motorista'->>'romaneio',''),'') IS NOT NULL) AS alloc_app_romaneio,
      (SELECT COUNT(*) FROM public.alocacoes_escala
         WHERE metadata->'app_motorista' ? 'romaneio' AND ordem_servico_id IS NOT NULL) AS alloc_romaneio_com_os,
      (SELECT COUNT(*) FROM public.alocacoes_escala
         WHERE metadata->'app_motorista' ? 'romaneio' AND ordem_servico_id IS NULL) AS alloc_romaneio_sem_os,
      (SELECT COUNT(*) FROM public.ordens_servico) AS total_os,
      (SELECT COUNT(*) FROM public.ordens_servico
         WHERE NULLIF(BTRIM(romaneio),'') IS NOT NULL) AS os_com_romaneio,
      (SELECT COUNT(*) FROM public.ordens_servico WHERE romaneio IS NULL OR romaneio='') AS os_sem_romaneio,
      (SELECT COUNT(*) FROM public.alocacoes_escala
         WHERE status='concluida' AND finalizada=true) AS aloc_concluidas
  `);
  console.log(cnt.rows[0]);

  // 5. Coluna romaneio em ordens_servico
  linha('5. ordens_servico.romaneio (coluna)');
  const col = await c.query(`
    SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ordens_servico' AND column_name='romaneio'
  `);
  console.log(col.rows[0] || 'coluna romaneio NÃO existe');

  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });