import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl:{rejectUnauthorized:false} });
const q = async (s,pr=[]) => (await pool.query(s,pr)).rows;
const o = {};
const esperadas = ["nome_completo","cpf","whatsapp","regiao","tipo_veiculo","tipo_carroceria",
 "experiencia_anos","como_conheceu","mensagem_livre","canal_captacao","status","score_perfil",
 "ultima_interacao","observacoes","avaliacao_nota","avaliacao_comentario"];
o.rec03_bloco1 = await q(`
  select c.column_name from unnest($1::text[]) as w(column_name)
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name='recrutamento_candidatos'
   and c.column_name = w.column_name
  order by w.column_name`, [esperadas]);
o.fk_candidato_documentos = await q(`
  select conname, pg_get_constraintdef(oid) def from pg_constraint
   where conrelid='public.candidato_documentos'::regclass`);
o.rec061_ok = await q(`
  select tgname from pg_trigger where not tgisinternal and tgrelid='public.prestadores'::regclass`);
o.policies_rec062b = await q(`
  select policyname from pg_policies where schemaname='public'
    and tablename in ('recrutamento_operacoes','crm_interacoes_prestadores')
   order by policyname`);
o.anon_revoke_status = await q(`
  select c.relname, has_table_privilege('anon', c.oid, 'SELECT') anon_sel,
         has_table_privilege('anon', c.oid, 'INSERT') anon_ins
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r'
     and c.relname in ('candidatos','recrutamento_candidatos','recrutamento_prestadores',
                       'recrutamento_operacoes','candidato_documentos','crm_interacoes_prestadores')
   order by 1`);
o.count_candidatos_anon_policy = await q(`
  select policyname, cmd, qual from pg_policies
   where schemaname='public' and tablename='candidatos' order by policyname`);
console.log(JSON.stringify(o,null,2));
await pool.end();
