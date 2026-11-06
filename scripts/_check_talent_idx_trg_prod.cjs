/* Verificação READ-ONLY final: índices + triggers das migrations talent */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

const IDX = [
  "idx_prestador_perfil_talento_tenant",
  "idx_prestador_disponibilidade_dia",
  "idx_recrutamento_avaliacoes_prestador",
  "idx_documentos_prestadores_validade",
  "idx_documentos_prestadores_validade_alt",
  "idx_convites_os_prestador",
  "idx_convites_os_os",
  "idx_convites_os_status",
  "idx_prestador_treinamentos_prestador",
  "idx_prestador_treinamentos_validade",
];
const TRG = [
  "trg_recrutamento_convites_os_updated_at",
  "trg_prestador_treinamentos_updated_at",
];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let fail = 0;

  const r1 = await c.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1::text[])`,
    [IDX],
  );
  const f1 = new Set(r1.rows.map((r) => r.indexname));
  for (const i of IDX) {
    const on = f1.has(i);
    if (!on) fail++;
    console.log(`${on ? "[OK]  " : "[FALTA]"} índice ${i}`);
  }

  const r2 = await c.query(
    `SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
     JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname='public' AND tgname = ANY($1::text[])`,
    [TRG],
  );
  const f2 = new Set(r2.rows.map((r) => r.tgname));
  for (const t of TRG) {
    const on = f2.has(t);
    if (!on) fail++;
    console.log(`${on ? "[OK]  " : "[FALTA]"} trigger ${t}`);
  }

  // Prova funcional mínima: RPC app_s6 existe e é SECURITY DEFINER
  const r3 = await c.query(
    `SELECT p.prosecdef, p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN ('app_s6_salvar_perfil_talento','app_s6_criar_prestador')`,
  );
  for (const row of r3.rows) {
    const definer = row.prosecdef === true;
    if (!definer) fail++;
    console.log(`${definer ? "[OK]  " : "[FALTA]"} SECURITY DEFINER (${r3.rows.indexOf(row) + 1}/${r3.rows.length})`);
  }

  console.log(`\nRESUMO: ${fail === 0 ? "TUDO PRESENTE (índices + triggers + RPCs)" : fail + " item(ns) ausente(s)"}`);
  await c.end();
  process.exit(0);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
