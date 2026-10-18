import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Confirmação FINAL ao vivo
console.log('server now():', (await pool.query(`SELECT now() AS n`)).rows[0].n.toISOString());

const st = await pool.query(`
  SELECT id, status, finalizada, data_finalizacao, updated_at,
         metadata->'app_motorista'->>'numero_os' AS numero_os,
         metadata->'app_motorista'->>'romaneio' AS romaneio,
         metadata->'app_motorista'->>'rota' AS rota,
         metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
         metadata->'tracking_status' AS tracking_status
  FROM public.alocacoes_escala WHERE id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
`);
console.log('ALOCAÇÃO ca5fe225:', st.rows[0]);

// última posição (idade em minutos)
const pos = await pool.query(`
  SELECT captured_at, created_at, latitude, longitude, velocidade, precisao, origem,
         round(extract(epoch from (now() - created_at))/60)::int AS idade_min
  FROM public.portal_tracking_realtime
  WHERE alocacao_id = 'ca5fe225-7114-42da-9997-c3d466e5df52'
  ORDER BY created_at DESC LIMIT 1
`);
console.log('ÚLTIMA POSIÇÃO:', pos.rows[0]);

// confirmar prestador e veículo
const p = await pool.query(`
  SELECT id, nome_completo, liberado_app, auth_user_id
  FROM public.prestadores WHERE id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'
`);
console.log('PRESTADOR:', p.rows[0]);

await pool.end();