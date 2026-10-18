// ADM-APP-02D.2-R1 — recuperação de estado (read-only)
import { DB } from "./_adm_app_02d2_env.mjs";
import pgpkg from "pg";
const { Client } = pgpkg;
const c2 = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c2.connect();
const out = {};
out.migrations = (await c2.query(
  `select version, name from supabase_migrations.schema_migrations
   where name like '%02d2%' or name like '%02d_2%' order by version desc limit 5`
).catch(() => ({ rows: [] }))).rows;
out.bucket = (await c2.query(
  `select id, public from storage.buckets where id='documentos_prestadores'`)).rows[0];
out.policies = (await c2.query(
  `select policyname, cmd, roles from pg_policies
   where schemaname='storage' and tablename='objects'
     and qual like '%documentos_prestadores%' order by policyname`)).rows;
out.tabela = (await c2.query(
  `select count(*)::int n,
          count(*) filter (where url is null or url='')::int vazia
   from documentos_prestadores`)).rows[0];
out.dp_policies = (await c2.query(
  `select count(*)::int n from pg_policies
   where schemaname='public' and tablename='documentos_prestadores'`)).rows[0];
out.anon_sem_acesso = out.policies.filter((p) => (p.roles || []).includes("anon")).length;
out.ts = (await c2.query(`select now()::text n`)).rows[0].n;
await c2.end();
console.log(JSON.stringify(out, null, 2));
