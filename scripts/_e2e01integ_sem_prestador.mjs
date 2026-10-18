import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  `select status, (ordem_servico_id is not null) tem_os,
          count(*)::int n, min(data_escala)::date d0, max(data_escala)::date d1
     from alocacoes_escala where prestador_id is null
    group by 1,2 order by n desc`);
console.log("Alocacoes SEM prestador_id:", JSON.stringify(r.rows, null, 2));
const tot = await c.query(`select count(*)::int n from alocacoes_escala where prestador_id is null`).rows[0].n;
console.log("total sem prestador_id:", tot);
await c.end();
