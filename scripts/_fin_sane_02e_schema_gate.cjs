const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DOTENV = fs.readFileSync(path.resolve('.env'), 'utf8');
const DATABASE_URL = DOTENV.split(/\r?\n/).find(l => l.startsWith('DATABASE_URL='))?.split('=').slice(1).join('=').trim();
if (!DATABASE_URL) throw new Error('DATABASE_URL não encontrado');

const client = new Client({ connectionString: DATABASE_URL, statement_timeout: 30000 });

async function q(sql, params = []) {
  try {
    const r = await client.query(sql, params);
    return r.rows;
  } catch (e) {
    return [{ ERRO: e.message }];
  }
}

async function main() {
  await client.connect();
  console.log('// CONECTADO AMBIENTE REAL (READ-ONLY) //');
  console.log('');

  // 1. Verificar snapshot pré-existente
  const snapExist = await q(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='fin_sane_02b_snapshot'`);
  console.log('SNAPSHOT PRE-EXISTENTE:', snapExist.length > 0 ? 'SIM' : 'NAO');
  if (snapExist.length > 0) {
    const snapCount = await q(`SELECT COUNT(*)::int AS n FROM public.fin_sane_02b_snapshot`);
    console.log('SNAPSHOT REGISTROS:', snapCount[0]?.n ?? '?');
  }
  console.log('');

  // 2. Tabelas e colunas
  const tabelas = [
    'financeiro_pagar',
    'pagamentos_prestadores',
    'financeiro_baixas',
    'alocacoes_escala',
    'ordens_servico',
    'clientes',
    'prestadores',
    'contas_financeiras',
    'financeiro_receber',
    'composicao_financeira_os'
  ];

  for (const tabela of tabelas) {
    console.log(`=== TABELA: ${tabela} ===`);
    const existe = await q(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [tabela]);
    console.log('EXISTE:', existe.length > 0 ? 'SIM' : 'NAO');
    if (existe.length > 0) {
      const cols = await q(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position
      `, [tabela]);
      cols.forEach(c => {
        console.log(`COL: ${c.column_name} | ${c.data_type} | NULL:${c.is_nullable} | DEFAULT:${c.column_default ?? 'null'}`);
      });

      const constraints = await q(`
        SELECT con.conname AS nome, pg_get_constraintdef(con.oid) AS def
        FROM pg_constraint con
        JOIN pg_class cl ON cl.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = cl.relnamespace
        WHERE ns.nspname='public' AND cl.relname=$1
        ORDER BY con.conname
      `, [tabela]);
      constraints.forEach(c => console.log(`CONSTRAINT: ${c.nome} | ${c.def}`));

      const indexes = await q(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname='public' AND tablename=$1
        ORDER BY indexname
      `, [tabela]);
      indexes.forEach(i => console.log(`INDEX: ${i.indexname}`));
    }
    console.log('');
  }

  // 3. Funções
  const funcoes = [
    'f_confirmar_pagamento_prestador',
    'f_trg_propagar_financeiro_alocacao',
    'f_trg_propagar_financeiro_os',
    'f_confirmar_pagamento_fechamento'
  ];
  for (const fn of funcoes) {
    console.log(`=== FUNCAO: ${fn} ===`);
    const r = await q(`
      SELECT p.proname, pg_get_function_arguments(p.oid) AS args,
             pg_get_function_result(p.oid) AS retorno,
             l.lanname AS lingua, p.provolatile AS volatil,
             p.prosecdef AS security_definer
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
      WHERE n.nspname='public' AND p.proname=$1
    `, [fn]);
    if (r.length === 0) {
      console.log('EXISTE: NAO');
    } else {
      r.forEach(f => console.log(`EXISTE: SIM | ARGS: ${f.args} | RETORNO: ${f.retorno} | LANG: ${f.lingua} | VOLATIL: ${f.volatil} | SECDEF: ${f.security_definer}`));
      const src = await q(`SELECT pg_get_functiondef(p.oid) AS src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1`, [fn]);
      const body = src[0]?.src ?? '';
      // Análise superficial de diferenças críticas
      const hasAuthUid = body.includes('auth.uid()');
      const hasValorLiquido = body.includes('valor_liquido');
      const hasValorPagarValorLiquido = /financeiro_pagar[\s\S]{0,500}valor\s*=\s*v_valor_liquido/.test(body);
      const hasValorPagarValorPrestador = /financeiro_pagar[\s\S]{0,500}valor\s*=\s*v_valor_prestador/.test(body);
      console.log(`ANALISE: auth.uid=${hasAuthUid} | usa valor_liquido=${hasValorLiquido} | fp.valor=valor_liquido=${hasValorPagarValorLiquido} | fp.valor=valor_prestador=${hasValorPagarValorPrestador}`);
    }
    const grants = await q(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema='public' AND routine_name=$1
    `, [fn]);
    console.log('GRANTS:', grants.map(g => `${g.grantee}:${g.privilege_type}`).join(', ') || 'NENHUM');
    console.log('');
  }

  // 4. Triggers
  const triggers = [
    ['trg_propagar_financeiro_alocacao', 'alocacoes_escala'],
    ['trg_propagar_financeiro_os', 'ordens_servico']
  ];
  for (const [tg, tbl] of triggers) {
    console.log(`=== TRIGGER: ${tg} ON ${tbl} ===`);
    const r = await q(`
      SELECT t.tgname, t.tgtype, t.tgenabled, c.relname AS tabela,
             p.proname AS funcao
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname='public' AND c.relname=$1 AND t.tgname=$2
    `, [tbl, tg]);
    if (r.length === 0) {
      console.log('EXISTE: NAO');
    } else {
      const t = r[0];
      const event = [];
      if (t.tgtype & 4) event.push('INSERT');
      if (t.tgtype & 8) event.push('DELETE');
      if (t.tgtype & 16) event.push('UPDATE');
      const timing = (t.tgtype & 2) ? 'BEFORE' : 'AFTER';
      const rowstmt = (t.tgtype & 1) ? 'FOR EACH ROW' : 'FOR EACH STATEMENT';
      console.log(`EXISTE: SIM | EVENTO: ${event.join('|')} | TIMING: ${timing} | ${rowstmt} | FUNCAO: ${t.funcao} | ENABLED: ${t.tgenabled}`);
    }
    console.log('');
  }

  // 5. Dry-run Seção 4 - candidatos a snapshot
  console.log('=== DRY-RUN SEÇÃO 4 (candidatos snapshot) ===');
  const dryCandidatos = await q(`
    SELECT
      COUNT(*)::int AS qtd,
      ROUND(COALESCE(SUM(COALESCE(fp.valor,0)),0),2) AS soma_valor_atual,
      ROUND(COALESCE(SUM(COALESCE(pp.valor_liquido,0)),0),2) AS soma_valor_proposto,
      ROUND(COALESCE(SUM(COALESCE(pp.valor_liquido,0)),0) - COALESCE(SUM(COALESCE(fp.valor,0)),0),2) AS diferenca
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
  `);
  console.log(dryCandidatos[0]);
  console.log('');

  // 6. Separar TESTE vs REAL
  console.log('=== DRY-RUN SEPARADO TESTE vs REAL ===');
  const separado = await q(`
    SELECT
      CASE
        WHEN fp.descricao ILIKE '%teste%' OR fp.descricao ILIKE '%TESTE%'
          OR pp.prestador_nome ILIKE '%teste%' OR pp.prestador_nome ILIKE '%TESTE%'
          OR fp.os_id ILIKE '%teste%' THEN 'TESTE'
        ELSE 'REAL'
      END AS tipo,
      COUNT(*)::int AS qtd,
      ROUND(COALESCE(SUM(COALESCE(fp.valor,0)),0),2) AS soma_valor_atual,
      ROUND(COALESCE(SUM(COALESCE(pp.valor_liquido,0)),0),2) AS soma_valor_proposto
    FROM public.financeiro_pagar fp
    INNER JOIN public.pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
    GROUP BY tipo
  `);
  console.log(separado);
  console.log('');

  // 7. Pagos sem baixa
  console.log('=== PAGOS SEM BAIXA ===');
  const pagosSemBaixa = await q(`
    SELECT
      CASE
        WHEN pp.prestador_nome ILIKE '%teste%' THEN 'TESTE'
        ELSE 'REAL'
      END AS tipo,
      COUNT(*)::int AS qtd
    FROM public.pagamentos_prestadores pp
    LEFT JOIN public.financeiro_baixas fb
           ON fb.titulo_tabela = 'financeiro_pagar'
          AND fb.titulo_id = (
            SELECT id FROM public.financeiro_pagar fp
             WHERE fp.os_id = pp.os_id::TEXT
             LIMIT 1
          )
          AND COALESCE(fb.estornada, false) = false
    WHERE (pp.status_pagamento = 'pago' OR pp.status = 'pago')
      AND fb.id IS NULL
    GROUP BY tipo
  `);
  console.log(pagosSemBaixa);
  console.log('');

  // 8. Contagens gerais
  console.log('=== CONTAGENS GERAIS ===');
  const contagens = await q(`
    SELECT
      (SELECT COUNT(*) FROM public.financeiro_pagar) AS total_fp,
      (SELECT COUNT(*) FROM public.pagamentos_prestadores) AS total_pp,
      (SELECT COUNT(*) FROM public.financeiro_baixas) AS total_baixas,
      (SELECT COUNT(*) FROM public.alocacoes_escala) AS total_aloc,
      (SELECT COUNT(*) FROM public.ordens_servico) AS total_os
  `);
  console.log(contagens[0]);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
