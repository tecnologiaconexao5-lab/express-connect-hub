import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select bucket_id, name from storage.objects
  where lower(name) like '%gap%' or lower(name) like '%purge%' or lower(name) like '%e2e11%'
     or lower(name) like '%teste02d2%' or lower(name) like '%adm02d2%'
  order by bucket_id, name`);
console.log("total:", r.rows.length);
for (const x of r.rows) console.log(x.bucket_id, "|", x.name);
await c.end();
