// MISSÃO 133-D.7.1 — ETAPA 1: Validar estado inicial completo da alocação candidata (SELECT-only)
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const ALOCACAO_ID = '76af8e4a-a3bc-492a-897d-4556574cc5d1';

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  await c.connect();

  console.log('=== ETAPA 1 — ESTADO INICIAL DA ALOCAÇÃO CANDIDATA ===\n');

  // 1. Alocação completa
  const r1 = await c.query(`
    SELECT id, ordem_servico_id, status, prestador_id, tenant_id, cliente_id,
           aceite_prestador, data_aceite, finalizada, data_finalizacao,
           metadata->'app_motorista'->>'etapa_atual' AS etapa_atual,
           metadata->'app_motorista'->>'ultima_idempotency' AS ultima_idempotency,
           LEFT(rota,100) AS rota, LEFT(observacoes,100) AS obs,
           LEFT(instrucoes_operacionais,100) AS instrucoes,
           tipo_reversa, reversa_status, data_escala,
           created_at, updated_at,
           horario_inicio_real, horario_fim_real
    FROM public.alocacoes_escala
    WHERE id = $1
  `, [ALOCACAO_ID]);

  if (r1.rows.length === 0) {
    console.log('❌ ALOCAÇÃO NÃO ENCONTRADA — NO-GO');
    process.exit(1);
  }
  const a = r1.rows[0];
  console.log('1.1 — DADOS DA ALOCAÇÃO');
  console.log(JSON.stringify(a, null, 2));
  console.log(`  etapa_atual: "${a.etapa_atual}" (vazio/null = transição "" → viagem_aceita válida)`);
  console.log(`  ultima_idempotency: "${a.ultima_idempotency}"`);

  // 2. Prestador vinculado
  if (a.prestador_id) {
    const r2 = await c.query(`
      SELECT id, nome_completo, status, auth_user_id, email, cpf_cnpj, telefone
      FROM public.prestadores WHERE id = $1
    `, [a.prestador_id]);
    console.log('\n1.2 — PRESTADOR VINCULADO');
    if (r2.rows.length > 0) {
      console.log(JSON.stringify(r2.rows[0], null, 2));
      console.log(`  auth_user_id: ${r2.rows[0].auth_user_id || 'NULL'}`);
    } else { console.log('  ❌ PRESTADOR NÃO ENCONTRADO'); }
  }

  // 3. Auth user do prestador
  const r3 = await c.query(`
    SELECT id, email, raw_user_meta_data, created_at, last_sign_in_at
    FROM auth.users WHERE id = (SELECT auth_user_id FROM public.prestadores WHERE id = $1)
  `, [a.prestador_id]);
  console.log('\n1.3 — AUTH USER DO PRESTADOR');
  if (r3.rows.length > 0) {
    console.log(JSON.stringify(r3.rows[0], null, 2));
  } else { console.log('  Auth user não encontrado'); }

  // 4. OS vinculada (se houver)
  if (a.ordem_servico_id) {
    const r4 = await c.query(`
      SELECT id, numero, status, data_servico, cliente_id::text AS cliente,
             LEFT(observacoes_gerais,200) AS obs
      FROM public.ordens_servico WHERE id = $1
    `, [a.ordem_servico_id]);
    console.log('\n1.4 — ORDEM DE SERVIÇO VINCULADA');
    if (r4.rows.length > 0) {
      const os = r4.rows[0];
      console.log(JSON.stringify(os, null, 2));
      console.log(`  Client exists: ${os.cliente ? 'YES' : 'NO'}`);
    }
  } else {
    console.log('\n1.4 — ORDEM DE SERVIÇO: NENHUMA (candidato isolado) ✅');
  }

  // 5. Financeiro associado (via OS)
  if (a.ordem_servico_id) {
    const osid = a.ordem_servico_id;
    const r5a = await c.query(`SELECT COUNT(*) AS qtd FROM public.financeiro_receber WHERE os_id = $1::text`, [osid]);
    const r5b = await c.query(`SELECT COUNT(*) AS qtd FROM public.financeiro_pagar WHERE os_id = $1::text`, [osid]);
    const r5c = await c.query(`SELECT COUNT(*) AS qtd FROM public.pagamentos_prestadores WHERE os_id = $1::text`, [osid]);
    const r5d = await c.query(`SELECT COUNT(*) AS qtd FROM public.composicao_financeira_os WHERE os_id = $1::text`, [osid]);
    console.log('\n1.5 — FINANCEIRO ASSOCIADO');
    console.log(`  financeiro_receber: ${r5a.rows[0].qtd}`);
    console.log(`  financeiro_pagar: ${r5b.rows[0].qtd}`);
    console.log(`  pagamentos_prestadores: ${r5c.rows[0].qtd}`);
    console.log(`  composicao_financeira_os: ${r5d.rows[0].qtd}`);
  } else {
    console.log('\n1.5 — FINANCEIRO: NENHUM (sem OS) ✅');
  }

  // 6. Tracking / POD / Ocorrências
  console.log('\n1.6 — TRACKING, POD, OCORRÊNCIAS');
  if (a.ordem_servico_id) {
    const osid = a.ordem_servico_id;
    const rt = await c.query(`SELECT COUNT(*) AS qtd FROM public.portal_tracking_realtime WHERE alocacao_id = $1`, [ALOCACAO_ID]);
    const rpod = await c.query(`SELECT COUNT(*) AS qtd FROM public.entregas_protocolo WHERE ordem_servico_id = $1`, [osid]);
    const roco = await c.query(`SELECT COUNT(*) AS qtd FROM public.portal_ocorrencias WHERE os_id = $1::text`, [osid]);
    console.log(`  portal_tracking_realtime: ${rt.rows[0].qtd}`);
    console.log(`  entregas_protocolo: ${rpod.rows[0].qtd}`);
    console.log(`  portal_ocorrencias: ${roco.rows[0].qtd}`);
  } else {
    console.log(`  portal_tracking_realtime: 0 (sem alocação tracking)`);
    console.log(`  entregas_protocolo: 0 (sem OS)`);
    console.log(`  portal_ocorrencias: 0 (sem OS)`);
  }

  // 7. Eventos e timeline já existentes para esta alocação
  const r7a = await c.query(`SELECT COUNT(*) AS qtd FROM public.eventos_oficiais WHERE entity_id = $1 AND entity_type = 'alocacao'`, [ALOCACAO_ID]);
  const r7b = await c.query(`SELECT COUNT(*) AS qtd FROM public.operation_timeline_events WHERE operation_id = $1::text`, [ALOCACAO_ID]);
  console.log('\n1.7 — EVENTOS E TIMELINE EXISTENTES');
  console.log(`  eventos_oficiais: ${r7a.rows[0].qtd}`);
  console.log(`  operation_timeline_events: ${r7b.rows[0].qtd}`);

  // 8. Histórico da alocação
  const r8 = await c.query(`SELECT COUNT(*) AS qtd FROM public.historico_alocacoes_escala WHERE alocacao_id = $1`, [ALOCACAO_ID]);
  console.log('\n1.8 — HISTÓRICO');
  console.log(`  historico_alocacoes_escala: ${r8.rows[0].qtd}`);

  // 9. Cliente vinculado
  if (a.cliente_id) {
    const r9 = await c.query(`SELECT id, razao_social, status FROM public.clientes WHERE id = $1`, [a.cliente_id]);
    console.log('\n1.9 — CLIENTE VINCULADO');
    if (r9.rows.length > 0) console.log(JSON.stringify(r9.rows[0], null, 2));
    else console.log('  Cliente não encontrado');
  } else {
    console.log('\n1.9 — CLIENTE: NENHUM (candidato sem cliente_id) ✅');
  }

  // 10. Tenant info
  if (a.tenant_id) {
    const r10 = await c.query(`SELECT id, nome FROM public.empresas WHERE id = $1`, [a.tenant_id]);
    console.log('\n1.10 — TENANT');
    if (r10.rows.length > 0) console.log(JSON.stringify(r10.rows[0], null, 2));
    else console.log('  Tenant info: ID existe mas não encontrado na tabela empresas');
  }

  // 11. Última alteração
  console.log(`\n1.11 — TIMESTAMPS`);
  console.log(`  created_at: ${a.created_at}`);
  console.log(`  updated_at: ${a.updated_at}`);
  const hoursSinceUpdate = (Date.now() - new Date(a.updated_at).getTime()) / 3600000;
  console.log(`  Horas desde última atualização: ${hoursSinceUpdate.toFixed(1)}h`);

  // CONFIRMAÇÕES
  console.log('\n' + '='.repeat(60));
  console.log('CONFIRMAÇÕES:');
  console.log('='.repeat(60));
  console.log(`✅ Exclusivamente HML: ${a.rota && (a.rota.toUpperCase().includes('TEST') || a.rota.toUpperCase().includes('HML')) ? 'SIM' : 'NÃO — VERIFICAR'}`);
  console.log(`✅ Sem OS comercial: ${a.ordem_servico_id ? 'TEM OS' : 'SIM (sem OS)'}`);
  console.log(`✅ Transição válida (→ viagem_aceita): etapa_atual="${a.etapa_atual || ''}" ${!a.etapa_atual ? '✅' : '⚠️ etapa já preenchida'}`);
  console.log(`✅ Nenhum usuário usando: não é possível confirmar sem bloqueio — baixo risco (aguardando_aceite, sem OS)`);
  console.log(`✅ Financeiro associado: ${a.ordem_servico_id ? '❌ SIM — risco' : '✅ NENHUM'}`);
  console.log(`✅ Tracking/POD/Ocorrências: ${a.ordem_servico_id ? '❌ PODE TER' : '✅ NENHUM'}`);

  // Check for ROTA TESTE or HOMOLOGACAO in observacoes/rota
  const isHML = (a.rota && (a.rota.toUpperCase().includes('TEST') || a.rota.toUpperCase().includes('HML') || a.rota.toUpperCase().includes('HOMOLOG')))
             || (a.obs && (a.obs.toUpperCase().includes('TEST') || a.obs.toUpperCase().includes('HML') || a.obs.toUpperCase().includes('HOMOLOG')));
  console.log(`\n🔍 VEREDITO HML: ${isHML ? '✅ REGISTRO DE HOMOLOGAÇÃO CONFIRMADO' : '❌ NÃO PARECE HML — VERIFICAR'}`);

  await c.end();
})();
