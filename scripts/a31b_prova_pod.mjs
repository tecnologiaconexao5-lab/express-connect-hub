import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('=== POD App (delivery_proofs) × entregas_protocolo via os_id ===');
  const r = await c.query(`
    SELECT dp.id AS dp_id, dp.os_id, ep.id AS ep_id, ep.ordem_servico_id AS ep_os, ep.alocacao_id AS ep_aloc,
           dp.status AS dp_status, ep.status AS ep_status
    FROM public.delivery_proofs dp
    LEFT JOIN public.entregas_protocolo ep ON ep.ordem_servico_id::text = dp.os_id
    ORDER BY dp.created_at DESC
  `);
  let syncOK = 0, sem = 0;
  for (const x of r.rows) {
    const ok = !!x.ep_id;
    if (ok) syncOK++; else sem++;
    console.log(`dp ${String(x.dp_id).slice(0,8)} | os ${String(x.os_id).slice(0,8)} → ep ${x.ep_id ? String(x.ep_id).slice(0,8) : 'NENHUM'} | ${ok ? 'SINCRONIZADO' : 'sem ep'}`);
  }
  if (r.rows.length === 0) console.log('(sem delivery_proofs)');
  console.log(`\nSincronizados: ${syncOK} | sem entregas_protocolo: ${sem}`);
  console.log('\n=== delivery_proofs sem OS (operation_id aponta para alocacao?) ===');
  const r2 = await c.query(`
    SELECT dp.id, dp.os_id, dp.operation_id, dp.rota_id, dp.stop_id,
           a.id AS alocacao_id, a.status AS aloc_status
    FROM public.delivery_proofs dp
    LEFT JOIN public.alocacoes_escala a ON a.id::text = dp.operation_id
    LIMIT 5
  `);
  for (const x of r2.rows) console.log(`dp ${String(x.id).slice(0,8)} | os_id=${x.os_id ? String(x.os_id).slice(0,8) : '—'} | operation_id=${x.operation_id ? String(x.operation_id).slice(0,8) : '—'} | aloc_match=${x.alocacao_id ? 'SIM' : 'não'} (status ${x.aloc_status || '—'})`);
  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });