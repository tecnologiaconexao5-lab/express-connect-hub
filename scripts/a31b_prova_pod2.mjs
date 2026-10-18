import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('=== f_sync_delivery_proof_to_entregas (definição) ===');
  const r = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_sync_delivery_proof_to_entregas'
  `);
  console.log(r.rows[0]?.def?.slice(0, 2500) || 'não encontrada');

  console.log('\n=== Cruzamento: delivery_proofs (operation_id=aloc) → entregas_protocolo (alocacao_id) ===');
  const r2 = await c.query(`
    SELECT dp.id AS dp_id, dp.operation_id AS dp_op, ep.id AS ep_id, ep.alocacao_id AS ep_aloc,
           ep.status AS ep_status, ep.foto_entrega_url AS foto, ep.assinatura_url AS assin,
           a.ordem_servico_id AS os_id
    FROM public.delivery_proofs dp
    LEFT JOIN public.alocacoes_escala a ON a.id::text = dp.operation_id
    LEFT JOIN public.entregas_protocolo ep ON ep.alocacao_id::text = dp.operation_id
    ORDER BY dp.created_at DESC
  `);
  let syncOK = 0;
  for (const x of r2.rows) {
    const ok = !!x.ep_id;
    if (ok) syncOK++;
    console.log(`dp ${String(x.dp_id).slice(0,8)} → ep ${x.ep_id ? String(x.ep_id).slice(0,8) : 'NENHUM'} | status=${x.ep_status || '—'} | foto=${x.foto ? 'sim' : 'não'} | assin=${x.assin ? 'sim' : 'não'} | os=${x.os_id ? String(x.os_id).slice(0,8) : '—'} | ${ok ? 'SINCRONIZADO' : 'NÃO SINCRONIZADO'}`);
  }
  console.log(`\nSincronizados: ${syncOK}/${r2.rows.length}`);
  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });