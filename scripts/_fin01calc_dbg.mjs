import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const id = "15a09ae5-9bd4-4da9-ad48-6a86c9524feb";
for (const t of ["financeiro_pagar", "pagamentos_prestadores", "financeiro_receber"]) {
  const r = await c.query(`select * from ${t} where os_id::text = $1`, [id]);
  console.log(t, "->", r.rows.length, JSON.stringify(r.rows));
}
await c.end();
