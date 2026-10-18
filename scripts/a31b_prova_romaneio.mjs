import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  console.log('=== 6 alocações com romaneio no payload App: têm OS? ===');
  const r = await c.query(`
    SELECT a.id AS aloc_id, a.ordem_servico_id AS os_id, os.numero AS os_numero,
           os.romaneio AS os_romaneio, a.status, a.finalizada,
           (a.metadata->'app_motorista'->>'romaneio') AS app_romaneio
    FROM public.alocacoes_escala a
    LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    WHERE a.metadata->'app_motorista' ? 'romaneio'
    ORDER BY a.created_at DESC
  `);
  for (const x of r.rows) {
    console.log(`aloc ${String(x.aloc_id).slice(0,8)} | os=${x.os_id ? String(x.os_id).slice(0,8)+' ('+x.os_numero+')' : 'SEM OS'} | app_romaneio=${x.app_romaneio} | os.romaneio=${x.os_romaneio || '(vazio)'} | status=${x.status} finalizada=${x.finalizada}`);
  }
  console.log(`\nTotal: ${r.rows.length}`);
  await c.end();
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });