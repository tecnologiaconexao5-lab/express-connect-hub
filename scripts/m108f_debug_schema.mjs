import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Check the actual type of cliente in ordens_servico
  const { rows } = await pool.query(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordens_servico'
     AND column_name IN ('cliente', 'cliente_id', 'prestador', 'prestador_id')
     ORDER BY ordinal_position`
  );
  for (const r of rows) {
    console.log(`${r.column_name}: ${r.data_type} (${r.udt_name})`);
  }

  // Check an existing OS
  const { rows: existing } = await pool.query(
    `SELECT id, cliente, cliente_id::text, prestador, prestador_id FROM public.ordens_servico LIMIT 1`
  );
  if (existing.length > 0) {
    const e = existing[0];
    console.log(`\nExemplo OS: id=${e.id}`);
    console.log(`  cliente (${typeof e.cliente}): ${e.cliente}`);
    console.log(`  cliente_id: ${e.cliente_id}`);
    console.log(`  prestador (${typeof e.prestador}): ${e.prestador}`);
    console.log(`  prestador_id: ${e.prestador_id}`);
  }

  // Check cliente_id in alocacoes_escala
  const { rows: aCols } = await pool.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'alocacoes_escala'
     AND column_name IN ('cliente_id', 'prestador_id')
     ORDER BY ordinal_position`
  );
  for (const r of aCols) {
    console.log(`\nalocacoes_escala.${r.column_name}: ${r.data_type}`);
  }

  // Try a simple INSERT
  const { rows: cli } = await pool.query('SELECT id FROM public.clientes LIMIT 1');
  const { rows: prest } = await pool.query("SELECT id FROM public.prestadores WHERE status='ativo' LIMIT 1");
  console.log(`\ncliente.id = ${cli[0]?.id}`);
  console.log(`prestador.id = ${prest[0]?.id}`);

  const testOsId = crypto.randomUUID();
  try {
    // cliente=UUID, cliente_id=TEXT (schema real)
    await pool.query(
      `INSERT INTO public.ordens_servico (id, cliente, cliente_id, status, tipo_operacao, veiculo_tipo, valor_cliente, custo_prestador, distancia_km, tipo_reversa, reversa_qtd_volumes)
       VALUES ($1, $2, $2::text, 'pendente', 'teste', 'VUC', 100, 50, 10, 'devolucao', 3)`,
      [testOsId, cli[0].id]
    );
    console.log('OS INSERT OK');
    await pool.query('DELETE FROM public.ordens_servico WHERE id=$1', [testOsId]);
  } catch (e) {
    console.log('OS INSERT FAILED:', e.message);
  }

  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
