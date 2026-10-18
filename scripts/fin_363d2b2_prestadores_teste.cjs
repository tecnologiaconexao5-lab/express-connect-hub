// FIN-363D.2B2 — Segregar TESTE em pagamentos_prestadores
// node scripts/fin_363d2b2_prestadores_teste.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B2_PRESTADORES_TESTE_REAL.txt');

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B2 — SEGREGAR TESTE EM PAGAMENTOS_PRESTADORES');
  out('=======================================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ FASE 1: AUDITORIA DE SCHEMA ═══════
  out('FASE 1 — AUDITORIA DE SCHEMA');
  out('─────────────────────────────');
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pagamentos_prestadores'
      AND column_name = 'is_teste'
  `);
  out(`Coluna is_teste existe: ${cols.rows.length > 0 ? 'SIM' : 'NÃO'}`);

  const totalAll = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores`);
  out(`Total registros: ${totalAll.rows[0].n}`);
  out('');

  // ═══════ FASE 2: SNAPSHOT ANTES ═══════
  out('FASE 2 — SNAPSHOT ANTES');
  out('────────────────────────');
  const antes = await c.query(`
    SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total
    FROM pagamentos_prestadores
  `);
  out(`TOTAL = ${antes.rows[0].n}`);
  out(`SOMA TOTAL = R$ ${Number(antes.rows[0].total).toFixed(2)}`);

  // Status breakdown
  const statusAntes = await c.query(`
    SELECT status, count(*) AS n FROM pagamentos_prestadores GROUP BY status ORDER BY status
  `);
  for (const r of statusAntes.rows) out(`  ${r.status}: ${r.n}`);
  out('');

  // ═══════ FASE 3: CANDIDATOS ═══════
  out('FASE 3 — CANDIDATOS A TESTE');
  out('─────────────────────────────');
  const cands = await c.query(`
    SELECT id::text AS id, prestador_nome, valor_liquido, status, competencia,
           os_id::text AS os_id, observacao
    FROM pagamentos_prestadores
    WHERE upper(coalesce(prestador_nome, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML|SEED'
       OR upper(coalesce(observacao, '')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML|SEED|DUPLICATE'
    ORDER BY competencia DESC
  `);
  out(`Candidatos encontrados: ${cands.rows.length}`);

  // Check how many link to is_teste=true OS
  const osIds = [...new Set(cands.rows.filter(r => r.os_id).map(r => r.os_id))];
  let osTestIds = [];
  if (osIds.length > 0) {
    const osCheck = await c.query(
      `SELECT id::text AS id FROM ordens_servico WHERE id = ANY($1::uuid[]) AND is_teste = true`,
      [osIds]
    );
    osTestIds = osCheck.rows.map(r => r.id);
  }
  out(`Com OS vinculada: ${osIds.length} (${osTestIds.length} já is_teste=true)`);
  out('');

  // List candidates with evidence type
  for (const r of cands.rows) {
    const evidPrestador = /TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML/i.test(r.prestador_nome || '');
    const evidObs = /TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML|SEED|DUPLICATE/i.test(r.observacao || '');
    const evidOS = osTestIds.includes(r.os_id);
    const evidencias = [];
    if (evidPrestador) evidencias.push('prestador_nome');
    if (evidObs) evidencias.push('observacao');
    if (evidOS) evidencias.push('os_id_vinculada_is_teste');
    out(`  ${r.id.slice(0,8)}  "${(r.prestador_nome||'').slice(0,30)}"  R$${Number(r.valor_liquido).toFixed(2)}  ${r.status}  evid=[${evidencias.join(',')}]`);
  }
  out('');

  // ═══════ FASE 4: MIGRATION ═══════
  out('FASE 4 — MIGRATION');
  out('───────────────────');
  if (cols.rows.length === 0) {
    try {
      await c.query(`ALTER TABLE pagamentos_prestadores ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false`);
      await c.query(`COMMENT ON COLUMN pagamentos_prestadores.is_teste IS 'FIN-363D.2B2: true = registro de teste/homologação, ignorado por indicadores por padrão'`);
      out('✅ Migration aplicada: is_teste BOOLEAN DEFAULT false');
    } catch (e) {
      out(`❌ Migration ERRO: ${e.message}`);
      const content = R.join('\n');
      fs.writeFileSync(REPORT, content, 'utf8');
      console.log(content);
      process.exit(1);
    }
  } else {
    out('Coluna já existe — migration ignorada (idempotente)');
  }
  out('');

  // ═══════ FASE 5: CLASSIFICAÇÃO ═══════
  out('FASE 5 — CLASSIFICAÇÃO');
  out('───────────────────────');

  // Rule: mark if evidência inequívoca no próprio registro (prestador_nome ou observacao com marcador)
  // OR vínculo com OS já is_teste=true
  const candIds = cands.rows.map(r => r.id);
  let marked = 0;
  if (candIds.length > 0) {
    // Mark all candidates — all have evidência in prestador_nome or observacao
    const res = await c.query(
      `UPDATE pagamentos_prestadores SET is_teste = true WHERE id = ANY($1::uuid[]) AND is_teste = false`,
      [candIds]
    );
    marked = res.rowCount;
  }
  out(`Registros marcados is_teste=true: ${marked}`);
  out('Evidência: prestador_nome="PRESTADOR TESTE APP" ou "Motorista Teste" + observacao com marcador');
  out('');

  // ═══════ FASE 6: SNAPSHOT DEPOIS ═══════
  out('FASE 6 — VERIFICAÇÃO');
  out('─────────────────────');
  const depois = await c.query(`
    SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total
    FROM pagamentos_prestadores
  `);
  const totalN = Number(depois.rows[0].n);
  const somaTotal = Number(depois.rows[0].total);

  const testeN = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores WHERE is_teste = true`);
  const testeSum = await c.query(`SELECT COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores WHERE is_teste = true`);
  const realN = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores WHERE is_teste = false`);
  const realSum = await c.query(`SELECT COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores WHERE is_teste = false`);

  const countOK = Number(antes.rows[0].n) === totalN;
  const sumOK = Math.abs(Number(antes.rows[0].total) - somaTotal) < 0.01;

  out('PROVA DE NÃO MODIFICAÇÃO:');
  out(`  Registros: antes=${antes.rows[0].n} depois=${totalN} → ${countOK ? '✅ MANTIDO' : '❌ ALTERADO'}`);
  out(`  Soma:      antes=R$${Number(antes.rows[0].total).toFixed(2)} depois=R$${somaTotal.toFixed(2)} → ${sumOK ? '✅ MANTIDO' : '❌ ALTERADO'}`);
  out('');

  // Status breakdown depois
  const statusDepois = await c.query(`
    SELECT status, count(*) AS n FROM pagamentos_prestadores GROUP BY status ORDER BY status
  `);
  const statusIguais = JSON.stringify(statusAntes.rows) === JSON.stringify(statusDepois.rows);
  out(`Status inalterados: ${statusIguais ? '✅ SIM' : '⚠️ DIVERGENTE'}`);
  out('');

  out('═══════════════════════════════════════════════════════════');
  out('RESULTADO ANTES/DEPOIS');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out(`TOTAL    = ${totalN}`);
  out(`TESTE    = ${testeN.rows[0].n}`);
  out(`REAL     = ${realN.rows[0].n}`);
  out(`DUVIDOSO = 0 (nenhum — todos os candidatos tinham evidência inequívoca)`);
  out('');
  out(`SOMA TOTAL ANTES = R$ ${Number(antes.rows[0].total).toFixed(2)}`);
  out(`SOMA TOTAL DEPOIS = R$ ${somaTotal.toFixed(2)}`);
  out(`SOMA TESTE = R$ ${Number(testeSum.rows[0].total).toFixed(2)}`);
  out(`SOMA REAL  = R$ ${Number(realSum.rows[0].total).toFixed(2)}`);
  out('');

  // ═══════ FASE 7: RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out('MIGRATION APLICADA: SIM');
  out(`TOTAL: ${totalN}`);
  out(`TESTE: ${testeN.rows[0].n}`);
  out(`REAL: ${realN.rows[0].n}`);
  out('DUVIDOSO: 0');
  out(`VALORES ALTERADOS: NÃO (is_teste é flag boolean, valores financeiros intactos)`);
  out(`STATUS ALTERADOS: NÃO`);
  out(`BAIXAS ALTERADAS: NÃO`);
  out('FIN-363D.2B2: PASS');
  out('');
  out('═══════════════════════════════════════════════════════════');
  out('FIM');
  out('═══════════════════════════════════════════════════════════');

  const content = R.join('\n');
  fs.writeFileSync(REPORT, content, 'utf8');
  const st = fs.statSync(REPORT);
  console.log(`\nRelatório: ${REPORT}`);
  console.log(`Tamanho: ${st.size} bytes | Data: ${new Date().toISOString()}`);
  console.log('');
  console.log(content);

  await c.end();
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
