const { Client } = require('pg');

const connectionString = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

let passed = 0;
let failed = 0;

function ok(name, condition, detail) {
  if (condition) {
    console.log('  PASS: ' + name);
    passed++;
  } else {
    console.log('  FAIL: ' + name + (detail ? ' — ' + detail : ''));
    failed++;
  }
}

async function run() {
  const c = new Client({ connectionString });
  await c.connect();

  console.log('=== FASE 5: PROVA DE INTEGRIDADE (8 CENARIOS) ===\n');

  // Get a real candidato from recrutamento_candidatos
  const candidatos = await c.query('SELECT id, nome FROM public.recrutamento_candidatos LIMIT 1');
  const candidatoId = candidatos.rows[0]?.id;
  console.log('Candidato de teste:', candidatoId, candidatos.rows[0]?.nome);

  // -------------------------------------------------------
  // CENARIO 1: candidato valido → documentos vinculados ao candidato correto
  // -------------------------------------------------------
  console.log('\n--- CENARIO 1: candidato valido → docs vinculados ao candidato correto ---');
  await c.query('BEGIN');
  try {
    const testDoc = await c.query(`
      INSERT INTO public.candidato_documentos (candidato_id, tipo, status)
      VALUES ($1, 'CNH', 'pendente')
      RETURNING id, candidato_id, tipo, status
    `, [candidatoId]);
    ok('Insert OK', testDoc.rows.length === 1);
    ok('Candidato ID correto', testDoc.rows[0].candidato_id === candidatoId);
    ok('Tipo correto', testDoc.rows[0].tipo === 'CNH');
    ok('Status default pendente', testDoc.rows[0].status === 'pendente');

    // Verify FK lookup
    const lookup = await c.query(`
      SELECT cd.id, rc.nome FROM public.candidato_documentos cd
      JOIN public.recrutamento_candidatos rc ON rc.id = cd.candidato_id
      WHERE cd.id = $1
    `, [testDoc.rows[0].id]);
    ok('FK join funciona', lookup.rows.length === 1);
    ok('FK aponta para candidato correto', lookup.rows[0].nome === candidatos.rows[0].nome);

    await c.query('ROLLBACK'); // clean up test data
    ok('Cleanup (rollback)', true);
  } catch (e) {
    await c.query('ROLLBACK');
    ok('CENARIO 1', false, e.message);
  }

  // -------------------------------------------------------
  // CENARIO 2: candidato inexistente → documento não pode ficar órfão
  // -------------------------------------------------------
  console.log('\n--- CENARIO 2: candidato inexistente → FK bloqueia inserção ---');
  await c.query('BEGIN');
  try {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await c.query(`
      INSERT INTO public.candidato_documentos (candidato_id, tipo, status)
      VALUES ($1, 'CNH', 'pendente')
    `, [fakeId]);
    ok('FK bloqueia órfão', false, 'INSERT succeeded when it should have failed');
  } catch (e) {
    ok('FK bloqueia órfão', e.message.includes('foreign key') || e.message.includes('violates'));
  }
  await c.query('ROLLBACK');

  // -------------------------------------------------------
  // CENARIO 3: requisitos incompletos → não liberar APP
  // -------------------------------------------------------
  console.log('\n--- CENARIO 3: requisitos incompletos → liberado_app = false ---');
  // Check prestadores with liberado_app = true but incomplete docs
  const incompleteLib = await c.query(`
    SELECT COUNT(*) as cnt FROM public.prestadores
    WHERE liberado_app = true AND (status IS NULL OR status != 'ativo')
  `);
  ok('Nenhum prestador liberado sem status ativo', parseInt(incompleteLib.rows[0].cnt) === 0,
    'Found ' + incompleteLib.rows[0].cnt + ' prestadores with liberado_app=true but status != ativo');

  // -------------------------------------------------------
  // CENARIO 4: documentação inválida/pendente → não liberar APP
  // -------------------------------------------------------
  console.log('\n--- CENARIO 4: documentação pendente → não liberar APP ---');
  // documentos_prestadores has no status column — check that prestadores without
  // any documents in documentos_prestadores are not liberado_app = true
  const noDocsLiberados = await c.query(`
    SELECT COUNT(*) as cnt FROM public.prestadores p
    WHERE p.liberado_app = true
    AND NOT EXISTS (
      SELECT 1 FROM public.documentos_prestadores dp
      WHERE dp.prestador_id = p.id
    )
  `);
  ok('Prestadores liberados SEM documentos verificados', parseInt(noDocsLiberados.rows[0].cnt) === 0,
    'Found ' + noDocsLiberados.rows[0].cnt + ' prestadores with liberado_app=true and NO docs in documentos_prestadores');

  // -------------------------------------------------------
  // CENARIO 5: fluxo aprovado → somente caminho canônico pode liberar
  // -------------------------------------------------------
  console.log('\n--- CENARIO 5: caminho canonico controla liberado_app ---');
  // Verify conversaoCandidatoService uses statusOperacional === 'ativo'
  const fs = require('fs');
  const path = require('path');
  const conversaoPath = path.join(__dirname, '..', 'src', 'modules', 'recrutamento', 'services', 'conversaoCandidatoService.ts');
  const conversao = fs.readFileSync(conversaoPath, 'utf8');
  ok('conversaoCandidatoService: liberado_app condicional', conversao.includes("liberado_app: statusOperacional === 'ativo'"),
    'Must use statusOperacional === ativo');

  // Verify prestadoresService also uses conditional
  const prestPath = path.join(__dirname, '..', 'src', 'modules', 'recrutamento', 'services', 'prestadoresService.ts');
  const prest = fs.readFileSync(prestPath, 'utf8');
  const liberadoTrueMatches = prest.match(/liberado_app:\s*true/g);
  ok('prestadoresService: sem liberado_app: true hardcoded', !liberadoTrueMatches || liberadoTrueMatches.length === 0,
    'Found ' + (liberadoTrueMatches?.length || 0) + ' hardcoded liberado_app: true');

  // -------------------------------------------------------
  // CENARIO 6: ON DELETE CASCADE funciona
  // -------------------------------------------------------
  console.log('\n--- CENARIO 6: ON DELETE CASCADE ---');
  // Verify FK has CASCADE
  const fkInfo = await c.query(`
    SELECT rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'candidato_documentos'
    AND tc.constraint_name = 'candidato_documentos_candidato_id_rc_fkey'
  `);
  ok('FK tem ON DELETE CASCADE', fkInfo.rows.length > 0 && fkInfo.rows[0].delete_rule === 'CASCADE',
    'delete_rule=' + (fkInfo.rows[0]?.delete_rule || 'NOT FOUND'));

  // -------------------------------------------------------
  // CENARIO 7: não há duplicação indevida de documentos
  // -------------------------------------------------------
  console.log('\n--- CENARIO 7: sem duplicacao indevida ---');
  const dupes = await c.query(`
    SELECT candidato_id, tipo, COUNT(*) as cnt
    FROM public.candidato_documentos
    GROUP BY candidato_id, tipo
    HAVING COUNT(*) > 1
  `);
  ok('Sem documentos duplicados', dupes.rows.length === 0,
    'Found ' + dupes.rows.length + ' duplicate groups');

  // -------------------------------------------------------
  // CENARIO 8: divergência tabela canônica vs JSONB
  // -------------------------------------------------------
  console.log('\n--- CENARIO 8: divergencia tabela vs JSONB ---');
  // Verify candidato_documentos has columns that JSONB doesn't
  const cdCols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='candidato_documentos' AND table_schema='public'");
  const colNames = cdCols.rows.map(r => r.column_name);
  ok('candidato_documentos tem arquivo_url', colNames.includes('arquivo_url'),
    'arquivo_url present in candidato_documentos but absent from JSONB');
  ok('candidato_documentos tem dados_extraidos', colNames.includes('dados_extraidos'),
    'dados_extraidos present in candidato_documentos but absent from JSONB');
  ok('candidato_documentos NÃO tem nome', !colNames.includes('nome'),
    'nome is in JSONB, not in candidato_documentos');
  ok('candidato_documentos NÃO tem dataValidade', !colNames.includes('dataValidade'),
    'dataValidade is in JSONB, not in candidato_documentos');

  // Verify recrutamento_candidatos.documentos JSONB exists
  const rcJsonb = await c.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='recrutamento_candidatos' AND column_name='documentos' AND data_type='jsonb') as has");
  ok('recrutamento_candidatos.documentos JSONB existe', rcJsonb.rows[0].has);

  // Summary
  console.log('\n=== FASE 5 RESULTADO ===');
  console.log('PASS: ' + passed);
  console.log('FAIL: ' + failed);
  console.log('TOTAL: ' + (passed + failed));

  await c.end();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
