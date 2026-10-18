// Aplica a migration Fase 2A (aditiva) em transação única e valida schema.
// Nenhum dado existente é criado/alterado/apagado.
import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import "dotenv/config";

const connStr = process.env.DATABASE_URL;
if (!connStr) { console.error("DATABASE_URL ausente"); process.exit(1); }

const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260816_fase2a_faturamento_profissional.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migration Fase 2A aplicada com sucesso (transação COMMIT).");

    // Validação apenas de schema/metadata (read-only)
    const tables = await client.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('faturas','fatura_itens') ORDER BY c.relname`);
    console.log("Tabelas:", tables.rows.map(r => r.relname).join(", "));

    const col = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='financeiro_receber' AND column_name='fatura_id'`);
    console.log("financeiro_receber.fatura_id:", col.rows.length ? "presente" : "AUSENTE");

    const rpcs = await client.query(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND proname IN ('f_gerar_numero_fatura','f_emitir_fatura','f_cancelar_fatura') ORDER BY proname`);
    console.log("RPCs:", rpcs.rows.map(r => r.proname).join(", "));

    const contagens = await client.query(`SELECT (SELECT count(*) FROM public.faturas) AS faturas, (SELECT count(*) FROM public.fatura_itens) AS itens`);
    console.log("Registros (deve ser 0):", JSON.stringify(contagens.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERRO ao aplicar:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}
main();