// Validação READ-ONLY da migration Fase 2A via BEGIN/ROLLBACK.
// NADA é persistido. Seguro para Produção.
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import "dotenv/config";

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error("DATABASE_URL ausente");
  process.exit(1);
}

const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260816_fase2a_faturamento_profissional.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  try {
    await client.query("BEGIN");
    // Valida sintaxe + executa aditivo dentro da transação
    await client.query(sql);
    console.log("SQL OK dentro de BEGIN/ROLLBACK (sintaxe válida).");

    // Valida schema criado
    const tables = await client.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('faturas','fatura_itens') ORDER BY c.relname`);
    console.log("Tabelas criadas:", tables.rows.map(r => r.relname).join(", "));

    const seq = await client.query(`
      SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='S' AND c.relname LIKE 'seq_fatura_%'`);
    console.log("Sequências:", seq.rows.map(r => r.relname).join(", "));

    const col = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='financeiro_receber' AND column_name='fatura_id'`);
    console.log("financeiro_receber.fatura_id:", col.rows.length ? "presente" : "AUSENTE");

    const rpcs = await client.query(`
      SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND proname IN ('f_gerar_numero_fatura','f_emitir_fatura','f_cancelar_fatura')
      ORDER BY proname`);
    console.log("RPCs:", rpcs.rows.map(r => r.proname).join(", "));

    const trig = await client.query(`
      SELECT t.tgname, c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND t.tgname IN ('trg_fatura_itens_recalcular_totais','trg_fatura_itens_anti_duplicidade','trg_fatura_itens_bloqueio_emissao')
      ORDER BY t.tgname`);
    console.log("Triggers:", trig.rows.map(r => `${r.tgname}@${r.relname}`).join(", "));

    const pol = await client.query(`
      SELECT tablename, policyname FROM pg_policies
      WHERE schemaname='public' AND tablename IN ('faturas','fatura_itens') ORDER BY tablename, policyname`);
    console.log("Policies:", pol.rows.map(r => `${r.tablename}:${r.policyname}`).join(", "));
  } catch (err) {
    console.error("ERRO na validação:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    process.exit(1);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

main();