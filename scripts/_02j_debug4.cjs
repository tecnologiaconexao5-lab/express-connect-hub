const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
  await c.connect();

  // Check ordens_servico for the non-explained OS
  const r = await c.query(`
    SELECT id, valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, desconto
    FROM ordens_servico
    WHERE id::TEXT = '3a6423b9-553d-4b70-bc5e-a03fd17daf4d'
  `);
  
  if (r.rows.length > 0) {
    const os = r.rows[0];
    console.log('=== ORDEM_SERVICO for 3a6423b9 ===');
    console.log('  id:', os.id);
    console.log('  valor_cliente:', os.valor_cliente);
    console.log('  custo_prestador:', os.custo_prestador);
    console.log('  pedagio:', os.pedagio);
    console.log('  adicionais:', os.adicionais, '(type:', typeof os.adicionais, ')');
    console.log('  ajudante:', os.ajudante, '(type:', typeof os.ajudante, ')');
    console.log('  descontos:', os.descontos);
    console.log('  desconto:', os.desconto);
    
    // Extract JSONB values
    let adicNum = 0;
    if (os.adicionais !== null) {
      if (typeof os.adicionais === 'number') adicNum = os.adicionais;
      else if (typeof os.adicionais === 'object') {
        if (os.adicionais.valor !== undefined) adicNum = parseFloat(os.adicionais.valor);
        else adicNum = parseFloat(os.adicionais['']) || 0;
      }
    }
    let ajNum = 0;
    if (os.ajudante !== null) {
      if (typeof os.ajudante === 'number') ajNum = os.ajudante;
      else if (typeof os.ajudante === 'object') {
        if (os.ajudante.valor !== undefined) ajNum = parseFloat(os.ajudante.valor);
        else ajNum = parseFloat(os.ajudante['']) || 0;
      }
    }
    
    const ped = parseFloat(os.pedagio) || 0;
    const desc = parseFloat(os.descontos) || 0;
    console.log('\n  Extracted: pedagio=' + ped + ' adicional=' + adicNum + ' ajudante=' + ajNum + ' descontos=' + desc);
    console.log('  Formula: valor_cliente - custo_prestador - pedagio - (adic+ajud-desc)');
    console.log('  = ' + os.valor_cliente + ' - ' + os.custo_prestador + ' - ' + ped + ' - (' + adicNum + '+' + ajNum + '-' + desc + ')');
    console.log('  = ' + (parseFloat(os.valor_cliente) - parseFloat(os.custo_prestador) - ped - (adicNum + ajNum - desc)));
    
    // Check: is pp.valor_liquido == custo_prestador + pedagio + (adic+ajud-desc)?
    const calcPP = parseFloat(os.custo_prestador) + ped + adicNum + ajNum - desc;
    console.log('\n  pp.valor_liquido should be: custo_prestador + pedagio + adicional + ajudante - descontos');
    console.log('  = ' + os.custo_prestador + ' + ' + ped + ' + ' + adicNum + ' + ' + ajNum + ' - ' + desc);
    console.log('  = ' + calcPP);
    console.log('  pp.valor_liquido actual: 1490');
    console.log('  Match:', Math.abs(calcPP - 1490) < 0.01 ? 'YES' : 'NO');
  } else {
    console.log('No ordens_servico found for this OS');
  }

  // Check another non-explained: 1adcf3c0 (diff=129.48)
  const r2 = await c.query(`
    SELECT id, valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos
    FROM ordens_servico
    WHERE id::TEXT = 'b7cdb83f-d486-4dad-aab2-4830da417fe4'
  `);
  if (r2.rows.length > 0) {
    const os = r2.rows[0];
    console.log('\n=== ORDEM_SERVICO for b7cdb83f (1adcf3c0 case) ===');
    console.log('  custo_prestador:', os.custo_prestador);
    console.log('  pedagio:', os.pedagio);
    console.log('  adicionais:', os.adicionais);
    console.log('  ajudante:', os.ajudante);
    console.log('  descontos:', os.descontos);
  }

  // Check: 3f3a74cb (diff=43.50, pp.pedagio=0, pp.adicionais=0)
  const r3 = await c.query(`
    SELECT fp.id, fp.valor, pp.valor_liquido, pp.valor_servicos, pp.pedagio, pp.adicionais, pp.reembolsos,
           os.pedagio AS os_ped, os.adicionais AS os_adic, os.ajudante AS os_aj, os.descontos AS os_desc,
           os.custo_prestador AS os_custo
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    LEFT JOIN ordens_servico os ON os.id::TEXT = fp.os_id
    WHERE fp.id = '3f3a74cb-8a7a-4ce6-bad8-0c9398550c44'
  `);
  if (r3.rows.length > 0) {
    const row = r3.rows[0];
    console.log('\n=== CASE 3f3a74cb (diff=43.50) ===');
    console.log('  fp.valor:', row.fp_valor, 'pp.valor_liquido:', row.valor_liquido);
    console.log('  pp.valor_servicos:', row.valor_servicos, 'pp.pedagio:', row.pedagio, 'pp.adicionais:', row.adicionais);
    console.log('  os.custo_prestador:', row.os_custo, 'os.pedagio:', row.os_ped);
    console.log('  os.adicionais:', row.os_adic, 'os.ajudante:', row.os_aj, 'os.descontos:', row.os_desc);
  }

  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
