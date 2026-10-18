// TMS-FIN-PROG-04B — Provas A..E executadas em TRANSAÇÃO com ROLLBACK.
// Nada persiste (exceto avanço de sequence, que não é transacional).
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, pr = []) => (await c.query(s, pr)).rows;
const USER = "8c12fc67-4dac-4f1e-b4fd-23cf0d168284";
const TENANT = "00000000-0000-0000-0000-000000000001";
const CLI_A = "91b80fdb-6b87-4982-a550-f863f7f15866";
const CLI_B = "a49d5aa3-5d36-4d64-b490-c41a552ae1d8";
const out = {};
try {
  await c.query("BEGIN");
  await c.query(`SET LOCAL request.jwt.claim.sub = '${USER}'`);

  const criarRascunho = async (clienteId, valor) => {
    const f = await q(`insert into faturas (tenant_id, cliente_id, data_emissao, vencimento, valor_bruto, valor_total, status, metadata)
      values ($1,$2,current_date,current_date+30,$3,$3,'rascunho','{"teste":"prog04b"}') returning id`,
      [TENANT, clienteId, valor]);
    const fid = f[0].id;
    await q(`insert into fatura_itens (fatura_id, cliente_id, descricao, data_servico, valor_base, valor_total)
      values ($1,$2,'TESTE PROG04B',current_date,$3,$3)`, [fid, clienteId, valor]);
    return fid;
  };

  // ---- TESTE A — RASCUNHO ----
  const fA = await criarRascunho(CLI_A, 100);
  const a = (await q(`select status, numero, numero_cliente, conta_receber_id from faturas where id=$1`, [fA]))[0];
  const aAR = (await q(`select count(*)::int n from financeiro_receber where fatura_id=$1`, [fA]))[0].n;
  out.TESTE_A = { status: a.status, numero: a.numero, numero_cliente: a.numero_cliente, conta_receber: a.conta_receber_id, ARs: aAR };

  // ---- TESTE B — EMISSÃO ----
  const rB = await q(`select public.f_emitir_fatura($1) r`, [fA]);
  const b = rB[0].r;
  const bRow = (await q(`select status, numero, numero_cliente, conta_receber_id, valor_total, cliente_id, vencimento from faturas where id=$1`, [fA]))[0];
  const bAR = (await q(`select id, fatura_id, valor, status, data_vencimento, cliente_id from financeiro_receber where fatura_id=$1`, [fA]));
  out.TESTE_B = { rpc: b, fatura: bRow, AR: bAR, ARs: bAR.length };

  // ---- TESTE C — IDEMPOTÊNCIA ----
  const rC = await q(`select public.f_emitir_fatura($1) r`, [fA]);
  const cRow = (await q(`select numero, numero_cliente, conta_receber_id from faturas where id=$1`, [fA]))[0];
  const cAR = (await q(`select count(*)::int n from financeiro_receber where fatura_id=$1`, [fA]))[0].n;
  const cCounter = (await q(`select ultimo_numero from fatura_contadores_cliente where tenant_id=$1 and cliente_id=$2`, [TENANT, CLI_A]))[0];
  out.TESTE_C = { rpc: rC[0].r, numero: cRow.numero, numero_cliente: cRow.numero_cliente, ARs: cAR, contadorA: cCounter?.ultimo_numero };

  // ---- TESTE D — SEQUÊNCIA POR CLIENTE ----
  const fA2 = await criarRascunho(CLI_A, 200);
  const rA2 = (await q(`select public.f_emitir_fatura($1) r`, [fA2]))[0].r;
  const fB1 = await criarRascunho(CLI_B, 300);
  const rB1 = (await q(`select public.f_emitir_fatura($1) r`, [fB1]))[0].r;
  const fB2 = await criarRascunho(CLI_B, 400);
  const rB2 = (await q(`select public.f_emitir_fatura($1) r`, [fB2]))[0].r;
  out.TESTE_D = {
    clienteA: [b.numero_cliente, rA2.numero_cliente],
    clienteB: [rB1.numero_cliente, rB2.numero_cliente],
    numerosConexao: [b.numero, rA2.numero, rB1.numero, rB2.numero],
  };

  // ---- TESTE E — BYPASS bloqueado pelo trigger ----
  const fE = await criarRascunho(CLI_A, 500);
  let bypassErro = null;
  await c.query("SAVEPOINT sp_e");
  try {
    await c.query(`UPDATE faturas SET status='emitida' WHERE id=$1`, [fE]);
  } catch (e) {
    bypassErro = e.message;
    await c.query("ROLLBACK TO SAVEPOINT sp_e");
  }
  const eRow = (await q(`select status, numero, numero_cliente, conta_receber_id from faturas where id=$1`, [fE]))[0];
  out.TESTE_E = { bloqueado: bypassErro !== null, erro: bypassErro, faturaApos: eRow };

  // ---- Unicidade estrutural de fatura_id ----
  out.UNIQUE_fatura_id_existe = (await q(`select indexname from pg_indexes where schemaname='public' and indexname='uq_receber_fatura_id'`)).length === 1;

  console.log(JSON.stringify(out, null, 2));
} finally {
  await c.query("ROLLBACK").catch(() => {});
  await c.end();
}
