// ============================================================
// Aplica supabase/migrations/20261111000000_os_numero_sequencial_seguro.sql
//
// Uso:
//   node scripts/_apply_os_numero_sequencial_seguro.cjs            (dry-run + ROLLBACK)
//   node scripts/_apply_os_numero_sequencial_seguro.cjs --apply    (COMMIT)
//   node scripts/_apply_os_numero_sequencial_seguro.cjs --check    (read-only)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261111000000_os_numero_sequencial_seguro.sql",
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

async function provar(client) {
  const { rows: fn } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname='public' AND p.proname='f_proximo_numero_os_sequencial'
      ORDER BY p.oid DESC LIMIT 1`,
  );
  registrar(Boolean(fn[0]), "função f_proximo_numero_os_sequencial existe");
  registrar(
    /America\/Sao_Paulo/.test(fn[0]?.def || ""),
    "função usa o fuso America/Sao_Paulo",
  );
  registrar(
    /regexp_replace/.test(fn[0]?.def || "") && /\[0-9\]\{1,5\}/.test(fn[0]?.def || ""),
    "função ignora números fora do padrão (1..5 dígitos)",
  );

  const { rows: grants } = await client.query(
    `SELECT has_function_privilege('authenticated', 'public.f_proximo_numero_os_sequencial()', 'EXECUTE') AS auth,
            has_function_privilege('service_role', 'public.f_proximo_numero_os_sequencial()', 'EXECUTE') AS svc`,
  );
  registrar(grants[0]?.auth === true && grants[0]?.svc === true, "grants authenticated/service_role");

  const { rows: prox } = await client.query(
    "SELECT public.f_proximo_numero_os_sequencial() AS numero",
  );
  const numero = prox[0]?.numero || "";
  registrar(/^OS-\d{6}-\d{4,5}$/.test(numero), "retorno no formato OS-AAAAMM-NNNN", numero);

  const { rows: base } = await client.query(
    `SELECT COALESCE(MAX((regexp_replace(numero, '^OS-[0-9]{6}-', ''))::integer), 1199) AS max
       FROM public.ordens_servico
      WHERE numero ~ '^OS-[0-9]{6}-[0-9]{1,5}$'`,
  );
  registrar(
    Boolean(numero) && Number(numero.split("-")[2]) >= Number(base[0]?.max || 0),
    "próximo número é maior/igual ao máximo existente",
    `max=${base[0]?.max}`,
  );
}

(async () => {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL não encontrado.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    if (CHECK_ONLY) {
      await provar(client);
    } else {
      await client.query("BEGIN");
      const sql = fs.readFileSync(MIGRATION, "utf8");
      await client.query(sql);
      console.log("SQL executado na transação.\n[provas]");
      await provar(client);
      const falhas = checks.filter((c) => !c.ok);
      if (falhas.length > 0) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(`\nFALHOU: ${falhas.length}/${checks.length} — ROLLBACK.`);
        process.exit(1);
      }
      if (APPLY) {
        await client.query("COMMIT");
        console.log("COMMIT realizado — sequenciador seguro aplicado.");
      } else {
        await client.query("ROLLBACK");
        console.log("(dry-run) ROLLBACK — nada persistido. Use --apply.");
      }
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
