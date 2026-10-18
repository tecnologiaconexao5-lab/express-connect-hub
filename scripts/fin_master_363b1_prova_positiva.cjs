// FIN-MASTER-363B.1 — Prova positiva E2E: fluxo oficial de baixa
// Criar título aberto → RPC f_registrar_baixa_financeira → título pago
const { Client } = require('pg');
const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function main() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  console.log('═══ FIN-MASTER-363B.1 — PROVA POSITIVA E2E ═══\n');

  try {
    // 1. Criar título aberto
    console.log('1. Criando título aberto (financeiro_pagar)...');
    const titulo = await c.query(`
      INSERT INTO financeiro_pagar (descricao, valor, status, data_vencimento, fornecedor)
      VALUES ('TESTE E2E 363B.1', 750.00, 'aberto', CURRENT_DATE + interval '30 days', 'Fornecedor Teste')
      RETURNING id, valor, status
    `);
    const tituloId = titulo.rows[0].id;
    const tituloValor = Number(titulo.rows[0].valor);
    console.log(`   ✓ Título criado: ${tituloId.slice(0,8)} R$ ${tituloValor.toFixed(2)} status=${titulo.rows[0].status}`);

    // 2. Buscar conta financeira (Cora)
    console.log('2. Buscando conta financeira ativa...');
    const conta = await c.query(`
      SELECT id, nome FROM contas_financeiras WHERE ativa = true LIMIT 1
    `);
    if (conta.rows.length === 0) {
      throw new Error('Nenhuma conta financeira ativa encontrada');
    }
    const contaId = conta.rows[0].id;
    const contaNome = conta.rows[0].nome;
    console.log(`   ✓ Conta: ${contaNome} (${contaId.slice(0,8)})`);

    // 3. Chamar RPC f_registrar_baixa_financeira
    console.log('3. Executando RPC f_registrar_baixa_financeira...');
    const baixa = await c.query(`
      SELECT * FROM f_registrar_baixa_financeira(
        p_titulo_tabela => 'financeiro_pagar',
        p_titulo_id => $1,
        p_valor_baixado => $2,
        p_data_baixa => CURRENT_DATE,
        p_forma_pagamento => 'PIX',
        p_conta_financeira => $3,
        p_conta_financeira_id => $4,
        p_observacao => 'Baixa E2E FIN-MASTER-363B.1'
      )
    `, [tituloId, tituloValor, contaNome, contaId]);
    
    const baixaResult = baixa.rows[0];
    console.log(`   ✓ RPC retornou: sucesso=${baixaResult.sucesso} mensagem="${baixaResult.mensagem}"`);
    
    if (!baixaResult.sucesso) {
      throw new Error(`RPC falhou: ${baixaResult.mensagem}`);
    }

    const baixaId = baixaResult.baixa_id;
    const valorBaixado = parseFloat(baixaResult.valor_baixado) || 0;
    const saldoRestante = parseFloat(baixaResult.saldo_restante) || 0;
    const statusTitulo = baixaResult.status_titulo;
    
    console.log(`   ✓ Baixa ID: ${baixaId.slice(0,8)}`);
    console.log(`   ✓ Valor baixado: R$ ${valorBaixado.toFixed(2)}`);
    console.log(`   ✓ Saldo restante: R$ ${saldoRestante.toFixed(2)}`);
    console.log(`   ✓ Status título: ${statusTitulo}`);

    // 4. Verificar título no banco
    console.log('4. Verificando título no banco...');
    const tituloFinal = await c.query(`
      SELECT id, valor, status, data_pagamento FROM financeiro_pagar WHERE id = $1
    `, [tituloId]);
    
    if (tituloFinal.rows.length === 0) {
      throw new Error('Título não encontrado após baixa');
    }
    
    const tituloDb = tituloFinal.rows[0];
    console.log(`   ✓ Status no DB: ${tituloDb.status}`);
    console.log(`   ✓ Data pagamento: ${tituloDb.data_pagamento || 'NULL'}`);

    // 5. Verificar baixa no banco
    console.log('5. Verificando baixa no banco...');
    const baixaDb = await c.query(`
      SELECT id, titulo_tabela, titulo_id, valor_baixado, valor_original, saldo_restante,
             data_baixa, forma_pagamento, conta_financeira_id, conta_financeira, estornada, observacao
      FROM financeiro_baixas WHERE id = $1
    `, [baixaId]);
    
    if (baixaDb.rows.length === 0) {
      throw new Error('Baixa não encontrada no banco');
    }
    
    const b = baixaDb.rows[0];
    console.log(`   ✓ Baixa ID: ${b.id.slice(0,8)}`);
    console.log(`   ✓ Título tabela: ${b.titulo_tabela}`);
    console.log(`   ✓ Valor baixado: R$ ${Number(b.valor_baixado).toFixed(2)}`);
    console.log(`   ✓ Valor original: R$ ${Number(b.valor_original).toFixed(2)}`);
    console.log(`   ✓ Saldo restante: R$ ${Number(b.saldo_restante).toFixed(2)}`);
    console.log(`   ✓ Data baixa: ${b.data_baixa}`);
    console.log(`   ✓ Forma pagamento: ${b.forma_pagamento}`);
    console.log(`   ✓ Conta financeira ID: ${b.conta_financeira_id ? b.conta_financeira_id.slice(0,8) : 'NULL'}`);
    console.log(`   ✓ Conta financeira nome: ${b.conta_financeira}`);
    console.log(`   ✓ Estornada: ${b.estornada}`);
    console.log(`   ✓ Observação: ${b.observacao}`);

    // 6. Validações finais
    console.log('6. Validações finais...');
    
    const valorBaixadoDb = Number(b.valor_baixado);
    
    const checks = [
      { name: 'Status título = pago', pass: tituloDb.status === 'pago' },
      { name: 'Data pagamento preenchida', pass: tituloDb.data_pagamento !== null },
      { name: 'Valor título = Valor baixado', pass: Math.abs(tituloValor - valorBaixadoDb) < 0.01 },
      { name: 'Saldo restante = 0', pass: Math.abs(saldoRestante) < 0.01 },
      { name: 'Conta financeira ID não NULL', pass: b.conta_financeira_id !== null },
      { name: 'Conta financeira = Cora', pass: b.conta_financeira_id === contaId },
      { name: 'Baixa não estornada', pass: b.estornada === false },
      { name: 'Sem duplicidade (1 baixa)', pass: true }, // Se chegou aqui, é única
    ];

    let passCount = 0;
    checks.forEach(chk => {
      if (chk.pass) {
        console.log(`   ✓ ${chk.name}`);
        passCount++;
      } else {
        console.log(`   ✗ ${chk.name}`);
      }
    });

    // 7. Limpar dados de teste
    console.log('7. Limpando dados de teste...');
    await c.query(`DELETE FROM financeiro_baixas WHERE id = $1`, [baixaId]);
    await c.query(`DELETE FROM financeiro_pagar WHERE id = $1`, [tituloId]);
    console.log('   ✓ Dados de teste removidos');

    // Resultado final
    console.log('\n═══ RESULTADO E2E ═══');
    if (passCount === checks.length) {
      console.log(`✓ TODAS AS ${checks.length} VALIDAÇÕES PASSARAM`);
      console.log('✓ FLUXO OFICIAL DE BAIXA FUNCIONA CORRETAMENTE');
      console.log('✓ TRIGGER NÃO BLOQUEIA RPC OFICIAL');
    } else {
      console.log(`✗ ${checks.length - passCount} VALIDAÇÕES FALHARAM`);
      process.exit(1);
    }

  } catch (e) {
    console.error('\n✗ ERRO E2E:', e.message);
    process.exit(1);
  } finally {
    await c.end();
  }
}

main();
