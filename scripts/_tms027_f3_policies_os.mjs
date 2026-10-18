import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const r = await c.query(
    "select policyname, cmd, qual, with_check, roles from pg_policies where tablename = 'ordens_servico' order by cmd"
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
