import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl:{rejectUnauthorized:false} });
const q = async (s) => (await pool.query(s)).rows;
const o = {};
o.app_s6_todas = await q(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'app_s6%' order by 1`);
o.resolver_login_legado = await q(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('app_s6_resolver_login_legado','app_s6_resolver_identidade_legada')`);
// colunas com PII ligeis por qualquer authenticated em recrutamento_prestadores
o.pii_recrut_prestadores = await q(`select column_name from information_schema.columns where table_schema='public' and table_name='recrutamento_prestadores' and column_name in ('cpf_cnpj','rg','data_nascimento','contatos','endereco','documentos')`);
// quantos prestadores existem em recrutamento_prestadores com cpf
o.amostra_rp = await q(`select count(*)::int total, count(cpf_cnpj) com_cpf, count(documentos) com_docs from recrutamento_prestadores`);
// candidatos: anon pode realmente ler?
o.candidatos_count = await q(`select count(*)::int n from candidatos`);
// prestadores: policy names again for report
o.policies_prestadores_nomes = await q(`select policyname, cmd, with_check from pg_policies where schemaname='public' and tablename='prestadores' order by policyname`);
console.log(JSON.stringify(o,null,2));
await pool.end();
