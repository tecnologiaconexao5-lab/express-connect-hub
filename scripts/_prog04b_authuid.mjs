import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const r = await p.query(`select n.nspname, p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='uid' and n.nspname='auth'`);
console.log(r.rows.map((x) => x.def).join("\n---\n"));
// also a real tenant_usuario user_id to simulate
const u = await p.query(`select user_id, tenant_id, papel from tenant_usuarios limit 3`);
console.log(JSON.stringify(u.rows, null, 2));
await p.end();
