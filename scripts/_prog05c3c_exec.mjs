// TMS-FIN-PROG-05C.3C — FASE 6: emissao oficial + cancelamento logico do AR legado.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, pr = []) => (await c.query(s, pr)).rows;
const USER = "8c12fc67-4dac-4f1e-b4fd-23cf0d168284";
const FID = "e5318b9d-120a-4a2b-a077-bebcdf8cf34c";
const AR = "bb5c0efe-3193-49ee-a6cb-d213bee69f72";
const out = {};
try {
  await c.query("BEGIN");
  await c.query(`SET LOCAL request.jwt.claim.sub = '${USER}'`);

  // Revalidacao
  const fat = (await q(`select status, numero, conta_receber_id, valor_total from faturas where id=$1`, [FID]))[0];
  const arL = (await q(`select status, valor, os_id, cliente_id, data_pagamento, is_teste from financeiro_receber where id=$1`, [AR]))[0];
  const baixa = (await q(`select count(*)::int n from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1 and not estornada`, [AR]))[0].n;
  const arFat0 = (await q(`select count(*)::int n from financeiro_receber where fatura_id=$1`, [FID]))[0].n;
  const ok = fat.status === "rascunho" && !fat.numero && !fat.conta_receber_id
    && arL.status === "aberto" && arL.valor === 600 && !arL.data_pagamento && !arL.is_teste
    && baixa === 0 && arFat0 === 0;
  out.revalidacao = { ok, fat, arL, baixa, arFat0 };
  if (!ok) { await c.query("ROLLBACK"); out.RESULT = "BLOCKED_REVALIDACAO"; console.log(JSON.stringify(out, null, 2)); await c.end(); process.exit(3); }

  // Emissao oficial
  const emit = (await q(`select public.f_emitir_fatura($1) r`, [FID]))[0].r;
  out.emissao = emit;
  if (!emit || emit.success !== true) { await c.query("ROLLBACK"); out.RESULT = "BLOCKED_EMISSAO"; console.log(JSON.stringify(out, null, 2)); await c.end(); process.exit(3); }

  // Cancelamento logico do AR legado equivalente
  await c.query(`UPDATE public.financeiro_receber
     SET status='cancelado',
         observacoes = COALESCE(observacoes,'') || ' | AR operacional legado substituído pelo AR oficial da fatura ' || $2 || '.'
     WHERE id=$1`, [AR, emit.numero]);

  // Validacoes pos
  const falhas = [];
  const fatPos = (await q(`select status, numero, numero_cliente, conta_receber_id, valor_total from faturas where id=$1`, [FID]))[0];
  if (fatPos.status !== "emitida") falhas.push("fatura nao emitida");
  if (!fatPos.numero) falhas.push("sem Nº Conexao");
  if (fatPos.numero_cliente == null) falhas.push("sem Nº Cliente");
  const arFat = await q(`select id, valor, cliente_id, vencimento::text, status from financeiro_receber where fatura_id=$1`, [FID]);
  if (arFat.length !== 1) falhas.push(`AR por fatura = ${arFat.length}`);
  const arLpos = (await q(`select status, valor, os_id, observacoes from financeiro_receber where id=$1`, [AR]))[0];
  if (arLpos.status !== "cancelado") falhas.push("AR legado nao cancelado");
  const baixaPos = (await q(`select count(*)::int n from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [AR]))[0].n;
  if (baixaPos !== 0) falhas.push("baixa criada indevidamente");
  const contador = (await q(`select ultimo_numero from fatura_contadores_cliente where cliente_id='91b80fdb-6b87-4982-a550-f863f7f15866'`))[0];
  if (!contador || contador.ultimo_numero !== 6) falhas.push(`contador ${contador?.ultimo_numero}`);

  out.validacao = { falhas, fatPos, arFat, arLpos, baixaPos, contador };
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
