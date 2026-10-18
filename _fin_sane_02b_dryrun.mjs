import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'C:\\Users\\DIEGO BALBINO\\Desktop\\Pasta Compartilhada\\DOCUMENTOS EMPRESA\\08_TECNOLOGIA_SISTEMAS\\express-connect-hub\\.env' });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function query(sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows;
}

function printSection(title) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

async function main() {
  await client.connect();
  console.log('DRY-RUN FIN-SANE-02B — SOMENTE LEITURA');

  // Critérios da migration (mesma query do INSERT no snapshot)
  const candidatos = await query(`
    SELECT
      COUNT(*) AS qtd,
      SUM(ABS(fp.valor - pp.valor_liquido)) AS soma_diferencas,
      COUNT(*) FILTER (WHERE fp.is_teste = true) AS qtd_teste,
      SUM(ABS(fp.valor - pp.valor_liquido)) FILTER (WHERE fp.is_teste = true) AS soma_dif_teste,
      COUNT(*) FILTER (WHERE fp.is_teste = false OR fp.is_teste IS NULL) AS qtd_real,
      SUM(ABS(fp.valor - pp.valor_liquido)) FILTER (WHERE fp.is_teste = false OR fp.is_teste IS NULL) AS soma_dif_real
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2);
  `);

  printSection('CANDIDATOS À ATUALIZAÇÃO');
  console.log(JSON.stringify(candidatos[0], null, 2));

  // Exclusões: títulos que NÃO serão alterados
  const excluidos = await query(`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(fp.status, '') IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')) AS status_terminal,
      COUNT(*) FILTER (WHERE fp.os_id IS NULL) AS sem_os,
      COUNT(*) FILTER (WHERE fp.fornecedor_id IS NULL) AS sem_prestador,
      COUNT(*) FILTER (WHERE pp.id IS NULL) AS sem_pp_correspondente,
      COUNT(*) FILTER (WHERE pp.tipo_pagamento = 'fechamento') AS tipo_fechamento,
      COUNT(*) FILTER (WHERE ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) = ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)) AS valores_iguais,
      COUNT(*) AS total_fp
    FROM public.financeiro_pagar fp
    LEFT JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
          AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento';
  `);

  printSection('REGISTROS EXCLUÍDOS DA ATUALIZAÇÃO (breakdown)');
  console.log(JSON.stringify(excluidos[0], null, 2));

  // Verificar risco de alterar título pago
  const pagosDivergentes = await query(`
    SELECT COUNT(*) AS qtd
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') IN ('pago', 'paga')
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2);
  `);

  printSection('RISCO: TÍTULOS PAGOS COM DIVERGÊNCIA');
  console.log(JSON.stringify(pagosDivergentes[0], null, 2));
  console.log('Estes NÃO serão alterados pela migration (critério status).');

  // Verificar se há despesas genéricas (fornecedor_cadastro_id preenchido)
  const despesasGenericas = await query(`
    SELECT COUNT(*) AS qtd
    FROM public.financeiro_pagar
    WHERE fornecedor_cadastro_id IS NOT NULL
       OR (os_id IS NULL AND fornecedor_id IS NULL);
  `);

  printSection('DESPESAS GENÉRICAS (NÃO TOCADAS)');
  console.log(JSON.stringify(despesasGenericas[0], null, 2));

  // Amostra de candidatos (sem dados sensíveis)
  const amostra = await query(`
    SELECT
      fp.id AS fp_id,
      LEFT(fp.os_id, 8) AS os_id_curto,
      fp.valor AS valor_anterior,
      pp.valor_liquido AS valor_novo,
      fp.status AS status,
      fp.is_teste,
      pp.origem_lancamento
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
    ORDER BY fp.created_at DESC
    LIMIT 10;
  `);

  printSection('AMOSTRA DE CANDIDATOS (máx 10)');
  console.table(amostra);

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
