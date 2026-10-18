import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows: cli } = await pool.query('SELECT id FROM public.clientes LIMIT 1');
  const { rows: prest } = await pool.query("SELECT id FROM public.prestadores WHERE status='ativo' LIMIT 1");

  const osId = crypto.randomUUID();
  const alocId = crypto.randomUUID();
  const cliId = cli[0].id;
  const prestId = prest[0].id;

  // Test 1: Simple OS INSERT
  console.log('Test 1: OS INSERT...');
  try {
    await pool.query(
      `INSERT INTO public.ordens_servico (id, cliente, cliente_id, status, tipo_operacao, veiculo_tipo, valor_cliente, custo_prestador, distancia_km, tipo_reversa, reversa_qtd_volumes)
       VALUES ($1::uuid, $2::uuid, $3::text, 'pendente', 'teste', 'VUC', 100, 50, 10, 'devolucao', 3)`,
      [osId, cliId, cliId]
    );
    console.log('  ✅ OS INSERT OK');
  } catch (e) { console.log('  ❌', e.message); }

  // Test 2: Alocacao INSERT
  console.log('\nTest 2: Alocacao INSERT...');
  try {
    await pool.query(
      `INSERT INTO public.alocacoes_escala (id, ordem_servico_id, cliente_id, prestador_id, status, data_escala, tipo_veiculo, valor_frete, valor_repasse, tipo_reversa, reversa_valor_cliente, reversa_valor_prestador, reversa_qtd_volumes, aceite_prestador, data_aceite)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'aceita', CURRENT_DATE, 'VUC', 2000, 1200, 'devolucao', 300, 150, 5, true, NOW())`,
      [alocId, osId, cliId, prestId]
    );
    console.log('  ✅ Alocacao INSERT OK');
  } catch (e) { console.log('  ❌', e.message); }

  // Check
  const { rows: fr } = await pool.query("SELECT valor FROM public.financeiro_receber WHERE os_id=$1::text", [osId]);
  console.log(`\nFinanceiro receber: ${fr.length} rows, valor=${fr[0]?.valor}`);

  // Cleanup
  await pool.query("DELETE FROM public.eventos_oficiais WHERE entity_id=$1", [alocId]);
  await pool.query("DELETE FROM public.financeiro_pagar WHERE os_id=$1::text", [osId]);
  await pool.query("DELETE FROM public.financeiro_receber WHERE os_id=$1::text", [osId]);
  await pool.query("DELETE FROM public.pagamentos_prestadores WHERE os_id=$1", [osId]);
  await pool.query("DELETE FROM public.composicao_financeira_os WHERE os_id=$1", [osId]);
  await pool.query("DELETE FROM public.alocacoes_escala WHERE id=$1", [alocId]);
  await pool.query("DELETE FROM public.ordens_servico WHERE id=$1", [osId]);
  console.log('\nCleanup OK');
  await pool.end();
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
