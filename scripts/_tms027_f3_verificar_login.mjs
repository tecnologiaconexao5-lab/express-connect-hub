import "dotenv/config";
import pg from "pg";

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();
  const r = await c.query(
    "select id, email, raw_user_meta_data, created_at from auth.users where id = $1",
    ["a5e51631-5ed8-430d-9041-4b185c03d821"]
  );
  console.log("AUTH USER:", JSON.stringify(r.rows, null, 2));
  const p = await c.query(
    "select id, email, telefone, auth_user_id from prestadores where id = $1",
    ["e6646799-fbac-453e-a3ef-afdfc01a7085"]
  );
  console.log("PRESTADOR:", JSON.stringify(p.rows, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
