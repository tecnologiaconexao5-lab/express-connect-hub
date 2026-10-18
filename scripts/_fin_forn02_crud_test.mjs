import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await c.connect();
  const results = [];

  // 1. INSERT fornecedor TESTE
  const insertRes = await c.query(`
    INSERT INTO fornecedores (tipo_pessoa, razao_social, nome_fantasia, cpf_cnpj, telefone, email, cidade, uf, status)
    VALUES ('PJ', 'FORNECEDOR TESTE FIN-FORN-02 LTDA', 'Teste Forn', '11222333000181', '(11) 99999-0000', 'teste@forn02.com.br', 'Sao Paulo', 'SP', 'ativo')
    RETURNING id, razao_social, cpf_cnpj, status
  `);
  const fornId = insertRes.rows[0].id;
  results.push(`1. INSERT: id=${fornId}, status=${insertRes.rows[0].status}`);

  // 2. SELECT fornecedor
  const selectRes = await c.query(`SELECT id, razao_social, cpf_cnpj, status FROM fornecedores WHERE id = $1`, [fornId]);
  results.push(`2. SELECT: ${JSON.stringify(selectRes.rows[0])}`);

  // 3. UPDATE fornecedor
  await c.query(`UPDATE fornecedores SET telefone = '(11) 88888-7777', nome_fantasia = 'Teste Updated' WHERE id = $1`, [fornId]);
  const updRes = await c.query(`SELECT telefone, nome_fantasia FROM fornecedores WHERE id = $1`, [fornId]);
  results.push(`3. UPDATE: telefone=${updRes.rows[0].telefone}, fantasia=${updRes.rows[0].nome_fantasia}`);

  // 4. INSERT financeiro_pagar com fornecedor_cadastro_id
  const pagarRes = await c.query(`
    INSERT INTO financeiro_pagar (descricao, valor, status, fornecedor_cadastro_id, fornecedor, fornecedor_nome, data_vencimento)
    VALUES ('Despesa TESTE FIN-FORN-02', 100.50, 'a vencer', $1, 'FORNECEDOR TESTE', 'FORNECEDOR TESTE FIN-FORN-02 LTDA', CURRENT_DATE + INTERVAL '30 days')
    RETURNING id, fornecedor_cadastro_id, fornecedor
  `, [fornId]);
  const pagarId = pagarRes.rows[0].id;
  results.push(`4. INSERT financeiro_pagar: id=${pagarId}, fornecedor_cadastro_id=${pagarRes.rows[0].fornecedor_cadastro_id}`);

  // 5. Verificar FK funciona
  const fkRes = await c.query(`
    SELECT fp.id, fn.razao_social, fn.cpf_cnpj
    FROM financeiro_pagar fp
    JOIN fornecedores fn ON fn.id = fp.fornecedor_cadastro_id
    WHERE fp.id = $1
  `, [pagarId]);
  results.push(`5. JOIN financeiro_pagar->fornecedores: ${JSON.stringify(fkRes.rows[0])}`);

  // 6. CPF/CNPJ duplicado (deve falhar - unique parcial)
  try {
    await c.query(`
      INSERT INTO fornecedores (tipo_pessoa, razao_social, cpf_cnpj, status)
      VALUES ('PJ', 'DUPLICADO TESTE', '11222333000181', 'ativo')
    `);
    results.push(`6. DUPLICATA: ERRO - deveria ter falhado`);
  } catch (err) {
    results.push(`6. DUPLICATA BLOQUEADA: ${err.message.substring(0, 80)}`);
  }

  // 7. Inativar fornecedor (unique parcial permite)
  await c.query(`UPDATE fornecedores SET status = 'inativo' WHERE id = $1`, [fornId]);
  try {
    await c.query(`
      INSERT INTO fornecedores (tipo_pessoa, razao_social, cpf_cnpj, status)
      VALUES ('PJ', 'Mesmo CNPJ Inativo', '11222333000181', 'ativo')
    `);
    results.push(`7. NOVO COM MESMO DOC (inativo): PERMITIDO (unique parcial OK)`);
  } catch (err) {
    results.push(`7. NOVO COM MESMO DOC: ${err.message.substring(0, 80)}`);
  }

  // 8. 101 titulos historicos intactos
  const titulos = await c.query(`SELECT count(*) as total FROM financeiro_pagar`);
  results.push(`8. TITULOS HISTORICOS: ${titulos.rows[0].total} (esperado 102 = 101 + 1 teste)`);

  // 9. fornecedor_id legado intacto
  const legado = await c.query(`SELECT count(*) as total FROM financeiro_pagar WHERE fornecedor_id IS NOT NULL`);
  results.push(`9. FORNECEDOR_ID LEGADO: ${legado.rows[0].total} registros com FK para prestadores`);

  // 10. Cleanup: remover teste
  await c.query(`DELETE FROM financeiro_pagar WHERE id = $1`, [pagarId]);
  await c.query(`DELETE FROM fornecedores WHERE id = $1`, [fornId]);
  // Remover o duplicado tambem se existe
  await c.query(`DELETE FROM fornecedores WHERE cpf_cnpj = '11222333000181'`);
  results.push(`10. CLEANUP: registros teste removidos`);

  // 11. Contagem final
  const finalCount = await c.query(`SELECT count(*) as total FROM fornecedores`);
  results.push(`11. FORNECEDORES FINAL: ${finalCount.rows[0].total} registros`);

  console.log("\n=== PROVA REAL FIN-FORN-02 ===");
  results.forEach(r => console.log(r));
  console.log("=== FIM ===");

  await c.end();
})();
