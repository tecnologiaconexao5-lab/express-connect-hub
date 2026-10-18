import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.PROJECT_DIR;
if (PROJECT) config({ path: path.resolve(PROJECT, ".env") });

import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const r = await client.query(
  `SELECT column_name, data_type, is_nullable, COALESCE(column_default,'') AS d
   FROM information_schema.columns WHERE table_schema='auth' AND table_name='users'
   ORDER BY ordinal_position`
);
console.table(r.rows);

const trg = await client.query(
  `SELECT tgname FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal`
);
console.log("TRIGGERS auth.users:", trg.rows.map(t=>t.tgname).join(", ") || "nenhum");

await client.end();
