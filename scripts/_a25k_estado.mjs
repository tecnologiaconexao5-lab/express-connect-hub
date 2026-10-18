import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// 1. Reconfirmar estado atual de ca5fe225 + ecaedf20
console.log('=== 1. ESTADO ATUAL DAS CANDIDATAS ===');
const cur = await pool.query(`
  SELECT id, status, status_pagamento, finalizada, updated_at,
         ordem_servico_id, cliente_id, prestador_id, placa, tipo_veiculo, origem, destino, data_escala
  FROM public.alocacoes_escala
  WHERE id IN ('ca5fe225-7114-42da-9997-c3d466e5df52','ecaedf20-9112-4195-b163-86b17e21a7d5')
`);
for (const r of cur.rows) {
  console.log('id:', r.id);
  console.log('  status:', r.status, '| finalizada:', r.finalizada, '| status_pagamento:', r.status_pagamento);
  console.log('  os_id:', r.ordem_servico_id, '| cliente_id:', r.cliente_id, '| prestador_id:', r.prestador_id);
  console.log('  placa:', r.placa, '| tipo:', r.tipo_veiculo, '| data_escala:', r.data_escala);
  console.log('  origem:', r.origem, '-> destino:', r.destino);
  console.log('  updated_at:', r.updated_at);
}

// 2. Histórico recente de ca5fe225
console.log('\n=== 2. HISTÓRICO ca5fe225 (últimas 15) ===');
const hist = await pool.query(`
  SELECT id, alocacao_id, evento, status_anterior, status_novo, descricao, created_at
  FROM public.historico_alocacoes_escala
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC LIMIT 15
`);
for (const h of hist.rows) console.log(' ', h.created_at, '|', h.evento, '|', h.status_anterior, '->', h.status_novo, '|', h.descricao);

// 3. Histórico recente de ecaedf20
console.log('\n=== 3. HISTÓRICO ecaedf20 (últimas 10) ===');
const hist2 = await pool.query(`
  SELECT id, alocacao_id, evento, status_anterior, status_novo, descricao, created_at
  FROM public.historico_alocacoes_escala
  WHERE alocacao_id = 'ecaedf20-9112-4195-b163-86b17e21a7d5'
  ORDER BY created_at DESC LIMIT 10
`);
for (const h of hist2.rows) console.log(' ', h.created_at, '|', h.evento, '|', h.status_anterior, '->', h.status_novo, '|', h.descricao);

// 4. Trigger que atualiza status da alocação por tracking
console.log('\n=== 4. f_trg_atualizar_status_alocacao_tracking (fonte) ===');
const trg = await pool.query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_atualizar_status_alocacao_tracking'
`);
if (trg.rows[0]) console.log(trg.rows[0].prosrc.slice(0, 2500));
else console.log('NÃO ENCONTRADA');

// 5. RPC registrar_posicao_motorista — como valida ALOCACAO_INATIVA
console.log('\n=== 5. registrar_posicao_motorista (regras de status) ===');
const rpc = await pool.query(`
  SELECT prosrc FROM pg_proc WHERE proname = 'registrar_posicao_motorista'
`);
if (rpc.rows[0]) {
  const src = rpc.rows[0].prosrc;
  const idx = src.indexOf('ALOCACAO_INATIVA');
  console.log(src.slice(Math.max(0, idx - 900), idx + 500));
} else console.log('NÃO ENCONTRADA');

await pool.end();