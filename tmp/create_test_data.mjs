import { Client } from 'pg';
import { readFileSync } from 'fs';

const lines = readFileSync('.env', 'utf8').split('\n');
const dbLine = lines.find(l => l.startsWith('DATABASE_URL='));
const connectionString = dbLine.replace('DATABASE_URL=', '').trim();

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();
    console.log('=== CRIANDO DADOS DE TESTE ===\n');

    // Use BRUNO as test prestador
    const PRESTADOR_ID = '659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce';
    const PRESTADOR_NOME = 'BRUNO DA SILVA SANTOS';

    // Check existing records for this prestador
    const existing = await client.query(`
      SELECT id, status, valor_liquido, fechamento_id, is_teste
      FROM pagamentos_prestadores
      WHERE prestador_id = $1
      ORDER BY created_at DESC LIMIT 5;
    `, [PRESTADOR_ID]);
    console.log('Registros existentes para BRUNO:');
    existing.rows.forEach(r => {
      console.log(`  ${r.id} | status=${r.status} | valor=${r.valor_liquido} | fechamento=${r.fechamento_id} | is_teste=${r.is_teste}`);
    });

    // Create 3 test payment records
    const testIds = [];
    for (let i = 1; i <= 3; i++) {
      const res = await client.query(`
        INSERT INTO pagamentos_prestadores (
          prestador_id, prestador_nome, status, tipo_pagamento,
          valor_servicos, valor_liquido, pedagio, adicionais, descontos,
          periodo_inicio, periodo_fim, is_teste,
          os_numero, origem_lancamento, observacao
        ) VALUES (
          $1, $2, 'pendente', 'servico',
          $3, $3, 10.00, 0, 0,
          CURRENT_DATE - INTERVAL '7 days',
          CURRENT_DATE,
          true,
          $4, 'TESTE VALID-P1-P2',
          'Registro de teste para validacao de fechamento'
        )
        RETURNING id, valor_liquido;
      `, [PRESTADOR_ID, PRESTADOR_NOME, 100 * i, `TESTE-FECH-${i}`]);
      testIds.push(res.rows[0].id);
      console.log(`\nItem ${i} criado: ${res.rows[0].id} | valor=${res.rows[0].valor_liquido}`);
    }

    console.log('\nIDs de teste:', testIds.join(', '));
    console.log('Total a ser fechado:', testIds.length, 'itens');

    // Verify they're visible
    const verify = await client.query(`
      SELECT id, prestador_nome, status, valor_liquido, is_teste, fechamento_id
      FROM pagamentos_prestadores
      WHERE id = ANY($1);
    `, [testIds]);
    console.log('\nVerificacao:');
    verify.rows.forEach(r => {
      console.log(`  ${r.id} | ${r.prestador_nome} | status=${r.status} | valor=${r.valor_liquido} | is_teste=${r.is_teste} | fech=${r.fechamento_id}`);
    });

    console.log('\n=== DADOS DE TESTE CRIADOS COM SUCESSO ===');
    console.log('PRESTADOR_ID=' + PRESTADOR_ID);
    console.log('TEST_IDS=' + testIds.join(','));
  } catch(e) {
    console.error('ERRO:', e.message);
  } finally {
    await client.end();
  }
})();
