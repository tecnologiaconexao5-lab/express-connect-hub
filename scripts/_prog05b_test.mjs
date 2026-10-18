// TMS-FIN-PROG-05B — provas A(M66) B(M80) C(fatura) em TRANSACAO com ROLLBACK.
import pg from "pg";
import fs from "node:fs";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const USER = "8c12fc67-4dac-4f1e-b4fd-23cf0d168284";
const TENANT = "00000000-0000-0000-0000-000000000001";
const PREST = "6cc41f68-1467-455d-b8d5-c61bfe72cb7c";
const CLI = "3d2d079d-708b-4d4d-9c0b-1ed9b894e37e";
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, pr = []) => (await c.query(s, pr)).rows;
const out = {};
try {
  await c.query("BEGIN");

  // ---- TESTE A — M66 (alocacao) ----
  const aId = (await q(
    `insert into alocacoes_escala (status, finalizada, valor_frete, valor_repasse, valor_pedagio,
       prestador_id, cliente_id, data_escala, tipo_veiculo, origem, destino, observacoes)
     values ('concluida', true, 1000, 600, 50, $1, $2, current_date, 'truck', 'ORIG', 'DEST', 'TESTE PROG05B M66')
     returning id`, [PREST, CLI]))[0].id;
  out.TESTE_A = {
    alocacao_id: aId,
    os_criada: (await q(`select id, numero, status, valor_cliente, custo_prestador from ordens_servico where id=$1`, [aId])).length === 1,
    financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar where os_id=$1`, [aId]))[0].n,
    pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores where os_id=$1`, [aId]))[0].n,
    composicao: (await q(`select count(*)::int n from composicao_financeira_os where os_id=$1`, [aId]))[0].n,
    financeiro_receber_por_os: (await q(`select count(*)::int n from financeiro_receber where os_id=$1`, [aId]))[0].n,
  };

  // ---- TESTE B — M80 (OS direta) ----
  const bId = (await q(
    `insert into ordens_servico (numero, cliente, prestador, cliente_id, prestador_id, status, data,
       valor_cliente, custo_prestador, pedagio, tipo_veiculo, origem, destino)
     values ('TESTE-PROG05B-M80', $1, $2, 'HOMOLOGACAO APP', 'PREST TESTE', 'finalizada', current_date,
       1000, 600, 50, 'truck', 'ORIG', 'DEST')
     returning id`, [CLI, PREST]))[0].id;
  out.TESTE_B = {
    os_id: bId,
    financeiro_pagar: (await q(`select count(*)::int n from financeiro_pagar where os_id=$1::text`, [bId]))[0].n,
    pagamentos_prestadores: (await q(`select count(*)::int n from pagamentos_prestadores where os_id=$1`, [bId]))[0].n,
    composicao: (await q(`select count(*)::int n from composicao_financeira_os where os_id=$1`, [bId]))[0].n,
    financeiro_receber_por_os: (await q(`select count(*)::int n from financeiro_receber where os_id=$1::text`, [bId]))[0].n,
  };

  // ---- TESTE C — f_emitir_fatura ----
  await c.query(`SET LOCAL request.jwt.claim.sub = '${USER}'`);
  const fId = (await q(
    `insert into faturas (tenant_id, cliente_id, data_emissao, vencimento, valor_bruto, valor_total, status, metadata)
     values ($1,$2,current_date,current_date+30,500,500,'rascunho','{"teste":"prog05b"}') returning id`, [TENANT, CLI]))[0].id;
  await q(`insert into fatura_itens (fatura_id, cliente_id, descricao, data_servico, valor_base, valor_total)
     values ($1,$2,'TESTE PROG05B FATURA',current_date,500,500)`, [fId, CLI]);
  const arRascunho = (await q(`select count(*)::int n from financeiro_receber where fatura_id=$1`, [fId]))[0].n;
  const em1 = (await q(`select public.f_emitir_fatura($1) r`, [fId]))[0].r;
  const ar1 = (await q(`select count(*)::int n from financeiro_receber where fatura_id=$1`, [fId]))[0].n;
  const em2 = (await q(`select public.f_emitir_fatura($1) r`, [fId]))[0].r;
  const ar2 = (await q(`select count(*)::int n from financeiro_receber where fatura_id=$1`, [fId]))[0].n;
  out.TESTE_C = { fatura_id: fId, ar_rascunho: arRascunho, emit1: em1, ar_pos_1: ar1, emit2: em2, ar_pos_2: ar2 };

  // ---- Inventario de funcoes que ainda mencionam INSERT financeiro_receber ----
  out.funcoes_com_insert_receber = await q(`
    select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and pg_get_functiondef(p.oid) ilike '%INSERT INTO financeiro_receber%'
    order by 1`);

  console.log(JSON.stringify(out, null, 2));
} catch (e) {
  out.ERRO = e.message;
  console.log(JSON.stringify(out, null, 2));
} finally {
  await c.query("ROLLBACK").catch(() => {});
  await c.end();
}
