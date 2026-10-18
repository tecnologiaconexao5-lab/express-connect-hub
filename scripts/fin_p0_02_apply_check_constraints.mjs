// FIN-P0-02: Apply CHECK constraints via pg module
import pg from 'pg';

const DATABASE_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  
  try {
    // Step 1: Drop old constraints
    console.log('=== STEP 1: Drop old constraints ===');
    await client.query('ALTER TABLE financeiro_pagar DROP CONSTRAINT IF EXISTS ck_fp_status');
    console.log('ck_fp_status dropped (if existed)');
    await client.query('ALTER TABLE financeiro_receber DROP CONSTRAINT IF EXISTS ck_fr_status');
    console.log('ck_fr_status dropped (if existed)');

    // Step 2: Create CHECK NOT VALID
    console.log('\n=== STEP 2: Create CHECK NOT VALID ===');
    await client.query(`
      ALTER TABLE financeiro_pagar
        ADD CONSTRAINT ck_fp_status
        CHECK (status IN (
          'aberto','pago','vencido','atrasado','cancelado',
          'parcial','pendente','a vencer','cancelada','provisorio',
          'recebido','renegociado'
        )) NOT VALID
    `);
    console.log('ck_fp_status created (NOT VALID)');

    await client.query(`
      ALTER TABLE financeiro_receber
        ADD CONSTRAINT ck_fr_status
        CHECK (status IN (
          'aberto','pago','vencido','atrasado','cancelado',
          'parcial','pendente','a vencer','a_vencer','cancelada',
          'vencida','provisorio','recebido','renegociado'
        )) NOT VALID
    `);
    console.log('ck_fr_status created (NOT VALID)');

    // Step 3: Validate
    console.log('\n=== STEP 3: Validate ===');
    await client.query('ALTER TABLE financeiro_pagar VALIDATE CONSTRAINT ck_fp_status');
    console.log('ck_fp_status validated');
    await client.query('ALTER TABLE financeiro_receber VALIDATE CONSTRAINT ck_fr_status');
    console.log('ck_fr_status validated');

    // Step 4: Verify
    console.log('\n=== STEP 4: Verify ===');
    const constraints = await client.query(`
      SELECT conrelid::regclass AS tabela, conname AS nome, convalidated AS validado
      FROM pg_constraint
      WHERE conrelid::regclass::text IN ('financeiro_pagar','financeiro_receber')
        AND contype='c'
        AND conname IN ('ck_fp_status','ck_fr_status')
      ORDER BY tabela
    `);
    console.table(constraints.rows);

    const counts = await client.query(`
      SELECT (SELECT COUNT(*) FROM financeiro_pagar) AS pagar_total,
             (SELECT COUNT(*) FROM financeiro_receber) AS receber_total
    `);
    console.log('Row counts:', counts.rows[0]);

    // Step 5: Verify all status values are in the constraint
    console.log('\n=== STEP 5: Verify no violations ===');
    const pagarStatus = await client.query('SELECT DISTINCT status FROM financeiro_pagar ORDER BY status');
    const receberStatus = await client.query('SELECT DISTINCT status FROM financeiro_receber ORDER BY status');
    
    const allowedPagar = new Set(['aberto','pago','vencido','atrasado','cancelado','parcial','pendente','a vencer','cancelada','provisorio','recebido','renegociado']);
    const allowedReceber = new Set(['aberto','pago','vencido','atrasado','cancelado','parcial','pendente','a vencer','a_vencer','cancelada','vencida','provisorio','recebido','renegociado']);
    
    console.log('Pagar statuses:', pagarStatus.rows.map(r => r.status));
    console.log('Receber statuses:', receberStatus.rows.map(r => r.status));
    
    const pagarViolations = pagarStatus.rows.filter(r => !allowedPagar.has(r.status));
    const receberViolations = receberStatus.rows.filter(r => !allowedReceber.has(r.status));
    
    if (pagarViolations.length > 0) {
      console.error('PAGAR VIOLATIONS:', pagarViolations);
    } else {
      console.log('Pagar: ✅ All statuses within allowed list');
    }
    
    if (receberViolations.length > 0) {
      console.error('RECEBER VIOLATIONS:', receberViolations);
    } else {
      console.log('Receber: ✅ All statuses within allowed list');
    }

    console.log('\n=== MIGRATION APPLIED SUCCESSFULLY ===');
    
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
