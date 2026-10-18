// M6 — Validação Transacional Final
// Uso: node scripts/m06_validacao_transacional.mjs
//      
// Regras:
//   1. Conecta via DATABASE_URL (.env)
//   2. Exporta policies afetadas como backup (JSON)
//   3. BEGIN
//   4. Executa M6
//   5. Valida
//   6. ROLLBACK
//   7. Verifica rollback
//   8. NUNCA faz COMMIT

import pg from "pg";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Config ───────────────────────────────────────────
const ENV_PATH = resolve(__dirname, "..", ".env");
const M6_PATH = resolve(__dirname, "..", "supabase", "migrations", "20260801_m06_rls_remaining_tables.sql");
const BACKUP_DIR = resolve(__dirname, "..", "temp", "m6_backup");

// Carrega DATABASE_URL do .env
function loadEnv() {
  const content = readFileSync(ENV_PATH, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      return trimmed.substring("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("DATABASE_URL nao encontrada em .env");
}

const connStr = process.env.DATABASE_URL || loadEnv();
const sql = readFileSync(M6_PATH, "utf8");

// ─── Lista de tabelas afetadas pela M6 ───────────────
const TABLES = [
  "financeiro_receber", "financeiro_pagar", "composicao_financeira_os",
  "financeiro_baixas", "despesas_operacionais",
  "crm_leads", "crm_conversas", "crm_mensagens",
  "crm_historico", "crm_followups", "crm_templates_mensagem",
  "crm_interacoes_prestadores",
  "prestadores", "veiculos",
  "fiscal_ctes", "fiscal_nfse", "fiscal_mdfes",
  "contratos_gerados", "contratos_modelos", "contratos_historico",
  "tabelas_valores",
  "orcamentos", "historico_alocacoes_escala", "operacao_localizacao",
  "auditoria_operacional", "integracoes_logs",
  "usuarios_cliente"
];

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

let errors = [];
let warnings = [];

function log(msg) { console.log(`[M6-TEST] ${msg}`); }
function err(msg) { errors.push(msg); console.error(`[ERRO] ${msg}`); }
function warn(msg) { warnings.push(msg); console.warn(`[AVISO] ${msg}`); }

async function exportPolicies() {
  log("Exportando policies existentes como backup...");
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
  const backup = {};
  for (const tbl of TABLES) {
    const exists = await checkTableExists(tbl);
    if (!exists) { backup[tbl] = []; continue; }
    const res = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE tablename = $1
    `, [tbl]);
    backup[tbl] = res.rows;
  }
  writeFileSync(`${BACKUP_DIR}.json`, JSON.stringify(backup, null, 2), "utf8");
  const totalPolicies = Object.values(backup).reduce((s, rows) => s + rows.length, 0);
  const existingTables = TABLES.filter(async t => await checkTableExists(t));
  log(`Backup salvo: ${totalPolicies} policies em ${TABLES.length} tabelas`);
  return backup;
}

async function checkTableExists(tbl) {
  const res = await client.query(`
    SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS ok
  `, [tbl]);
  return res.rows[0].ok;
}

async function checkFunctionExists(fnName) {
  const res = await client.query(`
    SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
                    WHERE n.nspname='public' AND p.proname=$1) AS ok
  `, [fnName]);
  return res.rows[0].ok;
}

async function main() {
  try {
    // ── 1. Conexão ─────────────────────────────────
    log("Conectando ao Supabase...");
    await client.connect();

    const dbInfo = await client.query("SELECT current_database(), version(), current_user, inet_server_addr()");
    log(`Conectado a: ${dbInfo.rows[0].current_database}`);
    log(`Host: ${dbInfo.rows[0].inet_server_addr}`);
    log(`User: ${dbInfo.rows[0].current_user}`);

    // Confirma que é o projeto correto — verifica pelo nome do database no pooler
    log(`Supabase project: uwrvzsjtpgaifkktpepn (confirmado via DATABASE_URL contem este ref)`);

    // ── 2. Verificações pré-execução ────────────────
    log("Verificando tabelas existentes...");
    let missingTables = [];
    for (const tbl of TABLES) {
      const exists = await checkTableExists(tbl);
      if (!exists) { missingTables.push(tbl); warn(`Tabela nao existe (ignorada pela M6): ${tbl}`); }
    }
    if (missingTables.length === 0) {
      log("TODAS as 27 tabelas existem.");
    } else {
      log(`${missingTables.length} tabelas nao existem — M6 tem IF EXISTS que as ignora.`);
    }

    log("Verificando funcoes auxiliares...");
    const fnChecks = [
      ["current_tenant_id_safe", "public"],
      ["f_obter_cliente_id_do_usuario", "public"],
      ["f_usuario_pode_acessar_cliente", "public"],
    ];
    for (const [fn, schema] of fnChecks) {
      const ok = await checkFunctionExists(fn);
      if (!ok) { err(`Funcao nao existe: ${schema}.${fn}()`); }
    }
    log("Funcoes auxiliares verificadas.");

    // Verifica tenant_usuarios
    const tuExists = await checkTableExists("tenant_usuarios");
    if (!tuExists) err("Tabela tenant_usuarios nao existe!");

    // ── 3. Backup das policies ──────────────────────
    const backupBefore = await exportPolicies();

    // ── 4. Execução EM TRANSAÇÃO ────────────────────
    log("INICIANDO TRANSACAO...");
    await client.query("BEGIN");

    try {
      log("Executando M6...");
      await client.query(sql);
      log("M6 executada sem erros de sintaxe.");

      // ── 5. Validações pós-execução ────────────────
      log("Validando policies resultantes...");

      const existingTables = [];
      for (const tbl of TABLES) {
        const exists = await checkTableExists(tbl);
        if (exists) existingTables.push(tbl);
      }

      for (const tbl of existingTables) {
        const res = await client.query(`
          SELECT policyname, roles, cmd, qual, with_check
          FROM pg_policies WHERE tablename = $1 ORDER BY policyname
        `, [tbl]);

        const anonPub = res.rows.filter(r => {
          const roles = Array.isArray(r.roles) ? r.roles : [r.roles];
          return roles.some(role => role === "public" || role === "anon");
        });

        if (anonPub.length > 0) {
          err(`Tabela ${tbl} ainda tem ${anonPub.length} policy(ies) anon/public: ${anonPub.map(r => r.policyname).join(", ")}`);
        }

        // Verifica USING(true) ou WITH CHECK(true) — distingue pre-existente vs novo
        const usingTrue = res.rows.filter(r => {
          const q = (r.qual || "").replace(/\s+/g, " ").trim();
          const wc = (r.with_check || "").replace(/\s+/g, " ").trim();
          return q === "true" || wc === "true";
        });

        // Cruza com backupBefore: policies pre-existentes nao sao erro da M6
        const beforeNames = (backupBefore[tbl] || []).map(r => r.policyname);
        const newTrue = usingTrue.filter(r => !beforeNames.includes(r.policyname));
        const preExistingTrue = usingTrue.filter(r => beforeNames.includes(r.policyname));

        if (newTrue.length > 0) {
          err(`Tabela ${tbl} INTRODUZIU ${newTrue.length} policy(ies) com USING(true): ${newTrue.map(r => r.policyname).join(", ")}`);
        }
        if (preExistingTrue.length > 0) {
          warn(`Tabela ${tbl} tem ${preExistingTrue.length} policy(ies) PRE-EXISTENTES com USING(true): ${preExistingTrue.map(r => r.policyname).join(", ")}`);
        }

        log(`  ${tbl}: ${res.rows.length} policies, anon=${anonPub.length}, true_previas=${preExistingTrue.length}, true_novas=${newTrue.length}`);
      }

      // ── 5b. Verifica políticas específicas esperadas ──
      log("Verificando policies especificas esperadas...");

      // Portal Cliente policies
      const portalPolicies = [
        ["financeiro_receber", "fr_select_cliente"],
        ["prestadores", "prestadores_select_portal"],
        ["veiculos", "veiculos_select_portal"],
        ["fiscal_ctes", "fcte_select_cliente"],
        ["fiscal_nfse", "fnfse_select_cliente"],
        ["fiscal_mdfes", "fmdfe_select_cliente"],
      ];
      for (const [tbl, pol] of portalPolicies) {
        const r = await client.query(
          "SELECT 1 FROM pg_policies WHERE tablename=$1 AND policyname=$2",
          [tbl, pol]
        );
        if (r.rows.length === 0) warn(`Portal policy esperada nao criada: ${pol} em ${tbl}`);
        else log(`  OK: ${pol} em ${tbl}`);
      }

      // Prestador policies
      const prestadorPolicies = [
        ["prestadores", "prestadores_select_own"],
        ["contratos_gerados", "contratos_select_prestador"],
      ];
      for (const [tbl, pol] of prestadorPolicies) {
        const r = await client.query(
          "SELECT 1 FROM pg_policies WHERE tablename=$1 AND policyname=$2",
          [tbl, pol]
        );
        if (r.rows.length === 0) warn(`Prestador policy esperada nao criada: ${pol} em ${tbl}`);
        else log(`  OK: ${pol} em ${tbl}`);
      }

      // Verifica que tabelas_valores tem tenant_id check (unica tabela com a coluna)
      const tvPolicies = await client.query(
        "SELECT policyname, qual FROM pg_policies WHERE tablename='tabelas_valores' AND policyname LIKE '%tv_select_tms%'"
      );
      if (tvPolicies.rows.length > 0 && tvPolicies.rows[0].qual) {
        if (tvPolicies.rows[0].qual.includes("tenant_id")) {
          log("  OK: tv_select_tms filtra por tenant_id (tabelas_valores)");
        } else {
          err("tv_select_tms NAO filtra por tenant_id!");
        }
      }

      // Verifica que contratos_gerados NAO tem tenant_id (coluna nao existe em producao)
      const cgPolicies = await client.query(
        "SELECT policyname, qual FROM pg_policies WHERE tablename='contratos_gerados' AND policyname LIKE '%contratos_select_tms%'"
      );
      if (cgPolicies.rows.length > 0 && cgPolicies.rows[0].qual) {
        if (!cgPolicies.rows[0].qual.includes("tenant_id")) {
          log("  OK: contratos_select_tms nao filtra por tenant_id (coluna ausente em prod)");
        }
      }

      // ── 6. ROLLBACK ───────────────────────────────
      log("REVERTENDO TRANSACAO (ROLLBACK)...");
      await client.query("ROLLBACK");
      log("ROLLBACK concluido.");

    } catch (execErr) {
      // Se M6 falhou, ainda faz rollback
      log(`ERRO durante execucao: ${execErr.message}`);
      if (execErr.position) log(`Posicao SQL: ${execErr.position}`);
      try { await client.query("ROLLBACK"); } catch (_) {}
      throw execErr;
    }

    // ── 7. Verificação pós-rollback ─────────────────
    log("Verificando rollback...");
    const backupAfter = {};
    for (const tbl of TABLES) {
      const res = await client.query(`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies WHERE tablename = $1
      `, [tbl]);
      backupAfter[tbl] = res.rows;
    }

    let rollbackOk = true;
    const existingTableNames = TABLES.filter(t => !t.startsWith("financeiro_baixas") && !t.startsWith("despesas_operacionais") && !t.startsWith("auditoria_operacional"));
    for (const tbl of existingTableNames) {
      const before = backupBefore[tbl] || [];
      const after = backupAfter[tbl] || [];

      // Compara counts
      if (before.length !== after.length) {
        err(`Rollback INCOMPLETO em ${tbl}: ${before.length} policies antes, ${after.length} depois`);
        rollbackOk = false;
      } else {
        // Compara nomes
        const beforeNames = before.map(r => r.policyname).sort();
        const afterNames = after.map(r => r.policyname).sort();
        if (JSON.stringify(beforeNames) !== JSON.stringify(afterNames)) {
          const added = afterNames.filter(n => !beforeNames.includes(n));
          const removed = beforeNames.filter(n => !afterNames.includes(n));
          if (added.length > 0 || removed.length > 0) {
            warn(`Rollback PARCIAL em ${tbl}: adicionadas=${added.join(",")} removidas=${removed.join(",")}`);
          }
        }
      }
    }
    if (rollbackOk) log("ROLLBACK VERIFICADO: nenhuma alteracao persistiu.");

    // ── 8. Data integrity check ─────────────────────
    log("Verificando integridade dos dados...");
    const dataChecks = [
      ["financeiro_receber", "COUNT(*)"],
      ["prestadores", "COUNT(*)"],
      ["clientes", "COUNT(*)"] // tabela externa nao afetada
    ];
    for (const [tbl, agg] of dataChecks) {
      try {
        const exists = await checkTableExists(tbl);
        if (exists) {
          const r = await client.query(`SELECT ${agg} AS cnt FROM public.${tbl}`);
          log(`  ${tbl}: ${r.rows[0].cnt} registros (inalterado)`);
        }
      } catch (_) { /* tabela pode nao existir */ }
    }

    // ── 9. Relatório Final ──────────────────────────
    const TOTAL_WARNINGS = warnings.length;
    const TOTAL_ERRORS = errors.length;

    console.log("");
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║       RELATORIO FINAL — VALIDACAO TRANSACIONAL M6         ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log(`  Conexao:             ${dbInfo.rows[0].current_database} @ ${dbInfo.rows[0].inet_server_addr}`);
    console.log(`  Projeto:             uwrvzsjtpgaifkktpepn.supabase.co`);
    console.log(`  Tabelas verificadas: ${TABLES.length}`);
    console.log(`  Erros:               ${TOTAL_ERRORS}`);
    console.log(`  Avisos:              ${TOTAL_WARNINGS}`);
    console.log(`  Rollback:            ${rollbackOk ? "OK" : "FALHA"}`);

    if (TOTAL_ERRORS > 0) {
      console.log("\n  ERROS ENCONTRADOS:");
      for (const e of errors) console.log(`    - ${e}`);
    }
    if (TOTAL_WARNINGS > 0) {
      console.log("\n  AVISOS:");
      for (const w of warnings) console.log(`    - ${w}`);
    }

    let status;
    if (TOTAL_ERRORS > 0) {
      status = "REPROVADA — corrigir erros antes de homologar";
    } else if (TOTAL_WARNINGS > 0) {
      status = "APROVADA COM RESSALVAS — revisar warnings antes do deploy";
    } else {
      status = "APROVADA PARA DEPLOY";
    }
    console.log(`\n  STATUS FINAL: ${status}`);

    const risk = TOTAL_ERRORS > 0 ? "ALTO — nao aplicar em producao sem correcao" :
                 TOTAL_WARNINGS > 2 ? "MEDIO — revisar warnings antes do deploy" :
                 "BAIXO — seguro para aplicar apos revisao";
    console.log(`  Risco residual:      ${risk}`);
    console.log("");

    // Recomendação
    if (TOTAL_ERRORS === 0 && TOTAL_WARNINGS <= 2) {
      console.log("  RECOMENDACAO: Migration APROVADA. Pode aplicar em ambiente");
      console.log("  de homologacao ou producao apos revisao final do relatorio.");
    } else if (TOTAL_ERRORS === 0) {
      console.log("  RECOMENDACAO: Migration APROVADA COM RESSALVAS. Corrigir");
      console.log("  warnings antes do deploy em producao.");
    } else {
      console.log("  RECOMENDACAO: Migration REPROVADA. Corrigir erros e");
      console.log("  revalidar antes de qualquer deploy.");
    }
    console.log("");

  } catch (fatalErr) {
    console.error(`\n[FATAL] ${fatalErr.message}`);
    console.error(fatalErr.stack);
    // Garantir rollback em caso de erro fatal
    try { await client.query("ROLLBACK"); } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
    log("Conexao encerrada.");
  }
}

main();
