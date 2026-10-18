// FIN-MASTER-363A — Drill-down investigation
// Investigates the 7 anomalies found in the first audit

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

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
    // A. DETALHAR OS 4 RECEBÍVEIS PAGOS SEM BAIXA
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("═══ A. RECEBÍVEIS PAGOS SEM BAIXA (4 casos) ═══");
    
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
        r.origem,
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
    
    console.log("\nDetalhes dos 4 recebíveis pagos sem baixa:\n");
    receberPagoSemBaixa.forEach((r, i) => {
      console.log(`\n[${i+1}] ID: ${r.id}`);
      console.log(`    Valor: R$ ${r.valor}`);
      console.log(`    Status: ${r.status}`);
      console.log(`    Cliente: ${r.cliente_nome || r.cliente}`);
      console.log(`    Data Pagamento: ${r.data_pagamento}`);
      console.log(`    Data Vencimento: ${r.data_vencimento}`);
      console.log(`    Fatura ID: ${r.fatura_id || 'N/A'}`);
      console.log(`    OS ID: ${r.os_id || 'N/A'}`);
      console.log(`    Origem: ${r.origem || 'N/A'}`);
      console.log(`    Criado: ${r.created_at}`);
      console.log(`    Atualizado: ${r.updated_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // B. DETALHAR A CONTA A PAGAR PAGA SEM BAIXA
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ B. CONTA A PAGAR PAGA SEM BAIXA (1 caso) ═══");
    
    const pagarPagoSemBaixa = await query(client, `
      SELECT 
        p.id,
        p.valor,
        p.status,
        p.fornecedor,
        p.fornecedor_nome,
        p.data_pagamento,
        p.data_vencimento,
        p.os_id,
        p.observacoes,
        p.created_at,
        p.updated_at
      FROM financeiro_pagar p
      LEFT JOIN financeiro_baixas b ON b.titulo_tabela = 'financeiro_pagar' 
        AND b.titulo_id = p.id 
        AND b.estornada = false
      WHERE p.status IN ('pago', 'parcial')
        AND b.id IS NULL
    `);
    
    console.log("\nDetalhes da conta a pagar paga sem baixa:\n");
    pagarPagoSemBaixa.forEach((p, i) => {
      console.log(`\n[${i+1}] ID: ${p.id}`);
      console.log(`    Valor: R$ ${p.valor}`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Fornecedor: ${p.fornecedor_nome || p.fornecedor}`);
      console.log(`    Data Pagamento: ${p.data_pagamento}`);
      console.log(`    Data Vencimento: ${p.data_vencimento}`);
      console.log(`    OS ID: ${p.os_id || 'N/A'}`);
      console.log(`    Observações: ${p.observacoes || 'N/A'}`);
      console.log(`    Criado: ${p.created_at}`);
      console.log(`    Atualizado: ${p.updated_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // C. DETALHAR OS 2 PRESTADORES COM VALOR DIVERGENTE
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ C. PRESTADORES COM VALOR DIVERGENTE (2 casos) ═══");
    
    const prestadorValorDivergente = await query(client, `
      SELECT 
        pp.id,
        pp.valor_liquido as valor_pagamento,
        pp.status_pagamento,
        pp.prestador_nome,
        pp.prestador_id,
        pp.os_id,
        pp.data_competencia,
        pp.data_pagamento,
        pp.observacao,
        pp.created_at,
        SUM(b.valor_baixado) as valor_baixado,
        ABS(pp.valor_liquido - SUM(b.valor_baixado)) as diferenca
      FROM pagamentos_prestadores pp
      JOIN financeiro_baixas b ON b.observacao LIKE '%' || LEFT(pp.id::text, 8) || '%'
        AND b.estornada = false
      WHERE pp.status_pagamento = 'pago'
      GROUP BY pp.id, pp.valor_liquido, pp.status_pagamento, pp.prestador_nome, 
               pp.prestador_id, pp.os_id, pp.data_competencia, pp.data_pagamento,
               pp.observacao, pp.created_at
      HAVING ABS(pp.valor_liquido - SUM(b.valor_baixado)) > 0.01
      ORDER BY ABS(pp.valor_liquido - SUM(b.valor_baixado)) DESC
    `);
    
    console.log("\nDetalhes dos prestadores com valor divergente:\n");
    prestadorValorDivergente.forEach((p, i) => {
      console.log(`\n[${i+1}] ID: ${p.id}`);
      console.log(`    Valor Pagamento: R$ ${p.valor_pagamento}`);
      console.log(`    Valor Baixado: R$ ${p.valor_baixado}`);
      console.log(`    Diferença: R$ ${p.diferenca}`);
      console.log(`    Status: ${p.status_pagamento}`);
      console.log(`    Prestador: ${p.prestador_nome}`);
      console.log(`    OS ID: ${p.os_id || 'N/A'}`);
      console.log(`    Data Competência: ${p.data_competencia}`);
      console.log(`    Data Pagamento: ${p.data_pagamento}`);
      console.log(`    Observação: ${p.observacao || 'N/A'}`);
      console.log(`    Criado: ${p.created_at}`);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // D. ANALISAR GAP DE RECONCILIAÇÃO (RECEBER)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ D. GAP DE RECONCILIAÇÃO (RECEBER) ═══");
    console.log("    receber_pago (títulos): R$ 9.874,56");
    console.log("    receber_baixado (baixas): R$ 74,06");
    console.log("    GAP: R$ 9.800,50\n");

    const receberBaixas = await query(client, `
      SELECT 
        COUNT(*) as total_baixas,
        SUM(valor_baixado) as total_valor,
        MIN(data_baixa) as primeira_baixa,
        MAX(data_baixa) as ultima_baixa
      FROM financeiro_baixas
      WHERE titulo_tabela = 'financeiro_receber'
        AND estornada = false
    `);
    
    console.log("Baixas de receber:");
    console.log(`    Total de baixas: ${receberBaixas[0]?.total_baixas}`);
    console.log(`    Total baixado: R$ ${receberBaixas[0]?.total_valor}`);
    console.log(`    Período: ${receberBaixas[0]?.primeira_baixa} a ${receberBaixas[0]?.ultima_baixa}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // E. ANALISAR GAP DE RECONCILIAÇÃO (PAGAR)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ E. GAP DE RECONCILIAÇÃO (PAGAR) ═══");
    console.log("    pagar_pago (títulos): R$ 1.794,42");
    console.log("    pagar_baixado (baixas): R$ 1.656,53");
    console.log("    GAP: R$ 137,89\n");

    const pagarBaixas = await query(client, `
      SELECT 
        COUNT(*) as total_baixas,
        SUM(valor_baixado) as total_valor,
        MIN(data_baixa) as primeira_baixa,
        MAX(data_baixa) as ultima_baixa
      FROM financeiro_baixas
      WHERE titulo_tabela = 'financeiro_pagar'
        AND estornada = false
    `);
    
    console.log("Baixas de pagar:");
    console.log(`    Total de baixas: ${pagarBaixas[0]?.total_baixas}`);
    console.log(`    Total baixado: R$ ${pagarBaixas[0]?.total_valor}`);
    console.log(`    Período: ${pagarBaixas[0]?.primeira_baixa} a ${pagarBaixas[0]?.ultima_baixa}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // F. ANALISAR GAP DE RECONCILIAÇÃO (PRESTADORES)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ F. GAP DE RECONCILIAÇÃO (PRESTADORES) ═══");
    console.log("    prestador_pago (pagamentos): R$ 3.356,12");
    console.log("    prestador_baixado (baixas): R$ 1.560,00");
    console.log("    GAP: R$ 1.796,12\n");

    const prestadorBaixas = await query(client, `
      SELECT 
        COUNT(*) as total_baixas,
        SUM(valor_baixado) as total_valor,
        MIN(data_baixa) as primeira_baixa,
        MAX(data_baixa) as ultima_baixa
      FROM financeiro_baixas
      WHERE observacao LIKE '%pagamento prestador%'
        AND estornada = false
    `);
    
    console.log("Baixas de prestadores:");
    console.log(`    Total de baixas: ${prestadorBaixas[0]?.total_baixas}`);
    console.log(`    Total baixado: R$ ${prestadorBaixas[0]?.total_valor}`);
    console.log(`    Período: ${prestadorBaixas[0]?.primeira_baixa} a ${prestadorBaixas[0]?.ultima_baixa}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // G. VERIFICAR TRIGGERS DE PROPAGAÇÃO FINANCEIRA
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ G. TRIGGERS DE PROPAGAÇÃO FINANCEIRA ═══");
    
    const triggers = await query(client, `
      SELECT 
        t.tgname as trigger_name,
        c.relname as table_name,
        p.proname as function_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE c.relname IN ('alocacoes_escala', 'ordens_servico')
        AND t.tgname LIKE '%financeiro%'
      ORDER BY c.relname, t.tgname
    `);
    
    console.log("\nTriggers de propagação financeira:");
    if (triggers.length === 0) {
      console.log("    ⚠️  NENHUM TRIGGER ENCONTRADO");
      console.log("    Isso explica o GAP de reconciliação!");
      console.log("    Títulos são criados manualmente ou via service,");
      console.log("    mas não há propagação automática para financeiro_baixas.");
    } else {
      triggers.forEach(t => {
        console.log(`    ✓ ${t.table_name}.${t.trigger_name} → ${t.function_name}()`);
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // H. VERIFICAR COMO TÍTULOS PAGOS FORAM CRIADOS
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n\n═══ H. ORIGEM DOS TÍTULOS PAGOS ═══");
    
    const receberPagoOrigem = await query(client, `
      SELECT 
        COALESCE(origem, 'N/A') as origem,
        COUNT(*) as qtd,
        SUM(valor) as total
      FROM financeiro_receber
      WHERE status IN ('pago', 'parcial')
      GROUP BY origem
      ORDER BY qtd DESC
    `);
    
    console.log("\nOrigem dos recebíveis pagos:");
    receberPagoOrigem.forEach(r => {
      console.log(`    ${r.origem}: ${r.qtd} títulos (R$ ${r.total})`);
    });

    const pagarPagoOrigem = await query(client, `
      SELECT 
        COALESCE(os_id, 'N/A') as os_id,
        COUNT(*) as qtd,
        SUM(valor) as total
      FROM financeiro_pagar
      WHERE status IN ('pago', 'parcial')
      GROUP BY os_id
      ORDER BY qtd DESC
    `);
    
    console.log("\nOrigem das contas a pagar pagas:");
    pagarPagoOrigem.forEach(p => {
      console.log(`    OS: ${p.os_id}: ${p.qtd} títulos (R$ ${p.total})`);
    });

    await client.end();
    console.log("\n\n✓ Investigação concluída");
    process.exit(0);

  } catch (error) {
    console.error("Erro fatal:", error);
    await client.end();
    process.exit(1);
  }
}

main();
