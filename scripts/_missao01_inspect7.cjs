const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const paths = ['a5e51631-5ed8-430d-9041-4b185c03d821/reimbursement/2026/08/07/fd611be0-7890-4770-93ba-4ef1c04b5773.jpg'];
  for (const p of paths) {
    const r = (await c.query("select bucket_id, name from storage.objects where name=$1", [p])).rows;
    console.log(p, JSON.stringify(r));
  }
  const like = (await c.query("select bucket_id, name from storage.objects where name like '%reimbursement%' limit 10")).rows;
  console.log("like:", JSON.stringify(like, null, 2));
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
