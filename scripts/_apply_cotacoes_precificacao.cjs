// ============================================================
// MISSAO COTACAO-EXPRESS-V2 — aplica
// supabase/migrations/20261025000000_cotacoes_precificacao_fase1.sql
// no banco remoto via `pg` (psql ausente no Windows) e FAZ A PROVA
// de cada item do contrato antes do COMMIT.
// Uso: node scripts/_apply_cotacoes_precificacao.cjs [--check]
//   --check → somente verifica (read-only), não altera nada
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261025000000_cotacoes_precificacao_fase1.sql",
);
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

const STATUS_LEGADOS = ["Pendente", "Aguardando Detalhes", "Pronto para OS"];
const STATUS_NOVO = "Pendente de Aprovação pelo Cliente";

async function provaCheck(client) {
  const { rows: cons } = await client.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.cotacoes_publicas'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'`,
  );
  const def = cons.map((r) => r.def).join(" | ");
  const comTodos = [...STATUS_LEGADOS, STATUS_NOVO].every((s) => def.includes(`'${s}'`));
  const restrito = cons.length === 1;
  registrar(
    comTodos && restrito,
    "CHECK de status com os 4 valores (1 unica constraint)",
    `${cons.length} constraint(s): ${def.slice(0, 200)}`,
  );
}

async function provaMetadata(client) {
  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default, is_nullable
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='cotacoes_publicas'
        AND column_name = 'metadata'`,
  );
  const col = rows[0];
  registrar(
    Boolean(col) && col.data_type === "jsonb" && col.is_nullable === "NO",
    "coluna metadata jsonb NOT NULL DEFAULT '{}'",
    col ? `${col.data_type} nullable=${col.is_nullable} default=${col.column_default}` : "ausente",
  );
}

async function provaIndice(client) {
  const { rows } = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename='cotacoes_publicas'`,
  );
  const idx = rows.find((r) => r.indexname === "idx_cotacoes_publicas_metadata");
  registrar(
    Boolean(idx) && /using\s+gin/i.test(idx.indexdef),
    "indice GIN de metadata",
    idx ? idx.indexdef.slice(0, 120) : "ausente",
  );
}

async function provaInsertStatus(client, rotulo) {
  let novoOk = null;
  let legadoOk = null;
  try {
    await client.query("SAVEPOINT prova_status");
    await client.query("SET LOCAL ROLE anon");
    const ins = await client.query(
      `INSERT INTO public.cotacoes_publicas (nome_cliente, status, metadata)
       VALUES ('__PROVA_V2__', $1, '{"origem":"prova"}') RETURNING id`,
      [STATUS_NOVO],
    );
    novoOk = ins.rowCount === 1;
    const upd = await client.query(
      `UPDATE public.cotacoes_publicas
          SET status = $1
        WHERE nome_cliente = '__PROVA_V2__' AND status = $2`,
      ["Aguardando Detalhes", STATUS_NOVO],
    );
    legadoOk = upd.rowCount === 1;
    await client.query("ROLLBACK TO SAVEPOINT prova_status");
    await client.query("RELEASE SAVEPOINT prova_status");
    await client.query("RESET ROLE");
  } catch (err) {
    await client.query("RESET ROLE").catch(() => {});
    await client.query("ROLLBACK TO SAVEPOINT prova_status").catch(() => {});
    console.log(`  (${rotulo}: erro ${err.message})`);
  }
  registrar(
    novoOk === true && legadoOk === true,
    `${rotulo}: anon grava '${STATUS_NOVO}' e transiciona para 'Aguardando Detalhes'`,
    `insert_novo=${novoOk} update_transicao=${legadoOk}`,
  );
}

async function provaInsertLegado(client, rotulo) {
  let ok = null;
  try {
    await client.query("SAVEPOINT prova_legado");
    await client.query("SET LOCAL ROLE anon");
    const ins = await client.query(
      `INSERT INTO public.cotacoes_publicas (nome_cliente, status)
       VALUES ('__PROVA_LEGADA__', 'Pendente') RETURNING id`,
    );
    ok = ins.rowCount === 1;
    await client.query("ROLLBACK TO SAVEPOINT prova_legado");
    await client.query("RELEASE SAVEPOINT prova_legado");
    await client.query("RESET ROLE");
  } catch (err) {
    await client.query("RESET ROLE").catch(() => {});
    await client.query("ROLLBACK TO SAVEPOINT prova_legado").catch(() => {});
    console.log(`  (${rotulo}: erro ${err.message})`);
  }
  registrar(
    ok === true,
    `${rotulo}: status legado 'Pendente' continua aceito (compatibilidade)`,
    `insert_legado=${ok}`,
  );
}

async function provaRealtime(client) {
  const { rows } = await client.query(
    `SELECT pubname FROM pg_publication_tables
      WHERE schemaname='public' AND tablename='cotacoes_publicas'`,
  );
  registrar(
    rows.some((r) => r.pubname === "supabase_realtime"),
    "tabela segue na publicacao supabase_realtime",
    rows.map((r) => r.pubname).join(", ") || "nenhuma",
  );
}

async function main() {
  const connStr = carregarDatabaseUrl();
  if (!connStr) {
    console.error("DATABASE_URL ausente (env ou .env). Abortado.");
    process.exit(1);
  }
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    const { rows: existe } = await client.query(
      "SELECT to_regclass('public.cotacoes_publicas') AS t",
    );
    if (!existe[0].t) {
      console.error("Tabela cotacoes_publicas nao existe — aplique 20261024000000 primeiro.");
      await client.end();
      process.exit(2);
    }

    const { rows: colAntes } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cotacoes_publicas'
          AND column_name = 'metadata'`,
    );
    const jaTemMetadata = colAntes[0].n === 1;
    const jaTemStatusNovo = (await provaStatusAtual(client)).jaTem;
    console.log(
      `Estado atual: metadata=${jaTemMetadata ? "presente" : "ausente"} · status novo=${
        jaTemStatusNovo ? "presente" : "ausente"
      }`,
    );

    await client.query("BEGIN");
    await client.query(sql);

    // ---------- PROVAS ----------
    await provaCheck(client);
    await provaMetadata(client);
    await provaIndice(client);
    await provaInsertStatus(client, "prova funcional do novo status");
    await provaInsertLegado(client, "prova funcional do status legado");
    await provaRealtime(client);

    const falhas = checks.filter((c) => !c.ok);
    if (falhas.length) {
      await client.query("ROLLBACK");
      console.log("\nROLLBACK executado — nada foi persistido.");
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} verificacoes.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificacoes OK.`);
    if (CHECK_ONLY) {
      await client.query("ROLLBACK");
      console.log("(modo --check — transacao revertida, nenhuma alteracao)");
    } else if (jaTemMetadata && jaTemStatusNovo) {
      await client.query("COMMIT");
      console.log("COMMIT — migration ja estava aplicada (idempotente), nenhuma mudanca de fato.");
    } else {
      await client.query("COMMIT");
      console.log("COMMIT realizado — migration aplicada no banco remoto.");
    }
  } catch (err) {
    console.error("ERRO:", err.message);
    await client.query("ROLLBACK").catch(() => {});
    console.error("ROLLBACK (se havia transacao aberta).");
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function provaStatusAtual(client) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.cotacoes_publicas'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'`,
  );
  const def = rows.map((r) => r.def).join(" ");
  return { jaTem: def.includes(`'${STATUS_NOVO}'`) };
}

main();
