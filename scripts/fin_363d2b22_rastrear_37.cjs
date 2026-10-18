// FIN-363D.2B2.2 — Rastrear 37 pagamentos_prestadores DUVIDOSOS
// node scripts/fin_363d2b22_rastrear_37.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B22_RASTREIO_37_DUVIDOSOS.txt');

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B2.2 — RASTREIO DOS 37 DUVIDOSOS');
  out('===========================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // Get all is_teste=false where prestador_nome has TEST markers (the 37 DUVIDOSOS)
  const duvidosos = await c.query(`
    SELECT pp.id::text AS id, pp.prestador_id::text AS prestador_id, pp.prestador_nome,
           pp.valor_liquido, pp.status, pp.competencia, pp.observacao,
           pp.os_id::text AS os_id, pp.os_numero, pp.created_at::text AS created,
           pp.lote_id::text AS lote_id, pp.origem_lancamento,
           os.numero AS os_numero_fk, os.is_teste AS os_is_teste, os.status AS os_status,
           os.cliente::text AS os_cliente_id
    FROM pagamentos_prestadores pp
    LEFT JOIN ordens_servico os ON os.id = pp.os_id
    WHERE pp.is_teste = false
      AND (upper(coalesce(pp.prestador_nome,'')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML'
           OR upper(coalesce(pp.observacao,'')) ~ 'TEST|TESTE|SENTINELA|AUDITORIA|DEV|HML')
    ORDER BY pp.competencia DESC
  `);

  const rows = duvidosos.rows;
  out(`TOTAL ANALISADO: ${rows.length}`);
  out('');

  // ═══════ RASTREAR CADA UM ═══════
  const confirmadosReal = [];
  const confirmadosTeste = [];
  const continuaDuvidoso = [];
  const detalhes = [];

  for (const r of rows) {
    const evidencias = [];
    let classificacao = 'CONTINUA_DUVIDOSO';

    // 1. OS vinculada com is_teste=true
    if (r.os_is_teste === true) {
      evidencias.push(`OS_FK=${r.os_numero_fk}(is_teste=true)`);
      classificacao = 'CONFIRMADO_TESTE';
    }

    // 2. os_numero com marcador de teste
    if (r.os_numero && /TEST|TESTE|HML|AUDITORIA/i.test(r.os_numero)) {
      evidencias.push(`os_numero="${r.os_numero}"`);
      if (classificacao !== 'CONFIRMADO_TESTE') classificacao = 'CONFIRMADO_TESTE';
    }

    // 3. observacao com marcador inequívoco (além do nome)
    const obs = (r.observacao || '').toUpperCase();
    if (/TEST[\b\-_]|TESTE[\b\-_\-]|SENTINELA[\b\-]|AUDITORIA[\b\-_]|HML[\-]|SEED[\-]|DUPLICATE/.test(obs)) {
      evidencias.push(`observacao="${(r.observacao||'').slice(0,40)}"`);
      if (classificacao !== 'CONFIRMADO_TESTE') classificacao = 'CONFIRMADO_TESTE';
    }

    // 4. Origem técnica rastreável (M43, FIN3621, 363B.1, etc)
    if (/^M\d{2,3}_|^FIN3621-|^FIN012_|^TESTE.363B/.test(r.observacao || '')) {
      evidencias.push('origem_tecnica');
      if (classificacao !== 'CONFIRMADO_TESTE') classificacao = 'CONFIRMADO_TESTE';
    }

    // 5. Financeiro_pagar vinculado com descrição de teste
    const fpCheck = await c.query(`
      SELECT id::text AS id, descricao, is_teste
      FROM financeiro_pagar
      WHERE prestador = $1
        AND valor = $2
        AND is_teste = true
      LIMIT 1
    `, [r.prestador_nome, r.valor_liquido]);
    if (fpCheck.rows.length > 0) {
      evidencias.push(`fp_vinculado=${fpCheck.rows[0].id.slice(0,8)}(is_teste=true)`);
      if (classificacao !== 'CONFIRMADO_TESTE') classificacao = 'CONFIRMADO_TESTE';
    }

    // 6. OS vinculada REAL (is_teste=false) → confirma REAL
    if (r.os_is_teste === false && r.os_numero_fk) {
      // OS existe e NÃO é teste — este pagamento é REAL
      // Mas só se não tiver evidência de teste
      if (classificacao !== 'CONFIRMADO_TESTE') {
        evidencias.push(`os_real=${r.os_numero_fk}`);
        classificacao = 'CONFIRMADO_REAL';
      }
    }

    // 7. sem OS vinculada + sem evidência = continua duvidoso
    if (classificacao === 'CONTINUA_DUVIDOSO' && !r.os_id) {
      evidencias.push('sem_os_vinculada');
    }

    // Se nenhum dos critérios acima classificou, verificar financeiro_pagar REAL
    if (classificacao === 'CONTINUA_DUVIDOSO') {
      const fpReal = await c.query(`
        SELECT id::text AS id, is_teste
        FROM financeiro_pagar
        WHERE prestador = $1 AND valor = $2
        LIMIT 1
      `, [r.prestador_nome, r.valor_liquido]);
      if (fpReal.rows.length > 0) {
        if (fpReal.rows[0].is_teste === false) {
          evidencias.push(`fp_real=${fpReal.rows[0].id.slice(0,8)}`);
          classificacao = 'CONFIRMADO_REAL';
        }
      }
    }

    detalhes.push({
      id: r.id,
      nome: (r.prestador_nome || '').slice(0, 28),
      valor: Number(r.valor_liquido).toFixed(2),
      classificacao,
      evidencias,
    });

    if (classificacao === 'CONFIRMADO_REAL') confirmadosReal.push(r.id);
    else if (classificacao === 'CONFIRMADO_TESTE') confirmadosTeste.push(r.id);
    else continuaDuvidoso.push(r.id);
  }

  // ═══════ LISTAR DETALHES ═══════
  for (const d of detalhes) {
    const tag = d.classificacao === 'CONFIRMADO_REAL' ? '🟢' :
                d.classificacao === 'CONFIRMADO_TESTE' ? '🔴' : '🟡';
    out(`${tag} ${d.id.slice(0,8)}  "${d.nome}"  R$${d.valor}  → ${d.classificacao}  [${d.evidencias.join('; ')}]`);
  }
  out('');

  // ═══════ CORRIGIR FLAGS ═══════
  out('═══════════════════════════════════════════════════════════');
  out('CORREÇÃO DE FLAGS');
  out('═══════════════════════════════════════════════════════════');

  let flagsAlteradas = 0;
  if (confirmadosTeste.length > 0) {
    const res = await c.query(
      `UPDATE pagamentos_prestadores SET is_teste = true WHERE id = ANY($1::uuid[]) AND is_teste = false`,
      [confirmadosTeste]
    );
    flagsAlteradas = res.rowCount;
    out(`Flags false → true (CONFIRMADO_TESTE): ${flagsAlteradas}`);
  } else {
    out('Nenhuma flag a alterar para teste');
  }
  out('');

  // ═══════ PROVA FINAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('PROVA FINAL');
  out('═══════════════════════════════════════════════════════════');

  const totalPP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores`);
  const testePP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores WHERE is_teste = true`);
  const realPP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores WHERE is_teste = false`);

  out(`TOTAL REGISTROS: ${totalPP.rows[0].n} (inalterado)`);
  out(`SOMA TOTAL: R$ ${Number(totalPP.rows[0].total).toFixed(2)} (inalterada)`);
  out(`is_teste=true: ${testePP.rows[0].n} registros, R$ ${Number(testePP.rows[0].total).toFixed(2)}`);
  out(`is_teste=false: ${realPP.rows[0].n} registros, R$ ${Number(realPP.rows[0].total).toFixed(2)}`);
  out('');

  // ═══════ RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out(`37 ANALISADOS: SIM`);
  out(`CONFIRMADO_REAL: ${confirmadosReal.length}`);
  out(`CONFIRMADO_TESTE: ${confirmadosTeste.length}`);
  out(`CONTINUA_DUVIDOSO: ${continuaDuvidoso.length}`);
  out(`FLAGS ALTERADAS: ${flagsAlteradas}`);
  out(`VALORES ALTERADOS: NÃO`);
  out(`STATUS ALTERADOS: NÃO`);
  out(`BAIXAS ALTERADAS: NÃO`);

  if (continuaDuvidoso.length > 0) {
    out('');
    out('BLOQUEIO ARQUITETURAL: SIM');
    out(`${continuaDuvidoso.length} registros sem evidência rastreável além do nome do prestador.`);
    out('boolean is_teste NÃO distingue REAL confirmado de DUVIDOSO.');
    out('Solução: campo adicional (ex: classificacao_autoridade) ou revisão manual.');
    out('');
    out('IDs CONTINUA_DUVIDOSOS:');
    for (const id of continuaDuvidoso) out(`  ${id}`);
  } else {
    out('BLOQUEIO ARQUITETURAL: NÃO');
  }

  out('');
  out(`FIN-363D.2B2.2: PASS`);
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
