import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  const out = [];
  out.push('SNAPSHOT A31D — ANTES DA APLICAÇÃO (produção uwrvzsjtpgaifkktpepn)');
  out.push('Gerado: ' + new Date().toISOString());
  out.push('');
  const rpc = await c.query(`SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_avancar_etapa_app_motorista'`);
  out.push('=== f_avancar_etapa_app_motorista (definição) ===');
  out.push(rpc.rows[0].def);
  out.push('');
  const grants = await c.query(`SELECT grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name='f_avancar_etapa_app_motorista' ORDER BY grantee`);
  out.push('=== Grants RPC ===');
  for (const g of grants.rows) out.push(`  ${g.grantee}: ${g.privilege_type}`);
  out.push('');
  const view = await c.query(`SELECT pg_get_viewdef(v.oid, true) AS def FROM pg_class v JOIN pg_namespace n ON n.oid=v.relnamespace WHERE n.nspname='public' AND v.relname='vw_app_motorista_operacoes' AND v.relkind='v'`);
  out.push('=== vw_app_motorista_operacoes (definição) ===');
  out.push(view.rows[0].def);
  out.push('');
  const cnt = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM public.alocacoes_escala) AS total_alloc,
      (SELECT COUNT(*) FROM public.alocacoes_escala WHERE metadata ? 'app_motorista') AS alloc_app_meta,
      (SELECT COUNT(*) FROM public.alocacoes_escala WHERE metadata->'app_motorista' ? 'romaneio' AND NULLIF(BTRIM(metadata->'app_motorista'->>'romaneio',''),'') IS NOT NULL) AS alloc_app_romaneio,
      (SELECT COUNT(*) FROM public.alocacoes_escala WHERE metadata->'app_motorista' ? 'romaneio' AND ordem_servico_id IS NOT NULL) AS alloc_romaneio_com_os,
      (SELECT COUNT(*) FROM public.alocacoes_escala WHERE metadata->'app_motorista' ? 'romaneio' AND ordem_servico_id IS NULL) AS alloc_romaneio_sem_os,
      (SELECT COUNT(*) FROM public.ordens_servico) AS total_os,
      (SELECT COUNT(*) FROM public.ordens_servico WHERE NULLIF(BTRIM(romaneio),'') IS NOT NULL) AS os_com_romaneio
  `);
  out.push('=== Contagens ===');
  out.push(JSON.stringify(cnt.rows[0], null, 2));
  fs.writeFileSync('docs/auditoria/02_evidencias/sql/a31d_snapshot_antes.sql.txt', out.join('\n'));
  console.log('Snapshot salvo em docs/auditoria/02_evidencias/sql/a31d_snapshot_antes.sql.txt');
  console.log('RPC def bytes:', rpc.rows[0].def.length);
  await c.end();
})().catch((e)=>{console.error('ERRO:',e.message);process.exit(1);});
