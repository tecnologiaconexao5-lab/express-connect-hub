// F0-D — validação comportamental dos RPCs p/ financeiro_receber (PRODUÇÃO, transacional).
// Tudo em BEGIN...ROLLBACK — NENHUM dado persistido.
// Cobre: baixa parcial/total/excedente, estorno (volta a aberto + data_pagamento NULL),
// bloqueio de baixa dupla, e regressão do branch financeiro_pagar.
import pg from "pg";
import "dotenv/config";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let passou = 0;
let falhou = 0;
function check(nome, cond, extra = "") {
  if (cond) { passou++; console.log(`  ✅ ${nome}`); }
  else { falhou++; console.log(`  ❌ ${nome} ${extra}`); }
}

async function main() {
  await c.connect();
  await c.query("BEGIN");

  // IDs reais (somente leitura) p/ respeitar FKs em produção
  const cid = await c.query("SELECT cliente_id FROM financeiro_receber WHERE cliente_id IS NOT NULL LIMIT 1");
  const pid = await c.query("SELECT fornecedor_id FROM financeiro_pagar WHERE fornecedor_id IS NOT NULL LIMIT 1");
  const clienteReal = cid.rows[0]?.cliente_id;
  const fornecedorReal = pid.rows[0]?.fornecedor_id;
  if (!clienteReal || !fornecedorReal) throw new Error("Sem cliente/fornecedor real para teste transacional");

  // -- título receber temporário (será desfeito no ROLLBACK)
  const r1 = await c.query(
    `INSERT INTO financeiro_receber (cliente_id, cliente_nome, descricao, valor, valor_bruto, valor_liquido,
                                     status, data_vencimento, conta_entrada, observacoes)
     VALUES ($1, 'HML F0-D', 'Titulo teste baixa', 1000.00, 1000.00, 1000.00,
             'aberto', CURRENT_DATE + 30, 'itau', 'origem F0-D validacao')
     RETURNING id`,
    [clienteReal]
  );
  const idRec = r1.rows[0].id;

  // 1. Baixa parcial (400) → status parcial, saldo 600
  const b1 = await c.query(
    `SELECT * FROM f_registrar_baixa_financeira('financeiro_receber', $1::uuid, 400.00, CURRENT_DATE, 'pix', 'itau', 'REF-001', 'obs', NULL, NULL)`,
    [idRec]
  );
  check("baixa parcial receber: sucesso", b1.rows[0].sucesso === true, b1.rows[0].mensagem);
  check("baixa parcial receber: status parcial", b1.rows[0].status_titulo === "parcial");
  check("baixa parcial receber: saldo 600.00", Number(b1.rows[0].saldo_restante) === 600);

  const st1 = await c.query(`SELECT status, data_pagamento, conta_entrada, observacoes FROM financeiro_receber WHERE id=$1`, [idRec]);
  check("título receber atualizado: status parcial", st1.rows[0].status === "parcial");
  check("título receber atualizado: data_pagamento preenchida", st1.rows[0].data_pagamento !== null);
  check("título receber atualizado: conta_entrada=itau", st1.rows[0].conta_entrada === "itau");
  check("título receber atualizado: observacoes com historico", (st1.rows[0].observacoes || "").includes("Baixa R$ 400"));

  const baixas1 = await c.query(
    `SELECT COUNT(*)::int AS n, saldo_restante FROM financeiro_baixas WHERE titulo_tabela='financeiro_receber' AND titulo_id=$1 AND NOT estornada GROUP BY saldo_restante`,
    [idRec]
  );
  check("livro de baixas: 1 registro receber", baixas1.rows.length === 1 && baixas1.rows[0].n === 1);

  // 2. Baixa excedente (700 > 600) → erro
  const b2 = await c.query(
    `SELECT * FROM f_registrar_baixa_financeira('financeiro_receber', $1::uuid, 700.00)`,
    [idRec]
  );
  check("baixa excedente: bloqueada", b2.rows[0].sucesso === false, b2.rows[0].mensagem);

  // 3. Baixa total (600) → status pago, saldo 0
  const b3 = await c.query(
    `SELECT * FROM f_registrar_baixa_financeira('financeiro_receber', $1::uuid, 600.00)`,
    [idRec]
  );
  check("baixa total receber: sucesso", b3.rows[0].sucesso === true);
  check("baixa total receber: status pago", b3.rows[0].status_titulo === "pago");
  check("baixa total receber: saldo 0.00", Number(b3.rows[0].saldo_restante) === 0);

  // 4. Baixa em título já pago → erro
  const b4 = await c.query(
    `SELECT * FROM f_registrar_baixa_financeira('financeiro_receber', $1::uuid, 1.00)`,
    [idRec]
  );
  check("baixa em título pago: bloqueada", b4.rows[0].sucesso === false, b4.rows[0].mensagem);

  // 5. Estorno da 2ª baixa (total) → volta parcial, saldo 600
  const b5 = await c.query(`SELECT * FROM f_estornar_baixa_financeira($1::uuid, 'estorno teste')`, [b3.rows[0].baixa_id]);
  check("estorno (2a baixa): sucesso", b5.rows[0].sucesso === true);
  check("estorno (2a baixa): volta parcial", b5.rows[0].status_titulo === "parcial");
  check("estorno (2a baixa): saldo 600", Number(b5.rows[0].saldo_restante) === 600);

  const st5 = await c.query(`SELECT status FROM financeiro_receber WHERE id=$1`, [idRec]);
  check("título após estorno parcial: status parcial", st5.rows[0].status === "parcial");

  // 6. Estorno da 1ª baixa (parcial) → sem baixas válidas → aberto + data_pagamento NULL
  const b6 = await c.query(`SELECT * FROM f_estornar_baixa_financeira($1::uuid, 'estorno total')`, [b1.rows[0].baixa_id]);
  check("estorno (1a baixa): sucesso", b6.rows[0].sucesso === true);
  check("estorno (1a baixa): volta aberto", b6.rows[0].status_titulo === "aberto");

  const st6 = await c.query(`SELECT status, data_pagamento FROM financeiro_receber WHERE id=$1`, [idRec]);
  check("título após estorno total: status aberto", st6.rows[0].status === "aberto");
  check("título após estorno total: data_pagamento NULL", st6.rows[0].data_pagamento === null);

  const baixas6 = await c.query(
    `SELECT COUNT(*)::int AS n FROM financeiro_baixas WHERE titulo_tabela='financeiro_receber' AND titulo_id=$1 AND NOT estornada`,
    [idRec]
  );
  check("livro: 0 baixas válidas restantes", baixas6.rows[0].n === 0);

  // 7. Estorno duplo → erro
  const b7 = await c.query(`SELECT * FROM f_estornar_baixa_financeira($1::uuid, 'x')`, [b1.rows[0].baixa_id]);
  check("estorno duplo: bloqueado", b7.rows[0].sucesso === false, b7.rows[0].mensagem);

  // 8. Regressão financeiro_pagar (branch original)
  const r8 = await c.query(
    `INSERT INTO financeiro_pagar (fornecedor_id, descricao, valor, status, data_vencimento)
     VALUES ($1, 'HML F0-D pagar', 500.00, 'pendente', CURRENT_DATE + 10)
     RETURNING id`,
    [fornecedorReal]
  );
  const idPag = r8.rows[0].id;
  const b8 = await c.query(
    `SELECT * FROM f_registrar_baixa_financeira('financeiro_pagar', $1::uuid, 200.00)`,
    [idPag]
  );
  check("regressão pagar: baixa ok", b8.rows[0].sucesso === true && b8.rows[0].status_titulo === "parcial", b8.rows[0].mensagem);
  const b8b = await c.query(`SELECT * FROM f_estornar_baixa_financeira($1::uuid)`, [b8.rows[0].baixa_id]);
  check("regressão pagar: estorno ok (aberto)", b8b.rows[0].sucesso === true && b8b.rows[0].status_titulo === "aberto", b8b.rows[0].mensagem);

  // 9. Tabela inválida → erro
  const b9 = await c.query(`SELECT * FROM f_registrar_baixa_financeira('foo', $1::uuid, 10.00)`, [idRec]);
  check("tabela inválida: bloqueada", b9.rows[0].sucesso === false, b9.rows[0].mensagem);

  await c.query("ROLLBACK");
  console.log(`\nRESULTADO: ${passou} PASS / ${falhou} FAIL`);
  await c.end();
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch(async (e) => {
  try { await c.query("ROLLBACK"); } catch {}
  console.error("ERRO:", e.message);
  process.exit(1);
});