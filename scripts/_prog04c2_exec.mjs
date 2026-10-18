// TMS-FIN-PROG-04C.2 — SANEAMENTO CONTROLADO.
// 1) snapshot pre  2) rollback SQL  3) valida ordem  4) migration  5) txn + validacao
import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const USER = "8c12fc67-4dac-4f1e-b4fd-23cf0d168284";
const TENANT = "00000000-0000-0000-0000-000000000001";
const CLI = "91b80fdb-6b87-4982-a550-f863f7f15866";
const REFS = ["38", "39", "40.", "41", "42"];
const AR_38 = "0eab9f84-3ff0-4a59-be5a-11fff05fddcd";
const AR_41 = "bbbaa2dc-a210-49df-abb6-d45b06e92288";

const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, pr = []) => (await c.query(s, pr)).rows;
const out = {};

try {
  // ── 0. Localizar as 5 faturas reais autorizadas ──────────────────────────
  const reais = await q(
    `select id, metadata->>'numeroManual' ref, numero, numero_cliente, status, cliente_id,
            conta_receber_id, valor_total, valor_bruto, data_emissao::text de, criado_em::text ce, vencimento::text vc
     from faturas
     where cliente_id=$1 and metadata->>'numeroManual' = any($2)`,
    [CLI, REFS]
  );
  reais.sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : a.ce < b.ce ? -1 : a.ce > b.ce ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ordem = reais.map((f) => f.ref);
  out.ordem_calculada = ordem;
  if (reais.length !== 5 || JSON.stringify(ordem) !== JSON.stringify(REFS)) {
    out.BLOCKED = "ORDEM_HISTORICA_DIVERGENTE";
    console.log(JSON.stringify(out, null, 2));
    await c.end();
    process.exit(2);
  }
  const byRef = Object.fromEntries(reais.map((f) => [f.ref, f]));

  // ── 1. Snapshot PRE ──────────────────────────────────────────────────────
  const ids = reais.map((f) => f.id);
  const snapshotPre = {
    gerado_em: new Date().toISOString(),
    faturas: await q(`select * from faturas where id = any($1) order by criado_em`, [ids]),
    ar_vinculados: await q(`select * from financeiro_receber where id = any($1)`, [[AR_38, AR_41]]),
    baixas_ar38: await q(`select * from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [AR_38]),
    contador_cliente: await q(`select * from fatura_contadores_cliente where tenant_id=$1 and cliente_id=$2`, [TENANT, CLI]),
    seq_fatura_2026: (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value ?? null,
  };
  fs.writeFileSync("temp/prog04c2_snapshot_pre.json", JSON.stringify(snapshotPre, null, 2));

  // ── 2. Rollback SQL determinístico ───────────────────────────────────────
  const idList = ids.map((i) => `'${i}'`).join(", ");
  const rollback = `-- TMS-FIN-PROG-04C.2 — ROLLBACK do saneamento (executar manualmente se necessario)
-- Observacao: a sequence seq_fatura_2026 NAO e transacional e nao pode ser revertida.
BEGIN;

-- 1) Desvincular os ARs legados das faturas 38 e 41 (NAO altera valor/status/data_pagamento/baixa)
UPDATE public.financeiro_receber SET fatura_id = NULL
 WHERE id = '${AR_38}' AND fatura_id = '${byRef["38"].id}';
UPDATE public.financeiro_receber SET fatura_id = NULL
 WHERE id = '${AR_41}' AND fatura_id = '${byRef["41"].id}';

-- 2) Remover os ARs CRIADOS para 39, 40. e 42 (nao existiam antes)
DELETE FROM public.financeiro_receber
 WHERE fatura_id IN ('${byRef["39"].id}', '${byRef["40."].id}', '${byRef["42"].id}');

-- 3) Restaurar as 5 faturas ao estado pre-saneamento (numero/numero_cliente/conta_receber_id NULL)
UPDATE public.faturas
   SET numero = NULL, numero_cliente = NULL, conta_receber_id = NULL
 WHERE id IN (${idList});

-- 4) Remover o contador do cliente 91b80fdb (nao existia antes)
DELETE FROM public.fatura_contadores_cliente
 WHERE tenant_id = '${TENANT}' AND cliente_id = '${CLI}';
COMMIT;
`;
  fs.writeFileSync("temp/prog04c2_rollback.sql", rollback);
  out.rollback_file = "temp/prog04c2_rollback.sql";
  out.snapshot_pre_file = "temp/prog04c2_snapshot_pre.json";

  // ── 3. Aplicar migration do procedimento (DDL aditivo) ───────────────────
  const migSql = fs.readFileSync("supabase/migrations/20260924000001_fin_prog04c2_regularizar_fatura_legada.sql", "utf8");
  await c.query("BEGIN");
  await c.query(migSql);
  await c.query("COMMIT");
  out.procedure_criada = true;

  // ── 4. Executar saneamento (transação única) ─────────────────────────────
  await c.query("BEGIN");
  await c.query(`SET LOCAL request.jwt.claim.sub = '${USER}'`);

  const call = async (ref, arId) => {
    const r = (await q(`select public.f_regularizar_fatura_legada($1, $2) r`, [byRef[ref].id, arId]))[0].r;
    return { ref, r };
  };
  // Ordem histórica verificada: 38, 39, 40., 41, 42
  const results = [];
  results.push(await call("38", AR_38));
  results.push(await call("39", null));
  results.push(await call("40.", null));
  results.push(await call("41", AR_41));
  results.push(await call("42", null));
  out.results = results;

  // ── 5. Validações dentro da transação ────────────────────────────────────
  const falhas = [];
  for (const res of results) if (res.r.success !== true) falhas.push(`${res.ref}: ${JSON.stringify(res.r)}`);

  const pos = await q(
    `select id, metadata->>'numeroManual' ref, numero, numero_cliente, status, conta_receber_id,
            (select count(*)::int from financeiro_receber r where r.fatura_id = f.id) n_ar
     from faturas f where id = any($1)`,
    [ids]
  );
  const posByRef = Object.fromEntries(pos.map((f) => [f.ref, f]));
  const esperadoNc = { "38": 1, "39": 2, "40.": 3, "41": 4, "42": 5 };
  for (const ref of REFS) {
    const f = posByRef[ref];
    if (!f) { falhas.push(`fatura ${ref} ausente`); continue; }
    if (f.status !== "emitida") falhas.push(`${ref}: status ${f.status}`);
    if (!f.numero) falhas.push(`${ref}: sem numero`);
    if (f.numero_cliente !== esperadoNc[ref]) falhas.push(`${ref}: numero_cliente ${f.numero_cliente} != ${esperadoNc[ref]}`);
    if (!f.conta_receber_id) falhas.push(`${ref}: sem conta_receber_id`);
    if (f.n_ar !== 1) falhas.push(`${ref}: ${f.n_ar} ARs (esperado 1)`);
  }
  const totalAr5 = (await q(`select count(*)::int n from financeiro_receber where fatura_id = any($1)`, [ids]))[0].n;
  if (totalAr5 !== 5) falhas.push(`total ARs das 5 = ${totalAr5} (esperado 5)`);

  const ar38 = (await q(`select id, fatura_id, valor, status, data_pagamento::text dp from financeiro_receber where id=$1`, [AR_38]))[0];
  if (ar38.status !== "pago") falhas.push(`AR38 status ${ar38.status} (esperado pago)`);
  if (ar38.fatura_id !== byRef["38"].id) falhas.push(`AR38 fatura_id ${ar38.fatura_id}`);
  const baixa38 = (await q(`select valor_baixado, data_baixa::text, estornada from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [AR_38]))[0];
  if (!baixa38 || baixa38.valor_baixado !== 3550.54 || baixa38.estornada) falhas.push(`baixa 38 alterada: ${JSON.stringify(baixa38)}`);

  const ar41 = (await q(`select id, fatura_id from financeiro_receber where id=$1`, [AR_41]))[0];
  if (ar41.fatura_id !== byRef["41"].id) falhas.push(`AR41 nao vinculado a 41`);

  const contador = (await q(`select ultimo_numero from fatura_contadores_cliente where tenant_id=$1 and cliente_id=$2`, [TENANT, CLI]))[0];
  if (!contador || contador.ultimo_numero !== 5) falhas.push(`contador ${contador?.ultimo_numero} (esperado 5)`);

  out.validacao = { falhas, pos: posByRef, totalAr5, ar38, baixa38, ar41, contador };
  if (falhas.length > 0) {
    await c.query("ROLLBACK");
    out.RESULT = "BLOCKED_ROLLBACK";
    console.log(JSON.stringify(out, null, 2));
    await c.end();
    process.exit(3);
  }
  await c.query("COMMIT");
  out.RESULT = "COMMIT_OK";

  // ── 6. Snapshot POST + diff ──────────────────────────────────────────────
  const idsArNovos = pos.filter((f) => ["39", "40.", "42"].includes(f.ref)).map((f) => f.conta_receber_id);
  const snapshotPos = {
    gerado_em: new Date().toISOString(),
    faturas: await q(`select * from faturas where id = any($1) order by criado_em`, [ids]),
    ar_criados: await q(`select * from financeiro_receber where id = any($1)`, [idsArNovos]),
    ar_vinculados: await q(`select * from financeiro_receber where id = any($1)`, [[AR_38, AR_41]]),
    baixas_ar38: await q(`select * from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [AR_38]),
    contador_cliente: await q(`select * from fatura_contadores_cliente where tenant_id=$1 and cliente_id=$2`, [TENANT, CLI]),
    seq_fatura_2026: (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value ?? null,
    contagens: {
      faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
      emitidas: (await q(`select count(*)::int n from faturas where status='emitida'`))[0].n,
      emitidas_sem_ar: (await q(`select count(*)::int n from faturas where status='emitida' and conta_receber_id is null`))[0].n,
      ar_com_fatura_id: (await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`))[0].n,
    },
  };
  fs.writeFileSync("temp/prog04c2_snapshot_pos.json", JSON.stringify(snapshotPos, null, 2));
  out.snapshot_pos = snapshotPos;

  console.log(JSON.stringify(out, null, 2));
  await c.end();
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("ERRO:", e.message);
  await c.end();
  process.exit(1);
}
