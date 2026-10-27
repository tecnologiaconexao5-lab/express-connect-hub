// ============================================================
// MISSAO COTACAO-EXPRESS — aplica supabase/migrations/20261024000000_
// cotacoes_publicas.sql no banco remoto via `pg` (psql ausente no
// Windows) e FAZ A PROVA de cada item do contrato antes do COMMIT.
// Uso: node scripts/_apply_cotacoes_publicas.cjs [--check]
//   --check  → somente verifica (read-only), não altera nada
// ============================================================
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261024000000_cotacoes_publicas.sql",
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
    const jaExiste = Boolean(existe[0].t);
    console.log(
      jaExiste
        ? "Tabela public.cotacoes_publicas ja existe -> apenas verificacao."
        : "Tabela inexistente -> aplicando migration em transacao unica.",
    );

    if (!jaExiste && CHECK_ONLY) {
      console.log("Tabela ainda nao existe e modo --check -> nada a verificar.");
      await client.end();
      process.exit(2);
    }

    // transacao unica: aplica a migration (quando necessario) e roda a
    // prova funcional da RLS dentro do mesmo contexto
    await client.query("BEGIN");
    if (!jaExiste) {
      await client.query(sql);
    }

    // ---------- PROVA ----------
    const { rows: col } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='cotacoes_publicas'`,
    );
    const cols = col.map((r) => r.column_name);
    const esperadas = [
      "id", "status", "nome_cliente", "telefone", "carga_descricao", "carga_peso",
      "carga_dimensoes", "carga_volumes", "paradas", "data_desejada", "hora_desejada",
      "detalhes", "orcamento_id", "valor_aprovado", "tenant_id", "created_at", "updated_at",
    ];
    const faltando = esperadas.filter((c) => !cols.includes(c));
    registrar(
      faltando.length === 0,
      "17 colunas do contrato",
      faltando.length ? `faltando: ${faltando}` : "",
    );

    const { rows: cons } = await client.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'public.cotacoes_publicas'::regclass AND contype='c'`,
    );
    const defStatus = cons.map((r) => r.def).join(" | ");
    registrar(
      defStatus.includes("'Pendente'") &&
        defStatus.includes("'Aguardando Detalhes'") &&
        defStatus.includes("'Pronto para OS'"),
      "CHECK dos 3 status",
      defStatus.slice(0, 140),
    );

    const { rows: rls } = await client.query(
      `SELECT relrowsecurity FROM pg_class
        WHERE oid = 'public.cotacoes_publicas'::regclass`,
    );
    registrar(rls[0].relrowsecurity === true, "RLS habilitado na tabela");

    const { rows: pol } = await client.query(
      `SELECT policyname, cmd, roles::text AS roles, qual, with_check
         FROM pg_policies WHERE schemaname='public' AND tablename='cotacoes_publicas'
        ORDER BY policyname`,
    );
    const nomes = pol.map((p) => p.policyname);
    const esperadasPol = [
      "cotacoes_publicas_delete_tms",
      "cotacoes_publicas_insert_anon",
      "cotacoes_publicas_select_anon",
      "cotacoes_publicas_update_anon",
    ];
    registrar(
      JSON.stringify(nomes) === JSON.stringify(esperadasPol),
      "4 policies (select/insert/update anon + delete autenticado)",
      nomes.join(", "),
    );
    const insertAnon = pol.find((p) => p.policyname === "cotacoes_publicas_insert_anon");
    registrar(
      Boolean(insertAnon) && insertAnon.roles.includes("anon") && insertAnon.cmd === "INSERT",
      "policy de INSERT aberta para anon (WITH CHECK)",
      insertAnon
        ? `${insertAnon.cmd} roles=${insertAnon.roles} check=${insertAnon.with_check}`
        : "",
    );

    const { rows: priv } = await client.query(
      `SELECT
         has_table_privilege('anon','public.cotacoes_publicas','SELECT')   AS anon_select,
         has_table_privilege('anon','public.cotacoes_publicas','INSERT')   AS anon_insert,
         has_table_privilege('anon','public.cotacoes_publicas','UPDATE')   AS anon_update,
         has_table_privilege('authenticated','public.cotacoes_publicas','DELETE') AS auth_delete`,
    );
    const p = priv[0];
    registrar(
      p.anon_select && p.anon_insert && p.anon_update && p.auth_delete,
      "GRANTS anon (SELECT/INSERT/UPDATE) + authenticated (DELETE)",
      `anon S=${p.anon_select} I=${p.anon_insert} U=${p.anon_update}; auth D=${p.auth_delete}`,
    );

    // PROVA FUNCIONAL DA RLS — o Supabase da ALL por DEFAULT PRIVILEGE, entao o
    // DELETE de anon so e barrado pela POLICY (role authenticated). Roda como anon
    // dentro de um SAVEPOINT e volta o savepoint depois: nada fica persistido.
    let anonInseriu = false;
    let anonRemoveu = null;
    let anonViu = null;
    try {
      await client.query("SAVEPOINT prova_anon");
      await client.query("SET LOCAL ROLE anon");
      const ins = await client.query(
        `INSERT INTO public.cotacoes_publicas (nome_cliente, status)
         VALUES ('__PROVA_RLS_COTACAO__', 'Pendente') RETURNING id`,
      );
      anonInseriu = ins.rowCount === 1;
      const del = await client.query(
        `DELETE FROM public.cotacoes_publicas WHERE nome_cliente = '__PROVA_RLS_COTACAO__'`,
      );
      anonRemoveu = del.rowCount;
      const vis = await client.query(
        `SELECT count(*)::int AS n FROM public.cotacoes_publicas
          WHERE nome_cliente = '__PROVA_RLS_COTACAO__'`,
      );
      anonViu = vis.rows[0].n;
      await client.query("ROLLBACK TO SAVEPOINT prova_anon");
      await client.query("RELEASE SAVEPOINT prova_anon");
      await client.query("RESET ROLE");
    } catch (err) {
      await client.query("RESET ROLE").catch(() => {});
      await client.query("ROLLBACK TO SAVEPOINT prova_anon").catch(() => {});
      console.log(`  (prova anon falhou por erro: ${err.message})`);
    }
    registrar(
      anonInseriu === true && anonRemoveu === 0 && anonViu === 1,
      "RLS funcional: anon INSERE (Fase 1) e NAO consegue DELETAR",
      `inseriu=${anonInseriu} linhas_removidas=${anonRemoveu} linhas_visiveis=${anonViu}`,
    );

    const { rows: pub } = await client.query(
      `SELECT pubname FROM pg_publication_tables
        WHERE schemaname='public' AND tablename='cotacoes_publicas'`,
    );
    registrar(
      pub.some((r) => r.pubname === "supabase_realtime"),
      "tabela na publicacao supabase_realtime (alertas Realtime)",
      pub.map((r) => r.pubname).join(", ") || "nenhuma",
    );

    const { rows: idx } = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname='public' AND tablename='cotacoes_publicas'`,
    );
    const idxNomes = idx.map((i) => i.indexname);
    const idxEsperados = [
      "idx_cotacoes_publicas_status",
      "idx_cotacoes_publicas_orcamento_id",
      "idx_cotacoes_publicas_created_at",
      "idx_cotacoes_publicas_tenant_id",
    ];
    const idxFaltando = idxEsperados.filter((i) => !idxNomes.includes(i));
    registrar(
      idxFaltando.length === 0,
      "4 indices",
      idxFaltando.length ? `faltando: ${idxFaltando}` : idxNomes.join(", "),
    );

    const { rows: trg } = await client.query(
      `SELECT tgname FROM pg_trigger
        WHERE tgrelid='public.cotacoes_publicas'::regclass AND NOT tgisinternal`,
    );
    registrar(
      trg.some((t) => t.tgname === "trg_cotacoes_publicas_updated_at"),
      "trigger updated_at",
      trg.map((t) => t.tgname).join(", "),
    );

    const falhas = checks.filter((c) => !c.ok);
    if (falhas.length) {
      await client.query("ROLLBACK").catch(() => {});
      console.log(jaExiste ? "" : "\nROLLBACK executado — nada foi persistido.");
      console.error(`\nFALHOU: ${falhas.length}/${checks.length} verificacoes.`);
      process.exit(1);
    }

    console.log(`\nPROVA COMPLETA: ${checks.length}/${checks.length} verificacoes OK.`);
    if (jaExiste) {
      await client.query("ROLLBACK"); // so prova — nenhuma alteracao persistida
      console.log("(tabela ja existia — transacao de prova revertida, nenhuma alteracao)");
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

main();
