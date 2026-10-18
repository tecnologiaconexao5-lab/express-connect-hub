import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl:{rejectUnauthorized:false} });
const q = async (s) => (await pool.query(s)).rows;
const o = {};
o.tipos = await q(`select column_name,data_type,udt_name from information_schema.columns where table_name='prestadores' and column_name in ('endereco','metadata','veiculos')`);
o.existe_col_veiculos = await q(`select exists(select 1 from information_schema.columns where table_name='prestadores' and column_name='veiculos') as tem_veiculos`);
// quem linka auth
o.auth_links = await q(`select id, nome_completo, liberado_app, status, origem_cadastro, auth_user_id is not null tem_auth from prestadores where auth_user_id is not null or liberado_app=true order by created_at desc`);
// etapas do canal: quantos candidatos vieram do bridge (recrutamento_prestadores)
o.stages = await q(`select stage, count(*)::int n from recrutamento_candidatos group by 1 order by 2 desc`);
// homologacoes + reservas
o.homologacoes = await q(`select count(*)::int n from homologacoes`);
// app_s6 grants
o.grants_rpc = await q(`select p.proname, r.rolname, p.prosecdef from pg_proc p cross join pg_roles r where p.proname like 'app_s6%' and has_function_privilege(r.oid, p.oid, 'EXECUTE') and r.rolname in ('anon','authenticated','service_role') order by p.proname, r.rolname`);
console.log(JSON.stringify(o,null,2));
await pool.end();
