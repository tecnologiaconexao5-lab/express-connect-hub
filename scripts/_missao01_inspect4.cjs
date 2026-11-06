const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s) => (await c.query(s)).rows;
  console.log("RLS clientes_contratos:", await q("select relrowsecurity, relforcerowsecurity from pg_class where oid='public.clientes_contratos'::regclass"));
  console.log("policies clientes_contratos:", await q("select policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' and tablename='clientes_contratos'"));
  console.log("policies documentos_metadata:", await q("select policyname, cmd, roles::text from pg_policies where schemaname='public' and tablename='documentos_metadata'"));
  console.log("policies reembolsos:", await q("select policyname, cmd, roles::text, qual from pg_policies where schemaname='public' and tablename='reembolsos_prestador'"));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
