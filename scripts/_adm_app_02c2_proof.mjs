import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, p = []) => (await pool.query(s, p)).rows;
const T = ["prestadores","recrutamento_candidatos","recrutamento_prestadores",
           "recrutamento_operacoes","candidato_documentos","candidatos","liberado_app_audit"];
const o = {};
o.ts = (await q(`select now() agora`))[0].agora;
o.triggers_prestadores = await q(
  `select tgname, pg_get_triggerdef(oid) def from pg_trigger
    where not tgisinternal and tgrelid='public.prestadores'::regclass order by tgname`);
o.funcoes = await q(
  `select p.proname, p.provolatile, p.prosecdef,
          has_function_privilege('anon', p.oid, 'EXECUTE') anon_exec,
          has_function_privilege('authenticated', p.oid, 'EXECUTE') auth_exec,
          length(p.prosrc) src_len
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('fn_guardar_privilegio_prestador','fn_audit_liberado_app',
       'f_bridge_prestador_para_recrutamento') order by p.proname`);
o.policies = await q(
  `select tablename, policyname, cmd, roles::text[] roles, qual, with_check
     from pg_policies where schemaname='public' and tablename = any($1)
    order by tablename, policyname`, [T]);
o.grants = await q(
  `select c.relname, c.relacl::text relacl,
          has_table_privilege('anon', c.oid, 'SELECT') anon_sel,
          has_table_privilege('anon', c.oid, 'INSERT') anon_ins,
          has_table_privilege('authenticated', c.oid, 'INSERT') auth_ins
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname = any($1) order by c.relname`, [T]);
o.rpc_app_s6 = await q(
  `select p.proname, p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'app_s6%' order by p.proname`);
o.audit_cols = await q(
  `select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='liberado_app_audit' order by ordinal_position`);
o.audit_count = (await q(`select count(*)::int n from liberado_app_audit`))[0].n;
o.contagens = await q(`
  select 'prestadores' t, count(*)::int n from prestadores
  union all select 'prestadores com auth', count(*) from prestadores where auth_user_id is not null
  union all select 'recrutamento_candidatos', count(*) from recrutamento_candidatos
  union all select 'recrutamento_prestadores', count(*) from recrutamento_prestadores
  union all select 'recrutamento_operacoes', count(*) from recrutamento_operacoes
  union all select 'candidato_documentos', count(*) from candidato_documentos
  union all select 'candidatos', count(*) from candidatos
  union all select 'tenant_usuarios', count(*) from tenant_usuarios`);
o.policies_hash = (await q(`
  select md5(string_agg(schemaname||'|'||tablename||'|'||policyname||'|'||cmd, E'\n'
                        order by tablename, policyname)) h
    from pg_policies where schemaname='public' and tablename = any($1)`, [T]))[0].h;
console.log(JSON.stringify(o, null, 2));
await pool.end();
