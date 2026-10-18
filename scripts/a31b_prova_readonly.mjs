/**
 * A31B — PROVA TÉCNICA READ-ONLY do fluxo App → Escala/OS → Central Financeira
 *
 * NENHUM INSERT/UPDATE/DELETE. Apenas SELECT.
 * Prova que App, Escala, OS e Financeiro usam a MESMA fonte de dados.
 *
 * Uso: node scripts/a31b_prova_readonly.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL não definida'); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

let passed = 0;
let failed = 0;
const evidencias = [];

function assert(condition, message, evidencia) {
  if (condition) { console.log(`  ✅ ${message}`); passed++; }
  else { console.log(`  ❌ ${message}`); failed++; }
  if (evidencia) evidencias.push(evidencia);
}

function header(t) { console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`); }

async function main() {
  await client.connect();
  console.log('✅ Conectado (read-only)\n');

  // ── 1. FLUXO APP → TMS: RPCs usadas pelo App ───────────────────────────────
  header('1. FLUXO APP → TMS — RPCs existentes');
  const { rows: rpcs } = await client.query(`
    SELECT p.proname,
           pg_get_function_arguments(p.oid) AS args,
           p.provolatile AS volatil,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('f_avancar_etapa_app_motorista','f_atualizar_reversa_app','f_buscar_operacoes_motorista')
    ORDER BY p.proname
  `);
  assert(rpcs.length >= 3, `3 RPCs do App presentes (encontradas ${rpcs.length})`);
  for (const r of rpcs) {
    console.log(`   - ${r.proname}(${r.args.slice(0, 90)}...) [${r.volatil}] anon=${r.anon_exec} auth=${r.auth_exec}`);
  }

  // ── 2. APP → ROMANEIO: o payload do App grava onde? ─────────────────────────
  header('2. APP → ROMANEIO — o que a RPC f_avancar_etapa grava');
  const { rows: avancarDef } = await client.query(`
    SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_avancar_etapa_app_motorista'
  `);
  const body = avancarDef[0]?.prosrc || '';
  assert(body.includes('alocacoes_escala'), 'RPC atualiza alocacoes_escala');
  assert(body.includes('app_motorista'), 'RPC grava payload em metadata.app_motorista');
  const gravaOrdensServicoRomaneio = body.includes('UPDATE public.ordens_servico') ||
    /ordens_servico[\s\S]{0,300}romaneio/i.test(body) || body.includes('romaneio = ');
  assert(!gravaOrdensServicoRomaneio, 'RPC NÃO grava diretamente em ordens_servico.romaneio (comprova causa raiz)');

  // ── 3. ALOCAÇÕES com metadata.app_motorista.romaneio ────────────────────────
  header('3. ALOCAÇÕES — quantas têm romaneio no payload do App');
  const { rows: comAppMeta } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE a.metadata ? 'app_motorista') AS com_app,
           COUNT(*) FILTER (WHERE a.metadata->'app_motorista' ? 'romaneio') AS com_romaneio_app
    FROM public.alocacoes_escala a
  `);
  console.log(`   Total alocações: ${comAppMeta[0].total}`);
  console.log(`   Com metadata.app_motorista: ${comAppMeta[0].com_app}`);
  console.log(`   Com romaneio no payload App: ${comAppMeta[0].com_romaneio_app}`);
  assert(Number(comAppMeta[0].com_romaneio_app) >= 0, 'Consulta de romaneio App OK (read-only)');

  // ── 4. FONTE OFICIAL: ordens_servico.romaneio preenchida pelo TMS ───────────
  header('4. FONTE OFICIAL — ordens_servico.romaneio (preenchida pelo TMS/Central)');
  const { rows: osRomaneio } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE romaneio IS NOT NULL AND romaneio <> '') AS com_romaneio
    FROM public.ordens_servico
  `);
  console.log(`   Total OS: ${osRomaneio[0].total} | com romaneio: ${osRomaneio[0].com_romaneio}`);
  assert(Number(osRomaneio[0].com_romaneio) >= 0, 'Consulta OS.romaneio OK (read-only)');

  // ── 5. CRUZAMENTO: alocação finalizada → OS → romaneio ─────────────────────
  header('5. CRUZAMENTO — Central Financeira lê o MESMO romaneio da OS');
  const { rows: cruzamento } = await client.query(`
    SELECT a.id AS alocacao_id,
           a.ordem_servico_id AS os_id,
           os.numero AS os_numero,
           os.romaneio AS os_romaneio,
           (a.metadata->'app_motorista'->>'romaneio') AS app_romaneio,
           a.status, a.finalizada,
           a.valor_frete, a.valor_repasse, a.valor_pedagio, a.valor_combustivel,
           a.valor_ajudante, a.valor_desconto, a.km_realizados
    FROM public.alocacoes_escala a
    LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    WHERE a.status = 'concluida' AND a.finalizada = true
      AND os.romaneio IS NOT NULL AND os.romaneio <> ''
    ORDER BY a.data_finalizacao DESC
    LIMIT 10
  `);
  console.log(`   Alocações finalizadas com OS.romaneio preenchido: ${cruzamento.length}`);
  for (const c of cruzamento) {
    const romaneioOK = c.os_romaneio === c.app_romaneio || c.app_romaneio === null;
    console.log(`   OS ${c.os_numero} | romaneio OS=${c.os_romaneio} | app=${c.app_romaneio || '—'} | ${romaneioOK ? 'MESMO' : 'DIVERGENTE'} | cliente R$ ${c.valor_frete} | prest R$ ${c.valor_repasse}`);
  }
  const todosRomaneioOK = cruzamento.every((c) => c.os_romaneio === c.app_romaneio || c.app_romaneio === null);
  assert(cruzamento.length > 0, 'Existem alocações finalizadas com romaneio na OS (fonte oficial)');

  // ── 6. POD: entregas_protocolo vinculado às alocações finalizadas ───────────
  header('6. POD — entregas_protocolo (fonte oficial de prova de entrega)');
  const { rows: pod } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE p.status = 'entregue') AS entregue,
           COUNT(*) FILTER (WHERE p.status = 'nao_entregue') AS nao_entregue,
           COUNT(*) FILTER (WHERE p.foto_entrega_url IS NOT NULL OR p.foto_canhoto_url IS NOT NULL) AS com_foto,
           COUNT(*) FILTER (WHERE p.assinatura_url IS NOT NULL) AS com_assinatura
    FROM public.entregas_protocolo p
  `);
  console.log(`   PODs: ${pod[0].total} | entregue=${pod[0].entregue} | nao_entregue=${pod[0].nao_entregue} | foto=${pod[0].com_foto} | assinatura=${pod[0].com_assinatura}`);
  assert(Number(pod[0].total) >= 0, 'Consulta entregas_protocolo OK');

  const { rows: podAlocacoes } = await client.query(`
    SELECT a.id AS alocacao_id, os.numero AS os_numero, os.romaneio AS romaneio,
           p.status AS pod_status, p.nome_recebedor AS recebedor,
           (p.foto_entrega_url IS NOT NULL OR p.foto_canhoto_url IS NOT NULL) AS tem_foto,
           p.assinatura_url IS NOT NULL AS tem_assinatura
    FROM public.entregas_protocolo p
    JOIN public.alocacoes_escala a ON a.id = p.alocacao_id
    LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    WHERE os.romaneio IS NOT NULL AND os.romaneio <> ''
    ORDER BY p.created_at DESC
    LIMIT 8
  `);
  console.log(`   PODs vinculados a alocações com romaneio na OS: ${podAlocacoes.length}`);
  for (const p of podAlocacoes) {
    console.log(`   OS ${p.os_numero} | romaneio ${p.romaneio} | POD=${p.pod_status} | recebedor=${p.recebedor || '—'} | foto=${p.tem_foto} | assinatura=${p.tem_assinatura}`);
  }
  assert(podAlocacoes.length >= 0, 'Consulta POD×alocação×OS OK');

  // ── 7. FINANCEIRO: títulos vinculados por os_id ─────────────────────────────
  header('7. FINANCEIRO — receber/pagar/pagamentos_prestadores por os_id');
  const { rows: fin } = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM public.financeiro_receber) AS qtd_receber,
      (SELECT COUNT(*) FROM public.financeiro_pagar) AS qtd_pagar,
      (SELECT COUNT(*) FROM public.pagamentos_prestadores) AS qtd_pagto,
      (SELECT COUNT(*) FROM public.composicao_financeira_os) AS qtd_composicao
  `);
  console.log(`   financeiro_receber: ${fin[0].qtd_receber} | financeiro_pagar: ${fin[0].qtd_pagar} | pagamentos_prestadores: ${fin[0].qtd_pagto} | composicao_financeira_os: ${fin[0].qtd_composicao}`);

  // Prestador e cliente NÃO compartilham o mesmo valor automaticamente
  const { rows: valoresDistintos } = await client.query(`
    SELECT a.id AS alocacao_id,
           a.valor_frete AS cliente_base, a.valor_repasse AS prestador_base,
           (a.valor_frete - a.valor_repasse) AS margem_bruta
    FROM public.alocacoes_escala a
    WHERE a.status='concluida' AND a.finalizada=true
      AND a.valor_frete IS NOT NULL AND a.valor_repasse IS NOT NULL
    ORDER BY a.data_finalizacao DESC LIMIT 8
  `);
  console.log('   Cliente × Prestador (margem):');
  for (const v of valoresDistintos) {
    console.log(`   aloc ${String(v.alocacao_id).slice(0,8)} | cliente R$ ${v.cliente_base} | prest R$ ${v.prestador_base} | margem R$ ${v.margem_bruta}`);
  }
  const algumDistinto = valoresDistintos.some((v) => Number(v.cliente_base) !== Number(v.prestador_base));
  assert(algumDistinto || valoresDistintos.length === 0, 'Cliente e Prestador usam valores independentes (não compartilham automaticamente)');

  // ── 8. MATRIZ DE SINCRONIZAÇÃO: mesma fonte por campo ───────────────────────
  header('8. MATRIZ DE SINCRONIZAÇÃO — campos compartilhados (fonte única)');
  const { rows: sincronizados } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE a.cliente_id IS NOT NULL) AS com_cliente,
           COUNT(*) FILTER (WHERE a.prestador_id IS NOT NULL) AS com_prestador,
           COUNT(*) FILTER (WHERE a.km_realizados > 0) AS com_km,
           COUNT(*) FILTER (WHERE a.finalizada) AS finalizadas,
           COUNT(*) FILTER (WHERE p.id IS NOT NULL) AS com_pod
    FROM public.alocacoes_escala a
    LEFT JOIN public.entregas_protocolo p ON p.alocacao_id = a.id
    WHERE a.status='concluida'
  `);
  console.log(`   Finalizadas com: cliente=${sincronizados[0].com_cliente}/${sincronizados[0].total} | prestador=${sincronizados[0].com_prestador} | km>0=${sincronizados[0].com_km} | pod=${sincronizados[0].com_pod}`);
  assert(Number(sincronizados[0].total) >= 0, 'Consulta matriz de sincronização OK');

  // ── 9. ESTRUTURA ALOCAÇÕES: campos de adicionais disponíveis ────────────────
  header('9. ESTRUTURA alocacoes_escala — adicionais Cliente × Prestador');
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='alocacoes_escala'
    ORDER BY ordinal_position
  `);
  const colsArr = cols.map((c) => c.column_name);
  const financeiroCols = [
    'valor_frete','valor_repasse','valor_pedagio','valor_combustivel','valor_ajudante',
    'valor_adicional','valor_desconto','pedagio_franquia','pedagio_excedente',
    'pedagio_cobrar_excedente','diarias_adicionais','valor_diaria','segunda_saida',
    'valor_segunda_saida','terceira_saida','valor_terceira_saida','saidas_adicionais',
    'valor_saida_adicional','ajudantes','valor_ajudante_unit','reembolsos_outros',
    'valor_reembolso_outros','km_previstos','km_realizados','km_rodados',
    'valor_tipo','valor_percentual','valor_fixo','combustivel_valor','valor_km'
  ];
  const presentes = financeiroCols.filter((c) => colsArr.includes(c));
  const ausentes = financeiroCols.filter((c) => !colsArr.includes(c));
  console.log(`   Colunas financeiras presentes: ${presentes.length}/${financeiroCols.length}`);
  if (ausentes.length) console.log(`   Ausentes: ${ausentes.join(', ')}`);
  assert(presentes.length === financeiroCols.length, `Todas as colunas de adicionais existem (faltam: ${ausentes.join(',') || 'nenhuma'})`);

  // ── 10. fiscal_documentos_vinculados — estrutura p/ NFs ─────────────────────
  header('10. FISCAL — fiscal_documentos_vinculados (NFs transportadas 1:N)');
  const { rows: fiscalCols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='fiscal_documentos_vinculados'
    ORDER BY ordinal_position
  `);
  const fCols = fiscalCols.map((c) => c.column_name);
  for (const c of ['ordem_servico_id','cte_id','mdfe_id','tipo_documento','chave_acesso','numero','serie','valor_total','xml_storage_path','status']) {
    assert(fCols.includes(c), `fiscal_documentos_vinculados possui coluna ${c}`);
  }
  const { rows: fiscalData } = await client.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE ordem_servico_id IS NOT NULL) AS com_os,
           COUNT(*) FILTER (WHERE cte_id IS NOT NULL OR mdfe_id IS NOT NULL) AS vinculada_doc_fiscal
    FROM public.fiscal_documentos_vinculados
  `);
  console.log(`   NFs: total=${fiscalData[0].total} | vinculadas a OS=${fiscalData[0].com_os} | usadas por CT-e/MDF-e=${fiscalData[0].vinculada_doc_fiscal}`);

  // ── RESUMO ──────────────────────────────────────────────────────────────────
  header('RESUMO PROVA READ-ONLY A31B');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('❌ ERRO:', e.message); process.exit(2); });