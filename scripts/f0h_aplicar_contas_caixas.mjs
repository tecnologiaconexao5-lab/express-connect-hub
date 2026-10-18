// F0-H — Aplica migration mínima de Contas & Caixas (aditiva, transacional).
// Confere project ref antes de aplicar. SEM reset/drop/delete de dados.
// Uso: node scripts/f0h_aplicar_contas_caixas.mjs
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
config({ path: path.join(root, ".env") });

const MIG = path.join(root, "supabase", "migrations", "20260819_f0h_contas_caixas.sql");
const REF_EXIGIDO = "uwrvzsjtpgaifkktpepn";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const ref = (supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1];
if (ref !== REF_EXIGIDO) {
  console.error(`ABORT: project ref esperado ${REF_EXIGIDO}, encontrado '${ref || "?"}'. PARAR.`);
  process.exit(2);
}
console.log(`[0] Project ref OK: ${ref}`);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const sql = fs.readFileSync(MIG, "utf8");

// Pré-cheque: tabela já existe? (migration é IF NOT EXISTS — segura de qualquer forma)
const { rows } = await client.query(
  `SELECT count(*)::int AS total FROM information_schema.tables
     WHERE table_schema='public' AND table_name='contas_financeiras'`
);
console.log(`[1] contas_financeiras existe antes: ${rows[0].total > 0}`);

await client.query("BEGIN");
try {
  await client.query(sql);
  await client.query("COMMIT");
  console.log("[2] Migration aplicada (COMMIT OK).");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ABORT: rollback —", e.message);
  process.exit(2);
}

// Verificação read-only
const tab = await client.query(
  `SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contas_financeiras' ORDER BY ordinal_position`
);
console.log("[3] contas_financeiras colunas:", tab.rows.map((r) => r.column_name).join(", "));

const uniq = await client.query(
  `SELECT indexname FROM pg_indexes WHERE tablename='contas_financeiras' AND indexname='uq_contas_financeiras_principal'`
);
console.log("[4] índice principal único:", !!uniq.rows[0]);

const rls = await client.query(
  `SELECT p.polname FROM pg_policy p
     JOIN pg_class c ON c.oid = p.polrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='contas_financeiras'
    ORDER BY p.polname`
);
console.log("[5] policies:", rls.rows.map((r) => r.polname).join(", "));

const baixa = await client.query(
  `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='financeiro_baixas' AND column_name='conta_financeira_id'`
);
console.log("[6] financeiro_baixas.conta_financeira_id:", !!baixa.rows[0]);

await client.end();
