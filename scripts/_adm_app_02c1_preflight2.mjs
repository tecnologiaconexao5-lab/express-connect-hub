// ADM-APP-02C.1 — leitura complementar READ-ONLY.
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;
const o = {};

// 1. constraints em prestadores (CHECK que poderia bloquear liberado_app/status)
o.constraints_prestadores = await q(`
  select conname, pg_get_constraintdef(oid) def
    from pg_constraint
   where conrelid = 'public.prestadores'::regclass
   order by contype, conname`);

// 2. match_operacoes_prestadores / reservas_banco / prestadores_app existencia
o.tabelas_extras = await q(`
  select table_name from information_schema.tables
   where table_schema='public' and table_name in
     ('match_operacoes_prestadores','reservas_banco','prestadores_app','liberado_app_audit',
      'recrutamento_historico','provider_documents','fluxo_recrutamento','homologacoes')
   order by table_name`);

// 3. source de current_tenant_id_safe
o.src_tenant_safe = await q(`
  select p.prosecdef, p.provolatile, left(p.prosrc, 1500) src
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='current_tenant_id_safe'`);

// 4. app_s6_resolver_identidade_legada — fonte completa
o.src_resolver = await q(`
  select p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_s6_resolver_identidade_legada'`);

// 5. app_s6_criar_prestador — fonte completa
o.src_criar = await q(`
  select p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_s6_criar_prestador'`);

// 6. prestadores com auth_user_id (candidatos ao teste de self-liberation)
o.prestadores_auth = await q(`
  select id, nome_completo, status, liberado_app, auth_user_id,
         origem_cadastro, data_aprovacao
    from prestadores
   where auth_user_id is not null
   order by created_at`);

// 7. coluna is_teste existe?
o.cols_is_teste = await q(`
  select table_name, column_name from information_schema.columns
   where table_schema='public' and column_name in ('is_teste','teste')
     and table_name in ('prestadores','recrutamento_candidatos','candidatos')
   order by table_name`);

// 8. grants de coluna em prestadores (attacl) — privilégio por coluna?
o.col_privs_prestadores = await q(`
  select attname, attacl::text as acl
    from pg_attribute
   where attrelid='public.prestadores'::regclass and attacl is not null`);

// 9. anon em candidatos (furo) + policies detalhe
o.candidatos_anon = await q(`
  select has_table_privilege('anon','public.candidatos','SELECT') sel,
         has_table_privilege('anon','public.candidatos','INSERT') ins`);

// 10. leitores/escritores de tabelas recrutamento em src (nomes de tabela textual)
//     (feito por grep fora do script — aqui apenas contagem de linhas)

// 11. auditoria: quem ja alterou liberado_app / status (updated_at recente)
o.ultima_alteracao = await q(`
  select max(updated_at) as max_updated_at,
         count(*) filter (where liberado_app) as liberados,
         count(*) filter (where status='ativo') as ativos,
         count(*) filter (where status is distinct from 'ativo') as nao_ativos
    from prestadores`);

// 12. prestadores sem auth mas com liberado_app (coerencia A-11)
o.coerencia = await q(`
  select count(*) filter (where liberado_app and auth_user_id is null) liberado_sem_auth,
         count(*) filter (where (not liberado_app or liberado_app is null) and auth_user_id is not null) auth_sem_liberacao,
         count(*) filter (where status='ativo' and (liberado_app is null or not liberado_app)) ativo_nao_liberado
    from prestadores`);

// 13. valores distintos de status
o.status_distintos = await q(`select status, count(*)::int n from prestadores group by 1 order by 2 desc`);

// 14. políticas RLS em auth.users? (nao — só informar se ha)
// 15. nomes de policies com 'anon' public em qualquer tabela public (contexto amplo)
o.policies_anon_todas = await q(`
  select tablename, count(*)::int n from pg_policies
   where schemaname='public' and 'anon' = any(roles) group by 1 order by 1`);

console.log(JSON.stringify(o, null, 2));
await pool.end();
