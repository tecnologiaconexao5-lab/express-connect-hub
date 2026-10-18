// ADM-APP-02A — introspecção READ-ONLY: funções/RPCs, triggers e tabelas do fluxo.
import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const out = {};

out.rpcs = await q(
  `select p.proname, pg_get_function_arguments(p.oid) args, p.provolatile, p.prosecdef
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and (p.proname ilike '%prestador%' or p.proname ilike '%candidato%'
           or p.proname ilike '%recrut%' or p.proname ilike '%liberado%'
           or p.proname ilike 'app_%' or p.proname ilike '%bridge%'
           or p.proname ilike '%cadastro%')
    order by p.proname`);

out.triggers_prestadores = await q(
  `select t.tgname, pg_get_triggerdef(t.oid) def
     from pg_trigger t where not t.tgisinternal and t.tgrelid='public.prestadores'::regclass`);

out.tabelas = await q(
  `select table_name from information_schema.tables
    where table_schema='public' and (table_name in
     ('prestadores','recrutamento_prestadores','recrutamento_candidatos','candidato_documentos',
      'documentos_prestadores','candidatos','veiculos','motorista_checkins','motorista_app_sessoes',
      'prestador_acesso','prestador_disponibilidade','prestador_notificacoes','prestador_engajamento',
      'recrutamento_operacoes','recrutamento_historico','auth_eventos_auditoria','tenant_usuarios')
     or table_name ilike 'prestador_%' or table_name ilike 'recrutamento_%')
    order by table_name`);

// Colunas-chave de prestadores
out.cols_prestadores = (await q(
  `select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='prestadores'
      and column_name in ('id','cpf_cnpj','auth_user_id','liberado_app','status','status_operacional',
                          'origem','origem_cadastro','veiculo','metadata','created_at','updated_at',
                          'data_aprovacao','indice_aceite','qtd_operacoes')
    order by column_name`));

// Colunas de recrutamento_candidatos
out.cols_candidatos = (await q(
  `select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='recrutamento_candidatos' order by ordinal_position`));

out.cols_recrut_prest = (await q(
  `select column_name from information_schema.columns where table_schema='public' and table_name='recrutamento_prestadores' order by ordinal_position`));

// Contagens reais do fluxo
out.counts = {
  prestadores_total: (await q(`select count(*)::int n from prestadores`))[0].n,
  prestadores_app: (await q(`select count(*)::int n from prestadores where origem='app_prestador' or origem_cadastro='app_motorista'`))[0].n,
  prestadores_liberados: (await q(`select count(*)::int n from prestadores where liberado_app=true`))[0].n,
  candidatos_total: (await q(`select count(*)::int n from recrutamento_candidatos`))[0].n,
  candidatos_sem_prestador: (await q(`select count(*)::int n from recrutamento_candidatos where prestador_id is null`)).catch ? undefined : undefined,
};
try { out.counts.candidatos_sem_prestador = (await q(`select count(*)::int n from recrutamento_candidatos where prestador_id is null`))[0].n; } catch (e) { out.counts.candidatos_sem_prestador = "n/a"; }
try { out.counts.recrut_prest_total = (await q(`select count(*)::int n from recrutamento_prestadores`))[0].n; } catch {}

// Duplicidade de CPF
out.cpf_duplicado = await q(
  `select cpf_cnpj, count(*)::int n from prestadores where cpf_cnpj is not null group by cpf_cnpj having count(*)>1 order by n desc limit 20`);

// liberado_app x status
out.liberado_x_status = await q(
  `select liberado_app, coalesce(status,'(null)') status, count(*)::int n
     from prestadores group by 1,2 order by 1,2`);

console.log(JSON.stringify(out, null, 2));
await pool.end();
