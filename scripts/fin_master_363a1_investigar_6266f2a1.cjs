// Investigação completa do pagamento 6266f2a1

const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function query(client, sql, params = []) {
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (e) {
    console.error(`Erro na query: ${e.message}\nSQL: ${sql}`);
    return [];
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  
  try {
    await client.connect();
    console.log('✓ Conectado ao banco (read-only)\n');

    const PAYMENT_ID = '6266f2a1-8f42-4898-9e44-a1fbd23add7b';
    const PRESTADOR_ID = 'fe7a75cc-a49f-43ef-a0b7-f869fbf07744';

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. DADOS COMPLETOS DO PAGAMENTO
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('═══ 1. DADOS DO PAGAMENTO 6266f2a1 ═══\n');
    
    const pagamento = await query(client, `
      SELECT 
        pp.*,
        p.nome_completo as prestador_nome_completo,
        p.cpf_cnpj as prestador_cpf_cnpj
      FROM pagamentos_prestadores pp
      LEFT JOIN prestadores p ON pp.prestador_id = p.id
      WHERE pp.id = $1
    `, [PAYMENT_ID]);
    
    console.log('Pagamento completo:');
    console.log(JSON.stringify(pagamento[0], null, 2));

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. BAIXAS ASSOCIADAS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 2. BAIXAS ASSOCIADAS ═══\n');
    
    const baixas = await query(client, `
      SELECT 
        b.*,
        c.nome as conta_nome
      FROM financeiro_baixas b
      LEFT JOIN contas_financeiras c ON b.conta_financeira_id = c.id
      WHERE b.observacao LIKE $1
        AND b.estornada = false
      ORDER BY b.created_at
    `, [`%6266f2a1%`]);
    
    console.log(`Total de baixas: ${baixas.length}`);
    baixas.forEach((b, i) => {
      console.log(`\n[Baixa ${i+1}]`);
      console.log(`  ID: ${b.id}`);
      console.log(`  Título ID: ${b.titulo_id}`);
      console.log(`  Valor: R$ ${b.valor_baixado}`);
      console.log(`  Data: ${b.data_baixa}`);
      console.log(`  Conta: ${b.conta_nome} (${b.conta_financeira_id})`);
      console.log(`  Observação: ${b.observacao}`);
      console.log(`  Criado: ${b.created_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. TÍTULOS FINANCEIRO_PAGAR DO PRESTADOR
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 3. TÍTULOS FINANCEIRO_PAGAR DO PRESTADOR ═══\n');
    
    const titulos = await query(client, `
      SELECT 
        fp.*,
        c.nome as conta_nome
      FROM financeiro_pagar fp
      LEFT JOIN contas_financeiras c ON fp.conta_financeira_id = c.id
      WHERE fp.prestador = $1
        AND fp.created_at >= '2026-09-01'
        AND fp.created_at <= '2026-09-10'
      ORDER BY fp.created_at
    `, ['CESAR AUGUSTO HOLANDA SILVA']);
    
    console.log(`Total de títulos: ${titulos.length}`);
    titulos.forEach((t, i) => {
      console.log(`\n[Título ${i+1}]`);
      console.log(`  ID: ${t.id}`);
      console.log(`  Valor: R$ ${t.valor}`);
      console.log(`  Status: ${t.status}`);
      console.log(`  OS ID: ${t.os_id || 'N/A'}`);
      console.log(`  Descrição: ${t.descricao || 'N/A'}`);
      console.log(`  Data Vencimento: ${t.data_vencimento}`);
      console.log(`  Data Pagamento: ${t.data_pagamento || 'N/A'}`);
      console.log(`  Conta: ${t.conta_nome || 'N/A'} (${t.conta_financeira_id || 'N/A'})`);
      console.log(`  Observações: ${t.observacoes || 'N/A'}`);
      console.log(`  Criado: ${t.created_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. ALOCAÇÕES DE ESCALA DO PRESTADOR
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 4. ALOCAÇÕES DE ESCALA DO PRESTADOR ═══\n');
    
    const alocacoes = await query(client, `
      SELECT 
        ae.id,
        ae.cliente_nome,
        ae.origem,
        ae.destino,
        ae.data_escala,
        ae.valor_frete,
        ae.status,
        ae.finalizada,
        ae.metadata,
        ae.created_at
      FROM alocacoes_escala ae
      WHERE ae.prestador_id = $1
        AND ae.created_at >= '2026-09-01'
        AND ae.created_at <= '2026-09-10'
      ORDER BY ae.created_at
    `, [PRESTADOR_ID]);
    
    console.log(`Total de alocações: ${alocacoes.length}`);
    alocacoes.forEach((a, i) => {
      console.log(`\n[Alocação ${i+1}]`);
      console.log(`  ID: ${a.id}`);
      console.log(`  Cliente: ${a.cliente_nome}`);
      console.log(`  Origem: ${a.origem}`);
      console.log(`  Destino: ${a.destino}`);
      console.log(`  Data Escala: ${a.data_escala}`);
      console.log(`  Valor Frete: R$ ${a.valor_frete}`);
      console.log(`  Status: ${a.status}`);
      console.log(`  Finalizada: ${a.finalizada}`);
      console.log(`  Metadata: ${JSON.stringify(a.metadata)}`);
      console.log(`  Criado: ${a.created_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. ORDENS DE SERVIÇO DO PRESTADOR
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 5. ORDENS DE SERVIÇO DO PRESTADOR ═══\n');
    
    const ordens = await query(client, `
      SELECT 
        os.id,
        os.numero,
        os.cliente,
        os.origem,
        os.destino,
        os.data,
        os.valor_cliente,
        os.custo_prestador,
        os.status,
        os.metadata,
        os.created_at
      FROM ordens_servico os
      WHERE os.prestador_id = $1
        AND os.created_at >= '2026-09-01'
        AND os.created_at <= '2026-09-10'
      ORDER BY os.created_at
    `, [PRESTADOR_ID]);
    
    console.log(`Total de OS: ${ordens.length}`);
    ordens.forEach((o, i) => {
      console.log(`\n[OS ${i+1}]`);
      console.log(`  ID: ${o.id}`);
      console.log(`  Número: ${o.numero}`);
      console.log(`  Cliente: ${o.cliente}`);
      console.log(`  Origem: ${o.origem}`);
      console.log(`  Destino: ${o.destino}`);
      console.log(`  Data: ${o.data}`);
      console.log(`  Valor Cliente: R$ ${o.valor_cliente}`);
      console.log(`  Custo Prestador: R$ ${o.custo_prestador}`);
      console.log(`  Status: ${o.status}`);
      console.log(`  Metadata: ${JSON.stringify(o.metadata)}`);
      console.log(`  Criado: ${o.created_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. PAGAMENTOS DO MESMO PRESTADOR NO PERÍODO
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 6. OUTROS PAGAMENTOS DO MESMO PRESTADOR ═══\n');
    
    const outrosPagamentos = await query(client, `
      SELECT 
        pp.id,
        pp.valor_liquido,
        pp.status_pagamento,
        pp.data_pagamento,
        pp.observacao,
        pp.created_at,
        pp.updated_at
      FROM pagamentos_prestadores pp
      WHERE pp.prestador_id = $1
        AND pp.created_at >= '2026-09-01'
        AND pp.created_at <= '2026-09-10'
      ORDER BY pp.created_at
    `, [PRESTADOR_ID]);
    
    console.log(`Total de pagamentos: ${outrosPagamentos.length}`);
    outrosPagamentos.forEach((p, i) => {
      console.log(`\n[Pagamento ${i+1}]`);
      console.log(`  ID: ${p.id}`);
      console.log(`  Valor: R$ ${p.valor_liquido}`);
      console.log(`  Status: ${p.status_pagamento}`);
      console.log(`  Data Pagamento: ${p.data_pagamento || 'N/A'}`);
      console.log(`  Observação: ${p.observacao || 'N/A'}`);
      console.log(`  Criado: ${p.created_at}`);
      console.log(`  Atualizado: ${p.updated_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. BAIXAS DO PRESTADOR NO PERÍODO
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 7. BAIXAS DO PRESTADOR NO PERÍODO ═══\n');
    
    const baixasPrestador = await query(client, `
      SELECT 
        b.id,
        b.titulo_id,
        b.valor_baixado,
        b.data_baixa,
        b.observacao,
        b.created_at
      FROM financeiro_baixas b
      WHERE b.observacao LIKE '%CESAR AUGUSTO HOLANDA SILVA%'
        AND b.created_at >= '2026-09-01'
        AND b.created_at <= '2026-09-10'
      ORDER BY b.created_at
    `);
    
    console.log(`Total de baixas: ${baixasPrestador.length}`);
    baixasPrestador.forEach((b, i) => {
      console.log(`\n[Baixa ${i+1}]`);
      console.log(`  ID: ${b.id}`);
      console.log(`  Título ID: ${b.titulo_id}`);
      console.log(`  Valor: R$ ${b.valor_baixado}`);
      console.log(`  Data: ${b.data_baixa}`);
      console.log(`  Observação: ${b.observacao}`);
      console.log(`  Criado: ${b.created_at}`);
    });

    await client.end();
    console.log('\n\n✓ Investigação concluída');
    process.exit(0);

  } catch (error) {
    console.error('Erro fatal:', error);
    await client.end();
    process.exit(1);
  }
}

main();
