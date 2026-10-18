import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 1. Histórico COMPLETO de ca5fe225 (alguma vez concluida/cancelada/recusada?)
console.log('=== 1. HISTÓRICO COMPLETO ca5fe225 ===');
const hist = await pool.query(`
  SELECT created_at, evento, status_anterior, status_novo, descricao
  FROM public.historico_alocacoes_escala
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at ASC
`);
for (const h of hist.rows) console.log(' ', h.created_at.toISOString(), '|', h.evento, '|', h.status_anterior, '->', h.status_novo, '|', h.descricao);

// 2. O RPC que o App consulta (f_buscar_operacoes_motorista) retornaria ca5fe225?
console.log('\n=== 2. f_buscar_operacoes_motorista (fonte — filtro de status) ===');
const rpc = await pool.query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'f_buscar_operacoes_motorista'
`);
if (rpc.rows[0]) {
  const src = rpc.rows[0].prosrc;
  // achar trechos de status
  const m = src.match(/.{0,300}(IN \(|status IN|AND ae\.status|alocacoes_escala|'em_rota'|'aceita'|'aguardando').{0,400}/g);
  if (m) m.forEach(s => console.log('---\n', s, '\n'));
  else console.log('trechos de status não localizados; fonte completa:', src.slice(0, 2000));
} else console.log('NÃO ENCONTRADA');

// 3. Outras alocações HML criadas recentemente (qualquer prestador, não só teste) — para saber se há algo mais novo
console.log('\n=== 3. ALOCAÇÕES criadas nas últimas 48h (todas) ===');
const recent = await pool.query(`
  SELECT id, status, prestador_id, placa, tipo_veiculo, origem, destino, created_at, updated_at,
         metadata->'app_motorista'->>'numero_os' AS numero_os
  FROM public.alocacoes_escala
  WHERE created_at > now() - interval '48 hours'
  ORDER BY created_at DESC
`);
console.log('TOTAL:', recent.rows.length);
for (const r of recent.rows) console.log(' ', r.created_at.toISOString(), '|', r.id, '|', r.status, '| placa', r.placa, '|', r.tipo_veiculo, '| OS', r.numero_os, '|', (r.origem||'').slice(0,40), '->', (r.destino||'').slice(0,30));

// 4. Quantas posições foram criadas para ca5fe225 HOJE
console.log('\n=== 4. POSIÇÕES de ca5fe225 hoje (total) ===');
const cnt = await pool.query(`
  SELECT count(*)::int AS total, min(created_at) AS inicio, max(created_at) AS fim
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52' AND created_at > now() - interval '24 hours'
`);
console.log(cnt.rows[0]);

await pool.end();