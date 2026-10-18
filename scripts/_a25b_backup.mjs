import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ============ SOMENTE LEITURA — backup da definição atual do RPC ============
const rpc = await pool.query(`
  SELECT pg_get_functiondef(p.oid) AS def, p.oid
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
`);
if (rpc.rows.length) {
  fs.writeFileSync('scripts/_a25b_backup_rpc_registrar_posicao.sql', rpc.rows[0].def + ';\n');
  console.log('BACKUP SALVO em scripts/_a25b_backup_rpc_registrar_posicao.sql');
  console.log('=== DEFINICAO ATUAL (primeiras 60 linhas) ===');
  console.log(rpc.rows[0].def.split('\n').slice(0, 60).join('\n'));
} else {
  console.log('RPC NÃO EXISTE');
}

// Alocação do prestador teste (para entender relacionamentos reais)
const aloc = await pool.query(`
  SELECT ae.id, ae.ordem_servico_id, ae.prestador_id, ae.cliente_id, ae.tenant_id,
         ae.placa, ae.tipo_veiculo, ae.status, ae.finalizada
  FROM public.alocacoes_escala ae
  WHERE ae.id = 'ecaedf20-9112-4195-b163-86b17e21a7d5'
`);
console.log('\n=== ALOCAÇÃO HML-APP-001 (relacionamentos) ===');
console.log(JSON.stringify(aloc.rows[0], null, 2));

// veículos do prestador
const veic = await pool.query(`
  SELECT v.id, v.placa, v.tipo_veiculo, v.prestador_vinculado, v.status
  FROM public.veiculos v
  WHERE v.prestador_vinculado = 'e6646799-fbac-453e-a3ef-afdfc01a7085' OR v.placa = 'ABC1T24' OR v.placa = 'ABC-1234'
  LIMIT 10
`);
console.log('\n=== VEÍCULOS DO PRESTADOR TESTE ===');
for (const v of veic.rows) console.log(JSON.stringify(v));

await pool.end();
