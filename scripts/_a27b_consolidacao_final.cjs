const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const OS_ID = '2c24a4dc-3491-4f46-9d24-69ceb4d76d63';
const OP_ID = 'c2ca797c-02b0-4042-ac5d-e8f96796d249';
const PREST_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';
const ALOC_ID = '2333f16e-6f4f-4169-8766-a02282ec8527';
const AUTH_ID = 'a5e51631-5ed8-430d-9041-4b185c03d821';

const out = [];
function l(s = '') { out.push(s); console.log(s); }

(async () => {
  await client.connect();

  l('========== A27-B CONSOLIDAÇÃO FINAL (READ-ONLY) ==========');

  // 1. Oportunidade: existiu, publicada, aceita, horário real
  const opp = await client.query(
    `SELECT id, os_id, status, prestador_aceite_id, aceite_em, valor_prestador,
            prazo_expiracao, created_at, veiculo_necessario, regiao, requisitos
     FROM public.rede_oportunidades WHERE id = $1`, [OP_ID]);
  l('\n[1] Oportunidade HML-A27B-REDE-20260816');
  if (opp.rows.length) {
    const o = opp.rows[0];
    l(`  id           : ${o.id}`);
    l(`  os_id        : ${o.os_id}`);
    l(`  status       : ${o.status}`);
    l(`  created_at   : ${o.created_at}  (publicação)`);
    l(`  prazo_exp    : ${o.prazo_expiracao}`);
    l(`  prestador    : ${o.prestador_aceite_id}`);
    l(`  aceite_em    : ${o.aceite_em}  (horário real de aceite)`);
    l(`  valor_repasse: ${o.valor_prestador}`);
    l(`  veic_necess  : ${JSON.stringify(o.veiculo_necessario)}`);
  } else l('  !!! NÃO ENCONTRADA');

  // Quantidade de oportunidades para esta OS (duplicidade?)
  const dup = await client.query(
    `SELECT COUNT(*)::int AS c, COUNT(DISTINCT id)::int AS d
     FROM public.rede_oportunidades WHERE os_id = $1`, [OS_ID]);
  l(`  total oportunidades p/ OS: ${dup.rows[0].c} (distintas: ${dup.rows[0].d})`);

  // 2. Alocação única
  const alocs = await client.query(
    `SELECT id, status, prestador_id, aceite_prestador, data_aceite,
            tipo_veiculo, placa, valor_frete, valor_repasse, metadata
     FROM public.alocacoes_escala WHERE ordem_servico_id = $1`, [OS_ID]);
  l('\n[2] Alocações');
  l(`  total alocações: ${alocs.rows.length}`);
  alocs.rows.forEach(a => {
    l(`  - ${a.id} | status=${a.status} | prestador=${a.prestador_id}`);
    l(`    aceite_prestador=${a.aceite_prestador} | data_aceite=${a.data_aceite}`);
    l(`    tipo_veiculo=${a.tipo_veiculo} | placa=${a.placa || '(via veiculos)'}`);
    l(`    valor_frete=${a.valor_frete} | valor_repasse=${a.valor_repasse}`);
    l(`    metadata.aceite_tipo=${a.metadata?.aceite_tipo} | operation_mode=${a.metadata?.operation_mode}`);
    l(`    metadata.os_numero=${a.metadata?.os_numero} | origem=${a.metadata?.origem}`);
  });

  // 3. Veículo e prestador
  const vei = await client.query(
    `SELECT id, placa, tipo_veiculo, capacidade_kg, status, prestador_vinculado
     FROM public.veiculos WHERE placa ILIKE '%A27B%'`, []);
  const prest = await client.query(
    `SELECT id, nome_completo, email, status, auth_user_id
     FROM public.prestadores WHERE id = $1`, [PREST_ID]);
  l('\n[3] Veículo + Prestador');
  vei.rows.forEach(v => l(`  Veículo: ${v.placa} | ${v.tipo_veiculo} | ${v.capacidade_kg}kg | ${v.status} | vinculo=${v.prestador_vinculado}`));
  prest.rows.forEach(p => l(`  Prestador: ${p.nome_completo} | ${p.email} | ${p.status} | auth_user_id=${p.auth_user_id}`));

  // 4. OS
  const os = await client.query(
    `SELECT numero, status, cliente_id, prestador_id, origem, destino,
            valor_cliente, peso, volumes, observacoes_gerais
     FROM public.ordens_servico WHERE id = $1`, [OS_ID]);
  l('\n[4] OS');
  if (os.rows.length) l(`  ${JSON.stringify(os.rows[0])}`);

  // 5. Desaparecimento (RPC pós-aceite retorna total=0 para este prestador)
  const rpc = await client.query(
    'SELECT public.f_buscar_oportunidades_para_prestador($1::uuid) AS resp', [PREST_ID]);
  const rpcData = rpc.rows[0].resp;
  const lista = rpcData?.oportunidades || [];
  const contem = lista.some(o => o.id === OP_ID || o.os_id === OS_ID);
  l('\n[5] Desaparecimento pós-aceite');
  l(`  RPC total=${rpcData?.total} | contém HML? ${contem} | success=${rpcData?.success}`);

  // 6. Home/Operações — RPC exige auth.uid() (JWT). Verificar comportamento de segurança.
  const def = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_buscar_operacoes_motorista'`);
  const usesAuthUid = def.rows[0]?.def.includes('auth.uid()') || false;
  l('\n[6] Home/Operações (f_buscar_operacoes_motorista)');
  l(`  usa auth.uid() (proteção TMS-032 S2): ${usesAuthUid}`);
  if (usesAuthUid) {
    // fora do contexto autenticado deve retornar USUARIO_NAO_AUTENTICADO (esperado)
    const r = await client.query(
      'SELECT public.f_buscar_operacoes_motorista($1::uuid) AS resp', [AUTH_ID]);
    l(`  chamada sem JWT: ${JSON.stringify(r.rows[0].resp)} (comportamento de segurança esperado)`);
  }
  // Equivalente direto à operação na alocação (read-only, comprova Home/Operações)
  const opsEq = await client.query(
    `SELECT o.numero, a.status, o.origem, o.destino, o.data_programada,
            a.valor_repasse, a.metadata->>'operation_mode' AS mode
     FROM public.alocacoes_escala a
     JOIN public.ordens_servico o ON o.id = a.ordem_servico_id
     WHERE a.id = $1`, [ALOC_ID]);
  l(`  equivalente alocação (Home/Operações): ${JSON.stringify(opsEq.rows[0])}`);

  // 7. JourneyConfig via metadata
  l('\n[7] JourneyConfig');
  if (alocs.rows.length) l(`  operation_mode = ${alocs.rows[0].metadata?.operation_mode}`);

  // 8. Notificação + histórico + visualizações
  const notif = await client.query(
    `SELECT titulo, tipo, origem_id, lida FROM public.portal_notificacoes
     WHERE tipo='oportunidade_aceita' AND origem_id=$1 ORDER BY created_at DESC LIMIT 1`, [OS_ID]);
  const hist = await client.query(
    `SELECT acao, status_novo, usuario FROM public.os_historico WHERE os_id=$1 ORDER BY created_at ASC`, [OS_ID]);
  const vis = await client.query(
    `SELECT COUNT(*)::int AS c FROM public.rede_visualizacoes WHERE oportunidade_id=$1`, [OP_ID]);
  l('\n[8] Notificação / Histórico / Visualizações');
  l(`  notificação: ${JSON.stringify(notif.rows[0] || null)}`);
  l(`  os_historico (${hist.rows.length}):`);
  hist.rows.forEach(h => l(`    - ${h.acao} | status=${h.status_novo} | user=${h.usuario}`));
  l(`  rede_visualizacoes count=${vis.rows[0].c}`);

  // 9. Financeiro propagado (M80)
  const rec = await client.query(
    `SELECT valor, status FROM public.financeiro_receber WHERE os_id=$1`, [OS_ID]);
  l('\n[9] Financeiro propagado');
  l(`  financeiro_receber: ${JSON.stringify(rec.rows[0] || null)}`);

  // 10. RPC A27 estado final
  const rpcDef = await client.query(
    `SELECT p.provolatile, p.prosecdef,
            pg_get_function_identity_arguments(p.oid) AS args,
            pg_get_functiondef(p.oid) AS def
     FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_buscar_oportunidades_para_prestador'`);
  l('\n[10] RPC A27 (f_buscar_oportunidades_para_prestador)');
  if (rpcDef.rows.length) {
    const d = rpcDef.rows[0];
    l(`  provolatile=${d.provolatile} | prosecdef=${d.prosecdef} | args=${d.args}`);
    l(`  search_path fixo: ${d.def.includes('SET search_path TO')}`);
    l(`  não expõe valor_cliente/margem/custos: ${!d.def.includes('valor_cliente') && !d.def.includes('margem')}`);
  }
  const grants = await client.query(
    `SELECT DISTINCT grantee, privilege_type FROM information_schema.routine_privileges
     WHERE routine_name='f_buscar_oportunidades_para_prestador' ORDER BY grantee`);
  l(`  grants: ${grants.rows.map(g => `${g.grantee}:${g.privilege_type}`).join(', ')}`);

  // 11. Fix f_aceitar (guarda UUID + check-then-insert)
  const aceDef = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
     JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
  const adef = aceDef.rows[0]?.def || '';
  l('\n[11] Fix f_aceitar_oportunidade_rede (migration 20260816)');
  l(`  guarda UUID cliente_id: ${adef.includes("~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'") || adef.includes('^[0-9a-f]{8}-[0-9a-f]{4}-')}`);
  l(`  check-then-insert (sem ON CONFLICT): ${!adef.includes('ON CONFLICT')}`);
  l(`  metadata os_numero: ${adef.includes('os_numero')}`);

  await client.end();
  l('\n========== FIM CONSOLIDAÇÃO ==========');
})().catch(async (e) => { console.error('FATAL:', e.message); await client.end(); process.exit(1); });