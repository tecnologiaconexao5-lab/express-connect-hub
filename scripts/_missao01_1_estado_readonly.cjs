const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s) => (await c.query(s)).rows;
  console.log("--- ESTADO READ-ONLY (antes da tentativa de QA) ---");
  console.log("clientes_contratos=" + JSON.stringify((await q("select count(*)::int total, count(anexo_url)::int com_url from clientes_contratos"))[0]));
  console.log("documentos_metadata=" + JSON.stringify((await q("select count(*)::int total from documentos_metadata"))[0]));
  console.log("reembolsos_prestador=" + JSON.stringify((await q("select count(*)::int total, count(comprovante_url)::int com_url from reembolsos_prestador"))[0]));
  console.log("storage_objetos_documentos_operacionais=" + (await q("select count(*)::int n from storage.objects where bucket_id='documentos_operacionais'"))[0].n);
  console.log("policies_clientes_contratos=" + JSON.stringify(await q("select policyname, cmd from pg_policies where schemaname='public' and tablename='clientes_contratos' order by policyname")));
  console.log("bucket_documentos_operacionais=" + JSON.stringify((await q("select id, public from storage.buckets where id='documentos_operacionais'"))[0]));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
