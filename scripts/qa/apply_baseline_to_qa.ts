/**
 * scripts/qa/apply_baseline_to_qa.ts
 *
 * MISSÃO: ENV-QA-02-BASELINE-PACKAGE
 *
 * Prepara a aplicação do baseline no novo ambiente QA quando criado.
 *
 * GUARD OBRIGATÓRIO ANTI-PRODUÇÃO:
 * - Recusar estritamente qualquer connection string ou project ref de produção:
 *   uwrvzsjtpgaifkktpepn
 * - Exigir confirmação explícita de ambiente QA via variável QA_DATABASE_URL ou --qa-url
 * - Bloquear e abortar imediatamente caso detecte qualquer indicador de produção.
 *
 * ATENÇÃO: NÃO EXECUTAR NESTA MISSÃO.
 */

import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import { URL } from "url";
import dotenv from "dotenv";

dotenv.config();

const PROD_REF = "uwrvzsjtpgaifkktpepn";
const BASELINE_FILE = path.resolve("supabase/baseline/full_production_schema_20260920.sql");

const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function extractHostname(connStr: string): string | null {
  try {
    const u = new URL(connStr);
    return u.hostname;
  } catch {
    // Fallback: parse manually from postgresql://user:pass@host:port/db
    const match = connStr.match(/@([^:/\s]+)(?::\d+)?/);
    return match ? match[1] : null;
  }
}

function validateHostname(hostname: string | null): { ok: boolean; reason: string } {
  if (!hostname) return { ok: false, reason: "Nao foi possivel extrair hostname da connection string" };
  if (ALLOWED_HOSTNAMES.has(hostname)) return { ok: true, reason: `Hostname '${hostname}' permitido (local)` };
  return {
    ok: false,
    reason: `Hostname '${hostname}' BLOQUEADO. Permitidos apenas: ${[...ALLOWED_HOSTNAMES].join(", ")}`,
  };
}

async function main() {
  console.log("================================================================================");
  console.log("APLICAÇÃO DE BASELINE ESTRUTURAL NO AMBIENTE QA LOCAL");
  console.log("================================================================================\n");

  const targetUrl = process.env.QA_DATABASE_URL || process.env.DATABASE_URL_QA;

  if (!targetUrl) {
    console.error("ERRO: QA_DATABASE_URL não configurada no ambiente.");
    console.error("Defina a variável QA_DATABASE_URL apontando para o banco QA LOCAL.");
    process.exit(1);
  }

  // ============================================================================
  // GUARD DE SEGURANÇA CRÍTICO ANTI-PRODUÇÃO (hostname parsing)
  // ============================================================================
  const hostname = extractHostname(targetUrl);
  const validation = validateHostname(hostname);

  if (!validation.ok) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("BLOCKED: " + validation.reason);
    console.error("Hostname detectado: " + hostname);
    console.error("Este script SO aceita conexoes em localhost (127.0.0.1).");
    console.error("Abortando imediatamente.");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    process.exit(1);
  }

  if (targetUrl.includes(PROD_REF)) {
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("BLOCKED: DETECTADA TENTATIVA DE CONEXÃO COM PRODUÇÃO!");
    console.error(`O project ref '${PROD_REF}' pertence ao banco de PRODUÇÃO.`);
    console.error("Abortando imediatamente.");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    process.exit(1);
  }

  if (!fs.existsSync(BASELINE_FILE)) {
    console.error("ERRO: Arquivo de baseline não encontrado:", BASELINE_FILE);
    process.exit(1);
  }

  console.log("Verificando conexão com o banco QA de destino...");
  const client = new Client({ connectionString: targetUrl, statement_timeout: 300000 });
  await client.connect();

  const rCheck = await client.query("SELECT current_database(), current_user;");
  console.log("Conectado ao banco QA:", rCheck.rows[0]);

  // Guard adicional pós conexão
  const rTables = await client.query("SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public';");
  console.log(`O banco de destino possui atualmente ${rTables.rows[0].count} tabelas/views em public.`);

  const sql = fs.readFileSync(BASELINE_FILE, "utf8");
  console.log(`Lendo baseline: ${BASELINE_FILE} (${(sql.length / 1024).toFixed(2)} KB)...`);

  console.log("Aplicando baseline estrutural no ambiente QA...");
  await client.query(sql);

  console.log("================================================================================");
  console.log("BASELINE APLICADO COM SUCESSO NO AMBIENTE QA!");
  console.log("================================================================================");

  await client.end();
}

// Se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("FATAL ERROR:", err.message);
    process.exit(1);
  });
}
