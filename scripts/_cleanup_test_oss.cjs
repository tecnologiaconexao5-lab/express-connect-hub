/* eslint-disable no-console */
// Limpeza transacional das OSs de teste criadas na bateria E2E ao vivo.
// Uso: node scripts/_cleanup_test_oss.cjs --apply   (sem --apply = dry-run/rollback)
const fs = require("fs");
const { Client } = require("pg");

function env(k) {
  for (const f of [".env", ".env.local"]) {
    try {
      const t = fs.readFileSync(f, "utf8");
      const l = t.split(/\r?\n/).find((x) => x.startsWith(k + "="));
      if (l) return l.slice(k.length + 1).trim();
    } catch {}
  }
  return "";
}

const NUMEROS = [
  "OS-202610-883536",
  "OS-202610-153075",
  "OS-202610-838844",
  "OS-202610-283236",
  "OS-202610-618349",
  "OS-202610-607852",
];

// [tabela, coluna] que referenciam alocacao/os (FKs + tabelas sem FK).
const REF_ALOC = [
  ["communication_events", "alocacao_id"],
  ["entregas_protocolo", "alocacao_id"],
  ["fatura_itens", "alocacao_id"],
  ["historico_alocacoes_escala", "alocacao_id"],
  ["ocorrencias", "alocacao_id"],
  ["operacao_mensagens", "alocacao_id"],
  ["rota_paradas", "alocacao_id"],
  ["rotas", "alocacao_id"],
  ["delivery_proofs", "operation_id"],
  ["eventos_oficiais", "entity_id"],
  ["operation_timeline_events", "operation_id"],
];
const REF_OS = [
  ["communication_events", "os_id"],
  ["fatura_itens", "os_id"],
  ["fiscal_ctes", "ordem_servico_id"],
  ["fiscal_documentos_vinculados", "ordem_servico_id"],
  ["fiscal_mdfes", "ordem_servico_id"],
  ["fiscal_nfse", "ordem_servico_id"],
  ["ocorrencias", "os_id"],
  ["operacao_mensagens", "os_id"],
  ["os_historico", "ordem_servico_id"],
  ["os_ocorrencias", "ordem_servico_id"],
  ["os_pod", "ordem_servico_id"],
  ["pagamentos_prestadores_itens", "os_id"],
  ["prestador_os", "ordem_servico_id"],
  ["rede_oportunidades", "os_id"],
  ["reembolsos_prestador", "os_id"],
  ["tracking_public_links", "os_id"],
  ["pagamentos_prestadores", "os_id"],
  ["financeiro_receber", "os_id"],
  ["financeiro_pagar", "os_id"],
  ["composicao_financeira_os", "os_id"],
];

async function colType(c, table, col) {
  const r = await c.query(
    "select data_type from information_schema.columns where table_name=$1 and column_name=$2",
    [table, col],
  );
  return r.rows[0] ? r.rows[0].data_type : null;
}
async function del(c, table, col, ids) {
  if (!ids.length) return 0;
  const t = await colType(c, table, col);
  if (!t) return -1; // tabela/coluna inexistente
  const cast = t === "uuid" ? "uuid" : "text";
  await c.query("SAVEPOINT sp");
  try {
    const r = await c.query(
      `delete from public.${table} where ${col} = ANY($1::${cast}[])`,
      [ids],
    );
    await c.query("RELEASE SAVEPOINT sp");
    return r.rowCount;
  } catch (e) {
    await c.query("ROLLBACK TO SAVEPOINT sp");
    return `ERR:${String(e.message).slice(0, 70)}`;
  }
}

(async () => {
  const apply = process.argv.includes("--apply");
  const c = new Client({ connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query("BEGIN");

  const os = await c.query("select id::text from public.ordens_servico where numero = ANY($1)", [NUMEROS]);
  const osIds = os.rows.map((r) => r.id);
  const al = await c.query(
    "select id::text from public.alocacoes_escala where metadata->>'os_numero' = ANY($1)",
    [NUMEROS],
  );
  const alIds = al.rows.map((r) => r.id);

  console.log(`OSs: ${osIds.length} | alocações: ${alIds.length}`);
  if (!osIds.length && !alIds.length) {
    console.log("Nada a limpar.");
    await c.query("ROLLBACK");
    await c.end();
    return;
  }

  const pp = osIds.length
    ? await c.query("select id::text from public.pagamentos_prestadores where os_id = ANY($1::uuid[])", [osIds])
    : { rows: [] };
  const ppIds = pp.rows.map((r) => r.id);

  const rel = {};
  for (const [t, col] of REF_ALOC) rel[`${t}.${col}`] = await del(c, t, col, alIds);
  for (const [t, col] of REF_OS) rel[`${t}.${col}`] = await del(c, t, col, osIds);
  // baixas financeiras ligadas aos títulos de pagamento dos prestadores.
  rel["financeiro_baixas.titulo_id"] = await del(c, "financeiro_baixas", "titulo_id", ppIds);
  // filhos diretos
  rel["alocacoes_escala"] = await del(c, "alocacoes_escala", "id", alIds);
  rel["ordens_servico"] = await del(c, "ordens_servico", "id", osIds);

  console.table(rel);
  if (!apply) {
    console.log("DRY-RUN: ROLLBACK (use --apply para efetivar).");
    await c.query("ROLLBACK");
  } else {
    await c.query("COMMIT");
    console.log("COMMIT: limpeza efetivada.");
  }
  await c.end();
})().catch(async (e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
