import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260705_m84b_fix_rls_anon.sql"),
  "utf8"
);
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(sql);
await client.end();
console.log("✅ RLS fix applied!");
