// Investigação do título 31fcab2b e dos 4 recebíveis pagos sem baixa

const { Client } = require('pg');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function query(client, sql, params = []) {
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (e) {
    console.error(`Erro na query: ${e.message}\nSQL: ${sql}`);
    return [];
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL });
  
  try {
    await client.connect();
    console.log('✓ Conectado ao banco (read-only)\n');

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. INVESTIGAR TÍTULO 31fcab2b (baixado com R$ 520,00)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('═══ 1. TÍTULO 31fcab2b (BAIXADO COM R$ 520,00) ═══\n');
    
    const titulo = await query(client, `
      SELECT 
        fp.*,
        c.nome as conta_nome
      FROM financeiro_pagar fp
      LEFT JOIN contas_financeiras c ON fp.conta_pagadora = c.nome
      WHERE fp.id = '31fcab2b-8745-482b-aab7-6650795629e1'
    `);
    
    console.log('Título completo:');
    console.log(JSON.stringify(titulo[0], null, 2));

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. INVESTIGAR OS DO TÍTULO 31fcab2b
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 2. OS DO TÍTULO 31fcab2b ═══\n');
    
    if (titulo[0]?.os_id) {
      const os = await query(client, `
        SELECT *
        FROM ordens_servico
        WHERE id = $1
      `, [titulo[0].os_id]);
      
      console.log('OS associada:');
      console.log(JSON.stringify(os[0], null, 2));
    } else {
      console.log('Título não tem os_id');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. INVESTIGAR OS 4 RECEBÍVEIS PAGOS SEM BAIXA
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 3. RECEBÍVEIS PAGOS SEM BAIXA ═══\n');
    
    const recebiveis = [
      '2d625b18-c262-4d29-814b-7fab65edbe22',
      '17e857d8-184e-4c79-883d-a26da3f86edf',
      'fb30838a-fc5f-430f-9aa3-9b7892e564d4',
      'cf6eea7b-4c9d-4200-b306-4d209764112f'
    ];

    for (const id of recebiveis) {
      console.log(`\n--- Recebível: ${id} ---\n`);
      
      const r = await query(client, `
        SELECT *
        FROM financeiro_receber
        WHERE id = $1
      `, [id]);
      
      if (r.length > 0) {
        console.log('Dados completos:');
        console.log(JSON.stringify(r[0], null, 2));
        
        // Verificar se tem OS associada
        if (r[0].os_id) {
          const os = await query(client, `
            SELECT id, numero, cliente, valor_cliente, status, data
            FROM ordens_servico
            WHERE id = $1
          `, [r[0].os_id]);
          
          console.log('\nOS associada:');
          console.log(JSON.stringify(os[0], null, 2));
        }
        
        // Verificar se tem fatura associada
        if (r[0].fatura_id) {
          const fatura = await query(client, `
            SELECT id, numero, cliente_id, valor_total, status
            FROM faturas
            WHERE id = $1
          `, [r[0].fatura_id]);
          
          console.log('\nFatura associada:');
          console.log(JSON.stringify(fatura[0], null, 2));
        }
      } else {
        console.log('Recebível não encontrado');
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. INVESTIGAR f83a3249 (TESTE)
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('\n\n═══ 4. CONTA A PAGAR f83a3249 (TESTE) ═══\n');
    
    const teste = await query(client, `
      SELECT *
      FROM financeiro_pagar
      WHERE id = 'f83a3249-acf4-49cb-8ddb-21ddbfe77a4b'
    `);
    
    console.log('Dados completos:');
    console.log(JSON.stringify(teste[0], null, 2));

    // Verificar relacionamentos
    console.log('\nVerificando relacionamentos:');
    
    // Tem OS?
    if (teste[0]?.os_id) {
      const os = await query(client, `
        SELECT id FROM ordens_servico WHERE id = $1
      `, [teste[0].os_id]);
      console.log(`OS: ${os.length > 0 ? 'SIM' : 'NÃO'}`);
    } else {
      console.log('OS: NÃO (sem os_id)');
    }
    
    // Tem baixas?
    const baixas = await query(client, `
      SELECT COUNT(*) as total
      FROM financeiro_baixas
      WHERE titulo_id = $1
    `, [teste[0]?.id]);
    console.log(`Baixas: ${baixas[0]?.total || 0}`);

    await client.end();
    console.log('\n\n✓ Investigação concluída');
    process.exit(0);

  } catch (error) {
    console.error('Erro fatal:', error);
    await client.end();
    process.exit(1);
  }
}

main();
