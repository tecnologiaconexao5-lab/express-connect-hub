const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  console.log("bucket:", (await c.query("select id, public from storage.buckets where id='driver-evidence'")).rows);
  console.log("policies:", (await c.query("select policyname, cmd, roles::text, qual from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%driver-evidence%' or policyname like '%driver%')")).rows);
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
