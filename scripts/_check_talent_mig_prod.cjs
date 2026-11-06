/* Verificação READ-ONLY: migrations talent Etapa 3/4/5 já aplicadas em produção? */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

const OBJETOS = {
  tabelas: [
    "prestador_perfil_talento",
    "prestador_disponibilidade",
    "recrutamento_cenarios",
    "recrutamento_avaliacoes",
    "recrutamento_convites_os",
    "prestador_treinamentos",
  ],
  funcoes: [
    "app_s6_salvar_perfil_talento",
    "app_s6_criar_prestador",
    "f_cotacao_detalhes_para_os",
  ],
  colunasFase7: [
    { tabela: "prestador_perfil_talento", coluna: "status_disponibilidade" },
    { tabela: "documentos_prestadores", coluna: "status" },
    { tabela: "documentos_prestadores", coluna: "data_vencimento" },
    { tabela: "documentos_prestadores", coluna: "validade" },
    { tabela: "documentos_prestadores", coluna: "observacoes" },
    { tabela: "documentos_prestadores", coluna: "updated_at" },
  ],
  constraints: ["chk_prestador_perfil_status_disponibilidade"],
};

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let ok = 0;
  let fail = 0;

  const r1 = await c.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1::text[])`,
    [OBJETOS.tabelas],
  );
  const foundT = new Set(r1.rows.map((r) => r.tablename));
  for (const t of OBJETOS.tabelas) {
    const exists = foundT.has(t);
    console.log(`${exists ? "[OK]  " : "[FALTA]"} tabela public.${t}`);
    exists ? ok++ : fail++;
  }

  const r2 = await c.query(
    `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND proname = ANY($1::text[])`,
    [OBJETOS.funcoes],
  );
  const foundF = new Set(r2.rows.map((r) => r.proname));
  for (const f of OBJETOS.funcoes) {
    const exists = foundF.has(f);
    console.log(`${exists ? "[OK]  " : "[FALTA]"} função public.${f}()`);
    exists ? ok++ : fail++;
  }

  for (const col of OBJETOS.colunasFase7) {
    const r = await c.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [col.tabela, col.coluna],
    );
    const exists = r.rowCount > 0;
    console.log(`${exists ? "[OK]  " : "[FALTA]"} coluna ${col.tabela}.${col.coluna}`);
    exists ? ok++ : fail++;
  }

  for (const con of OBJETOS.constraints) {
    const r = await c.query(
      `SELECT 1 FROM pg_constraint WHERE conname=$1 AND conrelid::regclass::text LIKE 'public.%'`,
      [con],
    );
    const exists = r.rowCount > 0;
    console.log(`${exists ? "[OK]  " : "[FALTA]"} constraint ${con}`);
    exists ? ok++ : fail++;
  }

  // Migrações registradas na tabela supabase_migrations?
  try {
    const r = await c.query(
      `SELECT name FROM supabase_migrations.schema_migrations
       WHERE name LIKE '2026103%' OR name LIKE '20261031%' ORDER BY name DESC LIMIT 10`,
    );
    console.log(`\nMigrations registradas na tabela supabase_migrations (2026-10-3x): ${r.rowCount}`);
    r.rows.forEach((row) => console.log("  -", row.name));
  } catch (e) {
    console.log("\n(tabela supabase_migrations indisponível:", e.message.split("\n")[0], ")");
  }

  console.log(`\nRESUMO: ${ok} presentes / ${fail} ausentes`);
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
