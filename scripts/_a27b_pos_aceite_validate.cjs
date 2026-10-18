const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });
const OS_ID = '2c24a4dc-3491-4f46-9d24-69ceb4d76d63';
const OP_ID = 'c2ca797c-02b0-4042-ac5d-e8f96796d249';
const PREST_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';
const ALOC_ID = '2333f16e-6f4f-4169-8766-a02282ec8527';
const VEIC_ID = '87dceca0-3d81-45a9-8878-047019fa3a58';

const checks = [];
function check(label, ok, detail) {
  checks.push({ label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label}${detail ? ' | ' + detail : ''}`);
}

async function q(sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

(async () => {
  await client.connect();

  // 1. Oportunidade: status/prestador_aceite_id/aceite_em
  const opp = await q(`SELECT status, prestador_aceite_id, aceite_em FROM public.rede_oportunidades WHERE id = $1`, [OP_ID]);
  check('Oportunidade aceita', opp.length === 1 && opp[0].status === 'aceita', opp[0]?.status);
  check('prestador_aceite_id = PRESTADOR TESTE APP', opp[0]?.prestador_aceite_id === PREST_ID, opp[0]?.prestador_aceite_id);
  check('aceite_em presente', !!opp[0]?.aceite_em, opp[0]?.aceite_em);

  // 2. Alocação: exatamente 1, status aceita, veículo, metadata
  const alocs = await q(`SELECT id, status, prestador_id, aceite_prestador, data_aceite, tipo_veiculo, placa, metadata FROM public.alocacoes_escala WHERE ordem_servico_id = $1`, [OS_ID]);
  check('Exatamente 1 alocação (atomicidade)', alocs.length === 1, `count=${alocs.length}`);
  if (alocs.length === 1) {
    const a = alocs[0];
    check('Alocação status aceita', a.status === 'aceita', a.status);
    check('Alocação prestador correto', a.prestador_id === PREST_ID, a.prestador_id);
    check('aceite_prestador = true', a.aceite_prestador === true, String(a.aceite_prestador));
    check('data_aceite presente', !!a.data_aceite, a.data_aceite);
    check('metadata.aceite_tipo = rede_enterprise', a.metadata?.aceite_tipo === 'rede_enterprise', a.metadata?.aceite_tipo);
    check('metadata.operation_mode = standard_delivery', a.metadata?.operation_mode === 'standard_delivery', a.metadata?.operation_mode);
    check('metadata.os_numero = OS-202608-680216', a.metadata?.os_numero === 'OS-202608-680216', a.metadata?.os_numero);
    check('metadata.oportunidade_id correto', a.metadata?.oportunidade_id === OP_ID, a.metadata?.oportunidade_id);
    console.log('  metadata completo:', JSON.stringify(a.metadata));
  }

  // 3. Veículo: vinculado ao prestador, ativo, VUC
  const vei = await q(`SELECT placa, tipo_veiculo, capacidade_kg, status, prestador_vinculado FROM public.veiculos WHERE id = $1`, [VEIC_ID]);
  check('Veículo HML-A27B existe', vei.length === 1, vei[0]?.placa);
  if (vei.length === 1) {
    check('Veículo vinculado ao prestador teste', vei[0].prestador_vinculado === PREST_ID, vei[0].prestador_vinculado);
    check('Veículo tipo vuc', vei[0].tipo_veiculo === 'vuc', vei[0].tipo_veiculo);
    check('Veículo status Ativo', vei[0].status === 'Ativo', vei[0].status);
  }

  // 4. OS: status agendada, prestador vinculado
  const os = await q(`SELECT numero, status, prestador_id, prestador FROM public.ordens_servico WHERE id = $1`, [OS_ID]);
  check('OS status agendada', os[0]?.status === 'agendada', os[0]?.status);
  check('OS prestador vinculado', os[0]?.prestador === PREST_ID || os[0]?.prestador_id === PREST_ID, `${os[0]?.prestador}/${os[0]?.prestador_id}`);

  // 5. RPC f_buscar_oportunidades_para_prestador: oportunidade NÃO deve mais aparecer (desaparecimento)
  const rpcRes = await client.query(`SELECT public.f_buscar_oportunidades_para_prestador($1::uuid) AS resp`, [PREST_ID]);
  const rpc = rpcRes.rows[0].resp;
  const lista = rpc?.oportunidades || [];
  const contemHml = lista.some(o => o.id === OP_ID || o.os_id === OS_ID);
  check('Desaparecimento: oportunidade não retorna na RPC', rpc?.success === true && !contemHml, `total=${rpc?.total}`);
  console.log('  RPC total:', rpc?.total);

  // 6. f_buscar_operacoes_motorista: operação deve aparecer em Home/Operações
  try {
    const opsRes = await client.query(`SELECT public.f_buscar_operacoes_motorista($1::uuid) AS resp`, [PREST_ID]);
    const ops = opsRes.rows[0].resp;
    const operacoes = Array.isArray(ops?.operacoes) ? ops.operacoes : [];
    const contemOs = operacoes.some(o => String(o.os_id || o.id) === OS_ID || String(o.ordem_servico_id) === OS_ID || String(o.numero).includes('680216'));
    check('Operação em f_buscar_operacoes_motorista', ops?.success === true && contemOs, `total=${ops?.total}`);
    const op = operacoes.find(o => String(o.os_id || o.id) === OS_ID || String(o.ordem_servico_id) === OS_ID || String(o.numero).includes('680216'));
    if (op) {
      console.log('  operacao encontrada:', JSON.stringify({ numero: op.numero, status: op.status, origem: op.origem, destino: op.destino, data: op.data_programada, valor: op.valor_prestador || op.valor_repasse, mode: op.operation_mode || op.metadata?.operation_mode }));
    }
  } catch (e) {
    console.log('  f_buscar_operacoes_motorista ERRO:', e.message);
  }

  // 7. JourneyConfig: operation_mode = standard_delivery
  if (alocs.length === 1) {
    check('JourneyConfig via metadata alocação', alocs[0].metadata?.operation_mode === 'standard_delivery', alocs[0].metadata?.operation_mode);
  }

  // 8. Notificação oportunidade_aceita
  const notif = await q(`SELECT titulo, tipo, origem_id, origem_tipo, lida FROM public.portal_notificacoes WHERE tipo = 'oportunidade_aceita' AND origem_id = $1 ORDER BY created_at DESC LIMIT 1`, [OS_ID]);
  check('Notificação oportunidade_aceita criada', notif.length >= 1, notif[0]?.titulo);

  // 9. os_historico: publicação + aceite
  const hist = await q(`SELECT acao, status_novo, usuario FROM public.os_historico WHERE os_id = $1 ORDER BY created_at ASC`, [OS_ID]);
  check('os_historico >= 2 registros', hist.length >= 2, `count=${hist.length}`);
  console.log('  histórico:', JSON.stringify(hist));

  // 10. Financeiro: receber propagado (M80)
  const rec = await q(`SELECT valor, status FROM public.financeiro_receber WHERE os_id = $1`, [OS_ID]);
  check('financeiro_receber propagado', rec.length === 1, `valor=${rec[0]?.valor} status=${rec[0]?.status}`);

  // 11. rede_visualizacoes sem consumo indevido
  const vis = await q(`SELECT COUNT(*)::int AS c FROM public.rede_visualizacoes WHERE oportunidade_id = $1`, [OP_ID]);
  check('rede_visualizacoes vazio (sem consumo)', vis[0].c === 0, `count=${vis[0].c}`);

  const passed = checks.filter(c => c.ok).length;
  const failed = checks.filter(c => !c.ok);
  console.log(`\n===== ${passed}/${checks.length} PASS =====`);
  if (failed.length) {
    console.log('FALHAS:');
    failed.forEach(f => console.log(` - ${f.label} | ${f.detail}`));
  }

  await client.end();
  process.exit(failed.length ? 2 : 0);
})().catch(async (e) => {
  console.error('FATAL:', e.message);
  await client.end();
  process.exit(1);
});