import fs from "node:fs";
import { Client } from "pg";
const DB = (fs.readFileSync(".env","utf8").match(/^DATABASE_URL=(.+)$/m)||[])[1];
const pg = new Client({ connectionString: DB.trim() });
await pg.connect();
const r = (await pg.query(`SELECT table_name, view_definition FROM information_schema.views
  WHERE table_schema='public' AND table_name IN ('vw_relatorio_pagamento_prestador','vw_relatorio_pagamento_detalhado')`)).rows;
for (const v of r) console.log("\n===== " + v.table_name + " =====\n" + v.view_definition);
const t = (await pg.query(`SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name LIKE '%conta%corrente%'`)).rows;
console.log("\nVIEWS CC:", JSON.stringify(t));
await pg.end();
