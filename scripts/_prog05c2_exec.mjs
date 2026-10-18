// TMS-FIN-PROG-05C.2 — execução transacional das 3 ações autorizadas.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, pr = []) => (await c.query(s, pr)).rows;
const out = {};
const D_IDS = JSON.parse(fs.readFileSync("temp/prog05c2_snapshot_pre.json", "utf8").replace(/^\uFEFF/, "")).d_ids.map((d) => d.id);

try {
  await c.query("BEGIN");
  // Migration anti-duplicidade
  await c.query(fs.readFileSync("supabase/migrations/20260924000003_fin_prog05c2_anti_duplicidade_alocacao.sql", "utf8"));

  // Revalidar 75e0e5f0
  const ar = (await q(`select id, os_id, cliente_id, status, valor, observacoes, data_pagamento, fatura_id from financeiro_receber where id='75e0e5f0-c512-49b6-9542-716362705c08'`))[0];
  const baixa = (await q(`select count(*)::int n from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id='75e0e5f0-c512-49b6-9542-716362705c08' and not estornada`))[0].n;
  const itemFat = (await q(`select fi.fatura_id, f.numero, f.conta_receber_id, f.status from fatura_itens fi join faturas f on f.id=fi.fatura_id where fi.fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb' and fi.alocacao_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`))[0];
  const arOficial = (await q(`select id, valor, status from financeiro_receber where id='346687cf-f35d-4cde-8a26-47bdcff46de1'`))[0];
  const ok75 = ar && ar.status === "aberto" && ar.os_id === "c0a7ee88-e0f9-470b-8fe0-0bb141ff4501"
    && baixa === 0 && itemFat && itemFat.conta_receber_id === "346687cf-f35d-4cde-8a26-47bdcff46de1"
    && arOficial && arOficial.valor === 2120 && arOficial.status === "aberto";
  out.revalidacao_75 = { ok: !!ok75, ar, baixa, itemFat, arOficial };
  if (!ok75) { await c.query("ROLLBACK"); out.RESULT = "BLOCKED_75"; console.log(JSON.stringify(out, null, 2)); await c.end(); process.exit(3); }

  // Ação 2 — marcar 77 como teste
  const upd77 = await c.query(`UPDATE financeiro_receber SET is_teste=true WHERE id = any($1)`, [D_IDS]);
  out.upd77 = upd77.rowCount;

  // Ação 3 — cancelar logicamente 75e0e5f0
  await c.query(`UPDATE financeiro_receber
    SET status='cancelado',
        observacoes = COALESCE(observacoes, '') || ' | AR operacional legado substituído pelo AR oficial da FAT-2026-000001.'
    WHERE id='75e0e5f0-c512-49b6-9542-716362705c08'`);

  // Validações
  const falhas = [];
  const dTest = (await q(`select count(*)::int n from financeiro_receber where id = any($1) and is_teste=true`, [D_IDS]))[0].n;
  if (dTest !== 77) falhas.push(`is_teste true entre D = ${dTest}`);
  const ar75pos = (await q(`select status from financeiro_receber where id='75e0e5f0-c512-49b6-9542-716362705c08'`))[0];
  if (ar75pos.status !== "cancelado") falhas.push(`75 status ${ar75pos.status}`);
  const arOfPos = (await q(`select valor, status from financeiro_receber where id='346687cf-f35d-4cde-8a26-47bdcff46de1'`))[0];
  if (arOfPos.valor !== 2120 || arOfPos.status !== "aberto") falhas.push(`AR oficial alterado`);
  const totalPos = (await q(`select count(*)::int n from financeiro_receber`))[0].n;
  if (totalPos !== 122) falhas.push(`receber_total ${totalPos}`);
  const baixasPos = (await q(`select count(*)::int n from financeiro_baixas`))[0].n;
  if (baixasPos !== 19) falhas.push(`baixas_total ${baixasPos}`);

  out.validacao = { falhas, dTest, ar75pos, arOfPos, totalPos, baixasPos };
  if (falhas.length) { await c.query("ROLLBACK"); out.RESULT = "BLOCKED_VALIDACAO"; console.log(JSON.stringify(out, null, 2)); await c.end(); process.exit(3); }
  await c.query("COMMIT");
  out.RESULT = "COMMIT_OK";
  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("ERRO:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
