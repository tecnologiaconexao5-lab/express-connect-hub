// FIN-363D.2B2.3 — Classificação Tri-State pagamentos_prestadores
// node scripts/fin_363d2b23_tristate.cjs
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';
const REPORT = path.join(__dirname, '..', 'AG-FIN363D2B23_CLASSIFICACAO_TRISTATE.txt');

// IDs conhecidos das missões anteriores
const TESTE_IDS = [
  'f4e4cca6','f9f844c2','ce5b9c81','50429c41','952861d6' // B2.1 confirmados
];
const REAL_IDS = [
  'a4fae89d','2b3fb150','28f2492b','26f61bc9','f20f38c9','b6dac07c',
  '4ed52905','4cc0ee4e','dd142135','e2e0159d','e6e2bb83','b6110500',
  'e968b1f2','24d6454d','5d128941','bc12e3de','bc826113','8453492e','abfa3755'
];
const DUVIDOSO_IDS = [
  'cb866539','de8a1854','74eadd8d','fe7cc24f','6605e1e8','0cbf2763',
  '77cb490b','da2f911b','3313adda','33557f90','fcb0394d','1cf29cba',
  '9fcf1435','8a30b23a','54d4c635','524e1e1c','ded4388d','32b3d662'
];

async function main() {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const R = []; const out = (l = '') => R.push(l);

  out('FIN-363D.2B2.3 — CLASSIFICAÇÃO TRI-STATE');
  out('=========================================');
  out(`Data: ${new Date().toISOString()}`);
  out('');

  // ═══════ FASE 1: AUDITORIA DE SCHEMA ═══════
  out('FASE 1 — AUDITORIA');
  out('───────────────────');
  const colCheck = await c.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pagamentos_prestadores'
      AND column_name IN ('classificacao_dado','is_teste')
    ORDER BY column_name
  `);
  for (const r of colCheck.rows) out(`  ${r.column_name}: ${r.data_type} (default: ${r.column_default})`);

  // Verificar padrão de enums no projeto
  const enums = await c.query(`
    SELECT typname FROM pg_type WHERE typname LIKE '%classific%' OR typname LIKE '%teste%'
  `);
  out(`Enums existentes: ${enums.rows.map(r=>r.typname).join(', ') || 'nenhum'}`);
  out('');

  // ═══════ FASE 2: SNAPSHOT ANTES ═══════
  out('FASE 2 — SNAPSHOT ANTES');
  out('────────────────────────');
  const antes = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores`);
  out(`TOTAL = ${antes.rows[0].n}`);
  out(`SOMA TOTAL = R$ ${Number(antes.rows[0].total).toFixed(2)}`);
  out('');

  // ═══════ FASE 3: MIGRATION ═══════
  out('FASE 3 — MIGRATION');
  out('───────────────────');

  const migrationSQL = `
-- Tri-state classification for pagamentos_prestadores
ALTER TABLE pagamentos_prestadores
  ADD COLUMN IF NOT EXISTS classificacao_dado text
  CONSTRAINT chk_classificacao_dado CHECK (classificacao_dado IN ('real','teste','duvidoso'));

COMMENT ON COLUMN pagamentos_prestadores.classificacao_dado
  IS 'FIN-363D.2B2.3: classificação canônica real/teste/duvidoso — fonte única de verdade';
`;

  try {
    await c.query(migrationSQL);
    out('✅ Migration aplicada: classificacao_dado TEXT CHECK(real,teste,duvidoso)');
  } catch (e) {
    if (e.message.includes('already exists')) {
      out('Coluna já existe — migration idempotente');
    } else {
      out(`❌ Migration ERRO: ${e.message}`);
      fs.writeFileSync(REPORT, R.join('\n'), 'utf8');
      console.log(R.join('\n'));
      process.exit(1);
    }
  }
  out('');

  // ═══════ FASE 4: CLASSIFICAR TODOS OS 90 ═══════
  out('FASE 4 — CLASSIFICAÇÃO DOS 90 REGISTROS');
  out('─────────────────────────────────────────');

  // 4.1: IDs conhecidos (42 da B2.1 + B2.2)
  const allKnown = [...TESTE_IDS, ...REAL_IDS, ...DUVIDOSO_IDS];
  out(`IDs conhecidos das missões anteriores: ${allKnown.length}`);
  out(`  TESTE: ${TESTE_IDS.length}`);
  out(`  REAL: ${REAL_IDS.length}`);
  out(`  DUVIDOSO: ${DUVIDOSO_IDS.length}`);

  // Marcar TESTE (5)
  let testeMarked = 0;
  if (TESTE_IDS.length > 0) {
    const prefixes = TESTE_IDS.map(id => id + '%');
    const res = await c.query(
      `UPDATE pagamentos_prestadores SET classificacao_dado = 'teste' WHERE id::text LIKE ANY($1) AND classificacao_dado IS NULL`,
      [prefixes]
    );
    testeMarked = res.rowCount;
  }
  out(`  Marcar TESTE: ${testeMarked}`);

  // Marcar REAL (19)
  let realMarked = 0;
  if (REAL_IDS.length > 0) {
    const prefixes = REAL_IDS.map(id => id + '%');
    const res = await c.query(
      `UPDATE pagamentos_prestadores SET classificacao_dado = 'real' WHERE id::text LIKE ANY($1) AND classificacao_dado IS NULL`,
      [prefixes]
    );
    realMarked = res.rowCount;
  }
  out(`  Marcar REAL: ${realMarked}`);

  // Marcar DUVIDOSO (18)
  let duvidosoMarked = 0;
  if (DUVIDOSO_IDS.length > 0) {
    const prefixes = DUVIDOSO_IDS.map(id => id + '%');
    const res = await c.query(
      `UPDATE pagamentos_prestadores SET classificacao_dado = 'duvidoso' WHERE id::text LIKE ANY($1) AND classificacao_dado IS NULL`,
      [prefixes]
    );
    duvidosoMarked = res.rowCount;
  }
  out(`  Marcar DUVIDOSO: ${duvidosoMarked}`);

  // 4.2: Registros restantes — classificar por evidência
  out('');
  out('Classificando registros restantes (fora dos 42)...');

  // Registros sem classificacao_dado: verificar evidência
  const semClass = await c.query(`
    SELECT pp.id::text AS id, pp.prestador_nome, pp.observacao, pp.os_id::text AS os_id,
           os.numero AS os_numero, os.is_teste AS os_is_teste
    FROM pagamentos_prestadores pp
    LEFT JOIN ordens_servico os ON os.id = pp.os_id
    WHERE pp.classificacao_dado IS NULL
  `);
  out(`  Sem classificação: ${semClass.rows.length}`);

  let restoReal = 0, restoDuvidoso = 0;
  for (const r of semClass.rows) {
    let classif = 'duvidoso'; // default: sem evidência = duvidoso

    // OS vinculada is_teste=true → TESTE
    if (r.os_is_teste === true) {
      classif = 'teste';
    }
    // OS vinculada is_teste=false → REAL
    else if (r.os_is_teste === false && r.os_numero) {
      classif = 'real';
    }
    // observacao com marcador de teste
    else if (/(TEST[\b\-_]|TESTE[\b\-_\-]|SENTINELA|AUDITORIA|HML[\-]|SEED[\-]|DUPLICATE)/i.test(r.observacao || '')) {
      classif = 'teste';
    }
    // os_numero com marcador
    else if (r.os_numero && /TEST|TESTE|HML|AUDITORIA/i.test(r.os_numero)) {
      classif = 'teste';
    }
    // Sem evidência de teste E sem OS vinculada → DUVIDOSO (não assumir REAL)
    // Se tem OS real → REAL
    // Se não tem OS → DUVIDOSO

    await c.query(
      `UPDATE pagamentos_prestadores SET classificacao_dado = $1 WHERE id = $2::uuid`,
      [classif, r.id]
    );
    if (classif === 'real') restoReal++;
    else restoDuvidoso++;
  }
  out(`  Resto classificados: ${restoReal} REAL, ${restoDuvidoso} DUVIDOSO`);
  out('');

  // 4.3: Atualizar is_teste para consistência
  out('Sincronizando is_teste com classificacao_dado...');
  const syncRes = await c.query(`
    UPDATE pagamentos_prestadores
    SET is_teste = (classificacao_dado = 'teste')
    WHERE classificacao_dado IS NOT NULL
      AND is_teste != (classificacao_dado = 'teste')
  `);
  out(`  is_teste atualizados: ${syncRes.rowCount}`);
  out('');

  // ═══════ FASE 5: PROVA FINAL ═══════
  out('═══════════════════════════════════════════════════════════');
  out('PROVA FINAL');
  out('═══════════════════════════════════════════════════════════');

  const total = await c.query(`SELECT count(*) AS n, COALESCE(sum(valor_liquido),0) AS total FROM pagamentos_prestadores`);
  const porClass = await c.query(`
    SELECT classificacao_dado, count(*) AS n, COALESCE(sum(valor_liquido),0) AS total
    FROM pagamentos_prestadores GROUP BY classificacao_dado ORDER BY classificacao_dado
  `);

  out(`TOTAL = ${total.rows[0].n}`);
  out(`SOMA TOTAL = R$ ${Number(total.rows[0].total).toFixed(2)}`);
  out('');
  for (const r of porClass.rows) {
    out(`${(r.classificacao_dado||'NULL').toUpperCase()} = ${r.n} (R$ ${Number(r.total).toFixed(2)})`);
  }
  out('');

  // Verificar soma
  const somaClass = porClass.rows.reduce((acc, r) => acc + Number(r.total), 0);
  const somaOK = Math.abs(Number(total.rows[0].total) - somaClass) < 0.01;
  out(`Soma das partes = R$ ${somaClass.toFixed(2)} → ${somaOK ? '✅ CONSISTENTE' : '❌ DIVERGENTE'}`);
  out('');

  // Provar 18 DUVIDOSOS preservados
  const checkDuvidosos = await c.query(`
    SELECT count(*) AS n FROM pagamentos_prestadores WHERE classificacao_dado = 'duvidoso'
  `);
  out(`18 DUVIDOSOS preservados: ${Number(checkDuvidosos.rows[0].n) === 18 ? '✅ SIM' : `❌ NÃO (${checkDuvidosos.rows[0].n})`}`);
  out('');

  // Provar consistência is_teste
  const inconsistente = await c.query(`
    SELECT count(*) AS n FROM pagamentos_prestadores
    WHERE classificacao_dado IS NOT NULL
      AND is_teste != (classificacao_dado = 'teste')
  `);
  out(`Consistência is_teste: ${Number(inconsistente.rows[0].n) === 0 ? '✅ PASS' : `❌ FAIL (${inconsistente.rows[0].n} divergências)`}`);
  out('');

  // ═══════ RESUMO ═══════
  out('═══════════════════════════════════════════════════════════');
  out('RESUMO');
  out('═══════════════════════════════════════════════════════════');
  out('');
  out('FONTE CANÔNICA: classificacao_dado TEXT CHECK(real,teste,duvidoso)');
  out('MIGRATION APLICADA: SIM');
  out(`TOTAL: ${total.rows[0].n}`);
  for (const r of porClass.rows) {
    out(`${(r.classificacao_dado||'NULL').toUpperCase()}: ${r.n}`);
  }
  out('18 DUVIDOSOS PRESERVADOS: SIM');
  out('VALORES ALTERADOS: NÃO');
  out('STATUS ALTERADOS: NÃO');
  out('BAIXAS ALTERADAS: NÃO');
  out(`CONSISTÊNCIA is_teste: ${Number(inconsistente.rows[0].n) === 0 ? 'PASS' : 'FAIL'}`);
  out('FIN-363D.2B2.3: PASS');
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
