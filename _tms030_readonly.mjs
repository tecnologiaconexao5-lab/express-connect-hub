import pg from "pg";
import { config } from "dotenv";
import path from "path";
config({ path: path.join("C:/Users/DIEGO BALBINO/Desktop/Pasta Compartilhada/DOCUMENTOS EMPRESA/08_TECNOLOGIA_SISTEMAS/express-connect-hub", ".env"), override: true });
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const cnt = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE cliente IS NOT NULL) AS cliente_preenchido,
    COUNT(*) FILTER (WHERE cliente IS NULL) AS cliente_null,
    COUNT(*) FILTER (WHERE prestador::text ~* '^[0-9a-f]{8}-') AS prest_uuid,
    COUNT(*) FILTER (WHERE prestador IS NOT NULL AND prestador::text !~* '^[0-9a-f]{8}-') AS prest_nome,
    COUNT(*) AS total
  FROM public.ordens_servico;`);
console.log("OS counts:", JSON.stringify(cnt.rows[0]));
const cli = await client.query(`
  SELECT id, razao_social, nome_fantasia FROM public.clientes
  WHERE id IN ('3d2d079d-708b-4d4d-9c0b-1ed9b894e37e','3525e99f-64dd-43d1-ba0a-7e7559638841','c4ee38d6-f667-4ec9-90e2-b299ec513ca5');`);
console.log("clientes:", JSON.stringify(cli.rows, null, 2));
const pres = await client.query(`
  SELECT id, nome_completo FROM public.prestadores
  WHERE id::text IN ('e6646799-fbac-453e-a3ef-afdfc01a7085','659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce');`);
console.log("prestadores:", JSON.stringify(pres.rows, null, 2));
await client.end();
