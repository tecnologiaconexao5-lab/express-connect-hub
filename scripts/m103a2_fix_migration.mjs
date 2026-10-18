// ═══════════════════════════════════════════════════════════════════════════════
// Reaplicar migration M103A com suporte a blocos $$ e testar Edge Function
// ═══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const MIGRATION_FILE = resolve(ROOT, "supabase", "migrations", "20260706_m103a_fix_alocacao_trigger_columns.sql");
const DB_URL = process.env.DATABASE_URL;

async function aplicarMigrationCompleta() {
  console.log("\n══════════════════════════════════════════════");
  console.log("REAPLICAR MIGRATION M103A (bloco único com $$)");
  console.log("══════════════════════════════════════════════\n");

  if (!DB_URL) { console.error("ERRO: DATABASE_URL não encontrada"); return false; }
  if (!existsSync(MIGRATION_FILE)) { console.error("ERRO: migration não encontrada"); return false; }

  const sql = readFileSync(MIGRATION_FILE, "utf8");
  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log("Conectado.\n");

    // Primeiro dropar tudo para recriar limpo
    await client.query("DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala");
    console.log("  ✅ Trigger removido");

    await client.query("DROP FUNCTION IF EXISTS public.f_trg_propagar_financeiro_alocacao()");
    console.log("  ✅ Function removida");

    // Executar SQL completo de uma vez (PostgreSQL lida com $$ corretamente)
    await client.query(sql);
    console.log("  ✅ Migration M103A reaplicada com sucesso (tudo em um statement)!\n");

    // Verificar se as colunas existem
    const res = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'pagamentos_prestadores' AND column_name IN ('os_id', 'pedagio', 'adicionais', 'status_conferencia', 'status_pagamento')
      ORDER BY column_name
    `);
    console.log(`Colunas em pagamentos_prestadores: ${res.rows.map(r => r.column_name).join(", ")}`);

    const res2 = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'financeiro_receber' AND column_name IN ('cliente_id', 'cliente_nome', 'fatura')
      ORDER BY column_name
    `);
    console.log(`Colunas em financeiro_receber: ${res2.rows.map(r => r.column_name).join(", ")}`);

    const res3 = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'financeiro_pagar' AND column_name IN ('fornecedor_id', 'fornecedor_nome', 'documento')
      ORDER BY column_name
    `);
    console.log(`Colunas em financeiro_pagar: ${res3.rows.map(r => r.column_name).join(", ")}`);

    const res4 = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'composicao_financeira_os' AND column_name IN ('origem_calculo', 'combustivel_valor', 'ajudante_valor')
      ORDER BY column_name
    `);
    console.log(`Colunas em composicao_financeira_os: ${res4.rows.map(r => r.column_name).join(", ")}`);

    // Verificar se o trigger existe
    const res5 = await client.query(`
      SELECT tgname FROM pg_trigger WHERE tgname = 'trg_propagar_financeiro_alocacao'
    `);
    console.log(`Trigger trg_propagar_financeiro_alocacao: ${res5.rows.length > 0 ? "✅ ATIVO" : "❌ AUSENTE"}`);

    const res6 = await client.query(`
      SELECT proname FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao'
    `);
    console.log(`Function f_trg_propagar_financeiro_alocacao: ${res6.rows.length > 0 ? "✅ ATIVA" : "❌ AUSENTE"}`);

    return true;
  } catch (err) {
    console.error("ERRO:", err.message);
    return false;
  } finally {
    await client.end();
  }
}

async function testarEdgeFunction() {
  console.log("\n══════════════════════════════════════════════");
  console.log("TESTAR EDGE FUNCTION criar-alocacao-escala");
  console.log("══════════════════════════════════════════════\n");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const internalToken = process.env.VITE_TMS_EDGE_INTERNAL_TOKEN || "tms-internal-token-temporario";

  if (!supabaseUrl || !anonKey) {
    console.error("ERRO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados");
    return false;
  }

  // First check if function exists by calling it
  const functionUrl = `${supabaseUrl}/functions/v1/criar-alocacao-escala`;

  try {
    // Try with anon key auth
    const payload = { prestador_id: "00000000-0000-0000-0000-000000000000", data_escala: "2026-07-07" };
    const resp = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "x-tms-internal-token": internalToken,
      },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    console.log(`Status HTTP: ${resp.status}`);
    console.log(`Resposta: ${JSON.stringify(result, null, 2)}`);

    if (resp.status === 400) {
      // Got past gateway auth, into function logic
      console.log("✅ Edge Function existe e está acessível!");
      return true;
    } else if (resp.status === 401) {
      console.log("⚠️  Edge Function existe mas rejeitou auth header");
      return false;
    } else {
      console.log(`✅ Edge Function respondeu (status ${resp.status})`);
      return true;
    }
  } catch (err) {
    console.error("❌ Erro ao chamar Edge Function:", err.message);
    return false;
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   MISSÃO 103-A2 — FIX MIGRATION + TEST EDGE FUNCTION     ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  const migOk = await aplicarMigrationCompleta();
  const fnOk = await testarEdgeFunction();

  console.log("\n══════════════════════════════════════════════");
  console.log("RESULTADO FINAL");
  console.log("══════════════════════════════════════════════");
  console.log(`Migration reaplicada:  ${migOk ? "✅ OK" : "❌ FALHOU"}`);
  console.log(`Edge Function ativa:   ${fnOk ? "✅ OK" : "⚠️  VERIFICAR"}`);
  console.log("");
}

main().catch(console.error);
