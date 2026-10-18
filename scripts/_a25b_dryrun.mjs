import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const sql = fs.readFileSync('scripts/_a25b_fix_rpc_registrar_posicao.sql', 'utf8');

const client = await pool.connect();
try {
  // DRY-RUN: aplica dentro de transação e REVERTE (valida sintaxe sem persistir)
  await client.query('BEGIN');
  await client.query(sql);
  // Verificação pós-aplicação dentro da transação
  const r = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'registrar_posicao_motorista'
  `);
  const def = r.rows[0].def;
  const refsInvalidas = ['ordem_servico_id', 'motorista_id', 'altitude', 'status_operacional']
    .filter(c => new RegExp(`INSERT INTO public\\.portal_tracking_realtime[\\s\\S]*?${c}[\\s\\S]*?\\)`).test(def));
  console.log('=== DRY-RUN (transação revertida) ===');
  console.log('Função aplicou sem erro de sintaxe: OK');
  console.log('Contém INSERT refs a colunas inexistentes? ', refsInvalidas.length ? refsInvalidas.join(', ') : 'NÃO');
  await client.query('ROLLBACK');
  console.log('ROLLBACK executado — Produção NÃO alterada nesta etapa.');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('ERRO no dry-run:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
