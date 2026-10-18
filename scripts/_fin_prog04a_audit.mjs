// TMS-FIN-PROG-04A — AUDITORIA READ-ONLY do fluxo de fatura. SOMENTE SELECT.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (sql, pr = []) => (await p.query(sql, pr)).rows;
const out = {};

out.cols_faturas = await q(`select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='faturas' order by ordinal_position`);
out.cols_fatura_itens = await q(`select column_name, data_type, is_nullable from information_schema.columns where table_schema='public' and table_name='fatura_itens' order by ordinal_position`);
out.cols_receber = await q(`select column_name, data_type from information_schema.columns where table_schema='public' and table_name='financeiro_receber' order by ordinal_position`);

out.constraints = await q(`select conrelid::regclass::text tabela, conname, contype, pg_get_constraintdef(oid) def from pg_constraint where conrelid in ('public.faturas'::regclass,'public.fatura_itens'::regclass,'public.financeiro_receber'::regclass) order by 1,2`);
out.indexes = await q(`select tablename, indexname, indexdef from pg_indexes where schemaname='public' and tablename in ('faturas','fatura_itens','financeiro_receber') order by 1,2`);
out.sequences = await q(`select sequencename, start_value, increment_by, last_value, cache_size, cycle from pg_sequences where schemaname='public' and sequencename like 'seq_fatura%'`);

out.rpcs = await q(`select p.proname, p.prosecdef as security_definer, p.provolatile, pg_get_function_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f_emitir_fatura','f_gerar_numero_fatura','f_cancelar_fatura','f_recalcular_totais_fatura') order by 1`);
out.rpc_grants = await q(`select routine_name, grantee, privilege_type from information_schema.routine_privileges where routine_schema='public' and routine_name in ('f_emitir_fatura','f_gerar_numero_fatura','f_cancelar_fatura') order by 1,2,3`);
out.triggers = await q(`select event_object_table tabela, trigger_name, event_manipulation, action_timing, action_statement from information_schema.triggers where trigger_schema='public' and event_object_table in ('faturas','fatura_itens','financeiro_receber') order by 1,2,3`);

out.faturas_por_status = await q(`select status, count(*)::int n, count(*) filter (where numero is not null)::int com_numero, count(*) filter (where conta_receber_id is not null)::int com_ar, coalesce(sum(valor_total),0) total from faturas group by status order by status`);
out.faturas_total = await q(`select count(*)::int n, count(*) filter (where numero is not null)::int com_numero, count(*) filter (where conta_receber_id is not null)::int com_ar from faturas`);
out.receber_com_fatura_id = await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`);
out.receber_fatura_texto = await q(`select count(*)::int n from financeiro_receber where fatura is not null and fatura <> '' and fatura_id is null`);

// 41 / 42
out.faturas_41_42 = await q(`select id, numero, status, cliente_id, data_emissao, vencimento, valor_total, conta_receber_id, metadata, criado_em from faturas where metadata->>'numeroManual' in ('41','42') order by metadata->>'numeroManual'`);
out.itens_41_42 = await q(`select i.fatura_id, i.os_id, i.alocacao_id, i.descricao, i.valor_base, i.valor_total, i.status from fatura_itens i join faturas f on f.id=i.fatura_id where f.metadata->>'numeroManual' in ('41','42') order by i.fatura_id`);
out.receber_41_42 = await q(`select id, fatura, numero, fatura_id, os_id, valor, status, data_vencimento from financeiro_receber where fatura in ('41','42') or numero in ('41','42') or id in (select conta_receber_id from faturas where metadata->>'numeroManual' in ('41','42') and conta_receber_id is not null)`);

// 14 emitidas sem AR
out.emitidas_sem_ar = await q(`select f.id, f.numero, f.status, f.conta_receber_id, f.cliente_id, f.valor_total, f.data_emissao, f.vencimento, f.criado_em, f.metadata->>'origem' origem, f.metadata->>'numeroManual' numero_manual, (select count(*)::int from fatura_itens i where i.fatura_id=f.id) n_itens, (select count(*)::int from fatura_itens i where i.fatura_id=f.id and i.os_id is not null) n_itens_com_os, (select count(*)::int from financeiro_receber r where r.fatura_id=f.id) n_ar_fatura_id, (select count(*)::int from financeiro_receber r where r.fatura=f.numero and f.numero is not null) n_ar_numero from faturas f where f.status='emitida' and f.conta_receber_id is null order by f.criado_em`);

// distribuição origem das emitidas
out.emitidas_por_origem = await q(`select coalesce(metadata->>'origem','(sem origem)') origem, count(*)::int n, count(*) filter (where conta_receber_id is null)::int sem_ar from faturas where status='emitida' group by 1 order by 1`);

// número por cliente (metadata.numeroManual)
out.numero_manual_por_cliente = await q(`select cliente_id, count(*)::int n, array_agg(coalesce(metadata->>'numeroManual', numero) order by criado_em) numeros from faturas where coalesce(metadata->>'numeroManual', numero) is not null group by cliente_id order by n desc limit 20`);

out.tenant_count = await q(`select count(distinct tenant_id)::int n from faturas`);

console.log(JSON.stringify(out, null, 2));
await p.end();
