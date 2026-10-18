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

function abrev(uuid) {
  return uuid ? uuid.toString().split('-')[0] : null;
}

async function main() {
  await client.connect();
  console.log('FIN-SANE-02C — DRY-RUN DETALHADO DE CANDIDATOS (SOMENTE LEITURA)');

  // Candidatos detalhados com componentes
  const candidatos = await query(`
    SELECT
      fp.id AS fp_id,
      fp.os_id AS fp_os_id,
      fp.fornecedor_id AS fp_prestador_id,
      fp.valor AS fp_valor,
      fp.status AS fp_status,
      fp.is_teste,
      pp.id AS pp_id,
      pp.valor_liquido AS pp_valor_liquido,
      pp.valor_servicos AS pp_valor_servicos,
      pp.pedagio AS pp_pedagio,
      pp.adicionais AS pp_adicionais,
      pp.descontos AS pp_descontos,
      pp.ajustes AS pp_ajustes,
      pp.reembolsos AS pp_reembolsos,
      pp.valor_reembolsos AS pp_valor_reembolsos,
      pp.valor_bonus AS pp_valor_bonus,
      pp.valor_adiantamentos AS pp_valor_adiantamentos,
      pp.valor_descontos AS pp_valor_descontos,
      pp.origem_lancamento AS pp_origem,
      ABS(ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) - ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)) AS diferenca
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
    ORDER BY fp.is_teste, fp.id;
  `);

  const testes = candidatos.filter(r => r.is_teste === true);
  const reais = candidatos.filter(r => r.is_teste === false || r.is_teste === null);

  printSection('RESUMO GERAL');
  console.log(`Total de candidatos: ${candidatos.length}`);
  console.log(`  Teste:  ${testes.length}`);
  console.log(`  Reais:  ${reais.length}`);
  console.log(`Soma diferenças teste: R$ ${testes.reduce((a, r) => a + Number(r.diferenca), 0).toFixed(2)}`);
  console.log(`Soma diferenças reais: R$ ${reais.reduce((a, r) => a + Number(r.diferenca), 0).toFixed(2)}`);

  printSection('CANDIDATOS TESTE (10)');
  for (const r of testes) {
    console.log(`  fp_id=${abrev(r.fp_id)} os=${abrev(r.fp_os_id)} prest=${abrev(r.fp_prestador_id)} fp=${Number(r.fp_valor).toFixed(2)} pp=${Number(r.pp_valor_liquido).toFixed(2)} dif=${Number(r.diferenca).toFixed(2)} origem=${r.pp_origem}`);
  }

  printSection('CANDIDATOS REAIS (26)');
  for (const r of reais) {
    console.log(`  fp_id=${abrev(r.fp_id)} os=${abrev(r.fp_os_id)} prest=${abrev(r.fp_prestador_id)} fp=${Number(r.fp_valor).toFixed(2)} pp=${Number(r.pp_valor_liquido).toFixed(2)} dif=${Number(r.diferenca).toFixed(2)} origem=${r.pp_origem}`);
  }

  // Validação de correspondência inequívoca
  printSection('VALIDAÇÃO DE CORRESPONDÊNCIA (1:1 obrigatório)');
  const ambiguidade = await query(`
    SELECT fp.id AS fp_id, COUNT(pp.id) AS qtd_pp
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
    GROUP BY fp.id
    HAVING COUNT(pp.id) > 1;
  `);

  if (ambiguidade.length === 0) {
    console.log('✅ Nenhum financeiro_pagar com múltiplos pagamentos_prestadores correspondentes.');
  } else {
    console.log(`⚠️ ${ambiguidade.length} registros com correspondência ambígua:`);
    console.table(ambiguidade);
  }

  // Validação de baixas existentes
  printSection('VALIDAÇÃO DE BAIXAS EXISTENTES NOS CANDIDATOS');
  const comBaixa = await query(`
    SELECT COUNT(*) AS qtd
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    LEFT JOIN public.financeiro_baixas fb
           ON fb.titulo_tabela = 'financeiro_pagar'
          AND fb.titulo_id = fp.id
          AND NOT COALESCE(fb.estornada, false)
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
      AND fb.id IS NOT NULL;
  `);

  if (Number(comBaixa[0].qtd) === 0) {
    console.log('✅ Nenhum candidato possui baixa não estornada.');
  } else {
    console.log(`⚠️ ${comBaixa[0].qtd} candidatos já possuem baixa não estornada.`);
  }

  // Validação componentes: diferença explicada por adicionais/pedágio/ajudante/desconto
  printSection('VALIDAÇÃO DE EXPLICAÇÃO DA DIFERENÇA (componentes)');
  let explicados = 0;
  let naoExplicados = 0;
  for (const r of candidatos) {
    const base = Number(r.pp_valor_servicos) || 0;
    const pedagio = Number(r.pp_pedagio) || 0;
    const adicionais = Number(r.pp_adicionais) || 0;
    const descontos = Number(r.pp_descontos || r.pp_valor_descontos) || 0;
    const ajustes = Number(r.pp_ajustes) || 0;
    const reembolsos = Number(r.pp_reembolsos || r.pp_valor_reembolsos) || 0;
    const bonus = Number(r.pp_valor_bonus) || 0;
    const adiantamentos = Number(r.pp_valor_adiantamentos) || 0;

    // Monta composição explicada pelos componentes visíveis
    const explicado = base + pedagio + adicionais - descontos + ajustes + reembolsos + bonus - adiantamentos;
    const diffEsperada = Math.abs(Number(r.pp_valor_liquido) - explicado);
    const diffFp = Math.abs(Number(r.fp_valor) - Number(r.pp_valor_liquido));

    if (diffEsperada < 0.02) {
      explicados++;
    } else {
      naoExplicados++;
      console.log(`  ⚠️ fp_id=${abrev(r.fp_id)}: diferença fp→pp=${diffFp.toFixed(2)}, mas componentes explicam pp=${explicado.toFixed(2)} (diff=${diffEsperada.toFixed(2)})`);
    }
  }
  console.log(`✅ Explicados pelos componentes: ${explicados}/${candidatos.length}`);
  console.log(`⚠️ Não explicados: ${naoExplicados}/${candidatos.length}`);

  // Casos pago-sem-baixa (já identificados em FIN-SANE-02A)
  printSection('CASOS PAGO-SEM-BAIXA (preservados fora da migration)');
  const pagoSemBaixa = await query(`
    SELECT fp.id, fp.status, fp.is_teste,
           EXISTS (
             SELECT 1 FROM public.financeiro_baixas fb
             WHERE fb.titulo_tabela = 'financeiro_pagar'
               AND fb.titulo_id = fp.id
               AND NOT COALESCE(fb.estornada, false)
           ) AS tem_baixa
    FROM public.financeiro_pagar fp
    WHERE COALESCE(fp.status, '') IN ('pago', 'paga')
    ORDER BY fp.is_teste, fp.id;
  `);

  const pagoSemBaixaList = pagoSemBaixa.filter(r => !r.tem_baixa);
  console.log(`Total: ${pagoSemBaixaList.length}`);
  console.log(`  Teste: ${pagoSemBaixaList.filter(r => r.is_teste).length}`);
  console.log(`  Reais: ${pagoSemBaixaList.filter(r => !r.is_teste).length}`);
  pagoSemBaixaList.forEach(r => {
    console.log(`  - fp_id=${abrev(r.id)} teste=${r.is_teste}`);
  });

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
