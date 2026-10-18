import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — MISSÃO A25 ============
// 1) RPC registrar_posicao_motorista — corpo real em produção
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
if (rpc.rows.length) {
  console.log('=== RPC registrar_posicao_motorista (produção) ===');
  console.log(rpc.rows[0].def);
} else {
  console.log('RPC NÃO EXISTE em produção');
}

// 2) Alocações ativas do PRESTADOR TESTE APP
const alocs = await pool.query(`
  SELECT ae.id, ae.status, ae.finalizada, ae.data_escala, ae.ordem_servico_id,
         os.numero AS os_numero, ae.destino, ae.placa, ae.tipo_veiculo,
         ae.metadata->>'etapa_atual' AS etapa_atual,
         ae.metadata->'app_motorista'->>'etapa_atual' AS app_etapa,
         ae.updated_at
  FROM public.alocacoes_escala ae
  LEFT JOIN public.ordens_servico os ON os.id = ae.ordem_servico_id
  WHERE ae.prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
  ORDER BY ae.data_escala DESC
  LIMIT 20
`);
console.log('\n=== ALOCAÇÕES DO PRESTADOR TESTE APP ===');
for (const a of alocs.rows) console.log(JSON.stringify(a));

// 3) A OS vinculada à posição de homologação tem coordenadas?
const os = await pool.query(`
  SELECT id, numero, status, cliente, origem, destino,
         localizacao_entrega_json, enderecos
  FROM public.ordens_servico
  WHERE id = '1e1b59fa-4ab6-46df-8648-a6a1f0facab2'
`);
console.log('\n=== OS VINCULADA À POSIÇÃO DE HOMOLOGAÇÃO ===');
for (const o of os.rows) console.log(JSON.stringify(o, null, 2));

await pool.end();
