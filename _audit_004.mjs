// [READ-ONLY] TMS-FIN-DATA-04D3C4 — somente SELECT; credencial via env; sem fallback PROD.
import pg from 'pg';
const { Client } = pg;

// TMS-FIN-DATA-04D3C4 — READ-ONLY. Credencial SOMENTE via env explicita; sem fallback para .env PROD.
const DATABASE_URL = process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[FAIL-CLOSED] Defina AUDIT_DATABASE_URL (ou DATABASE_URL). Nenhuma conexao foi feita.');
  process.exit(1);
}
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('=== AUDITORIA OPERACIONAL - DADOS REAIS ===\n');

  // 1. CLIENTES - detalhes
  console.log('=== CLIENTES ===');
  const cli = await client.query('SELECT id, razao_social, cnpj, status, cidade, uf, created_at FROM clientes ORDER BY created_at');
  console.log('Total:', cli.rows.length);
  cli.rows.forEach(r => console.log(' ', r.id?.slice(0,8)+'..', '|', r.razao_social, '|', r.cnpj, '|', r.status, '|', r.cidade, '/', r.uf, '|', r.created_at?.toISOString().slice(0,10)));

  // 2. ORDENS DE SERVICO
  console.log('\n=== ORDENS DE SERVICO ===');
  const os = await client.query(`SELECT id, numero, cliente, status, data, tipo_operacao, created_at, deleted_at 
    FROM ordens_servico ORDER BY created_at DESC LIMIT 20`);
  console.log('Amostra (20):');
  os.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.numero||'NULO', '|', 'cliente:', r.cliente?.slice(0,8), '|', r.status, '|', 
    r.data?.toISOString().slice(0,10), '|', r.tipo_operacao, '|', r.created_at?.toISOString().slice(0,16), r.deleted_at ? 'DELETED' : ''));
  
  // OS com deleted_at nao nulo
  const osDel = await client.query("SELECT count(*) as total FROM ordens_servico WHERE deleted_at IS NOT NULL");
  console.log('OS deletadas (soft delete):', osDel.rows[0].total);

  // 3. PRESTADORES
  console.log('\n=== PRESTADORES ===');
  const prest = await client.query('SELECT id, nome_completo, cpf_cnpj, status, tipo_parceiro, regiao_principal, created_at FROM prestadores ORDER BY created_at DESC');
  console.log('Total:', prest.rows.length);
  if (prest.rows.length > 0) {
    prest.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.nome_completo, '|', r.cpf_cnpj, '|', r.status, '|', r.tipo_parceiro, '|', r.regiao_principal));
  } else {
    console.log('  TABELA VAZIA');
  }

  // 4. VEICULOS
  console.log('\n=== VEICULOS ===');
  const veic = await client.query('SELECT v.id, v.placa, v.tipo_veiculo, v.marca, v.modelo, v.status, p.nome_completo as proprietario FROM veiculos v LEFT JOIN prestadores p ON v.prestador_vinculado = p.id ORDER BY v.created_at');
  console.log('Total:', veic.rows.length);
  veic.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.placa, '|', r.tipo_veiculo, '|', r.marca, r.modelo, '|', r.status, '|', r.proprietario||'sem vinculo'));

  // 5. ESCALA - ALOCACOES
  console.log('\n=== ESCALA (alocacoes_escala) ===');
  const alocTotal = await client.query('SELECT count(*) as total FROM alocacoes_escala');
  console.log('Total:', alocTotal.rows[0].total);
  
  const alocComp = await client.query(`
    SELECT a.id, a.data_escala, a.status, a.turno, a.placa, 
      a.prestador_id, p.nome_completo as prestador_nome,
      a.cliente_id, c.razao_social as cliente_nome,
      a.ordem_servico_id, os.numero as os_numero,
      a.valor_frete, a.valor_repasse, a.created_at
    FROM alocacoes_escala a
    LEFT JOIN prestadores p ON a.prestador_id = p.id
    LEFT JOIN clientes c ON a.cliente_id = c.id
    LEFT JOIN ordens_servico os ON a.ordem_servico_id = os.id
    ORDER BY a.created_at DESC LIMIT 15
  `);
  alocComp.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.data_escala, '|', r.status, '|', r.prestador_nome||'SEM_PRESTADOR', '|', r.cliente_nome||'SEM_CLIENTE', '|', 'OS:', r.os_numero||'NENHUMA', '|', 'R$', r.valor_frete, '/', r.valor_repasse));

  const alocOrf = await client.query("SELECT count(*) as orfaos FROM alocacoes_escala WHERE prestador_id IS NULL");
  console.log('Sem prestador:', alocOrf.rows[0].orfaos);
  const alocOrf2 = await client.query("SELECT count(*) as orfaos FROM alocacoes_escala WHERE cliente_id IS NULL");
  console.log('Sem cliente:', alocOrf2.rows[0].orfaos);
  const alocOrf3 = await client.query("SELECT count(*) as orfaos FROM alocacoes_escala WHERE ordem_servico_id IS NULL");
  console.log('Sem OS vinculada:', alocOrf3.rows[0].orfaos);

  // 6. HISTORICO ALOCACOES
  const histAloc = await client.query('SELECT count(*) as total FROM historico_alocacoes_escala');
  console.log('\nHistorico alocacoes:', histAloc.rows[0].total);

  // 7. ESCALA_OPERACIONAL (legado)
  const eo = await client.query('SELECT count(*) as total FROM escala_operacional');
  console.log('\nescala_operacional (legado):', eo.rows[0].total, 'registros');
  if (eo.rows[0].total > 0) {
    const eoD = await client.query('SELECT id, os_id, prestador_id, placa, data_operacao, status FROM escala_operacional LIMIT 5');
    eoD.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| OS:', r.os_id?.slice(0,8), '| prestador:', r.prestador_id?.slice(0,8), '|', r.placa, '|', r.data_operacao, '|', r.status));
  }

  // 8. TRACKING
  console.log('\n=== TRACKING ===');
  const opLoc = await client.query('SELECT count(*) as total FROM operacao_localizacao');
  console.log('operacao_localizacao:', opLoc.rows[0].total);
  if (opLoc.rows[0].total > 0) {
    const ol = await client.query('SELECT id, alocacao_id, latitude, longitude, velocidade, atualizado_em FROM operacao_localizacao ORDER BY atualizado_em DESC LIMIT 3');
    ol.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| aloc:', r.alocacao_id?.slice(0,8), '| lat:', r.latitude, '| lng:', r.longitude, '| vel:', r.velocidade, '|', r.atualizado_em));
  }

  const ptr = await client.query('SELECT count(*) as total FROM portal_tracking_realtime');
  console.log('portal_tracking_realtime:', ptr.rows[0].total);

  const tpl = await client.query('SELECT count(*) as total FROM tracking_public_links');
  console.log('tracking_public_links:', tpl.rows[0].total);
  if (tpl.rows[0].total > 0) {
    const tplD = await client.query('SELECT id, os_id, token_publico, expira_em, ativo, acessos FROM tracking_public_links ORDER BY created_at DESC LIMIT 3');
    tplD.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| OS:', r.os_id?.slice(0,8), '| token:', r.token_publico?.slice(0,20), '| ativo:', r.ativo, '| acessos:', r.acessos));
  }

  // 9. POD
  console.log('\n=== POD (entregas_protocolo) ===');
  const pod = await client.query(`SELECT ep.id, ep.alocacao_id, ep.nome_recebedor, ep.documento_recebedor, 
    ep.data_hora_entrega, ep.status, ep.foto_entrega_url is not null as tem_foto,
    ep.assinatura_url is not null as tem_assinatura, ep.latitude, ep.longitude,
    a.prestador_id, p.nome_completo as motorista
    FROM entregas_protocolo ep
    LEFT JOIN alocacoes_escala a ON ep.alocacao_id = a.id
    LEFT JOIN prestadores p ON a.prestador_id = p.id
    ORDER BY ep.data_hora_entrega DESC LIMIT 10`);
  console.log('Total:', pod.rows.length);
  pod.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| aloc:', r.alocacao_id?.slice(0,8), '| recebedor:', r.nome_recebedor, '| status:', r.status, '|', r.data_hora_entrega?.toISOString().slice(0,16), '| foto:', r.tem_foto?'SIM':'NAO', '| assinatura:', r.tem_assinatura?'SIM':'NAO', '| motorista:', r.motorista||'N/A'));

  // 10. FINANCEIRO
  console.log('\n=== FINANCEIRO ===');
  const fr = await client.query(`SELECT id, cliente_id, cliente_nome, descricao, valor, status, vencimento, 
    os_id, created_at FROM financeiro_receber ORDER BY created_at DESC LIMIT 10`);
  console.log('financeiro_receber:', fr.rows.length, 'mostrando 10:');
  fr.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| cliente:', r.cliente_nome||r.cliente_id?.slice(0,8), '|', r.descricao, '| R$', r.valor, '|', r.status, '| vencto:', r.vencimento, '| OS:', r.os_id?.slice(0,12)));

  const fp = await client.query(`SELECT id, fornecedor_nome, descricao, valor, status, vencimento, 
    os_id, os_vinculada FROM financeiro_pagar ORDER BY created_at DESC LIMIT 10`);
  console.log('\nfinanceiro_pagar:', fp.rows.length, 'mostrando 10:');
  fp.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| forn:', r.fornecedor_nome, '|', r.descricao, '| R$', r.valor, '|', r.status, '| vencto:', r.vencimento, '| OS:', r.os_id?.slice(0,12), '/', r.os_vinculada?.slice(0,12)));

  const pp = await client.query(`SELECT id, prestador_nome, periodo_inicio, periodo_fim, quantidade_os, 
    valor_liquido, status, status_pagamento, os_id FROM pagamentos_prestadores ORDER BY created_at DESC LIMIT 10`);
  console.log('\npagamentos_prestadores:', pp.rows.length, 'mostrando 10:');
  pp.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.prestador_nome, '| periodo:', r.periodo_inicio?.toISOString().slice(0,10), '-', r.periodo_fim?.toISOString().slice(0,10), '|', r.quantidade_os, 'OS | R$', r.valor_liquido, '|', r.status, '/', r.status_pagamento));

  const cf = await client.query(`SELECT id, os_id, cliente_id, prestador_id, valor_cliente, valor_prestador, 
    margem_bruta, percentual_margem_bruta FROM composicao_financeira_os ORDER BY created_at DESC LIMIT 10`);
  console.log('\ncomposicao_financeira_os:', cf.rows.length, 'mostrando 10:');
  cf.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| OS:', r.os_id?.slice(0,8), '| R$', r.valor_cliente, '/', r.valor_prestador, '| margem:', r.margem_bruta, '(', r.percentual_margem_bruta, '%)'));

  // 11. PORTAL CLIENTE
  console.log('\n=== PORTAL CLIENTE ===');
  const pPed = await client.query(`SELECT id, cliente_id, numero_pedido, status, os_vinculada_id, created_at 
    FROM portal_pedidos ORDER BY created_at DESC LIMIT 10`);
  console.log('portal_pedidos:', pPed.rows.length);
  pPed.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| cliente:', r.cliente_id?.slice(0,8), '| pedido:', r.numero_pedido, '| status:', r.status, '| OS vinculada:', r.os_vinculada_id?.slice(0,8)||'NENHUMA'));

  const pOco = await client.query('SELECT id, cliente_id, tipo, descricao, prioridade, status, created_at FROM portal_ocorrencias ORDER BY created_at DESC');
  console.log('portal_ocorrencias:', pOco.rows.length);
  pOco.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| cliente:', r.cliente_id?.slice(0,8), '|', r.tipo, '|', r.descricao?.slice(0,60), '|', r.status));

  const pAva = await client.query('SELECT count(*) as total FROM portal_avaliacoes');
  console.log('portal_avaliacoes:', pAva.rows[0].total);

  const pFat = await client.query('SELECT count(*) as total FROM portal_faturas');
  console.log('portal_faturas:', pFat.rows[0].total);

  const pNot = await client.query('SELECT count(*) as total FROM portal_notificacoes');
  console.log('portal_notificacoes:', pNot.rows[0].total);

  const pProt = await client.query('SELECT count(*) as total FROM portal_protocolos');
  console.log('portal_protocolos:', pProt.rows[0].total);

  // 12. CRM
  console.log('\n=== CRM ===');
  const leads = await client.query('SELECT count(*) as total FROM crm_leads');
  console.log('crm_leads:', leads.rows[0].total);

  const conv = await client.query('SELECT count(*) as total FROM crm_conversas');
  console.log('crm_conversas:', conv.rows[0].total);

  // 13. EVENTOS OFICIAIS
  const ev = await client.query('SELECT count(*) as total FROM eventos_oficiais');
  console.log('\neventos_oficiais:', ev.rows[0].total);
  const evS = await client.query('SELECT tipo, count(*) FROM eventos_oficiais GROUP BY tipo ORDER BY count DESC LIMIT 10');
  evS.rows.forEach(r => console.log(' ', r.tipo + ':', r.count));
  const evAmostra = await client.query('SELECT id, tipo, alocacao_id, prestador_id, metadata FROM eventos_oficiais ORDER BY created_at DESC LIMIT 3');
  evAmostra.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.tipo, '| aloc:', r.alocacao_id?.slice(0,8), '| prest:', r.prestador_id?.slice(0,8)));

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
}