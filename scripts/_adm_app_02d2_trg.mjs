import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select proname, left(prosrc, 1200) s from pg_proc
  where proname in ('f_bridge_prestador_para_recrutamento','fn_guardar_privilegio_prestador')`);
for (const row of r.rows) console.log("=== " + row.proname + "\n" + row.s + "\n");
await c.end();
