/* ============================================================================
 * _apply_os_numero_sequencial.cjs — valida/aplica a sequência oficial da OS
 *
 * Arquivo: supabase/migrations/20261102000000_os_numero_sequencial.sql
 *
 * Uso (raiz do repo, com DATABASE_URL no .env):
 *   node scripts\_apply_os_numero_sequencial.cjs            # DRY-RUN (ROLLBACK)
 *   node scripts\_apply_os_numero_sequencial.cjs --apply    # COMMIT real
 *
 * Provas:
 *   P1 sequence public.os_numero_seq existe (start 1200)
 *   P2 f_proximo_numero_os() gera "OS-AAAAMM-NNNN" com NNNN >= 1200
 *   P3 f_cotacao_detalhes_para_os usa a sequência (sem random p/ OS)
 *   P4 converter_pedido_para_os usa a sequência (sem random p/ OS)
 * ==========================================================================*/

const fs = require("fs");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const MIG = "supabase/migrations/20261102000000_os_numero_sequencial.sql";

const resultados = [];
function prova(id, nome, ok, detalhe = "") {
  resultados.push({ id, nome, ok });
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${id} ${nome}${detalhe ? " — " + detalhe : ""}`);
}
const todosPassaram = () => resultados.every((r) => r.ok);

async function verificar(c, prefixo) {
  console.log(`\n== ${prefixo} ==`);

  const seq = await c.query(
    `SELECT seqstart, seqincrement FROM pg_sequence s
       JOIN pg_class cl ON cl.oid = s.seqrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace
      WHERE n.nspname='public' AND cl.relname='os_numero_seq'`
  );
  const row = seq.rows[0];
  prova("P1", "sequence os_numero_seq (start 1200)", !!row && Number(row.seqstart) === 1200,
    row ? `start=${row.seqstart} inc=${row.seqincrement}` : "AUSENTE");

  const numero = await c.query(`SELECT public.f_proximo_numero_os() AS numero`);
  const valor = String(numero.rows[0]?.numero || "");
  const m = valor.match(/^OS-(\d{6})-(\d+)$/);
  prova("P2", "f_proximo_numero_os() → OS-AAAAMM-NNNN (>=1200)",
    !!m && Number(m[2]) >= 1200, valor);

  for (const [id, fn, padrao] of [
    ["P3", "f_cotacao_detalhes_para_os", "(floor(random() * 900000) + 100000)"],
    ["P4", "converter_pedido_para_os", "LPAD(floor(random() * 900000 + 100000)"],
  ]) {
    const r = await c.query(`SELECT prosrc FROM pg_proc WHERE proname=$1`, [fn]);
    const src = r.rows[0]?.prosrc || "";
    const ok = src.includes("f_proximo_numero_os()") && !src.includes(padrao);
    prova(id, `${fn} usa a sequência`, ok, ok ? "ok" : "ainda com geração aleatória");
  }
}

(async () => {
  console.log(`_apply_os_numero_sequencial.cjs — modo: ${APPLY ? "APPLY (COMMIT)" : "DRY-RUN (ROLLBACK)"}`);
  const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
  const sql = fs.readFileSync(MIG, "utf8");
  console.log(`\n== arquivo ==\n  ${MIG} (${sql.length} chars)`);

  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  await c.query("BEGIN");
  try {
    await c.query(sql);
    console.log("  migration executada na transação — ok");
    await verificar(c, "provas na transação");

    if (!todosPassaram()) throw new Error("falha nas provas");

    if (APPLY) {
      await c.query("COMMIT");
      console.log("\n*** COMMIT REALIZADO ***");
    } else {
      await c.query("ROLLBACK");
      console.log("\nDRY-RUN OK — tudo revertido (ROLLBACK). Use --apply para efetivar.");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("\nERRO -> ROLLBACK:", e.message);
    for (const r of resultados.filter((x) => !x.ok)) console.error(`  FALHOU: ${r.id} ${r.nome}`);
    await c.end();
    process.exit(1);
  }

  if (APPLY) {
    resultados.length = 0;
    await verificar(c, "verificação pós-COMMIT");
    if (!todosPassaram()) {
      await c.end();
      console.error("\nPOS-COMMIT: provas FALHARAM");
      process.exit(1);
    }
  }

  console.log(`\nResultado: ${resultados.filter((r) => r.ok).length}/${resultados.length} provas PASS`);
  await c.end();
})().catch((e) => { console.error("ERRO FATAL:", e.message); process.exit(2); });
