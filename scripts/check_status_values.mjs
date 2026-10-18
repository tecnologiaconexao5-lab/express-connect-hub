import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();

    console.log('--- DISTINCT STATUS VALUES IN financeiro_pagar ---');
    const pagar = await client.query(`
      SELECT DISTINCT status, COUNT(*) AS cnt 
      FROM financeiro_pagar 
      GROUP BY status 
      ORDER BY cnt DESC;
    `);
    for (const r of pagar.rows) {
      const valid = ['pendente','pago','cancelado','vencido','atrasado','parcial','em_andamento','aguardando','estornado','descontado','protestado','acordo','inscrito'].includes(r.status);
      console.log(`  ${valid ? '✅' : '❌'} "${r.status}" — ${r.cnt} rows`);
    }

    console.log('\n--- DISTINCT STATUS VALUES IN financeiro_receber ---');
    const receber = await client.query(`
      SELECT DISTINCT status, COUNT(*) AS cnt 
      FROM financeiro_receber 
      GROUP BY status 
      ORDER BY cnt DESC;
    `);
    for (const r of receber.rows) {
      const valid = ['pendente','pago','cancelado','vencido','atrasado','parcial','em_andamento','aguardando','estornado','descontado','protestado','acordo','inscrito'].includes(r.status);
      console.log(`  ${valid ? '✅' : '❌'} "${r.status}" — ${r.cnt} rows`);
    }

    console.log('\n--- NULL STATUS COUNTS ---');
    const nullPagar = await client.query(`SELECT COUNT(*) FROM financeiro_pagar WHERE status IS NULL;`);
    const nullReceber = await client.query(`SELECT COUNT(*) FROM financeiro_receber WHERE status IS NULL;`);
    console.log(`  financeiro_pagar NULL: ${nullPagar.rows[0].count}`);
    console.log(`  financeiro_receber NULL: ${nullReceber.rows[0].count}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
