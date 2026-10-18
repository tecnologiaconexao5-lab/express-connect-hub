import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
let ok = 0, fail = 0;

function check(label, cond, detail) {
  console.log(`  ${cond ? '✅' : '❌'} ${label}`);
  results.push({ label, ok: cond, detail });
  if (cond) ok++; else fail++;
}

async function exec(label, sql) {
  try { await pool.query(sql); check(label, true, 'ok'); }
  catch (e) {
    if (e.message.includes('already exists')) check(label, true, 'ja existia');
    else { check(label, false, e.message.slice(0, 100)); console.log('  SQL:', sql.slice(0, 80)); }
  }
}

async function main() {
  console.log('═'.repeat(65));
  console.log('M108-G — TABELA DE VALORES ENTERPRISE');
  console.log('═'.repeat(65));

  // SECTION 1: Add columns
  console.log('\n📦 Colunas tabelas_valores...');
  await exec('versao', 'ALTER TABLE public.tabelas_valores ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1');
  await exec('motivo_alteracao', 'ALTER TABLE public.tabelas_valores ADD COLUMN IF NOT EXISTS motivo_alteracao TEXT');
  await exec('prioridade', 'ALTER TABLE public.tabelas_valores ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 0');

  console.log('\n📦 Colunas tabela_prestador...');
  await exec('data_inicio tp', 'ALTER TABLE public.tabela_prestador ADD COLUMN IF NOT EXISTS data_inicio DATE');
  await exec('data_fim tp', 'ALTER TABLE public.tabela_prestador ADD COLUMN IF NOT EXISTS data_fim DATE');
  await exec('versao tp', 'ALTER TABLE public.tabela_prestador ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1');
  await exec('motivo_alteracao tp', 'ALTER TABLE public.tabela_prestador ADD COLUMN IF NOT EXISTS motivo_alteracao TEXT');
  await exec('prioridade tp', 'ALTER TABLE public.tabela_prestador ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 0');

  // SECTION 2: Create triggers
  console.log('\n📦 Triggers de versão...');
  await exec('trigger tabelas_valores', `
    CREATE OR REPLACE FUNCTION public.f_log_tabela_alteracao() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NEW.versao := COALESCE(OLD.versao, 0) + 1; NEW.updated_at := NOW(); RETURN NEW; END; $$;
    DROP TRIGGER IF EXISTS trg_tabelas_valores_version ON public.tabelas_valores;
    CREATE TRIGGER trg_tabelas_valores_version BEFORE UPDATE ON public.tabelas_valores FOR EACH ROW EXECUTE FUNCTION public.f_log_tabela_alteracao();
    DROP TRIGGER IF EXISTS trg_tabela_prestador_version ON public.tabela_prestador;
    CREATE TRIGGER trg_tabela_prestador_version BEFORE UPDATE ON public.tabela_prestador FOR EACH ROW EXECUTE FUNCTION public.f_log_tabela_alteracao();`);

  // SECTION 3: Test versioning
  console.log('\n🧪 Teste 1: Versionamento...');
  const { rows: tab } = await pool.query(`SELECT id FROM public.tabelas_valores WHERE ativo = true LIMIT 1`);
  if (tab.length > 0) {
    const tabId = tab[0].id;
    const { rows: v1 } = await pool.query(`SELECT versao FROM public.tabelas_valores WHERE id = $1`, [tabId]);
    const versaoOriginal = v1[0].versao;
    await pool.query(`UPDATE public.tabelas_valores SET nome = nome WHERE id = $1`, [tabId]);
    const { rows: v2 } = await pool.query(`SELECT versao FROM public.tabelas_valores WHERE id = $1`, [tabId]);
    check('Versão incrementada no update', Number(v2[0].versao) > Number(versaoOriginal),
      `antes=${versaoOriginal} depois=${v2[0].versao}`);
  } else {
    check('Tabela para testar versionamento', false, 'Nenhuma tabela ativa');
  }

  // SECTION 4: Test hierarchy view
  console.log('\n🧪 Teste 2: View hierarquia...');
  try {
    const { rows: hv } = await pool.query(`SELECT COUNT(*) as c FROM public.vw_hierarquia_tabelas`);
    check('View vw_hierarquia_tabelas criada', true, `${hv[0].c} registros`);
  } catch (e2) {
    // Drop and recreate with correct column name
    await pool.query('DROP VIEW IF EXISTS public.vw_hierarquia_tabelas');
    try {
      const { rows: pCol } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tabela_prestador' AND column_name LIKE '%restador%' LIMIT 1");
      const pc = pCol[0]?.column_name || 'prestador_id';
      await pool.query(`CREATE VIEW public.vw_hierarquia_tabelas AS SELECT 'tabelas_valores' as tipo, t.id, t.nome, t.cliente, t.tipo_veiculo, t.valor_base, t.franquia_km, t.valor_km_excedente, t.percentual_prestador, t.universal, t.data_inicio, t.data_fim, t.versao, t.prioridade, t.ativo, t.created_at, t.updated_at, CASE WHEN t.universal THEN 3 WHEN t.cliente IS NOT NULL AND t.data_inicio IS NOT NULL THEN 1 WHEN t.cliente IS NOT NULL THEN 2 ELSE 4 END as nivel_hierarquia FROM public.tabelas_valores t WHERE t.ativo = true UNION ALL SELECT 'tabela_prestador' as tipo, tp.id, tp.nome, tp.${pc}::text as cliente, tp.tipo_veiculo, tp.valor_minimo as valor_base, tp.km_incluso as franquia_km, tp.valor_km as valor_km_excedente, 0 as percentual_prestador, false as universal, tp.data_inicio, tp.data_fim, tp.versao, tp.prioridade, tp.ativo, tp.created_at, tp.updated_at, 0 as nivel_hierarquia FROM public.tabela_prestador tp WHERE tp.ativo = true`);
    } catch (e3) {
      const pc = 'prestador_id';
      await pool.query(`CREATE VIEW public.vw_hierarquia_tabelas AS SELECT 'tabelas_valores' as tipo, t.id, t.nome, t.cliente, t.tipo_veiculo, t.valor_base, t.franquia_km, t.valor_km_excedente, t.percentual_prestador, t.universal, t.data_inicio, t.data_fim, t.versao, t.prioridade, t.ativo, t.created_at, t.updated_at, CASE WHEN t.universal THEN 3 WHEN t.cliente IS NOT NULL AND t.data_inicio IS NOT NULL THEN 1 WHEN t.cliente IS NOT NULL THEN 2 ELSE 4 END as nivel_hierarquia FROM public.tabelas_valores t WHERE t.ativo = true`);
    }
    const { rows: hv } = await pool.query(`SELECT COUNT(*) as c FROM public.vw_hierarquia_tabelas`);
    check('View vw_hierarquia_tabelas criada', true, `${hv[0].c} registros`);
  }

  // SECTION 5: Test inserting with new fields
  console.log('\n🧪 Teste 3: INSERT com novos campos...');
  const testTabId = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO public.tabelas_valores (id, nome, cliente, tipo_veiculo, valor_base, franquia_km, valor_km_excedente, percentual_prestador, universal, ativo, versao, prioridade, data_inicio)
       VALUES ($1::text::uuid, 'Tabela Teste M108G', 'cliente_teste', 'vuc', 500, 50, 7, 80, false, true, 1, 10, CURRENT_DATE)`,
      [testTabId]);
    check('Inserir tabela com versao/prioridade', true, 'ok');

    const { rows: tv } = await pool.query(`SELECT versao, prioridade FROM public.tabelas_valores WHERE id = $1::text::uuid`, [testTabId]);
    check('versao = 1', tv.length > 0 && Number(tv[0].versao) === 1, String(tv[0]?.versao));
    check('prioridade = 10', tv.length > 0 && Number(tv[0].prioridade) === 10, String(tv[0]?.prioridade));

    const { rows: hv2 } = await pool.query(`SELECT nivel_hierarquia FROM public.vw_hierarquia_tabelas WHERE id = $1::text::uuid`, [testTabId]);
    check('Hierarquia nivel 1 (cliente + vigência)', hv2.length > 0 && Number(hv2[0].nivel_hierarquia) === 1, String(hv2[0]?.nivel_hierarquia));

    await pool.query(`DELETE FROM public.tabelas_valores WHERE id = $1::text::uuid`, [testTabId]);
  } catch (e) { check('Inserir tabela com versao/prioridade', false, e.message.slice(0, 100)); }

  // SECTION 6
  console.log('\n🧪 Teste 4: Tabela prestador com vigência...');
  const testTpId = crypto.randomUUID();
  const { rows: prest } = await pool.query("SELECT id, nome_completo FROM public.prestadores WHERE status='ativo' LIMIT 1");
  if (prest.length > 0) {
    try {
      // tabela_prestador NÃO tem prestador_id FK. O match é por nome.
      await pool.query(
        `INSERT INTO public.tabela_prestador (id, nome, tipo_veiculo, regiao, valor_minimo, km_incluso, valor_km, ativo, versao, prioridade, data_inicio)
         VALUES ($1, 'Tabela Prestador Teste', 'vuc', 'SP', 300, 40, 5, true, 1, 5, CURRENT_DATE)`,
        [testTpId]);
      check('Inserir tabela prestador com vigência', true, 'ok');

      const { rows: tp } = await pool.query(`SELECT versao, prioridade FROM public.tabela_prestador WHERE id = $1::text::uuid`, [testTpId]);
      check('versao tp = 1', tp.length > 0 && Number(tp[0].versao) === 1, String(tp[0]?.versao));
      check('prioridade tp = 5', tp.length > 0 && Number(tp[0].prioridade) === 5, String(tp[0]?.prioridade));

      await pool.query(`DELETE FROM public.tabela_prestador WHERE id = $1::text::uuid`, [testTpId]);
    } catch (e) {
      check('Inserir tabela prestador', false, (e.message || 'erro desconhecido').slice(0, 150));
      console.log('   FULL ERROR:', e.message);
    }
  }

  // Result
  console.log('\n' + '═'.repeat(65));
  console.log(`RESULTADO: ${ok} ✅ / ${fail} ❌`);
  await pool.end();
  if (fail > 0) process.exit(1);
}
main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
