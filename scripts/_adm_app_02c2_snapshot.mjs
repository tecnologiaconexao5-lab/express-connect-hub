// ADM-APP-02C.2 — SNAPSHOT PRÉ-MUDANÇA (read-only). Evidência para rollback exato.
// policies prestadores + recrutamento + candidatos; triggers prestadores; grants;
// inexistencia liberado_app_audit; contagens.
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;
const o = {};

const ALVO = ["prestadores","recrutamento_candidatos","recrutamento_prestadores",
  "recrutamento_operacoes","candidato_documentos","candidatos","prestadores_app"];

o.ts = (await q(`select now() as agora`))[0].agora;

// ── 1. POLICIES ─────────────────────────────────────────────────────────────
o.policies = await q(`
  select schemaname, tablename, policyname, cmd, roles::text[] as roles, qual, with_check
    from pg_policies
   where schemaname='public' and tablename = any($1)
   order by tablename, policyname`, [ALVO]);

// ── 2. RLS ON/OFF ───────────────────────────────────────────────────────────
o.rls = await q(`
  select c.relname, c.relrowsecurity, c.relforcerowsecurity, c.relacl::text as relacl
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname = any($1)
   order by c.relname`, [ALVO]);

// ── 3. TRIGGERS de prestadores (e globais que citam prestadores) ───────────
o.triggers_prestadores = await q(`
  select t.tgname, t.tgtype::int, pg_get_triggerdef(t.oid) def,
         (select p.proname from pg_proc p where p.oid=t.tgfoid) as fn
    from pg_trigger t
   where not t.tgisinternal and t.tgrelid='public.prestadores'::regclass
   order by t.tgname`);

o.triggers_citando_prestadores = await q(`
  select c.relname as tabela, t.tgname, pg_get_triggerdef(t.oid) def
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
   where not t.tgisinternal and n.nspname='public'
     and (pg_get_triggerdef(t.oid) ilike '%prestadores%' or t.tgname ilike '%liberado%'
          or t.tgname ilike '%bridge%')
   order by c.relname, t.tgname`);

o.funcoes_trigger_prestadores = await q(`
  select p.proname, p.provolatile, p.prosecdef, p.prosecdef as security_definer,
         length(p.prosrc) as src_len, left(p.prosrc, 600) as src_head
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in
     ('trg_bridge_prestador_para_recrutamento','fn_bridge_prestador_para_recrutamento',
      'fn_audit_liberado_app','fn_block_self_liberado_app')
   order by p.proname`);

// ── 4. GRANTS relevantes ────────────────────────────────────────────────────
o.grants_tabelas = await q(`
  select c.relname,
         has_table_privilege('anon', c.oid, 'SELECT') anon_sel,
         has_table_privilege('anon', c.oid, 'INSERT') anon_ins,
         has_table_privilege('anon', c.oid, 'UPDATE') anon_upd,
         has_table_privilege('anon', c.oid, 'DELETE') anon_del,
         has_table_privilege('authenticated', c.oid, 'SELECT') auth_sel,
         has_table_privilege('authenticated', c.oid, 'INSERT') auth_ins,
         has_table_privilege('authenticated', c.oid, 'UPDATE') auth_upd,
         has_table_privilege('authenticated', c.oid, 'DELETE') auth_del
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relname = any($1)
   order by c.relname`, [ALVO]);

o.grants_rpc_app_s6 = await q(`
  select p.proname, p.prosecdef, p.provolatile, p.proacl::text as acl
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'app_s6%'
   order by p.proname`);

// ── 5. inexistencia liberado_app_audit ──────────────────────────────────────
o.liberado_app_audit = await q(`
  select exists(select 1 from information_schema.tables
                 where table_schema='public' and table_name='liberado_app_audit') as existe`);

// ── 6. contagens atuais ─────────────────────────────────────────────────────
o.contagens = await q(`
  select 'prestadores' t, count(*)::int n from prestadores
  union all select 'prestadores com auth_user_id', count(*) from prestadores where auth_user_id is not null
  union all select 'recrutamento_candidatos', count(*) from recrutamento_candidatos
  union all select 'recrutamento_prestadores', count(*) from recrutamento_prestadores
  union all select 'recrutamento_operacoes', count(*) from recrutamento_operacoes
  union all select 'candidato_documentos', count(*) from candidato_documentos
  union all select 'candidatos', count(*) from candidatos
  union all select 'tenant_usuarios', count(*) from tenant_usuarios`);

// ── 7. colunas da tabela alvo da guarda (prestadores) ───────────────────────
o.cols_prestadores = await q(`
  select column_name, data_type, is_nullable
    from information_schema.columns
   where table_schema='public' and table_name='prestadores'
   order by ordinal_position`);

// ── 8. conteudo da snapshot (hash de policies) p/ verificacao pos-aplicacao ─
o.policies_hash = (await q(`
  select md5(string_agg(schemaname||'|'||tablename||'|'||policyname||'|'||cmd, E'\n'
                        order by tablename, policyname)) as h
    from pg_policies
   where schemaname='public' and tablename = any($1)`, [ALVO]))[0].h;

console.log(JSON.stringify(o, null, 2));
await pool.end();
