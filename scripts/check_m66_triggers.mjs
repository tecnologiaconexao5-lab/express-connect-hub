import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

async function main() {
  const r = await pool.query(`
    SELECT tgname, tgrelid::regclass::text AS tbl, pg_get_triggerdef(oid) AS def
    FROM pg_trigger
    WHERE tgrelid::regclass::text IN (
      'alocacoes_escala', 'ordens_servico', 'composicao_financeira_os',
      'financeiro_receber', 'pagamentos_prestadores'
    )
    AND NOT tgisinternal
  `);
  for (const row of r.rows) {
    console.log(`\n=== ${row.tbl} :: ${row.tgname} ===`);
    console.log(row.def);
  }
  await pool.end();
}
main();
