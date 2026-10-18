// =============================================================================
// A31D — Coleta final de evidências read-only pós-aplicação (para o relatório)
// =============================================================================
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();

  // 1. RPC — função e grants
  const rpc = await c.query(`SELECT p.provolatile, p.prosecdef, p.proisstrict,
    pg_get_function_result(p.oid) AS result,
    (SELECT string_agg(elem, ', ' ORDER BY ord) FROM unnest(proargnames) WITH ORDINALITY AS a(elem, ord) WHERE a.elem IS NOT NULL) AS argnames
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_avancar_etapa_app_motorista'`);
  console.log('RPC vol/definer/strict/result:', rpc.rows[0].provolatile, rpc.rows[0].prosecdef, rpc.rows[0].proisstrict, rpc.rows[0].result);

  const grants = await c.query(`SELECT grantee, string_agg(DISTINCT privilege_type, ', ') AS privs
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public' AND routine_name = 'f_avancar_etapa_app_motorista'
    GROUP BY grantee ORDER BY grantee`);
  console.log('Grants:');
  grants.rows.forEach((g) => console.log('  ', g.grantee, '→', g.privs));

  // 2. View — colunas e auto-updatable
  const view = await c.query(`SELECT c.is_updatable, count(*) AS ncols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'vw_app_motorista_operacoes'
    GROUP BY c.is_updatable`);
  console.log('View updatable/cols:', view.rows[0]);

  const temRomaneioView = await c.query(`SELECT count(*) AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vw_app_motorista_operacoes' AND column_name = 'romaneio'`);
  console.log('View tem coluna romaneio?', temRomaneioView.rows[0].n);

  // 3. Contagens
  const aloc = await c.query(`SELECT count(*) AS total FROM public.alocacoes_escala`);
  const alocConcluidas = await c.query(`SELECT count(*) AS n FROM public.alocacoes_escala WHERE status = 'concluida' AND finalizada = true`);
  const appMeta = await c.query(`SELECT count(*) AS n FROM public.alocacoes_escala WHERE metadata ? 'app_motorista'`);
  const appRomaneio = await c.query(`SELECT count(*) AS n FROM public.alocacoes_escala
    WHERE metadata ? 'app_motorista'
      AND NULLIF(BTRIM(COALESCE(metadata->'app_motorista'->>'romaneio','')),'') IS NOT NULL`);
  const appRomaneioSemOS = await c.query(`SELECT count(*) AS n FROM public.alocacoes_escala
    WHERE metadata ? 'app_motorista'
      AND NULLIF(BTRIM(COALESCE(metadata->'app_motorista'->>'romaneio','')),'') IS NOT NULL
      AND ordem_servico_id IS NULL`);
  const osTotal = await c.query(`SELECT count(*) AS n FROM public.ordens_servico`);
  const osComRomaneio = await c.query(`SELECT count(*) AS n FROM public.ordens_servico WHERE NULLIF(BTRIM(romaneio),'') IS NOT NULL`);
  console.log('Alocações total:', aloc.rows[0].total, '| concluídas:', alocConcluidas.rows[0].n);
  console.log('App metadata:', appMeta.rows[0].n, '| App com romaneio:', appRomaneio.rows[0].n, '| desses sem OS:', appRomaneioSemOS.rows[0].n);
  console.log('OS total:', osTotal.rows[0].n, '| OS com romaneio:', osComRomaneio.rows[0].n);

  // 4. Comentário da RPC
  const comment = await c.query(`SELECT obj_description(p.oid) AS c FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_avancar_etapa_app_motorista'`);
  console.log('Comentário RPC:', comment.rows[0].c);

  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });