import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl:{rejectUnauthorized:false} });
const q = async (s) => (await pool.query(s)).rows;
const o = {};
// REC-01 migration objects — did the migration get applied at all?
o.rec01_objetos = await q(`
 select 'tabela_liberado_app_audit' item, exists(select 1 from information_schema.tables where table_name='liberado_app_audit') ex
 union all select 'fn_mascarar_cpf', exists(select 1 from pg_proc where proname='mascarar_cpf')
 union all select 'fn_mascarar_telefone', exists(select 1 from pg_proc where proname='mascarar_telefone')
 union all select 'fn_obter_documento_signed_url', exists(select 1 from pg_proc where proname='obter_documento_signed_url')
 union all select 'fn_block_self_liberado_app', exists(select 1 from pg_proc where proname='fn_block_self_liberado_app')
 union all select 'pol_rc_select_auth', exists(select 1 from pg_policies where policyname='rc_select_auth')
 union all select 'pol_laa_select_tms', exists(select 1 from pg_policies where policyname='laa_select_tms')
 union all select 'pol_mop_select_auth', exists(select 1 from pg_policies where policyname='mop_select_auth')`);
// triggers on prestadores
o.trg_prestadores = await q(`select tgname, tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='prestadores' and not tgisinternal order by tgname`);
// policies on prestadores (liberado_app related)
o.pol_prestadores = await q(`select policyname, cmd, roles::text, qual from pg_policies where schemaname='public' and tablename='prestadores' order by policyname`);
// liberado_app column details
o.liberado_app_col = await q(`select column_name, data_type, column_default, is_nullable from information_schema.columns where table_name='prestadores' and column_name in ('liberado_app','status','status_operacional','origem','origem_cadastro','auth_user_id') order by column_name`);
// prestadores_app definition
o.prestadores_app_cols = await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='prestadores_app' order by ordinal_position`);
o.prestadores_app_rows = await q(`select count(*)::int n from prestadores_app`);
console.log(JSON.stringify(o,null,2));
await pool.end();
