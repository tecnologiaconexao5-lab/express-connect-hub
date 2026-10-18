import { Client } from 'pg';
import { readFileSync } from 'fs';

const lines = readFileSync('.env', 'utf8').split('\n');
const dbLine = lines.find(l => l.startsWith('DATABASE_URL='));
const connectionString = dbLine.replace('DATABASE_URL=', '').trim();

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    await client.connect();
    console.log('=== PRE-CHECAGEM BANCO REAL ===\n');

    // 1. Colunas
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'pagamentos_prestadores'
      AND column_name IN ('fechamento_id', 'data_conferencia', 'data_aprovacao')
      ORDER BY column_name;
    `);
    console.log('COLUNAS:');
    const found = new Set();
    cols.rows.forEach(r => {
      console.log(`  ${r.column_name}: ${r.data_type} (nullable=${r.is_nullable})`);
      found.add(r.column_name);
    });
    ['fechamento_id', 'data_conferencia', 'data_aprovacao'].forEach(c => {
      if (!found.has(c)) console.log(`  ${c}: FALTANDO!`);
    });

    // 2. FK
    const fk = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint
      WHERE conrelid = 'pagamentos_prestadores'::regclass
      AND contype = 'f' AND conname = 'fk_fechamento_pai';
    `);
    console.log('\nFK:');
    if (fk.rows.length > 0) {
      console.log(`  ${fk.rows[0].conname}: ${fk.rows[0].def}`);
    } else {
      console.log('  FK fk_fechamento_pai: FALTANDO!');
    }

    // 3. Indices
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'pagamentos_prestadores'
      AND indexname LIKE 'idx_pp_fechamento%';
    `);
    console.log('\nINDICES:');
    const idxNames = new Set();
    idx.rows.forEach(r => {
      console.log(`  ${r.indexname}`);
      idxNames.add(r.indexname);
    });
    ['idx_pp_fechamento_id', 'idx_pp_fechamento_tipo'].forEach(i => {
      if (!idxNames.has(i)) console.log(`  ${i}: FALTANDO!`);
    });

    // 4. Prestadores existentes (para teste)
    const prest = await client.query(`
      SELECT id, nome_completo FROM prestadores LIMIT 5;
    `);
    console.log('\nPRESTADORES (para referencia):');
    prest.rows.forEach(r => console.log(`  ${r.id} | ${r.nome_completo}`));

    // 5. Contas financeiras (para pagamento)
    const contas = await client.query(`
      SELECT id, nome, ativa FROM contas_financeiras WHERE ativa = true LIMIT 5;
    `);
    console.log('\nCONTAS FINANCEIRAS ATIVAS:');
    contas.rows.forEach(r => console.log(`  ${r.id} | ${r.nome} | ativa=${r.ativa}`));

    // 6. Total pagamentos_prestadores
    const tot = await client.query('SELECT COUNT(*) as cnt FROM pagamentos_prestadores');
    console.log('\nTOTAL pagamentos_prestadores:', tot.rows[0].cnt);

    // 7. Verificar se ja existem fechamentos
    const fech = await client.query(`
      SELECT COUNT(*) as cnt FROM pagamentos_prestadores WHERE tipo_pagamento = 'fechamento';
    `);
    console.log('Fechamentos existentes:', fech.rows[0].cnt);

    // 8. Status de todos os itens
    const statusRes = await client.query(`
      SELECT status, COUNT(*) as cnt FROM pagamentos_prestadores GROUP BY status ORDER BY status;
    `);
    console.log('\nDISTRIBUICAO DE STATUS:');
    statusRes.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));

    console.log('\n=== PRE-CHECAGEM COMPLETA ===');
  } catch(e) {
    console.error('ERRO:', e.message);
  } finally {
    await client.end();
  }
})();
