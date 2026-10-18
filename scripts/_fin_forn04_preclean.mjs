import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await c.connect();
  await c.query(`DELETE FROM financeiro_baixas WHERE titulo_id IN (SELECT id FROM financeiro_pagar WHERE descricao LIKE '%TESTE_FIN_FORN04%')`);
  await c.query(`DELETE FROM financeiro_pagar WHERE descricao LIKE '%TESTE_FIN_FORN04%'`);
  await c.query(`DELETE FROM fornecedores WHERE razao_social LIKE 'TESTE_FIN_FORN04%'`);
  console.log("Pre-cleanup done");
  await c.end();
})();
