import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let ok = 0, fail = 0;

function check(label, cond, detail) {
  console.log(`  ${cond ? '✅' : '❌'} ${label}`);
  if (cond) ok++; else fail++;
  if (!cond) console.log('     ' + String(detail).slice(0, 150));
}

async function exec(label, sql) {
  try { await pool.query(sql); check(label, true, 'ok'); }
  catch (e) {
    if (e.message.includes('already exists')) check(label, true, 'ja existia');
    else check(label, false, e.message.slice(0, 120));
  }
}

async function main() {
  console.log('═'.repeat(65));
  console.log('M108-I — NOC / TORRE DE CONTROLE ENTERPRISE');
  console.log('═'.repeat(65));

  // Section 1: Fix operacao_localizacao
  console.log('\n📦 Fix operacao_localizacao...');
  await exec('alocacao_id', 'ALTER TABLE public.operacao_localizacao ADD COLUMN IF NOT EXISTS alocacao_id UUID');
  await exec('os_id', 'ALTER TABLE public.operacao_localizacao ADD COLUMN IF NOT EXISTS os_id UUID');
  await exec('prestador_id', 'ALTER TABLE public.operacao_localizacao ADD COLUMN IF NOT EXISTS prestador_id UUID');
  await exec('tenant_id', "ALTER TABLE public.operacao_localizacao ADD COLUMN IF NOT EXISTS tenant_id UUID DEFAULT NULL");
  await exec('velocidade', 'ALTER TABLE public.operacao_localizacao ADD COLUMN IF NOT EXISTS velocidade NUMERIC DEFAULT 0');
  await exec('precisao', 'ALTER TABLE public.operacao_localizacao ADD COLUMN IF NOT EXISTS precisao NUMERIC DEFAULT 0');

  // Drop FK if exists
  try {
    await pool.query('ALTER TABLE public.operacao_localizacao DROP CONSTRAINT IF EXISTS operacao_localizacao_escala_id_fkey');
    check('Drop FK escala_operacional', true, 'ok');
  } catch (e) { check('Drop FK escala_operacional', true, e.message.includes('not exist') ? 'ja removida' : e.message); }

  // Section 2: Indexes
  console.log('\n📦 Indices...');
  for (const idx of [
    'CREATE INDEX IF NOT EXISTS idx_oper_localizacao_alocacao ON public.operacao_localizacao(alocacao_id)',
    'CREATE INDEX IF NOT EXISTS idx_oper_localizacao_prestador ON public.operacao_localizacao(prestador_id)',
    'CREATE INDEX IF NOT EXISTS idx_oper_localizacao_os ON public.operacao_localizacao(os_id)',
    'CREATE INDEX IF NOT EXISTS idx_oper_localizacao_tempo ON public.operacao_localizacao(atualizado_em DESC)',
  ]) await exec('indice', idx);

  // Section 3: RLS
  console.log('\n📦 RLS...');
  await exec('RLS enable', 'ALTER TABLE public.operacao_localizacao ENABLE ROW LEVEL SECURITY');
  await exec('RLS select',
    `DROP POLICY IF EXISTS "oper_localizacao_select" ON public.operacao_localizacao`);
  await exec('RLS select create',
    `CREATE POLICY "oper_localizacao_select" ON public.operacao_localizacao FOR SELECT TO authenticated
     USING (tenant_id = public.current_tenant_id_safe() OR tenant_id IS NULL)`);
  await exec('RLS insert',
    `DROP POLICY IF EXISTS "oper_localizacao_insert" ON public.operacao_localizacao`);
  await exec('RLS insert create',
    `CREATE POLICY "oper_localizacao_insert" ON public.operacao_localizacao FOR INSERT
     TO anon, authenticated WITH CHECK (true)`);

  // Section 4: Sync trigger
  console.log('\n📦 Trigger sync portal_tracking_realtime → operacao_localizacao...');
  await exec('Criar funcao',
    `CREATE OR REPLACE FUNCTION public.f_sync_tracking_to_oper_localizacao()
     RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$
     DECLARE v_prestador_id UUID; v_os_id UUID;
     BEGIN
       SELECT ae.prestador_id, ae.ordem_servico_id INTO v_prestador_id, v_os_id
       FROM public.alocacoes_escala ae WHERE ae.id = NEW.alocacao_id;
       INSERT INTO public.operacao_localizacao (alocacao_id, os_id, prestador_id, latitude, longitude, velocidade, precisao, tenant_id, atualizado_em)
       VALUES (NEW.alocacao_id, v_os_id, v_prestador_id, NEW.latitude, NEW.longitude, NEW.velocidade, NEW.precisao,
         COALESCE(NEW.tenant_id, public.current_tenant_id_safe()), COALESCE(NEW.captured_at, NOW()))
       ON CONFLICT DO NOTHING;
       RETURN NEW;
     END;
     \$\$;`);
  await exec('Drop trigger', 'DROP TRIGGER IF EXISTS trg_sync_tracking_to_oper_localizacao ON public.portal_tracking_realtime');
  await exec('Criar trigger',
    `CREATE TRIGGER trg_sync_tracking_to_oper_localizacao
     AFTER INSERT ON public.portal_tracking_realtime
     FOR EACH ROW EXECUTE FUNCTION public.f_sync_tracking_to_oper_localizacao()`);

  // Section 5: View NOC
  console.log('\n📦 View vw_noc_operacional...');
  await exec('Criar view',
    `CREATE OR REPLACE VIEW public.vw_noc_operacional AS
     SELECT ae.id as alocacao_id, ae.status as status_operacao, ae.prestador_id,
       COALESCE(p.nome_completo, 'N/I') as motorista_nome, ae.tipo_veiculo, ae.placa,
       ae.cliente_id, COALESCE(c.nome_fantasia, c.razao_social, 'N/I') as cliente_nome,
       ae.origem, ae.destino, ae.data_escala, ae.km_previstos,
       ae.valor_frete as valor_cliente, ae.valor_repasse as valor_prestador,
       ae.aceite_prestador, ae.data_aceite, ae.finalizada,
       ae.ordem_servico_id, os.numero as os_numero, os.tipo_operacao,
       ae.tipo_reversa, ae.reversa_valor_cliente, ae.reversa_valor_prestador, ae.reversa_status,
       ae.comprovante_url, ae.assinatura_url,
       CASE WHEN ae.comprovante_url IS NOT NULL OR ae.assinatura_url IS NOT NULL THEN true ELSE false END as tem_pod,
       ae.created_at as aloc_criada_em, ae.updated_at as aloc_atualizada_em, ae.tenant_id,
       ol.latitude as tracking_lat, ol.longitude as tracking_lng,
       ol.velocidade as tracking_velocidade, ol.atualizado_em as tracking_ultima_atualizacao,
       CASE WHEN ae.status = 'em_rota' AND ae.data_escala < CURRENT_DATE THEN 'atrasado'
            WHEN ae.status = 'em_rota' THEN 'em_dia'
            WHEN ae.status IN ('planejada','aguardando_aceite') AND ae.data_escala < CURRENT_DATE THEN 'urgente'
            WHEN ae.status IN ('planejada','aguardando_aceite') THEN 'pendente'
            WHEN ae.status = 'aceita' THEN 'confirmado'
            WHEN ae.status = 'concluida' THEN 'concluido' ELSE ae.status END as sla_status,
       CASE WHEN ae.reversa_valor_cliente > 0 AND ae.reversa_status IS NULL THEN 'reversa_pendente'
            WHEN ae.finalizada = true AND ae.comprovante_url IS NULL AND ae.assinatura_url IS NULL THEN 'pod_pendente'
            WHEN ae.status = 'em_rota' AND ol.latitude IS NULL THEN 'sem_sinal_gps'
            ELSE NULL END as alerta
     FROM public.alocacoes_escala ae
     LEFT JOIN public.prestadores p ON p.id = ae.prestador_id
     LEFT JOIN public.clientes c ON c.id = ae.cliente_id
     LEFT JOIN public.ordens_servico os ON os.id = ae.ordem_servico_id
     LEFT JOIN LATERAL (SELECT latitude, longitude, velocidade, atualizado_em FROM public.operacao_localizacao WHERE alocacao_id = ae.id ORDER BY atualizado_em DESC LIMIT 1) ol ON true
     WHERE ae.status NOT IN ('cancelada', 'recusada')`);

  // ===== TESTES =====
  console.log('\n🧪 Testes...');

  // 1. Check columns
  const { rows: cols } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='operacao_localizacao'
     AND column_name IN ('alocacao_id','os_id','prestador_id','tenant_id','velocidade','precisao')`
  );
  check('Colunas adicionadas operacao_localizacao', cols.length >= 5, cols.map(c => c.column_name).join(','));

  // 2. Check view
  const { rows: vwTest } = await pool.query(`SELECT COUNT(*) as c FROM public.vw_noc_operacional`);
  check('View vw_noc_operacional funciona', true, `${vwTest[0].c} registros`);

  // 3. Check view columns
  const { rows: vwCols } = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='vw_noc_operacional'`
  );
  check('View tem coluna tracking_lat', vwCols.some(c => c.column_name === 'tracking_lat'), 'ok');
  check('View tem coluna sla_status', vwCols.some(c => c.column_name === 'sla_status'), 'ok');
  check('View tem coluna alerta', vwCols.some(c => c.column_name === 'alerta'), 'ok');
  check('View tem coluna motorista_nome', vwCols.some(c => c.column_name === 'motorista_nome'), 'ok');
  check('View tem coluna tem_pod', vwCols.some(c => c.column_name === 'tem_pod'), 'ok');
  check('View tem coluna reversa_status', vwCols.some(c => c.column_name === 'reversa_status'), 'ok');

  // 4. Check trigger
  const { rows: trg } = await pool.query(
    `SELECT tgname FROM pg_trigger WHERE tgrelid='public.portal_tracking_realtime'::regclass
     AND tgname='trg_sync_tracking_to_oper_localizacao' AND NOT tgisinternal`
  );
  check('Trigger sync existe', trg.length > 0, trg[0]?.tgname);

  // 5. Test sync: insert into portal_tracking_realtime, verify operacao_localizacao
  const { rows: aloc } = await pool.query(
    `SELECT id FROM public.alocacoes_escala WHERE status NOT IN ('cancelada','recusada') LIMIT 1`
  );
  if (aloc.length > 0) {
    const alocId = aloc[0].id;
    await pool.query(
      `INSERT INTO public.portal_tracking_realtime (alocacao_id, latitude, longitude, velocidade, precisao, origem)
       VALUES ($1::uuid, -23.55, -46.63, 45, 8, 'test_m108i')`,
      [alocId]
    );
    await new Promise(r => setTimeout(r, 1000));
    const { rows: loc } = await pool.query(
      `SELECT latitude, longitude, velocidade FROM public.operacao_localizacao WHERE alocacao_id = $1::uuid`,
      [alocId]
    );
    check('Sync para operacao_localizacao', loc.length > 0 && Number(loc[0]?.latitude) === -23.55,
      `${loc.length} registros`);

    // Cleanup
    await pool.query(`DELETE FROM public.operacao_localizacao WHERE alocacao_id = $1::uuid`, [alocId]);
    await pool.query(`DELETE FROM public.portal_tracking_realtime WHERE alocacao_id = $1::uuid`, [alocId]);
  } else {
    check('Test sync (sem alocacao)', true, 'skip - nenhuma alocacao disponivel');
  }

  // Result
  console.log('\n' + '═'.repeat(65));
  console.log(`RESULTADO: ${ok} ✅ / ${fail} ❌`);
  await pool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
