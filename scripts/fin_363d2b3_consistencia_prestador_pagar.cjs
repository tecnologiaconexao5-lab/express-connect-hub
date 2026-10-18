// FIN-363D.2B3 — Consistência Prestador ↔ Pagar
// node scripts/fin_363d2b3_consistencia_prestador_pagar.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B3_CONSISTENCIA_PRESTADOR_PAGAR.txt');

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B3 — CONSISTÊNCIA PRESTADOR ↔ PAGAR');
  out('===============================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // Helper: pp is_teste + classificacao_dado → canonical class
  function ppClass(pp) {
    if (pp.classificacao_dado) return pp.classificacao_dado;
    return pp.is_teste ? 'teste' : 'real';
  }

  // ═══════ FASE 1: VÍNCULOS DIRETOS (prestador + valor) ═══════
  out('FASE 1 — VÍNCULOS DIRETOS (prestador_nome=prestador, valor_liquido=valor)');
  out('─────────────────────────────────────────────────────────────────────────');

  // Note: financeiro_pagar has is_teste but NOT classificacao_dado
  const vinculos = await c.query(`
    SELECT
      pp.id::text       AS pp_id,
      pp.prestador_nome AS pp_prestador,
      pp.valor_liquido  AS pp_valor,
      pp.classificacao_dado AS pp_classif,
      pp.is_teste       AS pp_is_teste,
      pp.os_id::text    AS pp_os_id,
      pp.os_numero      AS pp_os_numero,
      fp.id::text       AS fp_id,
      fp.prestador      AS fp_prestador,
      fp.valor          AS fp_valor,
      fp.is_teste       AS fp_is_teste,
      fp.os_id          AS fp_os_id_text,
      os.numero         AS os_numero,
      os.is_teste       AS os_is_teste
    FROM pagamentos_prestadores pp
    JOIN financeiro_pagar fp
      ON fp.prestador = pp.prestador_nome
      AND fp.valor = pp.valor_liquido
    LEFT JOIN ordens_servico os ON os.id = pp.os_id
    ORDER BY pp.id
  `);

  out(`Vínculos encontrados: ${vinculos.rows.length}`);
  out('');

  // ═══════ FASE 2: AUDITAR CADA VÍNCULO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('AUDITORIA INDIVIDUAL');
  out('═══════════════════════════════════════════════════════════');

  let auditados = 0;
  let conflitos = 0;
  let corrigidos = 0;
  let naoResolvidos = 0;

  for (const v of vinculos.rows) {
    auditados++;
    // Note: financeiro_pagar has is_teste but NOT classificacao_dado
    const ppC = ppClass(v);
    const fpC = v.fp_is_teste ? 'teste' : 'real';
    const osTeste = v.os_is_teste;

    let conflito = false;
    let evidencia = '';
    let novaPP = ppC;
    let novaFP_is_teste = v.fp_is_teste;

    // Se OS é TESTE → ambos devem ser TESTE
    if (osTeste === true) {
      evidencia = `OS_teste(${v.os_numero})`;
      if (ppC !== 'teste') { novaPP = 'teste'; conflito = true; }
      if (fpC !== 'teste') { novaFP_is_teste = true; conflito = true; }
    }
    // Se OS é REAL (tem numero, is_teste=false)
    else if (osTeste === false && v.os_numero) {
      evidencia = `OS_real(${v.os_numero})`;
      if (ppC === 'teste') { novaPP = 'real'; conflito = true; }
      if (fpC === 'teste') { novaFP_is_teste = false; conflito = true; }
    }
    // Sem OS vinculada: comparar pp vs fp
    else {
      evidencia = 'sem_OS';
      if (ppC === 'teste' && fpC !== 'teste') {
        conflito = true; naoResolvidos++;
      } else if (ppC !== 'teste' && fpC === 'teste') {
        conflito = true; naoResolvidos++;
      }
    }

    const tag = conflito ? '⚠️' : '✅';
    out(`${tag} PP=${v.pp_id.slice(0,8)} FP=${v.fp_id.slice(0,8)} OS=${(v.pp_os_id||'null').slice(0,8)} | pp=${ppC} fp=${fpC}${conflito ? ` → pp=${novaPP} fp=${novaFP_is_teste ? 'teste' : 'real'}` : ''} | ${evidencia}`);

    // Aplicar correções SOMENTE se evidência da OS
    if (conflito && osTeste !== undefined && osTeste !== null) {
      if (novaPP !== ppC) {
        await c.query(`UPDATE pagamentos_prestadores SET classificacao_dado = $1, is_teste = ($1 = 'teste') WHERE id = $2::uuid`, [novaPP, v.pp_id]);
        corrigidos++;
      }
      if (novaFP_is_teste !== v.fp_is_teste) {
        await c.query(`UPDATE financeiro_pagar SET is_teste = $1 WHERE id = $2::uuid`, [novaFP_is_teste, v.fp_id]);
        corrigidos++;
      }
    }
  }
  out('');

  // ═══════ FASE 3: VÍNCULOS POR OS_ID (pagamentos.os_id → financeiro.os_id TEXT) ═══════
  out('═══════════════════════════════════════════════════════════');
  out('VÍNCULOS VIA OS_ID (pp.os_id → fp.os_id text)');
  out('═══════════════════════════════════════════════════════════');

  const viaOS = await c.query(`
    SELECT
      pp.id::text AS pp_id,
      pp.classificacao_dado AS pp_classif,
      pp.is_teste AS pp_is_teste,
      pp.os_id::text AS pp_os_id,
      fp.id::text AS fp_id,
      fp.is_teste AS fp_is_teste,
      fp.os_id AS fp_os_id_text,
      os.numero AS os_numero,
      os.is_teste AS os_is_teste
    FROM pagamentos_prestadores pp
    JOIN financeiro_pagar fp ON fp.os_id = pp.os_id::text
    LEFT JOIN ordens_servico os ON os.id = pp.os_id
    WHERE pp.os_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM financeiro_pagar fp2
        WHERE fp2.prestador = pp.prestador_nome AND fp2.valor = pp.valor_liquido
          AND fp2.id = fp.id
      )
    ORDER BY pp.id
  `);

  out(`Vínculos adicionais via os_id: ${viaOS.rows.length}`);
  let conflitosOS = 0;
  for (const v of viaOS.rows) {
    const osc = v.os_is_teste;
    const ppC = ppClass(v);
    const fpC = v.fp_is_teste ? 'teste' : 'real';
    let conflito = false;

    if (osc === true && (ppC !== 'teste' || fpC !== 'teste')) conflito = true;
    if (osc === false && ((ppC === 'teste' && fpC !== 'teste') || (ppC !== 'teste' && fpC === 'teste'))) conflito = true;

    if (conflito) {
      conflitosOS++;
      out(`⚠️ PP=${v.pp_id.slice(0,8)} FP=${v.fp_id.slice(0,8)} OS=${v.os_numero} | pp=${ppC} fp=${fpC} os_teste=${osc}`);
      // Corrigir com base na OS
      if (osc === true) {
        if (ppC !== 'teste') {
          await c.query(`UPDATE pagamentos_prestadores SET classificacao_dado = 'teste', is_teste = true WHERE id = $1::uuid`, [v.pp_id]);
          corrigidos++;
        }
        if (fpC !== 'teste') {
          await c.query(`UPDATE financeiro_pagar SET is_teste = true WHERE id = $1::uuid`, [v.fp_id]);
          corrigidos++;
        }
      } else if (osc === false) {
        if (ppC === 'teste') {
          await c.query(`UPDATE pagamentos_prestadores SET classificacao_dado = 'real', is_teste = false WHERE id = $1::uuid`, [v.pp_id]);
          corrigidos++;
        }
        if (fpC === 'teste') {
          await c.query(`UPDATE financeiro_pagar SET is_teste = false WHERE id = $1::uuid`, [v.fp_id]);
          corrigidos++;
        }
      }
    }
  }
  out(`Conflitos via OS: ${conflitosOS}`);
  out('');

  // ═══════ FASE 4: PROVA FINAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('PROVA — VALORES INALTERADOS');
  out('═══════════════════════════════════════════════════════════');

  const totalPP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores`);
  const totalFP = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor),0) AS total FROM financeiro_pagar`);
  out(`pagamentos_prestadores: ${totalPP.rows[0].n} registros, R$ ${Number(totalPP.rows[0].total).toFixed(2)}`);
  out(`financeiro_pagar: ${totalFP.rows[0].n} registros, R$ ${Number(totalFP.rows[0].total).toFixed(2)}`);
  out('');

  // ═══════ RESUMO ═══════
  const totalVinculos = auditados + viaOS.rows.length;
  const totalConflitos = conflitos + conflitosOS;
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out(`VÍNCULOS AUDITADOS: ${totalVinculos}`);
  out(`CONFLITOS ENCONTRADOS: ${totalConflitos}`);
  out(`CONFLITOS CORRIGIDOS: ${corrigidos}`);
  out(`CONFLITOS NÃO RESOLVIDOS: ${naoResolvidos}`);
  out('VALORES ALTERADOS: NÃO');
  out('STATUS ALTERADOS: NÃO');
  out('BAIXAS ALTERADAS: NÃO');
  out(`FIN-363D.2B3: ${naoResolvidos === 0 ? 'PASS' : 'FAIL'}`);
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
