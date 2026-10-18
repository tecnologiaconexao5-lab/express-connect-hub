import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  `select name, created_at from storage.objects
    where bucket_id='driver-evidence' order by created_at desc limit 12`
);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
