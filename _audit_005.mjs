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

  // ORDENS DE SERVICO
  console.log('=== ORDENS DE SERVICO ===');
  const os = await client.query('SELECT count(*) as total FROM ordens_servico');
  console.log('Total:', os.rows[0].total);
  
  const osStatus = await client.query('SELECT status, count(*) FROM ordens_servico GROUP BY status ORDER BY count DESC');
  console.log('Por status:');
  osStatus.rows.forEach(r => console.log(' ', r.status + ':', r.count));

  const osDet = await client.query(`SELECT id, numero, cliente, prestador, status, data, tipo_operacao, 
    created_at, valor_cliente, custo_prestador, valor_prestador, margem
    FROM ordens_servico ORDER BY created_at DESC LIMIT 20`);
  osDet.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| n:', r.numero||'NULO', '| cli:', r.cliente?.slice(0,8), '| prest:', r.prestador?.slice(0,8), '|', r.status, '|', 
    r.tipo_operacao, '|', r.data, '| R$:', r.valor_cliente, '/', r.custo_prestador, '/', r.valor_prestador, '| margem:', r.margem));

  // PRESTADORES
  console.log('\n=== PRESTADORES ===');
  const prest = await client.query('SELECT count(*) as total FROM prestadores');
  console.log('Total:', prest.rows[0].total);
  const prestDet = await client.query(`SELECT id, nome_completo, cpf_cnpj, status, tipo_parceiro, 
    regiao_principal, valor_diaria, valor_km, created_at 
    FROM prestadores ORDER BY created_at DESC`);
  prestDet.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.nome_completo, '|', r.cpf_cnpj, '|', r.status, '|', 
    r.tipo_parceiro, '| regiao:', r.regiao_principal, '| R$', r.valor_diaria, '/km:', r.valor_km));

  // VEICULOS
  console.log('\n=== VEICULOS ===');
  const veic = await client.query(`SELECT v.id, v.placa, v.tipo_veiculo, v.marca||' '||v.modelo as veic, 
    v.status, v.prestador_vinculado, p.nome_completo
    FROM veiculos v LEFT JOIN prestadores p ON v.prestador_vinculado = p.id
    ORDER BY v.created_at`);
  console.log('Total:', veic.rows.length);
  veic.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.placa, '|', r.tipo_veiculo, '|', r.veic, '|', r.status, '| prest:', r.nome_completo||'NENHUM'));

  // ESCALA - COMPLETO
  console.log('\n=== ESCALA (alocacoes_escala) ===');
  const aloc = await client.query('SELECT count(*) as total FROM alocacoes_escala');
  console.log('Total:', aloc.rows[0].total);
  
  const alocStatus = await client.query("SELECT status, count(*) FROM alocacoes_escala GROUP BY status ORDER BY count DESC");
  alocStatus.rows.forEach(r => console.log(' ', r.status + ':', r.count));

  const alocOrfP = await client.query("SELECT count(*) FROM alocacoes_escala WHERE prestador_id IS NULL");
  console.log('Sem prestador_id:', alocOrfP.rows[0].count);
  const alocOrfC = await client.query("SELECT count(*) FROM alocacoes_escala WHERE cliente_id IS NULL");
  console.log('Sem cliente_id:', alocOrfC.rows[0].count);
  const alocOrfO = await client.query("SELECT count(*) FROM alocacoes_escala WHERE ordem_servico_id IS NULL");
  console.log('Sem ordem_servico_id:', alocOrfO.rows[0].count);

  const alocDet = await client.query(`
    SELECT a.id, a.data_escala, a.status, a.placa, a.turno, a.valor_frete, a.valor_repasse,
      p.nome_completo as prestador, c.razao_social as cliente, os.numero as os_num,
      a.prestador_id, a.cliente_id, a.ordem_servico_id
    FROM alocacoes_escala a
    LEFT JOIN prestadores p ON a.prestador_id = p.id
    LEFT JOIN clientes c ON a.cliente_id = c.id
    LEFT JOIN ordens_servico os ON a.ordem_servico_id = os.id
    ORDER BY a.data_escala DESC NULLS LAST LIMIT 20
  `);
  console.log('\nDetalhes (20):');
  alocDet.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.data_escala, '|', r.status, '|', r.prestador||'SEM-PREST', '|', r.cliente||'SEM-CLI', '| OS:', r.os_num||'NENHUMA', '|', r.placa, '| R$', r.valor_frete, '/', r.valor_repasse));

  // TRACKING
  console.log('\n=== TRACKING ===');
  const opLoc = await client.query('SELECT count(*) as total FROM operacao_localizacao');
  console.log('operacao_localizacao:', opLoc.rows[0].total, 'registros');
  if (opLoc.rows[0].total > 0) {
    const ol = await client.query('SELECT id, alocacao_id, latitude, longitude, velocidade, atualizado_em, origem FROM operacao_localizacao ORDER BY atualizado_em DESC LIMIT 3');
    ol.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| aloc:', r.alocacao_id?.slice(0,8), '| lat:', r.latitude?.toFixed(4), '| lng:', r.longitude?.toFixed(4), '| vel:', r.velocidade, '|', r.atualizado_em, '| origem:', r.origem));
  }

  const ptr = await client.query('SELECT count(*) as total FROM portal_tracking_realtime');
  console.log('portal_tracking_realtime:', ptr.rows[0].total);
  if (ptr.rows[0].total > 0) {
    const ptrD = await client.query('SELECT * FROM portal_tracking_realtime LIMIT 2');
    ptrD.rows.forEach(r => console.log(' ', JSON.stringify(r)));
  }

  const tpl = await client.query('SELECT count(*) as total FROM tracking_public_links');
  console.log('tracking_public_links:', tpl.rows[0].total);
  if (tpl.rows[0].total > 0) {
    const tplD = await client.query('SELECT id, os_id, token_publico, expira_em, ativo, acessos, created_at FROM tracking_public_links ORDER BY created_at DESC LIMIT 3');
    tplD.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| OS:', r.os_id?.slice(0,8), '| token:', r.token_publico, '| exp:', r.expira_em, '| ativo:', r.ativo, '| acessos:', r.acessos));
  }

  // POD
  console.log('\n=== POD ===');
  const podTot = await client.query('SELECT count(*) as total FROM entregas_protocolo');
  console.log('Total entregas_protocolo:', podTot.rows[0].total);
  const podC = await client.query(`
    SELECT ep.id, ep.alocacao_id, ep.nome_recebedor, ep.status, ep.data_hora_entrega,
      ep.foto_entrega_url IS NOT NULL as foto, ep.assinatura_url IS NOT NULL as assinatura,
      ep.foto_canhoto_url IS NOT NULL as canhoto, ep.latitude, ep.longitude,
      a.prestador_id, p.nome_completo, a.ordem_servico_id, os.numero
    FROM entregas_protocolo ep
    LEFT JOIN alocacoes_escala a ON ep.alocacao_id = a.id
    LEFT JOIN prestadores p ON a.prestador_id = p.id
    LEFT JOIN ordens_servico os ON a.ordem_servico_id = os.id
    ORDER BY ep.data_hora_entrega DESC LIMIT 10
  `);
  podC.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| aloc:', r.alocacao_id?.slice(0,8), '| recebedor:', r.nome_recebedor, '| status:', r.status, '|', 
    r.data_hora_entrega?.toISOString().slice(0,16), '| foto:', r.foto?'S':'N', '| ass:', r.assinatura?'S':'N', '| canhoto:', r.canhoto?'S':'N',
    '| motorista:', r.nome_completo||'N/A'));

  // FINANCEIRO
  console.log('\n=== FINANCEIRO ===');
  const fr = await client.query('SELECT sum(valor) as total, count(*) as qtd FROM financeiro_receber');
  console.log('financeiro_receber: R$', fr.rows[0].total, '|', fr.rows[0].qtd, 'registros');
  const frS = await client.query('SELECT status, count(*), sum(valor) FROM financeiro_receber GROUP BY status');
  frS.rows.forEach(r => console.log(' ', r.status + ':', r.count, 'registros, R$', r.sum));

  const fp = await client.query('SELECT sum(valor) as total, count(*) as qtd FROM financeiro_pagar');
  console.log('financeiro_pagar: R$', fp.rows[0].total, '|', fp.rows[0].qtd, 'registros');
  const fpS = await client.query('SELECT status, count(*), sum(valor) FROM financeiro_pagar GROUP BY status');
  fpS.rows.forEach(r => console.log(' ', r.status + ':', r.count, 'registros, R$', r.sum));

  const ppTot = await client.query('SELECT sum(valor_liquido) as total, count(*) as qtd FROM pagamentos_prestadores');
  console.log('pagamentos_prestadores: R$', ppTot.rows[0].total, '|', ppTot.rows[0].qtd, 'registros');

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
}