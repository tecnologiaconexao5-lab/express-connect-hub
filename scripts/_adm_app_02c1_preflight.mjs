// ADM-APP-02C.1 — PREFLIGHT READ-ONLY: REC-01 x banco real, self-liberation,
// RLS recrutamento, tenant, grants app_s6, dependencias REC-02.
// NENHUMA escrita. SELECT apenas.
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;
const o = {};

// ── 1. OBJETOS REC-01 / REC-02 ──────────────────────────────────────────────
o.tabela_liberado_app_audit = await q(`
  select column_name, data_type, is_nullable, column_default
    from information_schema.columns
   where table_schema='public' and table_name='liberado_app_audit'
   order by ordinal_position`);

o.funcoes_rec01 = await q(`
  select p.proname,
         p.provolatile, p.prosecdef, p.proacl::text as acl,
         pg_get_function_arguments(p.oid) args,
         length(p.prosrc) as src_len
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in
     ('fn_audit_liberado_app','fn_block_self_liberado_app','mascarar_cpf',
      'mascarar_telefone','obter_documento_signed_url',
      '_rec02_create_policy_if_not_exists','_rec02_add_tenant_isolation')
   order by p.proname`);

o.funcoes_rec01_src = await q(`
  select p.proname, p.prosrc
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in
     ('fn_block_self_liberado_app','fn_audit_liberado_app')`);

o.idx_laa = await q(`
  select indexname from pg_indexes where schemaname='public' and tablename='liberado_app_audit'`);

// ── 2. PRESTADORES: RLS, policies, colunas, triggers ────────────────────────
o.rls_prestadores = await q(`
  select relrowsecurity, relforcerowsecurity from pg_class
   where oid='public.prestadores'::regclass`);

o.policies_prestadores = await q(`
  select policyname, cmd, roles::text[] as roles, qual, with_check
    from pg_policies where schemaname='public' and tablename='prestadores'
   order by policyname`);

o.cols_prestadores = await q(`
  select column_name, data_type, is_nullable, column_default
    from information_schema.columns
   where table_schema='public' and table_name='prestadores'
   order by ordinal_position`);

o.triggers_prestadores = await q(`
  select t.tgname, t.tgtype::int, pg_get_triggerdef(t.oid) def,
         (select p.proname from pg_proc p where p.oid=t.tgfoid) as fn
    from pg_trigger t
   where not t.tgisinternal and t.tgrelid='public.prestadores'::regclass
   order by t.tgname`);

o.triggers_all_alvo = await q(`
  select c.relname as tabela, t.tgname, pg_get_triggerdef(t.oid) def
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
   where not t.tgisinternal
     and (pg_get_triggerdef(t.oid) ilike '%prestadores%'
          or t.tgname ilike '%liberado%')
   order by c.relname, t.tgname`);

o.prestadores_policies_full = await q(`
  select policyname, tablename, cmd, roles::text[] as roles, qual, with_check
    from pg_policies
   where schemaname='public' and tablename in ('prestadores','prestadores_app')
   order by tablename, policyname`);

// ── 3. RLS RECRUTAMENTO ─────────────────────────────────────────────────────
const tRec = ["recrutamento_candidatos","recrutamento_prestadores","recrutamento_operacoes",
               "candidato_documentos","candidatos","match_operacoes_prestadores",
               "crm_interacoes_prestadores","liberado_app_audit"];
o.rls_recrut = await q(`
  select c.relname, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname = any($1)
   order by c.relname`, [tRec]);

o.policies_recrut = await q(`
  select tablename, policyname, cmd, roles::text[] as roles, qual, with_check
    from pg_policies
   where schemaname='public' and tablename = any($1)
   order by tablename, policyname`, [tRec]);

o.cols_recrut = await q(`
  select table_name, column_name, data_type
    from information_schema.columns
   where table_schema='public' and table_name = any($1)
   order by table_name, ordinal_position`, [tRec]);

o.grants_anon = await q(`
  select c.relname, c.relacl::text as relacl
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relname = any($1)
   order by c.relname`, [tRec]);

o.counts_recrut = await q(`
  select 'recrutamento_candidatos' t, count(*)::int n from recrutamento_candidatos
  union all select 'recrutamento_prestadores', count(*) from recrutamento_prestadores
  union all select 'candidato_documentos', count(*) from candidato_documentos
  union all select 'candidatos', count(*) from candidatos
  union all select 'prestadores', count(*) from prestadores`);

// informacao de tenant REAL existente hoje
o.tenant_cols = await q(`
  select table_name, column_name
    from information_schema.columns
   where table_schema='public' and table_name = any($1)
     and (column_name ilike '%tenant%' or column_name ilike '%cliente_id%'
          or column_name = 'prestador_id' or column_name ilike '%unidade%')
   order by table_name, column_name`, [tRec]);

// amostra de vinculo prestador_id em recrutamento_candidatos
o.vinculo_candidatos = await q(`
  select count(*)::int total,
         count(prestador_id)::int com_prestador_id,
         count(distinct prestador_id)::int prestadores_distintos
    from recrutamento_candidatos`);

// ── 4. REC-02: quais tabelas ja tem tenant_id ───────────────────────────────
const tRec02 = ["recrutamento_candidatos","recrutamento_prestadores","recrutamento_operacoes",
  "candidatos","operacoes","homologacoes","crm_interacoes_prestadores","fluxo_recrutamento",
  "match_operacoes_prestadores","provider_documents","reservas_banco","liberado_app_audit"];
o.rec02_tenant_status = await q(`
  select t.name as tabela,
         exists(select 1 from information_schema.columns c
                 where c.table_schema='public' and c.table_name=t.name
                   and c.column_name='tenant_id') as tem_tenant_id
    from (select unnest($1::text[]) as name) t
   order by t.name`, [tRec02]);

o.rec02_policies_existentes = await q(`
  select tablename, policyname from pg_policies
   where schemaname='public'
     and (policyname like '%_tenant' or policyname like 'rc_%' or policyname like 'rp_%'
          or policyname like 'ro_%' or policyname like 'laa_%' or policyname like 'cip_%'
          or policyname like 'mop_%' or policyname like 'hom_%' or policyname like 'fr_%'
          or policyname like 'pd_%' or policyname like 'rb_%')
   order by tablename, policyname`);

// ── 5. GRANTS RPC APP ───────────────────────────────────────────────────────
o.grants_app_s6 = await q(`
  select p.proname, p.prosecdef, p.provolatile, p.proacl::text as acl,
         pg_get_function_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'app_s6%'
   order by p.proname`);

o.src_app_s6 = await q(`
  select p.proname, left(p.prosrc, 900) as src
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'app_s6%'
   order by p.proname`);

// grants genericos (anon/authenticated) em tabelas do fluxo
o.grants_tabelas = await q(`
  select c.relname,
         has_table_privilege('anon', c.oid, 'SELECT') anon_sel,
         has_table_privilege('anon', c.oid, 'INSERT') anon_ins,
         has_table_privilege('anon', c.oid, 'UPDATE') anon_upd,
         has_table_privilege('anon', c.oid, 'DELETE') anon_del,
         has_table_privilege('authenticated', c.oid, 'SELECT') auth_sel,
         has_table_privilege('authenticated', c.oid, 'INSERT') auth_ins
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname = any($1)
   order by c.relname`,
  [["prestadores","recrutamento_candidatos","recrutamento_prestadores",
    "recrutamento_operacoes","candidato_documentos","crm_interacoes_prestadores",
    "match_operacoes_prestadores","liberado_app_audit"]]);

// ── 6. STORAGE (somente confirmar compat com 02D) ───────────────────────────
o.buckets = await q(`select id, name, public from storage.buckets order by name`);
o.storage_policies_doc = await q(`
  select policyname, cmd, roles::text[] as roles, qual, with_check
    from pg_policies where schemaname='storage' and tablename='objects'
     and (qual ilike '%documentos_prestadores%' or with_check ilike '%documentos_prestadores%')
   order by policyname`);

// ── 7. funcoes helper de tenant ─────────────────────────────────────────────
o.tenant_helpers = await q(`
  select p.proname, p.provolatile, p.prosecdef
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in
     ('current_tenant_id_safe','current_tenant_id','app_current_tenant')
   order by p.proname`);

// ── 8. policys com anon em qualquer tabela (contexto) ───────────────────────
o.policies_with_anon = await q(`
  select schemaname, tablename, policyname, cmd, roles::text[] as roles
    from pg_policies
   where 'anon' = any(roles) and schemaname='public'
     and (tablename like 'recrutamento%' or tablename in
          ('candidatos','candidato_documentos','prestadores','match_operacoes_prestadores',
           'crm_interacoes_prestadores','homologacoes','operacoes','fluxo_recrutamento'))
   order by tablename, policyname`);

console.log(JSON.stringify(o, null, 2));
await pool.end();
