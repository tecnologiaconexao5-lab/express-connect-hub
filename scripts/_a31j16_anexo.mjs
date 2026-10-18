import "dotenv/config";
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (label, sql) => {
  try { const r = await c.query(sql); console.log(`\n### ${label}\n` + JSON.stringify(r.rows, null, 2)); }
  catch (e) { console.log(`\n### ${label} -> ERRO: ${e.message}`); }
};
await q("reembolsos_prestador — colunas", `
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='reembolsos_prestador' ORDER BY ordinal_position;`);
await q("colunas com anexo/comprovante/url nas tabelas operacionais", `
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema='public'
    AND (column_name ILIKE '%comprovante%' OR column_name ILIKE '%anexo%' OR column_name ILIKE '%pedagio%'
         OR column_name ILIKE '%url%')
    AND table_name IN ('alocacoes_escala','reembolsos_prestador','pagamentos_prestadores','delivery_proofs','prestadores')
  ORDER BY table_name, column_name;`);
await q("reembolsos_prestador — amostra", `
  SELECT * FROM public.reembolsos_prestador LIMIT 3;`);
await c.end();
