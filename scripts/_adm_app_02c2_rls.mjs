import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({connectionString:cs, ssl:{rejectUnauthorized:false}});
await c.connect();
const r = await c.query(`select relname, relrowsecurity, relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname = any($1) order by relname`,
 [["prestadores","recrutamento_candidatos","recrutamento_prestadores","recrutamento_operacoes","candidato_documentos","candidatos","liberado_app_audit","crm_interacoes_prestadores"]]);
console.log(JSON.stringify(r.rows,null,0).replace(/},{/g,"}\n{"));
await c.end();
