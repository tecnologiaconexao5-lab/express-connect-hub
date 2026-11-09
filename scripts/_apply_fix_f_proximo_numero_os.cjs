// ============================================================
// Aplica supabase/migrations/20261109020000_fix_f_proximo_numero_os.sql
// (cria a sequence + f_proximo_numero_os usada pela RPC da Cotação Express).
//
// Uso:
//   node scripts/_apply_fix_f_proximo_numero_os.cjs            (dry-run: prova + ROLLBACK)
//   node scripts/_apply_fix_f_proximo_numero_os.cjs --apply    (COMMIT)
//   node scripts/_apply_fix_f_proximo_numero_os.cjs --check    (read-only)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261109020000_fix_f_proximo_numero_os.sql",
);
const APPLY = process.argv.includes("--apply");
const CHECK_ONLY = process.argv.includes("--check");

function carregarDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = path.resolve(__dirname, "..", ".env");
  if (!fs.existsSync(env)) return null;
  const linha = fs
    .readFileSync(env, "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!linha) return null;
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const checks = [];
const registrar = (ok, rotulo, detalhe = "") => {
  checks.push({ ok, rotulo, detalhe });
  console.log(`${ok ? "  OK " : "FAIL "} ${rotulo}${detalhe ? ` — ${detalhe}` : ""}`);
};

async function defFuncao(client, nome) {
  const { rows } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname=$1
      ORDER BY p.oid DESC LIMIT 1`,
    [nome],
  );
  return rows[0] ? rows[0].def : null;
}

async function provar(client) {
  const { rows: seq } = await client.query(
    `SELECT sequencename AS relname, last_value
       FROM pg_sequences
      WHERE schemaname='public' AND sequencename='os_numero_seq'`,
  );
  registrar(Boolean(seq[0]), "sequence public.os_numero_seq existe", seq[0] ? `last=${seq[0].last_value}` : "");

  const defProx = await defFuncao(client, "f_proximo_numero_os");
  registrar(Boolean(defProx), "função public.f_proximo_numero_os() existe");
  if (defProx) {
    registrar(
      defProx.includes("nextval") && defProx.includes("America/Sao_Paulo"),
      "f_proximo_numero_os usa a sequence + fuso America/Sao_Paulo",
    );
  }

  const { rows: grants } = await client.query(
    `SELECT DISTINCT grantee FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND routine_name='f_proximo_numero_os'`,
  );
  const g = grants.map((x) => x.grantee);
  registrar(
    g.includes("authenticated") && !g.includes("PUBLIC"),
    "grants: authenticated presente, PUBLIC revogado",
    g.join(", "),
  );

  // Garante que a RPC do Lote 1 continua com as correções (não foi regredida).
  const defOs = await defFuncao(client, "f_cotacao_detalhes_para_os");
  registrar(Boolean(defOs), "RPC f_cotacao_detalhes_para_os existe");
  if (defOs) {
    registrar(
      defOs.includes("public.f_proximo_numero_os()"),
      "RPC chama public.f_proximo_numero_os() (agora existente)",
    );
    registrar(
      defOs.includes("f_endereco_cotacao_os") &&
        defOs.includes("America/Sao_Paulo") &&
        defOs.includes("'em_analise'"),
      "RPC mantém as correções do Lote 1 (endereços/fuso/status)",
    );
  }
}

async function main() {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL ausente (env ou .env). Abortado.");
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    if (CHECK_ONLY) {
      console.log("[--check] estado atual (nada será alterado):");
      await provar(client);
      const falhas = checks.filter((c) => !c.ok);
      await client.end();
      process.exit(falhas.length ? 1 : 0);
    }

    await client.query("BEGIN");
    console.log("SQL executado dentro da transação (ainda não commitado).");
    await client.query(sql);

    console.log("\n[provas]");
    await provar(client);

    const falhas = checks.filter((c) => !c.ok);
    if (falhas.length) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} — ROLLBACK.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificações OK.`);
    if (APPLY) {
      await client.query("COMMIT");
      console.log("COMMIT realizado — sequence + f_proximo_numero_os criadas.");
    } else {
      await client.query("ROLLBACK");
      console.log("(dry-run) ROLLBACK — nada persistido. Use --apply.");
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
