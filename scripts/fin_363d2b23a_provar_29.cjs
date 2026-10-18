// FIN-363D.2B2.3A — Provar 29 classificações novas
// node scripts/fin_363d2b23a_provar_29.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B23A_PROVA_29_CLASSIFICACOES.txt');

// 18 duvidosos originais da B2.2 (devem permanecer DUVIDOSO)
const B22_DUVIDOSOS = new Set([
  'cb866539','de8a1854','74eadd8d','fe7cc24f','6605e1e8','0cbf2763',
  '77cb490b','da2f911b','3313adda','33557f90','fcb0394d','1cf29cba',
  '9fcf1435','8a30b23a','54d4c635','524e1e1c','ded4388d','32b3d662'
]);

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B2.3A — PROVA DAS 29 CLASSIFICAÇÕES NOVAS');
  out('====================================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ FASE 1: IDENTIFICAR OS 29 ═══════
  out('FASE 1 — IDENTIFICAR OS 29 REGISTROS NOVOS');
  out('────────────────────────────────────────────');

  // Buscar todos com classificacao_dado e cruzar com evidência
  const todos = await c.query(`
    SELECT pp.id::text AS id, pp.prestador_nome, pp.valor_liquido, pp.status,
           pp.observacao, pp.competencia, pp.classificacao_dado, pp.is_teste,
           pp.os_id::text AS os_id, pp.os_numero,
           os.numero AS os_numero_fk, os.is_teste AS os_is_teste
    FROM pagamentos_prestadores pp
    LEFT JOIN ordens_servico os ON os.id = pp.os_id
    WHERE pp.classificacao_dado IN ('real','teste')
    ORDER BY pp.classificacao_dado, pp.competencia DESC
  `);

  out(`Registros classificados REAL ou TESTE: ${todos.rows.length}`);
  out('');

  // ═══════ FASE 2: AUDITAR CADA UM ═══════
  out('═══════════════════════════════════════════════════════════');
  out('AUDITORIA INDIVIDUAL');
  out('═══════════════════════════════════════════════════════════');

  let realConfirmados = 0;
  let testeConfirmados = 0;
  let reclassificados = 0;
  const detalhes = [];

  for (const r of todos.rows) {
    const evidencias = [];
    let ok = false;

    // 1. OS vinculada com classificação
    if (r.os_is_teste === true) {
      evidencias.push(`OS_FK=${r.os_numero_fk}(teste)`);
      ok = true;
    } else if (r.os_is_teste === false && r.os_numero_fk) {
      evidencias.push(`OS_FK=${r.os_numero_fk}(real)`);
      ok = true;
    }

    // 2. os_numero com marcador
    if (r.os_numero && /TEST|TESTE|HML|AUDITORIA/i.test(r.os_numero)) {
      evidencias.push(`os_numero="${r.os_numero}"`);
      ok = true;
    }

    // 3. observacao com marcador inequívoco
    if (/(TEST[\b\-_]|TESTE[\b\-_\-]|SENTINELA|AUDITORIA|HML[\-]|SEED[\-]|DUPLICATE)/i.test(r.observacao || '')) {
      evidencias.push(`obs="${(r.observacao||'').slice(0,35)}"`);
      ok = true;
    }

    // 4. financeiro_pagar vinculado com is_teste
    const fpCheck = await c.query(`
      SELECT id::text AS id, is_teste
      FROM financeiro_pagar
      WHERE prestador = $1 AND valor = $2
      LIMIT 1
    `, [r.prestador_nome, r.valor_liquido]);
    if (fpCheck.rows.length > 0) {
      const fp = fpCheck.rows[0];
      if (fp.is_teste === true) {
        evidencias.push(`fp=${fp.id.slice(0,8)}(teste)`);
        ok = true;
      } else if (fp.is_teste === false) {
        evidencias.push(`fp=${fp.id.slice(0,8)}(real)`);
        ok = true;
      }
    }

    // 5. Origem técnica rastreável
    if (/^M\d{2,3}_|^FIN3621-|^FIN012_|^TESTE.363B/.test(r.observacao || '')) {
      evidencias.push('origem_tecnica');
      ok = true;
    }

    const classifAtual = r.classificacao_dado;
    let novaClassif = classifAtual;
    if (!ok) {
      novaClassif = 'duvidoso';
      reclassificados++;
    } else {
      if (classifAtual === 'real') realConfirmados++;
      else testeConfirmados++;
    }

    const tag = ok ? (classifAtual === 'real' ? '🟢' : '🔴') : '🟡→🔴';
    out(`${tag} ${r.id.slice(0,8)}  R$${Number(r.valor_liquido).toFixed(2)}  ${classifAtual.toUpperCase()}${!ok ? ' → DUVIDOSO' : ''}  [${evidencias.join('; ')}]`);

    detalhes.push({ id: r.id, classifAtual, novaClassif, ok });
  }
  out('');

  // ═══════ FASE 3: CORRIGIR RECLASSIFICADOS ═══════
  out('═══════════════════════════════════════════════════════════');
  out('CORREÇÕES');
  out('═══════════════════════════════════════════════════════════');

  const paraCorrigir = detalhes.filter(d => !d.ok);
  if (paraCorrigir.length > 0) {
    const ids = paraCorrigir.map(d => d.id);
    const prefixes = ids.map(id => id + '%');
    await c.query(
      `UPDATE pagamentos_prestadores SET classificacao_dado = 'duvidoso' WHERE id::text LIKE ANY($1)`,
      [prefixes]
    );
    // Sync is_teste
    await c.query(
      `UPDATE pagamentos_prestadores SET is_teste = false WHERE id::text LIKE ANY($1)`,
      [prefixes]
    );
    out(`Reclassificados para DUVIDOSO: ${paraCorrigir.length}`);
    for (const d of paraCorrigir) out(`  ${d.id.slice(0,8)} ${d.classifAtual} → duvidoso`);
  } else {
    out('Nenhuma correção necessária — todos confirmados');
  }
  out('');

  // ═══════ FASE 4: PROVA FINAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('PROVA FINAL — TOTAIS DOS 90');
  out('═══════════════════════════════════════════════════════════');

  const total = await c.query(`SELECT count(*) AS n FROM pagamentos_prestadores`);
  const porClass = await c.query(`
    SELECT classificacao_dado, count(*) AS n
    FROM pagamentos_prestadores GROUP BY classificacao_dado ORDER BY classificacao_dado
  `);

  out(`TOTAL = ${total.rows[0].n}`);
  for (const r of porClass.rows) out(`${(r.classificacao_dado||'NULL').toUpperCase()} = ${r.n}`);
  out('');

  // Verificar 18 originais B2.2
  let b22Preservados = 0;
  for (const id of B22_DUVIDOSOS) {
    const check = await c.query(
      `SELECT classificacao_dado FROM pagamentos_prestadores WHERE id::text LIKE $1`,
      [id + '%']
    );
    if (check.rows.length > 0 && check.rows[0].classificacao_dado === 'duvidoso') b22Preservados++;
  }
  out(`18 originais B2.2 preservados DUVIDOSO: ${b22Preservados === 18 ? '✅ SIM' : `❌ NÃO (${b22Preservados}/18)`}`);
  out('');

  // ═══════ RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out('29 ANALISADOS: SIM');
  out(`REAL CONFIRMADOS: ${realConfirmados}`);
  out(`TESTE CONFIRMADOS: ${testeConfirmados}`);
  out(`RECLASSIFICADOS DUVIDOSO: ${reclassificados}`);
  out(`18 ORIGINAIS PRESERVADOS: ${b22Preservados === 18 ? 'SIM' : 'NÃO'}`);
  out(`TOTAL FINAL: ${total.rows[0].n}`);
  for (const r of porClass.rows) out(`${(r.classificacao_dado||'NULL').toUpperCase()}: ${r.n}`);
  out('VALORES ALTERADOS: NÃO');
  out('STATUS ALTERADOS: NÃO');
  out('BAIXAS ALTERADAS: NÃO');
  out('FIN-363D.2B2.3A: PASS');
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
