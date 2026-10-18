// TMS-FIN-PROG-05C.3C — FASE 5: snapshot + rollback (read-only; escreve arquivos).
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const FID = "e5318b9d-120a-4a2b-a077-bebcdf8cf34c";
const AR = "bb5c0efe-3193-49ee-a6cb-d213bee69f72";
const CLI = "91b80fdb-6b87-4982-a550-f863f7f15866";
const TENANT = "00000000-0000-0000-0000-000000000001";

const fatura = (await q(`select * from faturas where id=$1`, [FID]))[0];
const ar = (await q(`select * from financeiro_receber where id=$1`, [AR]))[0];
const baixa = await q(`select * from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1 and not estornada`, [AR]);
const contador = (await q(`select * from fatura_contadores_cliente where tenant_id=$1 and cliente_id=$2`, [TENANT, CLI]))[0];
const seq = (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value;
const arFatura = await q(`select id from financeiro_receber where fatura_id=$1`, [FID]);

const okEquiv = fatura.status === "rascunho" && !fatura.numero && !fatura.conta_receber_id
  && ar && ar.status === "aberto" && !ar.data_pagamento && baixa.length === 0
  && Number(ar.valor) === 600 && ar.os_id === "58e5751e-bd54-43c5-9bcf-55fe4e575e6b"
  && ar.cliente_id === CLI && ar.is_teste === false && arFatura.length === 0;
if (!okEquiv) { console.log(JSON.stringify({ BLOCKED: true, fatura, ar, baixa, arFatura }, null, 2)); process.exit(2); }

const snap = {
  gerado_em: new Date().toISOString(),
  fatura_antes: fatura,
  ar_legado_antes: ar,
  baixas_ar: baixa,
  contador_antes: contador,
  seq_antes: seq,
  classificacao_equivalencia: "E2",
};
fs.writeFileSync("temp/prog05c3c_snapshot_pre.json", JSON.stringify(snap, null, 2));

const obs = ar.observacoes == null ? "NULL" : `'${String(ar.observacoes).replace(/'/g, "''")}'`;
const rollback = `-- TMS-FIN-PROG-05C.3C — ROLLBACK (restaura estado pre-reconciliacao)
-- Obs: a sequence seq_fatura_2026 nao e transacional e nao pode ser revertida.
BEGIN;
-- 1) Restaurar AR legado ao estado anterior
UPDATE public.financeiro_receber SET status='${ar.status}', observacoes=${obs}
 WHERE id='${AR}';
-- 2) Restaurar a fatura ao estado rascunho (sem numero/numero_cliente/AR)
UPDATE public.faturas SET status='${fatura.status}', numero=NULL, numero_cliente=NULL, conta_receber_id=NULL
 WHERE id='${FID}';
-- 3) Remover o AR oficial criado pela emissao (nao existia antes)
DELETE FROM public.financeiro_receber WHERE fatura_id='${FID}';
-- 4) Restaurar contador do cliente
UPDATE public.fatura_contadores_cliente SET ultimo_numero=${contador ? contador.ultimo_numero : 0}
 WHERE tenant_id='${TENANT}' AND cliente_id='${CLI}';
COMMIT;
`;
fs.writeFileSync("temp/prog05c3c_rollback.sql", rollback);

console.log(JSON.stringify({
  ok: true, equivalencia: "E2",
  fatura: { id: fatura.id, status: fatura.status, valor_total: fatura.valor_total, venc: fatura.vencimento },
  ar_legado: { id: ar.id, valor: ar.valor, status: ar.status, os_id: ar.os_id, is_teste: ar.is_teste },
  tem_baixa: baixa.length, ar_por_fatura: arFatura.length,
  contador: contador?.ultimo_numero, seq,
  arquivos: ["temp/prog05c3c_snapshot_pre.json", "temp/prog05c3c_rollback.sql"],
}, null, 2));
await p.end();
