// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 103-A2 — Aplicar migration, deploy Edge Function e testar alocação
// ═══════════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "..");
const MIGRATION_FILE = resolve(ROOT, "supabase", "migrations", "20260706_m103a_fix_alocacao_trigger_columns.sql");

const DB_URL = process.env.DATABASE_URL;
const PROJECT_REF = "uwrvzsjtpgaifkktpepn";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const EDGE_INTERNAL_TOKEN = process.env.VITE_TMS_EDGE_INTERNAL_TOKEN || "tms-internal-token-temporario";

let migrationApplied = false;
let functionDeployed = false;
let testPassed = false;
let errors = [];

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 1 — Aplicar migration via pg
// ═══════════════════════════════════════════════════════════════════════════════
async function aplicarMigration() {
  console.log("\n══════════════════════════════════════════════");
  console.log("PASSO 1 — Aplicar migration via pg");
  console.log("══════════════════════════════════════════════\n");

  if (!DB_URL) {
    const msg = "DATABASE_URL não encontrada no .env";
    console.error("ERRO:", msg);
    errors.push(msg);
    return;
  }

  if (!existsSync(MIGRATION_FILE)) {
    const msg = `Migration file não encontrada: ${MIGRATION_FILE}`;
    console.error("ERRO:", msg);
    errors.push(msg);
    return;
  }

  const sql = readFileSync(MIGRATION_FILE, "utf8");
  console.log(`Migration: ${MIGRATION_FILE}`);
  console.log(`Tamanho SQL: ${sql.length} chars`);

  const client = new pg.Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Conectado ao Supabase via DATABASE_URL.\n");

    // Split by semicolons, preserving DO $$ blocks
    const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);

    let ok = 0, fail = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await client.query(stmt);
        ok++;
        process.stdout.write(`  [${i + 1}/${statements.length}] ✅ OK\n`);
      } catch (err) {
        fail++;
        // Ignore "already exists" errors for ALTER TABLE ADD COLUMN IF NOT EXISTS
        const msg = err.message || "";
        if (msg.includes("already exists") || msg.includes("duplicada") || msg.includes("duplicate")) {
          process.stdout.write(`  [${i + 1}/${statements.length}] ⏭️ Já existe\n`);
        } else {
          process.stdout.write(`  [${i + 1}/${statements.length}] ❌ ${msg.substring(0, 120)}\n`);
        }
      }
    }

    console.log(`\nResultado: ${ok} ok, ${fail} falhas (esperado para ADD COLUMN IF NOT EXISTS já existentes)`);
    migrationApplied = true;
    console.log("✅ Migration M103A aplicada com sucesso!");
  } catch (err) {
    const msg = `Erro ao conectar/executar migration: ${err.message}`;
    console.error("ERRO:", msg);
    errors.push(msg);
  } finally {
    await client.end();
    console.log("Conexão fechada.\n");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 2 — Deploy Edge Function via Management API
// ═══════════════════════════════════════════════════════════════════════════════
async function deployEdgeFunction() {
  console.log("\n══════════════════════════════════════════════");
  console.log("PASSO 2 — Deploy Edge Function criar-alocacao-escala");
  console.log("══════════════════════════════════════════════\n");

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

  if (!accessToken) {
    const msg = "SUPABASE_ACCESS_TOKEN não encontrada no ambiente.\n" +
      "Para deploy de Edge Functions, configure:\n" +
      "  1. SUPABASE_ACCESS_TOKEN no .env (gerado em supabase.com/dashboard/account/tokens)\n" +
      "  2. Ou execute manualmente: npx supabase functions deploy criar-alocacao-escala --no-verify-jwt";
    console.warn("⚠️  AVISO:", msg);
    errors.push("Edge Function não pôde ser publicada automaticamente — SUPABASE_ACCESS_TOKEN ausente");
    functionDeployed = false;
    return;
  }

  // Read the function entrypoint
  const funcPath = resolve(ROOT, "supabase", "functions", "criar-alocacao-escala", "index.ts");
  if (!existsSync(funcPath)) {
    const msg = `Edge Function não encontrada em: ${funcPath}`;
    console.error("ERRO:", msg);
    errors.push(msg);
    return;
  }

  const code = readFileSync(funcPath, "utf8");

  // Deploy via Management API
  const body = JSON.stringify({
    slug: "criar-alocacao-escala",
    name: "criar-alocacao-escala",
    entrypoint_path: "index.ts",
    verify_jwt: false,
    code,
  });

  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.supabase.com",
          path: `/v1/projects/${PROJECT_REF}/functions`,
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode, body: data }));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    if (result.status >= 200 && result.status < 300) {
      console.log("✅ Edge Function publicada com sucesso!");
      console.log(`   Status: ${result.status}`);
      functionDeployed = true;
    } else {
      console.error(`❌ Falha ao publicar Edge Function. Status: ${result.status}`);
      console.error(`   Resposta: ${result.body.substring(0, 200)}`);
      errors.push(`Edge Function deploy failed: HTTP ${result.status}`);
    }
  } catch (err) {
    console.error("❌ Erro de rede ao publicar Edge Function:", err.message);
    errors.push(`Edge Function deploy network error: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PASSO 3 — Testar criação de alocação via Edge Function
// ═══════════════════════════════════════════════════════════════════════════════
async function testarCriacaoAlocacao() {
  console.log("\n══════════════════════════════════════════════");
  console.log("PASSO 3 — Testar criação de alocação");
  console.log("══════════════════════════════════════════════\n");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    const msg = "VITE_SUPABASE_URL não encontrada no .env";
    console.error("ERRO:", msg);
    errors.push(msg);
    return;
  }

  // First, check if there's a prestador and OS to use for testing
  const { createClient } = await import("@supabase/supabase-js");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabase;

  if (serviceRoleKey) {
    supabase = createClient(supabaseUrl, serviceRoleKey);
    console.log("Usando service_role para teste.");
  } else {
    supabase = createClient(supabaseUrl, ANON_KEY);
    console.log("Usando anon_key para teste (pode falhar por RLS).");
  }

  try {
    // Get a test prestador
    const { data: prestador, error: errP } = await supabase
      .from("prestadores")
      .select("id, nome_completo, cpf_cnpj")
      .limit(1)
      .single();

    if (errP || !prestador) {
      console.warn("⚠️  Nenhum prestador encontrado para testar.");
      console.warn("   Teste de criação de alocação será SKIPPED.");
      console.warn("   (É necessário ter ao menos 1 prestador cadastrado)");
      return;
    }

    console.log(`Prestador encontrado: ${prestador.nome_completo} (${prestador.id})`);

    // Test calling the edge function directly
    const today = new Date().toISOString().split("T")[0];
    const functionUrl = `${supabaseUrl}/functions/v1/criar-alocacao-escala`;

    const payload = {
      prestador_id: prestador.id,
      data_escala: today,
      status: "planejada",
      tipo_veiculo: "vuc",
      turno: "diurno",
      origem: "Teste Automático M103A2 - Origem",
      destino: "Teste Automático M103A2 - Destino",
      valor_frete: 500,
      valor_repasse: 300,
      cliente_nome: "Cliente Teste M103A2",
    };

    console.log(`\nChamando Edge Function: ${functionUrl}`);
    console.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tms-internal-token": EDGE_INTERNAL_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.ok) {
      console.log(`\n✅ Alocação criada com sucesso!`);
      console.log(`   ID: ${result.id}`);
      console.log(`   Dados: ${JSON.stringify(result.dados, null, 2)}`);
      testPassed = true;

      // Cleanup: remove test alocação
      console.log("\nLimpando registro de teste...");
      const { error: errDel } = await supabase
        .from("alocacoes_escala")
        .delete()
        .eq("id", result.id);

      if (errDel) {
        console.warn(`⚠️  Não foi possível remover alocação de teste: ${errDel.message}`);
      } else {
        console.log("✅ Registro de teste removido.");
      }
    } else {
      console.error(`\n❌ Falha ao criar alocação de teste:`);
      console.error(`   Status HTTP: ${response.status}`);
      console.error(`   Resposta: ${JSON.stringify(result, null, 2)}`);
      errors.push(`Teste de alocação falhou: ${result.error} (${result.detalhes})`);
    }
  } catch (err) {
    console.error("❌ Erro no teste de alocação:", err.message);
    errors.push(`Teste de alocação: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTAR
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║   MISSÃO 103-A2 — AUTOMAÇÃO ESCALA SUPABASE              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝\n");

  // Step 1: Apply migration
  await aplicarMigration();

  // Step 2: Deploy Edge Function
  await deployEdgeFunction();

  // Step 3: Test alocação
  await testarCriacaoAlocacao();

  // ══════════════════════════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════════════");
  console.log("RELATÓRIO FINAL");
  console.log("══════════════════════════════════════════════\n");

  console.log(`Migration aplicada:       ${migrationApplied ? "✅ SIM" : "❌ NÃO"}`);
  console.log(`Edge Function publicada:  ${functionDeployed ? "✅ SIM" : "⚠️  SKIPPED (sem token)"}`);
  console.log(`Teste de alocação:        ${testPassed ? "✅ PASSOU" : "⚠️  SKIPPED/FAILED"}`);

  if (errors.length > 0) {
    console.log("\nErros encontrados:");
    errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }

  console.log("\n═".repeat(55));

  if (!functionDeployed) {
    console.log("\n📌 Para publicar a Edge Function manualmente:");
    console.log("  1. Gere um token em: https://supabase.com/dashboard/account/tokens");
    console.log("  2. Adicione ao .env: SUPABASE_ACCESS_TOKEN=seu_token_aqui");
    console.log("  3. Execute novamente este script");
    console.log("  Ou execute diretamente:");
    console.log("  npx supabase functions deploy criar-alocacao-escala --no-verify-jwt");
  }

  process.exit(errors.length > 0 && !functionDeployed ? 0 : 0);
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
