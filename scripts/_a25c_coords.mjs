import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// SOMENTE LEITURA — quantas OS ativas têm coordenadas (explica "0 de 0 OS")
const r = await pool.query(`
  SELECT
    count(*) AS total_ativas,
    count(*) FILTER (WHERE localizacao_entrega_json IS NOT NULL) AS com_loc_json,
    count(*) FILTER (WHERE enderecos IS NOT NULL AND jsonb_typeof(enderecos) = 'array' AND jsonb_array_length(enderecos) > 0) AS com_enderecos
  FROM public.ordens_servico
  WHERE status NOT IN ('finalizada','entregue','concluida','cancelada')
`);
console.log('OS ativas e presença de coordenadas:', JSON.stringify(r.rows[0]));

// Amostra de OS ativas com localizacao_entrega_json não nulo
const amostra = await pool.query(`
  SELECT numero, status, localizacao_entrega_json
  FROM public.ordens_servico
  WHERE status NOT IN ('finalizada','entregue','concluida','cancelada')
    AND localizacao_entrega_json IS NOT NULL
  LIMIT 5
`);
console.log('\nAmostra OS com localizacao_entrega_json:');
for (const a of amostra.rows) console.log(' ', a.numero, '|', a.status, '|', JSON.stringify(a.localizacao_entrega_json).slice(0,120));

await pool.end();
