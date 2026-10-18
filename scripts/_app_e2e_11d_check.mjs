import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const r = await p.query("select id, public from storage.buckets where id in ('driver-evidence','comprovantes-entrega') order by id");
console.log(JSON.stringify(r.rows, null, 2));
await p.end();
