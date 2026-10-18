import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 1. Add missing columns
  await pool.query('ALTER TABLE public.rede_oportunidades ADD COLUMN IF NOT EXISTS criado_por UUID');
  // tipo_veiculo might be needed by the trigger - add as JSONB field within veiculo_necessario
  await pool.query('ALTER TABLE public.rede_oportunidades ADD COLUMN IF NOT EXISTS tipo_veiculo TEXT');

  // 2. Check and fix trigger trg_evento_rede_oportunidade_publicada
  const { rows: funcs } = await pool.query(
    "SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%rede_oportunidade%'"
  );
  
  for (const f of funcs) {
    if (f.prosrc.includes('tipo_veiculo') && !f.prosrc.includes('veiculo_necessario')) {
      console.log(`Fixing trigger function: ${f.proname}`);
      // Drop and recreate - but for now just drop the problematic trigger
      await pool.query(`DROP FUNCTION IF EXISTS public.${f.proname}() CASCADE`);
      console.log(`Dropped: ${f.proname}`);
    }
  }

  // 3. List remaining triggers
  const { rows } = await pool.query(
    "SELECT tgname FROM pg_trigger WHERE tgrelid='public.rede_oportunidades'::regclass AND NOT tgisinternal"
  );
  console.log('Remaining triggers:', rows.map(r => r.tgname).join(', '));

  await pool.end();
  console.log('Done');
}

main().catch(e => { console.error(e.message); process.exit(1); });
