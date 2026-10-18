// M133-D.7.2 — Pre-check: confirm state of HML alocação
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();
  const r = await c.query(`SELECT id, ordem_servico_id, status, aceite_prestador, metadata->'app_motorista'->>'etapa_atual' AS etapa, data_escala, updated_at, LEFT(rota,60) AS rota, prestador_id::text AS prest FROM public.alocacoes_escala WHERE id = '76af8e4a-a3bc-492a-897d-4556574cc5d1'::uuid`);
  const a = r.rows[0];
  console.log('=== ESTADO ALOCAÇÃO HML ===');
  console.log('ID:', a.id);
  console.log('OS:', a.ordem_servico_id || 'NULL');
  console.log('Status:', a.status);
  console.log('Etapa:', a.etapa || 'NULL');
  console.log('Aceite:', a.aceite_prestador);
  console.log('Data escala:', a.data_escala);
  console.log('Updated:', a.updated_at);
  console.log('Rota:', a.rota);
  console.log('Prestador:', a.prest);
  const hoursAgo = (Date.now() - new Date(a.updated_at).getTime()) / 3600000;
  console.log('Horas desde update:', hoursAgo.toFixed(1));
  const r2 = await c.query(`SELECT nome_completo, auth_user_id FROM public.prestadores WHERE id = $1::uuid`, [a.prest]);
  console.log('Prestador nome:', r2.rows[0]?.nome_completo);
  console.log('Prestador auth_user_id:', r2.rows[0]?.auth_user_id);
  console.log('');
  if (a.status === 'aguardando_aceite' && !a.etapa && !a.ordem_servico_id) {
    console.log('✅ PRÉ-CHECK OK — Alocação HML isolada, pronta para teste');
  } else {
    console.log('❌ PRÉ-CHECK FALHOU — Estado inesperado');
  }
  await c.end();
})();
