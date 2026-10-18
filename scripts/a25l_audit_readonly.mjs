import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const ALOC = 'ca5fe225-7114-42da-9997-c3d466e5df52';

async function main() {
  console.log('=== A25-L AUDITORIA READ-ONLY ===\n');

  console.log('--- 1. SCHEMA REAL de portal_tracking_realtime ---');
  const cols = await pool.query(`
    SELECT column_name, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'portal_tracking_realtime'
    ORDER BY ordinal_position
  `);
  for (const c of cols.rows) {
    console.log(`${c.column_name.padEnd(24)} ${c.udt_name.padEnd(12)} null=${c.is_nullable} def=${c.column_default ?? ''}`);
  }

  console.log('\n--- 2. TOTAL de registros da alocacao ---');
  const total = await pool.query(
    'SELECT COUNT(*) AS n, MAX(created_at) AS max_created, MAX(captured_at) AS max_captured FROM portal_tracking_realtime WHERE alocacao_id = $1',
    [ALOC]
  );
  console.log(total.rows[0]);

  console.log('\n--- 3. ULTIMAS 15 POSICOES (mais recentes primeiro) ---');
  const rows = await pool.query(
    `SELECT id, alocacao_id, latitude, longitude, velocidade, precisao, direcao, bateria,
            captured_at, created_at, origem, status, prestador_id, os_id, cliente_id, veiculo_id, tenant_id
     FROM portal_tracking_realtime
     WHERE alocacao_id = $1
     ORDER BY created_at DESC
     LIMIT 15`,
    [ALOC]
  );
  for (const r of rows.rows) {
    console.log(JSON.stringify(r));
  }

  console.log('\n--- 4. Diferença captured_at vs created_at (mais recente) ---');
  const diffs = await pool.query(
    `SELECT id, captured_at, created_at,
            EXTRACT(EPOCH FROM (created_at - captured_at)) AS delta_seg,
            NOW() AS agora_servidor
     FROM portal_tracking_realtime
     WHERE alocacao_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [ALOC]
  );
  for (const r of diffs.rows) {
    console.log(JSON.stringify(r));
  }

  console.log('\n--- 5. ALOCACAO (status, prestador, veiculo, os) ---');
  const aloc = await pool.query(
    `SELECT id, status, finalizada, prestador_id, ordem_servico_id, placa, tipo_veiculo,
            origem, destino, data_escala, aceite_prestador, data_aceite,
            metadata
     FROM alocacoes_escala
     WHERE id = $1`,
    [ALOC]
  );
  if (aloc.rows[0]) {
    const a = aloc.rows[0];
    const meta = a.metadata;
    console.log('status:', a.status, '| finalizada:', a.finalizada);
    console.log('prestador_id:', a.prestador_id);
    console.log('ordem_servico_id:', a.ordem_servico_id);
    console.log('placa:', a.placa, '| tipo_veiculo:', a.tipo_veiculo);
    console.log('origem:', a.origem, '| destino:', a.destino);
    console.log('aceite:', a.aceite_prestador, '| data_aceite:', a.data_aceite);
    console.log('metadata.ultima_posicao:', JSON.stringify(meta?.ultima_posicao ?? null));
    console.log('metadata.tracking_status:', meta?.tracking_status ?? null);
    console.log('metadata.app_motorista:', JSON.stringify(meta?.app_motorista ?? null));
    console.log('metadata.chave_metadata (todas):', Object.keys(meta ?? {}).join(', '));
  } else {
    console.log('ALOCACAO NAO ENCONTRADA');
  }

  console.log('\n--- 6. PRESTADOR / VEICULO / OS ---');
  if (aloc.rows[0]) {
    const a = aloc.rows[0];
    if (a.prestador_id) {
      const pr = await pool.query('SELECT id, nome_completo, telefone FROM prestadores WHERE id = $1', [a.prestador_id]);
      console.log('prestador:', JSON.stringify(pr.rows[0] ?? null));
    }
    const vc = await pool.query(
      `SELECT id, placa, tipo_veiculo, modelo FROM veiculos WHERE placa = $1 LIMIT 3`, [a.placa]);
    console.log('veiculo(por placa):', JSON.stringify(vc.rows ?? null));
    if (a.ordem_servico_id) {
      const os = await pool.query(
        `SELECT id, numero, status, cliente, prestador, origem, destino, localizacao_entrega_json
         FROM ordens_servico WHERE id = $1`, [a.ordem_servico_id]);
      console.log('os:', JSON.stringify(os.rows[0] ?? null));
    } else {
      console.log('os: NENHUMA (alocação sem ordem_servico_id)');
    }
  }

  console.log('\n--- 7. TODAS as alocacoes da MESMA OS (se houver) ---');
  if (aloc.rows[0]?.ordem_servico_id) {
    const osId = aloc.rows[0].ordem_servico_id;
    const alocs = await pool.query(
      `SELECT id, status, placa, prestador_id FROM alocacoes_escala WHERE ordem_servico_id = $1 ORDER BY data_escala DESC`,
      [osId]
    );
    for (const r of alocs.rows) console.log(JSON.stringify(r));
  }

  await pool.end();
}

main().catch(async (e) => {
  console.error('ERRO:', e.message);
  await pool.end();
  process.exit(1);
});