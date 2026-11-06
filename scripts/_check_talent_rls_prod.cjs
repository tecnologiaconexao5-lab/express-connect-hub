/* Verificação READ-ONLY detalhada: RLS + policies + constraint das migrations talent */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

const TABELAS = [
  "prestador_perfil_talento",
  "prestador_disponibilidade",
  "recrutamento_cenarios",
  "recrutamento_avaliacoes",
  "recrutamento_convites_os",
  "prestador_treinamentos",
];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let fail = 0;

  const rls = await c.query(
    `SELECT c.relname, c.relrowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relname = ANY($1::text[])`,
    [TABELAS],
  );
  const rlsMap = new Map(rls.rows.map((r) => [r.relname, r.relrowsecurity]));
  for (const t of TABELAS) {
    const on = rlsMap.get(t) === true;
    if (!on) fail++;
    console.log(`${on ? "[OK]  " : "[FALTA]"} RLS em ${t}`);
  }

  const pol = await c.query(
    `SELECT tablename, count(*) AS n FROM pg_policies
     WHERE schemaname='public' AND tablename = ANY($1::text[])
     GROUP BY tablename ORDER BY tablename`,
    [TABELAS],
  );
  const polMap = new Map(pol.rows.map((r) => [r.tablename, Number(r.n)]));
  for (const t of TABELAS) {
    const n = polMap.get(t) ?? 0;
    if (n === 0) fail++;
    console.log(`${n > 0 ? "[OK]  " : "[FALTA]"} policies em ${t} (${n})`);
  }

  const con = await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conname = 'chk_prestador_perfil_status_disponibilidade'`,
  );
  const hasCon = con.rowCount > 0;
  if (!hasCon) fail++;
  console.log(
    `${hasCon ? "[OK]  " : "[FALTA]"} constraint chk_prestador_perfil_status_disponibilidade` +
      (hasCon ? ` -> ${con.rows[0].def}` : ""),
  );

  // Valores distintos permitidos (prova de que o CHECK vigora, se existir)
  if (hasCon) {
    const vals = await c.query(
      `SELECT DISTINCT status_disponibilidade FROM public.prestador_perfil_talento LIMIT 10`,
    );
    console.log(`      valores distintos em produção: ${vals.rows.map((r) => r.status_disponibilidade).join(", ") || "(vazio)"}`);
  }

  console.log(`\nRESUMO: ${fail === 0 ? "TUDO PRESENTE" : fail + " item(ns) ausente(s)"}`);
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
