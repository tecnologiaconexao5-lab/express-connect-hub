import pg from "pg"; import fs from "node:fs";
const cs=fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c=new pg.Client({connectionString:cs,ssl:{rejectUnauthorized:false}}); await c.connect();
const r=await c.query(`select column_name,data_type from information_schema.columns where table_schema='public' and table_name='candidato_documentos' order by ordinal_position`);
console.log(JSON.stringify(r.rows));
await c.end();
