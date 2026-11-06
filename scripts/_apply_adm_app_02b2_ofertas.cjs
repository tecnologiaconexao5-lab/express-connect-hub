// ============================================================
// ADM-APP-02B.2 — aplica supabase/migrations/20261103000002_adm_app_02b2_ofertas_publicas.sql
// no banco remoto via `pg` e faz a prova dos objetos antes/depois.
// Uso: node scripts/_apply_adm_app_02b2_ofertas.cjs [--apply]
//   sem --apply -> somente verificacao read-only
//   --apply     -> executa a migration (arquivo ja contem BEGIN/COMMIT)
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261103000002_adm_app_02b2_ofertas_publicas.sql",
);
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

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

async function verificar(client) {
  const { rows: tabelas } = await client.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (
         'recrutamento_ofertas',
         'recrutamento_oferta_identificadores',
         'recrutamento_oferta_eventos',
         'recrutamento_oferta_rate_limit'
       )
     ORDER BY table_name`);
  const nomes = tabelas.map((t) => t.table_name);
  registrar(nomes.length === 4, "4 tabelas criadas", nomes.join(", "));

  const { rows: col } = await client.query(`
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_candidatos' AND column_name='oferta_id'`);
  registrar(col.length === 1, "recrutamento_candidatos.oferta_id existe");

  const { rows: fn } = await client.query(`
    SELECT p.prosecdef AS secdef, p.provolatile
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_registrar_oferta_publica'`);
  registrar(fn.length === 1, "RPC f_registrar_oferta_publica existe");
  registrar(fn[0]?.secdef === true, "RPC SECURITY DEFINER");

  const { rows: grants } = await client.query(`
    SELECT
      has_function_privilege('service_role',
        'public.f_registrar_oferta_publica(uuid,jsonb,text,text,text)', 'EXECUTE') AS service_role_ok,
      has_function_privilege('anon',
        'public.f_registrar_oferta_publica(uuid,jsonb,text,text,text)', 'EXECUTE') AS anon_ok,
      has_function_privilege('authenticated',
        'public.f_registrar_oferta_publica(uuid,jsonb,text,text,text)', 'EXECUTE') AS authenticated_ok`);
  const g = grants[0] || {};
  registrar(g.service_role_ok === true, "service_role pode executar a RPC");
  registrar(g.anon_ok === false, "anon NAO executa a RPC");
  registrar(g.authenticated_ok === false, "authenticated NAO executa a RPC");

  const { rows: rls } = await client.query(`
    SELECT c.relname, c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public'
       AND c.relname IN (
         'recrutamento_ofertas',
         'recrutamento_oferta_identificadores',
         'recrutamento_oferta_eventos',
         'recrutamento_oferta_rate_limit'
       )
     ORDER BY c.relname`);
  registrar(
    rls.length === 4 && rls.every((r) => r.relrowsecurity === true),
    "RLS habilitada nas 4 tabelas",
    rls.map((r) => `${r.relname}=${r.relrowsecurity}`).join(", "),
  );

  const { rows: pol } = await client.query(`
    SELECT polname FROM pg_policy
     WHERE polrelid IN (
       'public.recrutamento_ofertas'::regclass,
       'public.recrutamento_oferta_identificadores'::regclass,
       'public.recrutamento_oferta_eventos'::regclass
     ) ORDER BY polname`);
  registrar(pol.length >= 3, "Policies internas criadas", pol.map((p) => p.polname).join(", "));

  const { rows: trg } = await client.query(`
    SELECT tgname FROM pg_trigger
     WHERE tgrelid='public.recrutamento_ofertas'::regclass AND NOT tgisinternal`);
  registrar(
    trg.some((t) => t.tgname === "trg_recrutamento_ofertas_before_update"),
    "Trigger de updated_at/protecao existe",
  );

  const { rows: idx } = await client.query(`
    SELECT count(*)::int AS total FROM pg_indexes
     WHERE schemaname='public' AND tablename IN (
       'recrutamento_ofertas',
       'recrutamento_oferta_identificadores',
       'recrutamento_oferta_eventos',
       'recrutamento_oferta_rate_limit')`);
  registrar((idx[0]?.total || 0) >= 12, "Indices criados", String(idx[0]?.total || 0));
}

async function main() {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL ausente (env ou .env). Abortado.");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const { rows: existe } = await client.query(
      "SELECT to_regclass('public.recrutamento_ofertas') AS t",
    );
    const jaExiste = Boolean(existe[0].t);
    console.log(
      jaExiste
        ? "Tabela recrutamento_ofertas ja existe -> apenas verificacao."
        : "Tabela inexistente -> migration ainda NAO aplicada.",
    );

    if ((!jaExiste || FORCE) && APPLY) {
      const sql = fs.readFileSync(MIGRATION, "utf8");
      console.log(`Aplicando ${path.basename(MIGRATION)} (transacao do proprio arquivo)...`);
      await client.query(sql);
      console.log("Migration executada (COMMIT do arquivo concluido).");
    } else if (!jaExiste) {
      console.log("Modo verificacao (sem --apply). Nada alterado.");
    }

    await verificar(client);

    const falhas = checks.filter((c) => !c.ok);
    console.log(`\nResumo: ${checks.length - falhas.length}/${checks.length} provas OK`);
    if (falhas.length > 0) process.exitCode = 3;
  } catch (err) {
    console.error("Erro:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
