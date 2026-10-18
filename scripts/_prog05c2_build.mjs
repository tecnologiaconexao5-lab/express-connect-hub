// TMS-FIN-PROG-05C.2 — build: snapshot pre + lista 77 + rollback (SEM escrita).
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const cls = JSON.parse(fs.readFileSync("temp/prog05c1.json", "utf8").replace(/^\uFEFF/, ""));
const dRows = cls.rows.filter((r) => r.classe === "D");
const dIds = dRows.map((r) => r.id);
if (dIds.length !== 77) { console.log(JSON.stringify({ BLOCKED: "D != 77", n: dIds.length })); process.exit(2); }

// Revalida existência + os_id + classe
const dbRows = await q(`select id, os_id, is_teste, status, valor, data_pagamento::text dp from financeiro_receber where id = any($1)`, [dIds]);
if (dbRows.length !== 77) { console.log(JSON.stringify({ BLOCKED: "existem menos de 77 na base", n: dbRows.length })); process.exit(2); }
const dbMap = Object.fromEntries(dbRows.map((r) => [r.id, r]));
const divergencias = [];
for (const r of dRows) {
  const d = dbMap[r.id];
  if (!d) divergencias.push(`${r.id} ausente`);
  else if (String(d.os_id) !== String(r.os_id)) divergencias.push(`${r.id} os_id divergente`);
}
if (divergencias.length) { console.log(JSON.stringify({ BLOCKED: "divergencias", divergencias })); process.exit(2); }

const ar75 = (await q(`select * from financeiro_receber where id='75e0e5f0-c512-49b6-9542-716362705c08'`))[0];
if (!ar75) { console.log(JSON.stringify({ BLOCKED: "75e0e5f0 ausente" })); process.exit(2); }
const antiDef = (await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_trg_fatura_itens_anti_duplicidade'`))[0].def;

const snapshot = {
  gerado_em: new Date().toISOString(),
  d_ids: dRows.map((r) => ({ id: r.id, os_id: r.os_id, is_teste_antes: dbMap[r.id].is_teste, status_antes: dbMap[r.id].status, dp_antes: dbMap[r.id].dp })),
  ar_75e0e5f0_antes: ar75,
  anti_dup_def_original: antiDef,
  contagens_pre: {
    receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
    receber_test_true: (await q(`select count(*)::int n from financeiro_receber where is_teste=true`))[0].n,
    baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
    ar_oficial_346687cf: (await q(`select id, valor, status from financeiro_receber where id='346687cf-f35d-4cde-8a26-47bdcff46de1'`))[0],
  },
};
fs.writeFileSync("temp/prog05c2_snapshot_pre.json", JSON.stringify(snapshot, null, 2));

// Rollback
const falsos = dRows.filter((r) => dbMap[r.id].is_teste !== true).map((r) => `'${r.id}'`);
const verdadeiros = dRows.filter((r) => dbMap[r.id].is_teste === true).map((r) => `'${r.id}'`);
const obs = ar75.observacoes === null || ar75.observacoes === undefined ? "NULL" : `'${String(ar75.observacoes).replace(/'/g, "''")}'`;
const rollback = `-- TMS-FIN-PROG-05C.2 — ROLLBACK (restaura estado anterior)
BEGIN;
UPDATE public.financeiro_receber SET is_teste = false
 WHERE id IN (${falsos.length ? falsos.join(",") : "NULL"});
UPDATE public.financeiro_receber SET is_teste = true
 WHERE id IN (${verdadeiros.length ? verdadeiros.join(",") : "NULL"});
UPDATE public.financeiro_receber SET status = '${ar75.status}', observacoes = ${obs}
 WHERE id = '75e0e5f0-c512-49b6-9542-716362705c08';

${antiDef};
COMMIT;
`;
fs.writeFileSync("temp/prog05c2_rollback.sql", rollback);

console.log(JSON.stringify({
  ok: true,
  d_total: dIds.length,
  d_ja_is_teste_true: verdadeiros.length,
  d_is_teste_false: falsos.length,
  ar75_status: ar75.status,
  ar75_valor: ar75.valor,
  ar75_os_id: ar75.os_id,
  contagens_pre: snapshot.contagens_pre,
  arquivos: ["temp/prog05c2_snapshot_pre.json", "temp/prog05c2_rollback.sql"],
}, null, 2));
await p.end();
