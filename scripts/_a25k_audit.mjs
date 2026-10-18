import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// PRESTADOR TESTE APP
const PRES = 'e6646799-fbac-453e-a3ef-afdfc01a7085';

console.log('=== 1. PRESTADOR ===');
const p = await pool.query(`
  SELECT id, nome_completo, nome_fantasia, status, liberado_app, auth_user_id, status_operacional
  FROM public.prestadores WHERE id = $1
`, [PRES]);
console.log(p.rows[0] ?? 'NÃO ENCONTRADO');

console.log('\n=== 2. ALOCAÇÕES DO PRESTADOR (todas) ===');
const al = await pool.query(`
  SELECT ae.id, ae.status, ae.data_escala, ae.turno,
         ae.ordem_servico_id, ae.cliente_id, ae.prestador_id, ae.placa,
         ae.tipo_veiculo, ae.origem, ae.destino, ae.metadata,
         ae.created_at, ae.updated_at
  FROM public.alocacoes_escala ae
  WHERE ae.prestador_id = $1
  ORDER BY ae.created_at DESC
`, [PRES]);
console.log('TOTAL:', al.rows.length);
for (const a of al.rows) {
  const app = a.metadata?.app_motorista || {};
  console.log('---');
  console.log('id:', a.id, '| status:', a.status);
  console.log('os_id:', a.ordem_servico_id, '| cliente_id:', a.cliente_id);
  console.log('placa:', a.placa, '| tipo:', a.tipo_veiculo);
  console.log('origem:', a.origem, '| destino:', a.destino);
  console.log('data_escala:', a.data_escala, '| created:', a.created_at, '| updated:', a.updated_at);
  console.log('app_motorista:', JSON.stringify(app));
}

console.log('\n=== 3. VEÍCULOS do prestador ===');
const v = await pool.query(`
  SELECT id, placa, tipo_veiculo, tipo, status, prestador_vinculado
  FROM public.veiculos WHERE prestador_vinculado = $1
`, [PRES]);
console.log('TOTAL:', v.rows.length);
for (const row of v.rows) console.log(' ', row.id, '|', row.placa, '|', row.tipo, '|', row.status);

console.log('\n=== 4. CLIENTES HML (homologação/teste) ===');
const cli = await pool.query(`
  SELECT id, razao_social, nome_fantasia, cnpj, status
  FROM public.clientes
  WHERE status = 'ativo'
    AND (razao_social ILIKE '%HML%' OR razao_social ILIKE '%HOMOLOG%' OR razao_social ILIKE '%TESTE%'
         OR nome_fantasia ILIKE '%HML%' OR nome_fantasia ILIKE '%HOMOLOG%' OR nome_fantasia ILIKE '%TESTE%')
  LIMIT 20
`);
console.log('TOTAL:', cli.rows.length);
for (const c of cli.rows) console.log(' ', c.id, '|', c.razao_social, '|', c.nome_fantasia, '|', c.cnpj, '| tenant', c.tenant_id);

console.log('\n=== 5. ORDENS DE SERVIÇO HML (relacionadas ao prestador ou HML) ===');
const osr = await pool.query(`
  SELECT id, numero, status, cliente, prestador, origem, destino, created_at
  FROM public.ordens_servico
  WHERE (numero ILIKE '%HML%' OR numero ILIKE '%TESTE%')
     OR prestador = $1
  ORDER BY created_at DESC LIMIT 20
`, [PRES]);
console.log('TOTAL:', osr.rows.length);
for (const o of osr.rows) console.log(' ', o.id, '|', o.numero, '|', o.status, '| cliente', o.cliente, '| prestador', o.prestador, '|', o.origem, '->', o.destino, '|', o.created_at);

await pool.end();