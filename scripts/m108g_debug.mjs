import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Check tabelas_valores columns
  const { rows: tvCols } = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tabelas_valores' ORDER BY ordinal_position`);
  console.log('tabelas_valores columns:', tvCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  // Check tabela_prestador columns
  const { rows: tpCols } = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tabela_prestador' WHERE column_name LIKE '%prestador%' OR column_name LIKE '%nome%' ORDER BY ordinal_position`);
  console.log('tabela_prestador columns:', tpCols.map(c => `${c.column_name} (${c.data_type})`).join(', '));

  // Try a simple insert
  const id = crypto.randomUUID();
  try {
    await pool.query(`INSERT INTO public.tabelas_valores (id, nome, cliente, tipo_veiculo, valor_base, ativo) VALUES ($1, 'teste', 'teste', 'vuc', 100, true)`, [id]);
    console.log('INSERT OK');
  } catch (e) { console.log('INSERT FAILED:', e.message); }

  await pool.query(`DELETE FROM public.tabelas_valores WHERE id=$1`, [id]);
  await pool.end();
}
main().catch(e => { console.error(e.message); });
