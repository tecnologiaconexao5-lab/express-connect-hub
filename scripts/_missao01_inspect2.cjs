const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s) => (await c.query(s)).rows;
  console.log("clientes:", (await q("select count(*)::int n from clientes"))[0]);
  console.log("contratos:", (await q("select count(*)::int n, count(anexo_url)::int com_url, count(anexo_nome)::int com_nome from clientes_contratos"))[0]);
  console.log("aloc c/ os:", (await q("select count(*)::int n from alocacoes_escala where ordem_servico_id is not null"))[0]);
  console.log("os:", (await q("select count(*)::int n from ordens_servico"))[0]);
  console.log("reembolsos:", (await q("select count(*)::int n, count(comprovante_url)::int com_url from reembolsos_prestador"))[0]);
  console.log("os cols tenant:", (await q("select column_name from information_schema.columns where table_schema='public' and table_name='ordens_servico' and column_name like '%tenant%'")).map(r=>r.column_name));
  console.log("sample aloc:", (await q("select id, ordem_servico_id, cliente_id, prestador_id, tenant_id from alocacoes_escala where ordem_servico_id is not null limit 1"))[0]);
  console.log("sample cliente:", (await q("select id, razao_social, nome_fantasia, tenant_id from clientes limit 1"))[0]);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
