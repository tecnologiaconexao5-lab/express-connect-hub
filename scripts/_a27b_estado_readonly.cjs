const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const url = process.env.DATABASE_URL;
const client = new Client({ connectionString: url });
const pad = (s, n = 45) => String(s).padEnd(n);

async function q(label, sql, params = []) {
  try {
    const r = await client.query(sql, params);
    console.log(`\n### ${label}`);
    console.log(r.rows.length === 0 ? '(vazio)' : JSON.stringify(r.rows, null, 1));
  } catch (e) {
    console.log(`\n### ${label} -> ERRO: ${e.message}`);
  }
}

(async () => {
  await client.connect();

  await q('RPC f_buscar_oportunidades_para_prestador existe?', `
    SELECT p.proname, p.provolatile, p.prosecdef
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_buscar_oportunidades_para_prestador';
  `);

  await q('RPC f_aceitar_oportunidade_rede existe? (assinatura)', `
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_aceitar_oportunidade_rede';
  `);

  await q('RPC f_aceitar_oportunidade_rede contem fix cliente_id (regex guard)?', `
    SELECT pg_get_functiondef(p.oid) LIKE '%^[0-9a-f]{8}-[0-9a-f]{4}-%' AS tem_guard_uuid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'f_aceitar_oportunidade_rede';
  `);

  await q('Oportunidades em rede_oportunidades (todas, ordenadas por created_at desc)', `
    SELECT id, os_id, status, prestador_aceite_id, aceite_em, valor_prestador,
           prazo_expiracao, created_at, veiculo_necessario, regiao, requisitos
    FROM public.rede_oportunidades
    ORDER BY created_at DESC LIMIT 15;
  `);

  await q('OS candidata HML (busca por prefixo 680216)', `
    SELECT id, numero, status, cliente_id, prestador_id, data_programada,
           origem, destino, peso, volumes, cubagem, valor_cliente, valor_repasse,
           custo_prestador, observacoes_gerais, distancia_km, created_at
    FROM public.ordens_servico
    WHERE numero ILIKE '%680216%' OR numero ILIKE '%A27B%' OR numero ILIKE '%202608-68%'
    ORDER BY created_at DESC LIMIT 10;
  `);

  await q('Veiculos HML-A27B', `
    SELECT id, placa, tipo_veiculo, capacidade_kg, status, prestador_vinculado, created_at
    FROM public.veiculos WHERE placa ILIKE '%A27B%' ORDER BY created_at DESC LIMIT 5;
  `);

  await q('Prestador TESTE (teste@conexao.com)', `
    SELECT id, nome_completo, email, status, regiao_principal, regioes_secundarias,
           aceita_refrigerada, created_at
    FROM public.prestadores WHERE email ILIKE '%teste@conexao%' ORDER BY created_at DESC LIMIT 5;
  `);

  await q('Alocacoes vinculadas a OS 680216', `
    SELECT a.id, a.ordem_servico_id, a.prestador_id, a.status, a.aceite_prestador,
           a.data_aceite, a.valor_frete, a.valor_repasse, a.metadata
    FROM public.alocacoes_escala a
    LEFT JOIN public.ordens_servico o ON o.id = a.ordem_servico_id
    WHERE o.numero ILIKE '%680216%'
    ORDER BY a.created_at DESC LIMIT 10;
  `);

  await q('Financeiro propagado da OS 680216', `
    SELECT 'receber' AS tabela, id, os_id, valor, status FROM public.financeiro_receber
    WHERE os_id::text ILIKE '%' ORDER BY created_at DESC LIMIT 3;
  `);

  await client.end();
})().catch(async (e) => {
  console.error('FATAL:', e.message);
  await client.end();
  process.exit(1);
});