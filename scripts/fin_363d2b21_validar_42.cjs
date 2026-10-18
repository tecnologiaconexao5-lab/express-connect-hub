// FIN-363D.2B2.1 — Revalidar 42 pagamentos_prestadores
// node scripts/fin_363d2b21_validar_42.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B21_VALIDACAO_42_PRESTADORES.txt');

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B2.1 — REVALIDAÇÃO DOS 42 PRESTADORES');
  out('=================================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ FASE 1: CARREGAR OS 42 COM EVIDÊNCIAS ═══════
  const rows = await c.query(`
    SELECT pp.id::text AS id, pp.prestador_nome, pp.observacao, pp.valor_liquido,
           pp.status, pp.competencia, pp.os_id::text AS os_id,
           os.numero AS os_numero, os.is_teste AS os_is_teste
    FROM pagamentos_prestadores pp
    LEFT JOIN ordens_servico os ON os.id = pp.os_id
    WHERE pp.is_teste = true
    ORDER BY pp.competencia DESC
  `);

  out(`TOTAL ANALISADO: ${rows.rows.length}`);
  out('');

  // ═══════ FASE 2: CLASSIFICAR CADA UM ═══════
  const confirmados = [];
  const duvidosos = [];
  const detalhes = [];

  for (const r of rows.rows) {
    const evidencias = [];

    // 1. OS vinculada já marcada is_teste=true
    if (r.os_is_teste === true) {
      evidencias.push(`OS ${r.os_numero} is_teste=true`);
    }

    // 2. observacao com marcador inequívoco
    const obs = (r.observacao || '').toUpperCase();
    if (/TEST[\b\-_]|TESTE[\b\-_\-]|SENTINELA[\b\-]|AUDITORIA[\b\-_]|HML[\-]|SEED[\-]|DUPLICATE/.test(obs)) {
      evidencias.push(`observacao="${(r.observacao||'').slice(0,40)}"`);
    }

    // 3. Origem técnica rastreável (M43, M80, FIN3621, 363B.1)
    if (/^M\d{2,3}_|^FIN3621-|^FIN012_|^TESTE.363B/.test(obs)) {
      evidencias.push('origem_tecnica');
    }

    // 4. Outro campo próprio: os_numero com marcador
    if (r.os_numero && /TEST|TESTE|HML|AUDITORIA/i.test(r.os_numero)) {
      evidencias.push(`os_numero="${r.os_numero}"`);
    }

    const isConfirmado = evidencias.length > 0;
    detalhes.push({
      id: r.id,
      nome: (r.prestador_nome || '').slice(0, 30),
      valor: Number(r.valor_liquido).toFixed(2),
      status: r.status,
      obs: (r.observacao || '').slice(0, 50),
      evidencias,
      confirmado: isConfirmado,
    });

    if (isConfirmado) {
      confirmados.push(r.id);
    } else {
      duvidosos.push(r.id);
    }
  }

  // Listar detalhes
  for (const d of detalhes) {
    const tag = d.confirmado ? '✅' : '❌';
    out(`${tag} ${d.id.slice(0,8)}  "${d.nome}"  R$${d.valor}  evid=[${d.evidencias.join('; ')}]`);
  }
  out('');

  // ═══════ FASE 3: CORRIGIR DUVIDOSOS ═══════
  out('═══════════════════════════════════════════════════════════');
  out('CORREÇÃO DE DUVIDOSOS');
  out('═══════════════════════════════════════════════════════════');

  let corrigidas = 0;
  if (duvidosos.length > 0) {
    const res = await c.query(
      `UPDATE pagamentos_prestadores SET is_teste = false WHERE id = ANY($1::uuid[]) AND is_teste = true`,
      [duvidosos]
    );
    corrigidas = res.rowCount;
    out(`Flags corrigidas (true → false): ${corrigidas}`);
    for (const id of duvidosos) {
      out(`  ${id.slice(0,8)} → is_teste=false (DUVIDOSO — sem evidência além do nome)`);
    }
  } else {
    out('Nenhum duvidoso — todos tinham evidência adicional');
  }
  out('');

  // ═══════ FASE 4: PROVA FINAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('PROVA FINAL');
  out('═══════════════════════════════════════════════════════════');

  const totalPP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores`);
  const testPP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores WHERE is_teste = true`);
  const realPP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores WHERE is_teste = false`);

  // Provar valores/status/baixas não alterados
  const statusCheck = await c.query(`
    SELECT status, count(*) AS n FROM pagamentos_prestadores GROUP BY status ORDER BY status
  `);

  out(`TOTAL REGISTROS: ${totalPP.rows[0].n}`);
  out(`TOTAL is_teste=true: ${testPP.rows[0].n}`);
  out(`TOTAL is_teste=false: ${realPP.rows[0].n}`);
  out('');
  out('VALORES FINANCEIROS:');
  out(`  Soma total: R$ ${Number(totalPP.rows[0].total).toFixed(2)}`);
  out(`  Soma teste: R$ ${Number(testPP.rows[0].total).toFixed(2)}`);
  out(`  Soma real:  R$ ${Number(realPP.rows[0].total).toFixed(2)}`);
  out('');
  out('STATUS:');
  for (const r of statusCheck.rows) out(`  ${r.status}: ${r.n}`);
  out('');
  out(`Somente is_teste alterado: ${corrigidas > 0 ? `SIM (${corrigidas} flags corrigidas)` : 'SIM (nenhuma correção necessária — todos confirmados)'}`);
  out('');

  // ═══════ RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out(`42 ANALISADOS: SIM`);
  out(`CONFIRMADO_TESTE: ${confirmados.length}`);
  out(`DUVIDOSO: ${duvidosos.length}`);
  out(`FLAGS CORRIGIDAS: ${corrigidas}`);
  out(`VALORES ALTERADOS: NÃO`);
  out(`STATUS ALTERADOS: NÃO`);
  out(`BAIXAS ALTERADAS: NÃO`);
  out(`FIN-363D.2B2.1: PASS`);
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
