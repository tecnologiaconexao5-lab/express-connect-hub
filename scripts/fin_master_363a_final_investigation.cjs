// FIN-MASTER-363A — Final investigation: 6266f2a1 case + recebíveis sem baixa

const { Client } = require("pg");

const DB_URL = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

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
    console.log("✓ Conectado ao banco (read-only)\n");

    // ═══════════════════════════════════════════════════════════════════════════
    // A. INVESTIGAR 6266f2a1 (POST-FIN-362.3E ANOMALY)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("═══ A. CASO 6266f2a1 (POST-FIN-362.3E) ═══");
    
    const caso6266 = await query(client, `
      SELECT 
        pp.id,
        pp.valor_liquido,
        pp.status_pagamento,
        pp.prestador_nome,
        pp.os_id,
        pp.data_competencia,
        pp.data_pagamento,
        pp.observacao,
        pp.created_at,
        pp.updated_at
      FROM pagamentos_prestadores pp
      WHERE pp.id = '6266f2a1-8f42-4898-9e44-a1fbd23add7b'
    `);
    
    console.log("\nDetalhes do pagamento 6266f2a1:");
    console.log(JSON.stringify(caso6266[0], null, 2));

    // Buscar baixas associadas
    const baixas6266 = await query(client, `
      SELECT 
        b.id,
        b.titulo_id,
        b.valor_baixado,
        b.data_baixa,
        b.conta_financeira_id,
        b.observacao,
        b.created_at
      FROM financeiro_baixas b
      WHERE b.observacao LIKE '%6266f2a1%'
        AND b.estornada = false
    `);
    
    console.log("\nBaixas associadas ao 6266f2a1:");
    console.log(JSON.stringify(baixas6266, null, 2));

    // Verificar se há financeiro_pagar para este prestador
    const pagar6266 = await query(client, `
      SELECT 
        fp.id,
        fp.valor,
        fp.status,
        fp.prestador,
        fp.os_id,
        fp.data_vencimento,
        fp.data_pagamento,
        fp.created_at
      FROM financeiro_pagar fp
      WHERE fp.prestador LIKE '%CESAR AUGUSTO HOLANDA SILVA%'
        AND fp.valor = 520.00
        AND fp.created_at >= '2026-09-04'
      ORDER BY fp.created_at DESC
    `);
    
    console.log("\nfinanceiro_pagar para CESAR (valor=520, criado após 2026-09-04):");
    console.log(JSON.stringify(pagar6266, null, 2));

    // ═══════════════════════════════════════════════════════════════════════════
    // B. RECEBÍVEIS PAGOS SEM BAIXA (CORRIGIDO)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ B. RECEBÍVEIS PAGOS SEM BAIXA (DETALHADO) ═══");
    
    const receberPagoSemBaixa = await query(client, `
      SELECT 
        r.id,
        r.valor,
        r.status,
        r.cliente,
        r.cliente_nome,
        r.data_pagamento,
        r.data_vencimento,
        r.fatura_id,
        r.os_id,
        r.observacoes,
        r.created_at,
        r.updated_at
      FROM financeiro_receber r
      LEFT JOIN financeiro_baixas b ON b.titulo_tabela = 'financeiro_receber' 
        AND b.titulo_id = r.id 
        AND b.estornada = false
      WHERE r.status IN ('pago', 'parcial')
        AND b.id IS NULL
      ORDER BY r.created_at DESC
    `);
    
    console.log(`\nTotal: ${receberPagoSemBaixa.length} recebíveis pagos sem baixa\n`);
    receberPagoSemBaixa.forEach((r, i) => {
      console.log(`[${i+1}] ID: ${r.id}`);
      console.log(`    Valor: R$ ${r.valor}`);
      console.log(`    Cliente: ${r.cliente_nome || r.cliente}`);
      console.log(`    Data Pagamento: ${r.data_pagamento}`);
      console.log(`    Fatura ID: ${r.fatura_id || 'N/A'}`);
      console.log(`    OS ID: ${r.os_id || 'N/A'}`);
      console.log(`    Observações: ${r.observacoes || 'N/A'}`);
      console.log(`    Criado: ${r.created_at}\n`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // C. VERIFICAR SERVIÇO QUE ATUALIZA STATUS SEM BAIXA
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ C. PADRÃO DE ATUALIZAÇÃO DE STATUS ═══");
    
    // Verificar se há padrão de atualização direta de status
    const receberAtualizados = await query(client, `
      SELECT 
        r.id,
        r.valor,
        r.status,
        r.data_pagamento,
        r.updated_at,
        r.created_at,
        EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) as tempo_vida_segundos
      FROM financeiro_receber r
      WHERE r.status = 'pago'
        AND r.updated_at != r.created_at
      ORDER BY r.updated_at DESC
      LIMIT 10
    `);
    
    console.log("\nRecebíveis com status atualizado para 'pago':");
    receberAtualizados.forEach((r, i) => {
      const tempoVida = parseFloat(r.tempo_vida_segundos);
      console.log(`[${i+1}] ID: ${r.id}`);
      console.log(`    Valor: R$ ${r.valor}`);
      console.log(`    Tempo de vida: ${tempoVida.toFixed(2)}s (${(tempoVida/3600).toFixed(2)}h)`);
      console.log(`    Criado: ${r.created_at}`);
      console.log(`    Atualizado: ${r.updated_at}\n`);
    });

    await client.end();
    console.log("\n✓ Investigação concluída");
    process.exit(0);

  } catch (error) {
    console.error("Erro fatal:", error);
    await client.end();
    process.exit(1);
  }
}

main();
