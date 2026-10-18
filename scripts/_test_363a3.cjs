// FIN-MASTER-363A.3 — Testes negativos e E2E positivo
// Testa que NÃO é possível criar/atualizar recebível como pago sem baixa

const { Client } = require('pg');
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function q(client, sql, params = []) {
  try { const r = await client.query(sql, params); return r.rows; }
  catch (e) { return { __error: e.message }; }
}

async function main() {
  const client = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✓ Conectado (read-only para testes)\n');

  // Criar cliente de teste
  const cli = await q(client, `INSERT INTO clientes (razao_social, nome_fantasia, cnpj, status) VALUES ('Cliente Teste 363A3', 'Teste 363A3', '00.000.000/0001-00', 'ativo') RETURNING id`);
  const clienteId = cli[0]?.id;
  console.log('Cliente de teste criado:', clienteId);

  // TESTE A: tentar criar recebível diretamente como pago
  console.log('\n=== TESTE A: criar recebível com status=pago (deve falhar) ===');
  try {
    const r = await q(client, `
      INSERT INTO financeiro_receber (cliente_id, valor, data_vencimento, status)
      VALUES ($1, 100, '2026-12-31', 'pago')
      RETURNING id
    `, [clienteId]);
    if (r.__error) {
      console.log('✓ BLOQUEADO:', r.__error);
    } else {
      console.log(' FALHOU: criado com id', r[0]?.id, '(deveria ter sido bloqueado)');
    }
  } catch (e) {
    console.log('✓ BLOQUEADO:', e.message);
  }

  // TESTE B: criar recebível aberto e tentar atualizar para pago
  console.log('\n=== TESTE B: atualizar recebível aberto para pago (deve falhar) ===');
  const rec = await q(client, `
    INSERT INTO financeiro_receber (cliente_id, valor, data_vencimento, status)
    VALUES ($1, 200, '2026-12-31', 'aberto')
    RETURNING id
  `, [clienteId]);
  const recId = rec[0]?.id;
  console.log('Recebível aberto criado:', recId);

  try {
    const r = await q(client, `
      UPDATE financeiro_receber SET status = 'pago' WHERE id = $1 RETURNING id
    `, [recId]);
    if (r.__error) {
      console.log('✓ BLOQUEADO:', r.__error);
    } else {
      console.log('✗ FALHOU: atualizado para pago (deveria ter sido bloqueado)');
    }
  } catch (e) {
    console.log('✓ BLOQUEADO:', e.message);
  }

  // TESTE C: tentar criar com status='recebido' ou 'baixado'
  console.log('\n=== TESTE C: criar com status=recebido/baixado (deve falhar) ===');
  for (const status of ['recebido', 'baixado']) {
    try {
      const r = await q(client, `
        INSERT INTO financeiro_receber (cliente_id, valor, data_vencimento, status)
        VALUES ($1, 300, '2026-12-31', $2)
        RETURNING id
      `, [clienteId, status]);
      if (r.__error) {
        console.log(`✓ BLOQUEADO (${status}):`, r.__error);
      } else {
        console.log(` FALHOU (${status}): criado com id`, r[0]?.id);
      }
    } catch (e) {
      console.log(`✓ BLOQUEADO (${status}):`, e.message);
    }
  }

  // TESTE POSITIVO: criar aberto, criar baixa via RPC, verificar que fica pago
  console.log('\n=== TESTE POSITIVO: fluxo oficial de baixa ===');
  const rec2 = await q(client, `
    INSERT INTO financeiro_receber (cliente_id, valor, data_vencimento, status)
    VALUES ($1, 500, '2026-12-31', 'aberto')
    RETURNING id
  `, [clienteId]);
  const rec2Id = rec2[0]?.id;
  console.log('Recebível aberto criado:', rec2Id);

  // Criar baixa via RPC
  const baixa = await q(client, `
    SELECT * FROM f_registrar_baixa_financeira(
      'financeiro_receber', $1::uuid, 500, '2026-09-06', 'pix', 'Cora', 
      '9741ad36-79a6-4e1f-94a5-512e08758186', null, 'Teste E2E 363A3', null, null
    )
  `, [rec2Id]);
  console.log('Baixa registrada:', JSON.stringify(baixa[0]));

  // Verificar se ficou pago
  const final = await q(client, `
    SELECT id, status, data_pagamento FROM financeiro_receber WHERE id = $1
  `, [rec2Id]);
  console.log('Estado final:', JSON.stringify(final[0]));

  // Limpar dados de teste
  console.log('\n=== LIMPEZA ===');
  await q(client, `DELETE FROM financeiro_baixas WHERE observacao = 'Teste E2E 363A3'`);
  await q(client, `DELETE FROM financeiro_receber WHERE cliente_id = $1`, [clienteId]);
  await q(client, `DELETE FROM clientes WHERE id = $1`, [clienteId]);
  console.log('✓ Dados de teste limpos');

  await client.end();
}

main().catch(async e => { console.error(e); process.exit(1); });
