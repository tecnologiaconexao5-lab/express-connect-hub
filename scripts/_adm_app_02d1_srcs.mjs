import pg from "pg"; import fs from "node:fs";
const cs=fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c=new pg.Client({connectionString:cs,ssl:{rejectUnauthorized:false}}); await c.connect();
const a={};
a.candidato_documentos=(await c.query(`select id, tipo, arquivo_url, created_at from candidato_documentos order by created_at`)).rows;
a.candidatos_cols=(await c.query(`select column_name from information_schema.columns where table_schema='public' and table_name='candidatos' order by ordinal_position`)).rows.map(r=>r.column_name);
a.candidatos_rows=(await c.query(`select * from candidatos limit 5`)).rows;
console.log(JSON.stringify(a,null,1));
await c.end();
