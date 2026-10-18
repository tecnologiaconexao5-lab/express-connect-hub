// F0-K — Aplica migration de Recibos (aditiva). Confere project ref.
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
config({ path: path.join(root, ".env") });

const MIG = path.join(root, "supabase", "migrations", "20260819_f0k_recibos.sql");
const REF_EXIGIDO = "uwrvzsjtpgaifkktpepn";
const ref = (process.env.VITE_SUPABASE_URL || "").match(/https:\/\/([^.]+)\.supabase\.co/) || [];
if (ref[1] !== REF_EXIGIDO) {
  console.error(`ABORT: project ref esperado ${REF_EXIGIDO}, encontrado '${ref[1] || "?"}'.`);
  process.exit(2);
}
console.log(`[0] Project ref OK: ${ref[1]}`);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const sql = fs.readFileSync(MIG, "utf8");
await client.query("BEGIN");
try {
  await client.query(sql);
  await client.query("COMMIT");
  console.log("[1] Migration aplicada (COMMIT OK).");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ABORT: rollback —", e.message);
  process.exit(2);
}

const tab = await client.query(
  `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recibos' ORDER BY ordinal_position`
);
console.log("[2] recibos colunas:", tab.rows.map((r) => r.column_name).join(", "));
const uniq = await client.query(
  `SELECT indexname FROM pg_indexes WHERE tablename='recibos' AND indexname='uq_recibos_numero'`
);
console.log("[3] índice número único:", !!uniq.rows[0]);
const rls = await client.query(
  `SELECT p.polname FROM pg_policy p
     JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='recibos' ORDER BY p.polname`
);
console.log("[4] policies:", rls.rows.map((r) => r.polname).join(", "));

await client.end();
