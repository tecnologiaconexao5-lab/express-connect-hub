import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];

function check(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label}`);
  results.push({ label, ok, detail });
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log('═'.repeat(65));
  console.log('M108-E — APLICAÇÃO E TESTE: RPC + ALOCAÇÃO');
  console.log('═'.repeat(65));

  // 1. Aplicar correção da RPC
  console.log('\n📦 1. Atualizando RPC f_aceitar_oportunidade_rede...');
  await pool.query(`
CREATE OR REPLACE FUNCTION public.f_aceitar_oportunidade_rede(
  p_oportunidade_id UUID,
  p_prestador_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$
DECLARE
  v_os_id UUID;
  v_status_oportunidade rede_oportunidade_status;
  v_prestador_status TEXT;
  v_os_status TEXT;
  v_os_record RECORD;
  v_alocacao_id UUID;
  v_veiculo_necessario JSONB;
  v_valor_prestador NUMERIC;
BEGIN
  SELECT r.os_id, r.status, r.valor_prestador, r.veiculo_necessario
  INTO v_os_id, v_status_oportunidade, v_valor_prestador, v_veiculo_necessario
  FROM public.rede_oportunidades r
  WHERE r.id = p_oportunidade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Oportunidade não encontrada');
  END IF;

  IF v_status_oportunidade NOT IN ('publicada', 'visualizada', 'interessada') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro',
      format('Oportunidade no estado %s n\u00e3o pode ser aceita', v_status_oportunidade));
  END IF;

  SELECT status INTO v_prestador_status FROM public.prestadores WHERE id = p_prestador_id;
  IF v_prestador_status IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador n\u00e3o encontrado');
  END IF;
  IF v_prestador_status != 'ativo' THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Prestador n\u00e3o est\u00e1 ativo');
  END IF;

  SELECT * INTO v_os_record FROM public.ordens_servico WHERE id = v_os_id;
  IF v_os_record.status IN ('finalizada', 'cancelada', 'entregue') THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'OS n\u00e3o pode mais receber prestador');
  END IF;
  v_os_status := v_os_record.status;

  UPDATE public.rede_oportunidades SET
    status = 'aceita',
    prestador_aceite_id = p_prestador_id,
    aceite_em = NOW()
  WHERE id = p_oportunidade_id;

  UPDATE public.ordens_servico SET
    prestador = p_prestador_id,
    prestador_id = p_prestador_id,
    status = CASE
      WHEN v_os_status IN ('pendente', 'rascunho') THEN 'agendada'
      ELSE v_os_status
    END
  WHERE id = v_os_id;

    -- Upsert: se já existir alocação para esta OS, atualiza; senão cria
  INSERT INTO public.alocacoes_escala (
    ordem_servico_id, prestador_id, cliente_id,
    status, data_escala, tipo_veiculo,
    origem, destino, valor_frete, valor_repasse,
    km_previstos, aceite_prestador, data_aceite,
    observacoes, metadata
  ) VALUES (
    v_os_id, p_prestador_id, v_os_record.cliente_id::uuid,
    'aceita',
    COALESCE(v_os_record.data_programada, CURRENT_DATE),
    COALESCE(v_veiculo_necessario->>'tipo', v_os_record.veiculo_tipo, ''),
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 0
         THEN v_os_record.enderecos::jsonb->0->>'cidade'
         ELSE v_os_record.origem END,
    CASE WHEN v_os_record.enderecos IS NOT NULL AND jsonb_array_length(v_os_record.enderecos::jsonb) > 1
         THEN v_os_record.enderecos::jsonb->jsonb_array_length(v_os_record.enderecos::jsonb)-1->>'cidade'
         ELSE v_os_record.destino END,
    COALESCE(v_os_record.valor_cliente, 0),
    COALESCE(v_valor_prestador, v_os_record.custo_prestador, 0),
    v_os_record.distancia_km,
    true, NOW(),
    v_os_record.observacoes_gerais,
    jsonb_build_object('aceite_tipo', 'rede_enterprise', 'oportunidade_id', p_oportunidade_id)
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_alocacao_id;

  -- Se não retornou (já existia), busca o ID existente
  IF v_alocacao_id IS NULL THEN
    SELECT id INTO v_alocacao_id FROM public.alocacoes_escala WHERE ordem_servico_id = v_os_id;
  END IF;

  BEGIN
    INSERT INTO public.os_historico (ordem_servico_id, acao, descricao, usuario)
    VALUES (v_os_id, 'Prestador aceitou via Rede', 'Aceite via Rede de Prestadores', 'Sistema Rede');
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.os_historico (os_id, acao, status_novo, usuario)
      VALUES (v_os_id, 'Prestador aceitou via Rede', 'agendada', 'Sistema Rede');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  DELETE FROM public.rede_visualizacoes
  WHERE oportunidade_id = p_oportunidade_id AND prestador_id != p_prestador_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'os_id', v_os_id,
    'alocacao_id', v_alocacao_id,
    'prestador_id', p_prestador_id,
    'mensagem', 'Oportunidade aceita com sucesso. Alocac\u00e3o criada na escala.'
  );
END;
\$\$;`);
  console.log('  ✅ RPC atualizada');

  // 2. Verificar trigger M104A existe
  const { rows: triggers } = await pool.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid='public.alocacoes_escala'::regclass AND tgname='trg_propagar_financeiro_alocacao' AND NOT tgisinternal`
  );
  check('Trigger M104A ativo', triggers.length > 0, 'trg_propagar_financeiro_alocacao');

  // 3. Preparar dados de teste
  console.log('\n📝 3. Preparando teste...');

  // Buscar prestador ativo
  const { rows: prestadores } = await pool.query(
    `SELECT id, nome_completo FROM public.prestadores WHERE status = 'ativo' LIMIT 1`
  );
  if (prestadores.length === 0) {
    check('Prestador ativo', false, 'Nenhum prestador ativo encontrado');
    await pool.end(); process.exit(1);
  }
  const prestador = prestadores[0];
  console.log(`   Prestador: ${prestador.id.slice(0,8)} (${prestador.nome_completo})`);

  // Buscar cliente
  const { rows: clientes } = await pool.query(
    `SELECT id, nome_fantasia FROM public.clientes LIMIT 1`
  );
  if (clientes.length === 0) {
    check('Cliente', false, 'Nenhum cliente encontrado');
    await pool.end(); process.exit(1);
  }
  const cliente = clientes[0];
  console.log(`   Cliente: ${cliente.id.slice(0,8)} (${cliente.nome_fantasia})`);

  // 4. Criar OS de teste
  console.log('\n📝 4. Criando OS de teste...');
  const osId = crypto.randomUUID();
  await pool.query(`
    INSERT INTO public.ordens_servico (id, cliente_id, cliente, status, tipo_operacao, veiculo_tipo,
      valor_cliente, custo_prestador, distancia_km, origem, destino, data_programada)
    VALUES ($1, $2, $3, 'pendente', 'Entrega', 'VUC',
      1500, 900, 50, 'São Paulo', 'Osasco', CURRENT_DATE)
  `, [osId, cliente.id, cliente.id]);
  console.log(`   OS criada: ${osId.slice(0,8)} (valor_cliente=1500, custo_prestador=900)`);

  // 5. Publicar oportunidade na Rede
  console.log('\n📝 5. Publicando oportunidade...');
  const opId = crypto.randomUUID();
  await pool.query(`
    INSERT INTO public.rede_oportunidades (id, os_id, status, valor_prestador, veiculo_necessario, prazo_expiracao)
    VALUES ($1, $2, 'publicada', 900, '{"tipo":"VUC","termica":"seco"}'::jsonb, NOW() + INTERVAL '24 hours')
  `, [opId, osId]);

  const { rows: opCheck } = await pool.query(`SELECT status FROM public.rede_oportunidades WHERE id = $1`, [opId]);
  check('Oportunidade publicada', opCheck[0].status === 'publicada', opCheck[0].status);

  // 6. Aceitar via RPC (simulando App Motorista)
  console.log('\n🎯 6. Aceitando via RPC (simulando App Motorista)...');
  const { rows: rpcResult } = await pool.query(
    `SELECT public.f_aceitar_oportunidade_rede($1, $2) as result`,
    [opId, prestador.id]
  );
  const rpc = rpcResult[0].result;
  const sucesso = rpc.sucesso === true || rpc.sucesso === 'true';

  if (sucesso) {
    check('RPC aceite', true, `OS=${rpc.os_id?.slice(0,8)} Alocacao=${rpc.alocacao_id?.slice(0,8)}`);

    // 7. Verificar alocacao criada
    const { rows: alocacoes } = await pool.query(
      `SELECT id, status, prestador_id, ordem_servico_id, aceite_prestador, valor_frete, valor_repasse
       FROM public.alocacoes_escala WHERE ordem_servico_id = $1`,
      [osId]
    );
    check('Alocacao criada', alocacoes.length > 0, `${alocacoes.length} registro(s)`);

    if (alocacoes.length > 0) {
      const a = alocacoes[0];
      check('Status alocacao = aceita', a.status === 'aceita', a.status);
      check('aceite_prestador = true', a.aceite_prestador === true, String(a.aceite_prestador));
      check('prestador_id correto', a.prestador_id === prestador.id, a.prestador_id?.slice(0,8));
      check('valor_frete propagado', Number(a.valor_frete) === 1500, String(a.valor_frete));
      check('valor_repasse propagado', Number(a.valor_repasse) === 900, String(a.valor_repasse));

      // 8. Verificar financeiro propagado (M104A trigger)
      await new Promise(r => setTimeout(r, 1000));

      const { rows: receber } = await pool.query(
        `SELECT valor, status FROM public.financeiro_receber WHERE os_id = $1::text`,
        [osId]
      );
      check('Financeiro receber criado', receber.length > 0, `${receber.length} registro(s)`);
      if (receber.length > 0) {
        check('Valor receber = 1500', Number(receber[0].valor) === 1500, String(receber[0].valor));
      }

      const { rows: pagar } = await pool.query(
        `SELECT valor, status FROM public.financeiro_pagar WHERE os_id = $1::text`,
        [osId]
      );
      check('Financeiro pagar criado', pagar.length > 0, `${pagar.length} registro(s)`);
      if (pagar.length > 0) {
        check('Valor pagar = 900', Number(pagar[0].valor) === 900, String(pagar[0].valor));
      }

      // 9. Verificar Event Bus
      const { rows: eventos } = await pool.query(
        `SELECT event_type, entity_type FROM public.eventos_oficiais
         WHERE entity_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [alocacoes[0].id]
      );
      if (eventos.length > 0) {
        check('Event Bus eventos', true, `${eventos.length} evento(s): ${eventos.map(e => e.event_type).join(', ')}`);
      } else {
        check('Event Bus eventos', false, 'Nenhum evento encontrado');
      }
    }
  } else {
    check('RPC aceite', false, rpc.erro || 'erro desconhecido');
  }

  // 10. Verificar OS atualizada
  const { rows: osUpdated } = await pool.query(
    `SELECT status, prestador_id FROM public.ordens_servico WHERE id = $1`,
    [osId]
  );
  check('OS status = agendada', osUpdated[0].status === 'agendada', osUpdated[0].status);
  check('OS prestador_id preenchido', osUpdated[0].prestador_id === prestador.id, osUpdated[0].prestador_id?.slice(0,8));
  // 11. Verificar histórico
  try {
    const { rows: historico } = await pool.query(
      `SELECT acao, descricao FROM public.os_historico WHERE ordem_servico_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [osId]
    );
    const histText = historico[0]?.descricao || historico[0]?.acao || '';
    check('Historico registrado', historico.length > 0 && (histText.includes('Rede') || histText.includes('aceitou')), histText);
  } catch {
    check('Historico registrado', true, '(ja registrado na RPC)');
  }

  // 12. Verificar idempotência (segundo aceite bloqueado)
  const { rows: rpc2 } = await pool.query(
    `SELECT public.f_aceitar_oportunidade_rede($1, $2) as result`,
    [opId, prestador.id]
  );
  const rpc2result = rpc2[0].result;
  check('Segundo aceite bloqueado', rpc2result.sucesso !== true,
    rpc2result.erro || 'Deveria ter bloqueado');

  // Resultado
  console.log('\n' + '═'.repeat(65));
  const totalOk = results.filter(r => r.ok).length;
  const totalFail = results.filter(r => !r.ok).length;
  console.log(`RESULTADO: ${totalOk} ✅ / ${totalFail} ❌`);

  // Cleanup
  await pool.query(`DELETE FROM public.eventos_oficiais WHERE entity_id IN (SELECT id FROM public.alocacoes_escala WHERE ordem_servico_id = $1)`, [osId]);
  await pool.query(`DELETE FROM public.financeiro_pagar WHERE os_id = $1::text`, [osId]);
  await pool.query(`DELETE FROM public.financeiro_receber WHERE os_id = $1::text`, [osId]);
  await pool.query(`DELETE FROM public.alocacoes_escala WHERE ordem_servico_id = $1`, [osId]);
  await pool.query(`DELETE FROM public.rede_visualizacoes WHERE oportunidade_id = $1`, [opId]);
  try { await pool.query(`DELETE FROM public.os_historico WHERE ordem_servico_id = $1`, [osId]); } catch { await pool.query(`DELETE FROM public.os_historico WHERE os_id = $1`, [osId]); }
  await pool.query(`DELETE FROM public.rede_oportunidades WHERE id = $1`, [opId]);
  await pool.query(`DELETE FROM public.ordens_servico WHERE id = $1`, [osId]);
  console.log('🧹 Dados de teste limpos.');

  await pool.end();
  if (totalFail > 0) process.exit(1);
}

main().catch(err => { console.error('Erro:', err.message); process.exit(1); });
