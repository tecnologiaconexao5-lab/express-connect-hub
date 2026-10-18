// FIN-MASTER-363A — Auditoria Read-Only do Financeiro
// Este script executa APENAS queries SELECT para auditoria
// NÃO modifica dados, NÃO altera schema, NÃO cria registros

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DB_URL = "postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres";

const output = {
  timestamp: new Date().toISOString(),
  auditoria: {}
};

async function query(client, sql, params = []) {
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (e) {
    console.error(`Erro na query: ${e.message}`);
    return [];
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  
  try {
    await client.connect();
    console.log("✓ Conectado ao banco (read-only)");

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. RECEBER — Auditoria de financeiro_receber → financeiro_baixas
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 1. RECEBER ═══");

    // 1.1 Total de recebíveis por status
    const receberPorStatus = await query(client, `
      SELECT status, COUNT(*) as qtd, SUM(valor) as total
      FROM financeiro_receber
      GROUP BY status
      ORDER BY qtd DESC
    `);
    output.auditoria.receber_por_status = receberPorStatus;
    console.log("Recebíveis por status:", receberPorStatus);

    // 1.2 Título pago sem baixa
    const tituloPagoSemBaixa = await query(client, `
      SELECT r.id, r.valor, r.status, r.cliente, r.data_pagamento
      FROM financeiro_receber r
      LEFT JOIN financeiro_baixas b ON b.titulo_tabela = 'financeiro_receber' 
        AND b.titulo_id = r.id 
        AND b.estornada = false
      WHERE r.status IN ('pago', 'parcial')
        AND b.id IS NULL
      LIMIT 10
    `);
    output.auditoria.receber_pago_sem_baixa = tituloPagoSemBaixa;
    console.log("Recebíveis pagos SEM baixa:", tituloPagoSemBaixa.length);

    // 1.3 Baixa sem título
    const baixaSemTitulo = await query(client, `
      SELECT b.id, b.valor_baixado, b.data_baixa, b.conta_financeira_id
      FROM financeiro_baixas b
      LEFT JOIN financeiro_receber r ON b.titulo_id = r.id 
        AND b.titulo_tabela = 'financeiro_receber'
      WHERE b.titulo_tabela = 'financeiro_receber'
        AND r.id IS NULL
      LIMIT 10
    `);
    output.auditoria.receber_baixa_sem_titulo = baixaSemTitulo;
    console.log("Baixas SEM título receber:", baixaSemTitulo.length);

    // 1.4 Valor original ≠ valor liquidado (diferença > 0.01)
    const valorDivergente = await query(client, `
      SELECT r.id, r.valor as valor_original, 
        SUM(b.valor_baixado) as valor_liquidado,
        ABS(r.valor - SUM(b.valor_baixado)) as diferenca
      FROM financeiro_receber r
      JOIN financeiro_baixas b ON b.titulo_tabela = 'financeiro_receber' 
        AND b.titulo_id = r.id 
        AND b.estornada = false
      WHERE r.status = 'pago'
      GROUP BY r.id, r.valor
      HAVING ABS(r.valor - SUM(b.valor_baixado)) > 0.01
      LIMIT 10
    `);
    output.auditoria.receber_valor_divergente = valorDivergente;
    console.log("Recebíveis com valor divergente:", valorDivergente.length);

    // 1.5 Baixa duplicada (mesmo título + mesmo valor + mesma data)
    const baixaDuplicada = await query(client, `
      SELECT titulo_id, valor_baixado, data_baixa, COUNT(*) as qtd
      FROM financeiro_baixas
      WHERE titulo_tabela = 'financeiro_receber' 
        AND estornada = false
      GROUP BY titulo_id, valor_baixado, data_baixa
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    output.auditoria.receber_baixa_duplicada = baixaDuplicada;
    console.log("Baixas duplicadas (receber):", baixaDuplicada.length);

    // 1.6 conta_financeira_id ausente em baixas
    const receberSemConta = await query(client, `
      SELECT COUNT(*) as qtd
      FROM financeiro_baixas
      WHERE titulo_tabela = 'financeiro_receber'
        AND estornada = false
        AND (conta_financeira_id IS NULL OR conta_financeira_id = '')
    `);
    output.auditoria.receber_baixa_sem_conta = receberSemConta;
    console.log("Baixas receber SEM conta:", receberSemConta[0]?.qtd || 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. PAGAR — Auditoria de financeiro_pagar → financeiro_baixas
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 2. PAGAR ═══");

    const pagarPorStatus = await query(client, `
      SELECT status, COUNT(*) as qtd, SUM(valor) as total
      FROM financeiro_pagar
      GROUP BY status
      ORDER BY qtd DESC
    `);
    output.auditoria.pagar_por_status = pagarPorStatus;
    console.log("Contas a pagar por status:", pagarPorStatus);

    const pagarPagoSemBaixa = await query(client, `
      SELECT p.id, p.valor, p.status, p.fornecedor, p.data_pagamento
      FROM financeiro_pagar p
      LEFT JOIN financeiro_baixas b ON b.titulo_tabela = 'financeiro_pagar' 
        AND b.titulo_id = p.id 
        AND b.estornada = false
      WHERE p.status IN ('pago', 'parcial')
        AND b.id IS NULL
      LIMIT 10
    `);
    output.auditoria.pagar_pago_sem_baixa = pagarPagoSemBaixa;
    console.log("Contas a pagar pagas SEM baixa:", pagarPagoSemBaixa.length);

    const pagarBaixaSemTitulo = await query(client, `
      SELECT b.id, b.valor_baixado, b.data_baixa, b.conta_financeira_id
      FROM financeiro_baixas b
      LEFT JOIN financeiro_pagar p ON b.titulo_id = p.id 
        AND b.titulo_tabela = 'financeiro_pagar'
      WHERE b.titulo_tabela = 'financeiro_pagar'
        AND p.id IS NULL
      LIMIT 10
    `);
    output.auditoria.pagar_baixa_sem_titulo = pagarBaixaSemTitulo;
    console.log("Baixas SEM título pagar:", pagarBaixaSemTitulo.length);

    const pagarValorDivergente = await query(client, `
      SELECT p.id, p.valor as valor_original, 
        SUM(b.valor_baixado) as valor_liquidado,
        ABS(p.valor - SUM(b.valor_baixado)) as diferenca
      FROM financeiro_pagar p
      JOIN financeiro_baixas b ON b.titulo_tabela = 'financeiro_pagar' 
        AND b.titulo_id = p.id 
        AND b.estornada = false
      WHERE p.status = 'pago'
      GROUP BY p.id, p.valor
      HAVING ABS(p.valor - SUM(b.valor_baixado)) > 0.01
      LIMIT 10
    `);
    output.auditoria.pagar_valor_divergente = pagarValorDivergente;
    console.log("Contas a pagar com valor divergente:", pagarValorDivergente.length);

    const pagarBaixaDuplicada = await query(client, `
      SELECT titulo_id, valor_baixado, data_baixa, COUNT(*) as qtd
      FROM financeiro_baixas
      WHERE titulo_tabela = 'financeiro_pagar' 
        AND estornada = false
      GROUP BY titulo_id, valor_baixado, data_baixa
      HAVING COUNT(*) > 1
      LIMIT 10
    `);
    output.auditoria.pagar_baixa_duplicada = pagarBaixaDuplicada;
    console.log("Baixas duplicadas (pagar):", pagarBaixaDuplicada.length);

    const pagarSemConta = await query(client, `
      SELECT COUNT(*) as qtd
      FROM financeiro_baixas
      WHERE titulo_tabela = 'financeiro_pagar'
        AND estornada = false
        AND (conta_financeira_id IS NULL OR conta_financeira_id = '')
    `);
    output.auditoria.pagar_baixa_sem_conta = pagarSemConta;
    console.log("Baixas pagar SEM conta:", pagarSemConta[0]?.qtd || 0);

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. PRESTADORES — Validação FIN-362.3E
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 3. PRESTADORES ═══");

    const prestadoresPorStatus = await query(client, `
      SELECT status_pagamento, COUNT(*) as qtd, SUM(valor_liquido) as total
      FROM pagamentos_prestadores
      GROUP BY status_pagamento
      ORDER BY qtd DESC
    `);
    output.auditoria.prestadores_por_status = prestadoresPorStatus;
    console.log("Pagamentos prestadores por status:", prestadoresPorStatus);

    // Pagamento prestador PAGO sem baixa coerente
    const prestadorPagoSemBaixa = await query(client, `
      SELECT pp.id, pp.valor_liquido, pp.status_pagamento, pp.prestador_nome
      FROM pagamentos_prestadores pp
      LEFT JOIN financeiro_baixas b ON b.observacao LIKE '%' || LEFT(pp.id::text, 8) || '%'
        AND b.estornada = false
      WHERE pp.status_pagamento = 'pago'
        AND b.id IS NULL
      LIMIT 10
    `);
    output.auditoria.prestador_pago_sem_baixa = prestadorPagoSemBaixa;
    console.log("Pagamentos prestador PAGO SEM baixa:", prestadorPagoSemBaixa.length);

    // Pagamento prestador com valor divergente da baixa
    const prestadorValorDivergente = await query(client, `
      SELECT pp.id, pp.valor_liquido as valor_pagamento,
        SUM(b.valor_baixado) as valor_baixado,
        ABS(pp.valor_liquido - SUM(b.valor_baixado)) as diferenca
      FROM pagamentos_prestadores pp
      JOIN financeiro_baixas b ON b.observacao LIKE '%' || LEFT(pp.id::text, 8) || '%'
        AND b.estornada = false
      WHERE pp.status_pagamento = 'pago'
      GROUP BY pp.id, pp.valor_liquido
      HAVING ABS(pp.valor_liquido - SUM(b.valor_baixado)) > 0.01
      LIMIT 10
    `);
    output.auditoria.prestador_valor_divergente = prestadorValorDivergente;
    console.log("Pagamentos prestador com valor divergente:", prestadorValorDivergente.length);

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. TESOURARIA — Contas financeiras e consistência
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 4. TESOURARIA ═══");

    const contasFinanceiras = await query(client, `
      SELECT id, nome, banco, ativa, saldo_inicial
      FROM contas_financeiras
      ORDER BY nome
    `);
    output.auditoria.contas_financeiras = contasFinanceiras;
    console.log("Contas financeiras cadastradas:", contasFinanceiras.length);

    // Baixas com conta_financeira_id inválido (não existe em contas_financeiras)
    const baixaContaInvalida = await query(client, `
      SELECT b.id, b.conta_financeira_id, b.valor_baixado
      FROM financeiro_baixas b
      LEFT JOIN contas_financeiras c ON b.conta_financeira_id = c.id
      WHERE b.conta_financeira_id IS NOT NULL
        AND b.conta_financeira_id != ''
        AND c.id IS NULL
      LIMIT 10
    `);
    output.auditoria.baixa_conta_invalida = baixaContaInvalida;
    console.log("Baixas com conta_financeira_id INVÁLIDO:", baixaContaInvalida.length);

    // Estornos registrados
    const estornos = await query(client, `
      SELECT COUNT(*) as qtd, SUM(valor_baixado) as total
      FROM financeiro_baixas
      WHERE estornada = true
    `);
    output.auditoria.estornos = estornos;
    console.log("Estornos registrados:", estornos[0]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. RECONCILIAÇÃO FINANCEIRA — Totais consolidados
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 5. RECONCILIAÇÃO FINANCEIRA ═══");

    const reconciliacao = await query(client, `
      SELECT 
        (SELECT COALESCE(SUM(valor), 0) FROM financeiro_receber WHERE status = 'pago') as receber_pago,
        (SELECT COALESCE(SUM(valor_baixado), 0) FROM financeiro_baixas WHERE titulo_tabela = 'financeiro_receber' AND estornada = false) as receber_baixado,
        (SELECT COALESCE(SUM(valor), 0) FROM financeiro_pagar WHERE status = 'pago') as pagar_pago,
        (SELECT COALESCE(SUM(valor_baixado), 0) FROM financeiro_baixas WHERE titulo_tabela = 'financeiro_pagar' AND estornada = false) as pagar_baixado,
        (SELECT COALESCE(SUM(valor_liquido), 0) FROM pagamentos_prestadores WHERE status_pagamento = 'pago') as prestador_pago,
        (SELECT COALESCE(SUM(valor_baixado), 0) FROM financeiro_baixas WHERE observacao LIKE '%pagamento prestador%' AND estornada = false) as prestador_baixado
    `);
    output.auditoria.reconciliacao = reconciliacao;
    console.log("Reconciliação:", reconciliacao[0]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. CASO HISTÓRICO 32fe474f (exceção pré-FIN-362.3E)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 6. CASO HISTÓRICO 32fe474f ═══");

    const casoHistorico = await query(client, `
      SELECT 
        pp.id, pp.valor_liquido, pp.status_pagamento, pp.prestador_nome,
        (SELECT COALESCE(SUM(valor_baixado), 0) FROM financeiro_baixas 
         WHERE observacao LIKE '%' || LEFT(pp.id::text, 8) || '%' AND estornada = false) as total_baixado
      FROM pagamentos_prestadores pp
      WHERE pp.id = '32fe474f-41c7-432b-a21e-7d0b2831c1bb'
    `);
    output.auditoria.caso_historico_32fe474f = casoHistorico;
    console.log("Caso histórico:", casoHistorico[0]);

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. RESUMO EXECUTIVO
    // ═══════════════════════════════════════════════════════════════════════════
    console.log("\n═══ 7. RESUMO EXECUTIVO ═══");

    const anomalias = {
      receber_pago_sem_baixa: tituloPagoSemBaixa.length,
      receber_baixa_sem_titulo: baixaSemTitulo.length,
      receber_valor_divergente: valorDivergente.length,
      receber_baixa_duplicada: baixaDuplicada.length,
      receber_sem_conta: receberSemConta[0]?.qtd || 0,
      pagar_pago_sem_baixa: pagarPagoSemBaixa.length,
      pagar_baixa_sem_titulo: pagarBaixaSemTitulo.length,
      pagar_valor_divergente: pagarValorDivergente.length,
      pagar_baixa_duplicada: pagarBaixaDuplicada.length,
      pagar_sem_conta: pagarSemConta[0]?.qtd || 0,
      prestador_pago_sem_baixa: prestadorPagoSemBaixa.length,
      prestador_valor_divergente: prestadorValorDivergente.length,
      baixa_conta_invalida: baixaContaInvalida.length
    };

    output.resumo = {
      total_anomalias: Object.values(anomalias).reduce((a, b) => a + b, 0),
      anomalias_por_tipo: anomalias,
      reconciliacao: reconciliacao[0],
      estornos: estornos[0]
    };

    console.log("\nTotal de anomalias detectadas:", output.resumo.total_anomalias);
    console.log("Anomalias por tipo:", anomalias);

    // Salvar resultado
    const outputDir = path.join(process.cwd(), "docs", "auditoria", "fin_master_363a");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, "readonly_audit_result.json");
    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), "utf-8");
    console.log(`\n✓ Resultado salvo em: ${outputFile}`);

    await client.end();
    process.exit(0);

  } catch (error) {
    console.error("Erro fatal:", error);
    await client.end();
    process.exit(1);
  }
}

main();
