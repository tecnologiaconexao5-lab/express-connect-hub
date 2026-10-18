/**
 * A31B — PROVA READ-ONLY 3: view App, entregas_protocolo, gap romaneio OS
 * NENHUM INSERT/UPDATE/DELETE.
 * Uso: node scripts/a31b_prova_views.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('❌ DATABASE_URL não definida'); process.exit(1); }
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
let passed = 0, failed = 0;
const assert = (c, m) => { if (c) { console.log(`  ✅ ${m}`); passed++; } else { console.log(`  ❌ ${m}`); failed++; } };
const header = (t) => console.log(`\n${'='.repeat(70)}\n${t}\n${'='.repeat(70)}`);

async function main() {
  await client.connect();
  console.log('✅ Conectado (read-only)\n');

  header('1. VIEW vw_app_motorista_operacoes — definição (fonte do romaneio)');
  const { rows: viewDef } = await client.query(`
    SELECT definition FROM pg_views WHERE schemaname='public' AND viewname='vw_app_motorista_operacoes'
  `);
  const def = viewDef[0]?.definition || '';
  // Extrair as linhas que citam romaneio
  const linhas = def.split('\n').filter((l) => /romaneio/i.test(l));
  for (const l of linhas) console.log('   ' + l.trim().slice(0, 140));
  assert(linhas.length > 0, 'Definição da view encontrada e contém romaneio');

  // descobrir de qual fonte a view tira romaneio
  const vq = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='vw_app_motorista_operacoes' ORDER BY ordinal_position`);
  const vcols = vq.rows.map((r) => `${r.column_name}:${r.data_type}`);
  console.log('   Colunas view:', vcols.join(', ').slice(0, 600));
  const comRomaneioView = vcols.some((c) => c.toLowerCase().startsWith('romaneio'));
  assert(comRomaneioView, 'View expõe coluna romaneio');

  header('2. entregas_protocolo — colunas reais');
  const { rows: epCols } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='entregas_protocolo' ORDER BY ordinal_position
  `);
  console.log('   ' + epCols.map((r) => `${r.column_name}:${r.data_type}`).join(', '));
  const epList = epCols.map((r) => r.column_name);
  const vinculoEP = ['alocacao_id', 'ordem_servico_id', 'os_id'].find((c) => epList.includes(c));
  assert(!!vinculoEP, `entregas_protocolo tem vínculo (${vinculoEP})`);

  header('3. POD App (delivery_proofs) × entregas_protocolo via os_id');
  if (vinculoEP === 'os_id') {
    const { rows: cruza } = await client.query(`
      SELECT dp.id AS dp_id, ep.id AS ep_id, dp.os_id, ep.os_id AS ep_os,
             dp.status AS dp_status, ep.status AS ep_status
      FROM public.delivery_proofs dp
      LEFT JOIN public.entregas_protocolo ep ON ep.os_id = dp.os_id
      ORDER BY dp.created_at DESC LIMIT 10
    `);
    let syncOK = 0;
    for (const c of cruza) { if (c.ep_id) syncOK++; console.log(`   dp ${String(c.dp_id).slice(0,8)} → ep ${c.ep_id ? String(c.ep_id).slice(0,8) : 'NENHUM'} | ${c.ep_id ? 'SINCRONIZADO' : 'sem ep'}`); }
    if (cruza.length) assert(syncOK >= 1, `POD do App sincronizado (${syncOK}/${cruza.length})`);
    else { console.log('   (sem delivery_proofs com os_id)'); assert(true, 'Sem dados para comparar'); }
  } else {
    const { rows: cruza } = await client.query(`
      SELECT dp.id AS dp_id, ep.id AS ep_id, dp.operation_id, ep.alocacao_id AS ep_aloc
      FROM public.delivery_proofs dp
      LEFT JOIN public.entregas_protocolo ep ON ep.alocacao_id = dp.operation_id
      ORDER BY dp.created_at DESC LIMIT 10
    `);
    let syncOK = 0;
    for (const c of cruza) { if (c.ep_id) syncOK++; console.log(`   dp ${String(c.dp_id).slice(0,8)} → ep ${c.ep_id ? String(c.ep_id).slice(0,8) : 'NENHUM'} | ${c.ep_id ? 'SINCRONIZADO' : 'sem ep'}`); }
    if (cruza.length) assert(syncOK >= 1, `POD do App sincronizado (${syncOK}/${cruza.length})`);
    else { console.log('   (sem delivery_proofs com operation_id)'); assert(true, 'Sem dados para comparar'); }
  }

  header('4. GAP ROMANEIO — OS com app_romaneio mas os.romaneio vazio (JOIN correto)');
  const { rows: gap } = await client.query(`
    SELECT a.id AS alocacao_id, a.ordem_servico_id AS os_id, os.numero AS os_numero,
           (a.metadata->'app_motorista'->>'romaneio') AS app_romaneio,
           os.romaneio AS os_romaneio
    FROM public.alocacoes_escala a
    JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
    WHERE a.metadata->'app_motorista' ? 'romaneio'
  `);
  console.log(`   Alocações com app_romaneio (com OS): ${gap.length}`);
  for (const g of gap) {
    const sync = g.os_romaneio === g.app_romaneio && !!g.os_romaneio;
    console.log(`   OS ${g.os_numero} | app=${g.app_romaneio} | os.romaneio=${g.os_romaneio || '(vazio)'} | ${sync ? 'SINCRONIZADO' : 'NÃO PROPAGADO'}`);
  }

  header('5. romaneio na OS vs eventos_oficiais (outra fonte)');
  const { rows: evt } = await client.query(`
    SELECT metadata->>'romaneio_numero' AS rom_evento, os.numero AS os_numero
    FROM public.eventos_oficiais e
    LEFT JOIN public.ordens_servico os ON os.id = e.entidade_id
    WHERE e.metadata ? 'romaneio_numero'
    LIMIT 5
  `);
  console.log(`   eventos_oficiais com romaneio_numero: ${evt.length} (amostra)`);
  for (const r of evt) console.log(`   rom_evento=${r.rom_evento} | os=${r.os_numero || '—'}`);

  header('RESUMO PROVA READ-ONLY A31B (VIEWS)');
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error('❌ ERRO:', e.message); process.exit(2); });