import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to production database.\n');

    const statements = [
      {
        name: '1. DROP ck_fp_status',
        sql: `ALTER TABLE financeiro_pagar DROP CONSTRAINT IF EXISTS ck_fp_status;`,
      },
      {
        name: '2. DROP ck_fr_status',
        sql: `ALTER TABLE financeiro_receber DROP CONSTRAINT IF EXISTS ck_fr_status;`,
      },
      {
        name: '3. ADD ck_fp_status CHECK NOT VALID',
        sql: `ALTER TABLE financeiro_pagar ADD CONSTRAINT ck_fp_status CHECK (
  status IN (
    'pendente', 'pago', 'cancelado', 'vencido', 'atrasado',
    'parcial', 'em_andamento', 'aguardando', 'estornado',
    'descontado', 'protestado', 'acordo', 'inscrito'
  )
) NOT VALID;`,
      },
      {
        name: '4. ADD ck_fr_status CHECK NOT VALID',
        sql: `ALTER TABLE financeiro_receber ADD CONSTRAINT ck_fr_status CHECK (
  status IN (
    'pendente', 'pago', 'cancelado', 'vencido', 'atrasado',
    'parcial', 'em_andamento', 'aguardando', 'estornado',
    'descontado', 'protestado', 'acordo', 'inscrito'
  )
) NOT VALID;`,
      },
      {
        name: '5. VALIDATE ck_fp_status',
        sql: `ALTER TABLE financeiro_pagar VALIDATE CONSTRAINT ck_fp_status;`,
      },
      {
        name: '6. VALIDATE ck_fr_status',
        sql: `ALTER TABLE financeiro_receber VALIDATE CONSTRAINT ck_fr_status;`,
      },
    ];

    for (const stmt of statements) {
      try {
        const res = await client.query(stmt.sql);
        console.log(`✅ ${stmt.name} — OK`);
        if (res.rowCount !== undefined) {
          console.log(`   Rows affected: ${res.rowCount}`);
        }
      } catch (err) {
        console.error(`❌ ${stmt.name} — FAILED: ${err.message}`);
      }
    }

    console.log('\n--- CONSTRAINT VERIFICATION ---');
    const verify = await client.query(`
      SELECT 
        conrelid::regclass AS tabela,
        conname AS nome,
        convalidated AS validado,
        pg_get_constraintdef(oid) AS definicao
      FROM pg_constraint
      WHERE conrelid::regclass::text IN ('financeiro_pagar', 'financeiro_receber')
      AND contype = 'c'
      AND conname IN ('ck_fp_status', 'ck_fr_status')
      ORDER BY tabela;
    `);
    
    for (const row of verify.rows) {
      console.log(`\n  Tabela: ${row.tabela}`);
      console.log(`  Nome: ${row.nome}`);
      console.log(`  Validado: ${row.validado}`);
      console.log(`  Definição: ${row.definicao}`);
    }

    console.log('\n--- ROW COUNTS ---');
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM financeiro_pagar) AS pagar_total,
        (SELECT COUNT(*) FROM financeiro_receber) AS receber_total;
    `);
    
    console.log(`  financeiro_pagar: ${counts.rows[0].pagar_total}`);
    console.log(`  financeiro_receber: ${counts.rows[0].receber_total}`);

    if (parseInt(counts.rows[0].pagar_total) === 107 && parseInt(counts.rows[0].receber_total) === 112) {
      console.log('\n✅ Row counts match expected values (107 + 112)');
    } else {
      console.log('\n❌ Row counts do NOT match expected values!');
    }

  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
  }
}

run();
