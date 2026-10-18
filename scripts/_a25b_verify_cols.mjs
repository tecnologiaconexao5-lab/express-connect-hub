import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// SOMENTE LEITURA — verificação de colunas/tabelas referenciadas no novo RPC
const veicCols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'veiculos' AND column_name IN ('prestador_vinculado','prestador_id','updated_at','created_at')
  ORDER BY column_name
`);
console.log('=== veiculos colunas (prestador) ===');
for (const c of veicCols.rows) console.log('  ' + c.column_name);

const hasOpTimeline = await pool.query(`
  SELECT to_regclass('public.operation_timeline_events') AS tab
`);
console.log('\n=== operation_timeline_events ===');
console.log('  ' + (hasOpTimeline.rows[0].tab || 'NÃO EXISTE'));

const alocCols = await pool.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'alocacoes_escala' AND column_name IN ('ordem_servico_id','cliente_id','status','prestador_id')
  ORDER BY column_name
`);
console.log('\n=== alocacoes_escala colunas usadas ===');
for (const c of alocCols.rows) console.log('  ' + c.column_name);

await pool.end();
