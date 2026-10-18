import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl:{rejectUnauthorized:false} });
const q = async (s, p=[]) => (await pool.query(s,p)).rows;
const safe = async (s,p=[]) => { try { return await q(s,p); } catch(e) { return { err: e.message }; } };

const o = {};
o.existencia = await q(`
 select 'liberado_app_audit' item, exists(select 1 from information_schema.tables where table_schema='public' and table_name='liberado_app_audit') ex
 union all select 'trg_audit_liberado_app', exists(select 1 from pg_trigger where tgname='trg_audit_liberado_app')
 union all select 'fn_audit_liberado_app', exists(select 1 from pg_proc where proname='fn_audit_liberado_app')
 union all select 'homologacoes', exists(select 1 from information_schema.tables where table_schema='public' and table_name='homologacoes')
 union all select 'reservas_banco', exists(select 1 from information_schema.tables where table_schema='public' and table_name='reservas_banco')
 union all select 'candidato_documentos', exists(select 1 from information_schema.tables where table_schema='public' and table_name='candidato_documentos')
 union all select 'f_bridge_prestador_para_recrutamento', exists(select 1 from pg_proc where proname='f_bridge_prestador_para_recrutamento')
 union all select 'trg_bridge_prestador_para_recrutamento', exists(select 1 from pg_trigger where tgname='trg_bridge_prestador_para_recrutamento')
 union all select 'trg_propagar_financeiro_os', exists(select 1 from pg_trigger where tgname='trg_propagar_financeiro_os')
 union all select 'f_trg_novo_candidato_evento', exists(select 1 from pg_proc where proname='f_trg_novo_candidato_evento')`);

o.counts = await safe(`
 select 'candidato_documentos' t, count(*)::int n from candidato_documentos
 union all select 'documentos_prestadores', count(*) from documentos_prestadores
 union all select 'documentos_prestadores_sem_fk', count(*) from documentos_prestadores where prestador_id is null
 union all select 'candidatos', count(*) from recrutamento_candidatos
 union all select 'candidatos_com_prestador', count(*) from recrutamento_candidatos where prestador_id is not null
 union all select 'candidatos_com_documentos_jsonb', count(*) from recrutamento_candidatos where documentos is not null and jsonb_array_length(documentos)>0
 union all select 'prestadores', count(*) from prestadores
 union all select 'prestadores_app', count(*) from prestadores where origem='app_prestador' or origem_cadastro='app_motorista'
 union all select 'prestadores_liberados', count(*) from prestadores where liberado_app=true
 union all select 'recrutamento_prestadores', count(*) from recrutamento_prestadores`);

o.status_documental = await safe(`select coalesce(status_documental,'(null)') s, count(*)::int n from recrutamento_candidatos group by 1 order by 2 desc`);
o.docs_jsonb_por_candidato = await safe(`select id, nome, jsonb_array_length(documentos) ndocs, stage, status_documental from recrutamento_candidatos order by jsonb_array_length(documentos) desc limit 12`);
o.docs_por_tipo = await safe(`select tipo, count(*)::int n from documentos_prestadores group by 1 order by 2 desc limit 20`);
o.buckets = await safe(`select b.name, b.public, (select count(*) from storage.objects o where o.bucket_id=b.id)::int objects from storage.buckets b order by b.name`);
o.policies_storage = await safe(`select tablename, policyname, cmd, qual from pg_policies where schemaname='storage' and tablename='objects' order by tablename, policyname`);
o.cpf_duplicados = await safe(`select cpf_cnpj, count(*)::int n, string_agg(id::text,',') ids from prestadores where cpf_cnpj is not null and length(regexp_replace(cpf_cnpj,'\\D','','g'))>=11 group by 1 having count(*)>1 order by 2 desc`);
console.log(JSON.stringify(o,null,2));
await pool.end();
