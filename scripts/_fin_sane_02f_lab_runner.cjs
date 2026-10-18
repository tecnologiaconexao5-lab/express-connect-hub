const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const ADMIN_URL = 'postgresql://postgres:postgres@localhost:5432/postgres';
const LAB_DB = 'fin_sane_02f_lab';
const LAB_URL = `postgresql://postgres:postgres@localhost:5432/${LAB_DB}`;
const MIGRATIONS_DIR = path.resolve('supabase/migrations_lab');

function readMigration(name) {
  const content = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
  return content.replace(/^\uFEFF/, '');
}

async function execSql(client, sql, label) {
  try {
    await client.query(sql);
    return { ok: true, label };
  } catch (e) {
    return { ok: false, label, error: e.message };
  }
}

async function withTransaction(client, fn) {
  await client.query('BEGIN');
  try {
    const res = await fn();
    await client.query('ROLLBACK');
    return { ok: true, ...res };
  } catch (e) {
    await client.query('ROLLBACK');
    return { ok: false, error: e.message };
  }
}

async function main() {
  const results = [];

  // 1. Criar banco lab
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${LAB_DB} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${LAB_DB}`);
    results.push({ step: 'Criar banco lab', ok: true });
  } catch (e) {
    results.push({ step: 'Criar banco lab', ok: false, error: e.message });
    await admin.end();
    printResults(results);
    return;
  }
  await admin.end();

  // 2. Conectar ao lab e aplicar baseline + extensões
  const lab = new Client({ connectionString: LAB_URL, statement_timeout: 60000 });
  await lab.connect();

  await lab.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await lab.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  // Roles usadas pelos grants do baseline
  for (const role of ['anon', 'authenticated', 'service_role', 'postgres']) {
    await lab.query(`DO $$ BEGIN CREATE ROLE ${role} WITH LOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  }

  const baseline = readMigration('0000_fin_sane_02b_baseline.sql');
  const forward = readMigration('20260913000000_fin_sane_02b_unifica_valor_pagar.sql');
  const rollback = readMigration('20260913000001_fin_sane_02b_rollback.sql');

  const rBase = await execSql(lab, baseline, 'Aplicar baseline');
  results.push(rBase);
  if (!rBase.ok) { await lab.end(); printResults(results); return; }

  // 3. Aplicar forward 02B corrigida
  const rFwd = await execSql(lab, forward, 'Aplicar forward 02B corrigida');
  results.push(rFwd);
  if (!rFwd.ok) { await lab.end(); printResults(results); return; }

  // 4. Executar 12 cenários
  const cenariosRaw = fs.readFileSync(path.resolve('tests/sql/fin_sane_02b_cenarios.sql'), 'utf8').replace(/^\uFEFF/, '');
  const cenariosClean = cenariosRaw.split(/\r?\n/).filter(l => !l.trim().startsWith('\\')).join('\n');
  const rCen = await withTransaction(lab, async () => {
    const blocks = cenariosClean.split(/DO \$\$|\$\$;/).filter((_, i) => i % 2 === 1);
    for (let i = 0; i < blocks.length; i++) {
      await lab.query(`DO $$${blocks[i]}$$;`);
    }
    return { message: '12 cenários executados sem ASSERT failure' };
  });
  results.push({ step: '12 cenários SQL', ...rCen });

  // 5. Teste M66 → OS
  const rOs = await withTransaction(lab, async () => {
    const pId = (await lab.query(`INSERT INTO prestadores (nome_completo, cpf_cnpj, status) VALUES ('Test OS M66', '12345678901', 'ativo') RETURNING id`)).rows[0].id;
    const cId = (await lab.query(`INSERT INTO clientes (nome_fantasia, razao_social, status) VALUES ('Cliente OS M66', 'Cliente OS M66 LTDA', 'ativo') RETURNING id`)).rows[0].id;
    const aId = (await lab.query(`INSERT INTO alocacoes_escala (cliente_id, prestador_id, status, finalizada, data_escala, tipo_veiculo, origem, destino, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
      VALUES ($1, $2, 'concluida', true, CURRENT_DATE, 'HR', 'Origem A', 'Destino B', 1000, 700, 50, 80, 30, 100) RETURNING id`, [cId, pId])).rows[0].id;

    const os = await lab.query(`SELECT * FROM ordens_servico WHERE id = $1`, [aId]);
    const fp = await lab.query(`SELECT * FROM financeiro_pagar WHERE os_id = $1`, [aId]);
    const pp = await lab.query(`SELECT * FROM pagamentos_prestadores WHERE os_id = $1`, [aId]);
    const fr = await lab.query(`SELECT * FROM financeiro_receber WHERE os_id = $1`, [aId]);
    const cf = await lab.query(`SELECT * FROM composicao_financeira_os WHERE os_id = $1`, [aId]);

    if (os.rowCount !== 1) throw new Error(`OS não criada: rowCount=${os.rowCount}`);
    if (fp.rowCount !== 1) throw new Error(`financeiro_pagar não criado: rowCount=${fp.rowCount}`);
    if (pp.rowCount !== 1) throw new Error(`pagamentos_prestadores não criado: rowCount=${pp.rowCount}`);
    if (fr.rowCount !== 1) throw new Error(`financeiro_receber não criado: rowCount=${fr.rowCount}`);
    if (cf.rowCount !== 1) throw new Error(`composicao_financeira_os não criada: rowCount=${cf.rowCount}`);

    const valorEsperado = 700 + 50 + 80 + 30 - 100; // 760
    if (Math.round(fp.rows[0].valor * 100) !== Math.round(valorEsperado * 100)) {
      throw new Error(`fp.valor=${fp.rows[0].valor}, esperado=${valorEsperado}`);
    }
    if (Math.round(pp.rows[0].valor_liquido * 100) !== Math.round(valorEsperado * 100)) {
      throw new Error(`pp.valor_liquido=${pp.rows[0].valor_liquido}, esperado=${valorEsperado}`);
    }
    if (os.rows[0].cliente_id !== 'Cliente OS M66') throw new Error(`OS.cliente_id divergente: ${os.rows[0].cliente_id}`);
    if (os.rows[0].prestador_id !== 'Test OS M66') throw new Error(`OS.prestador_id divergente: ${os.rows[0].prestador_id}`);

    return { message: 'M66 → OS OK, fp.valor=760' };
  });
  results.push({ step: 'Teste M66 -> OS', ...rOs });

  // 6. Teste UPDATE alocação
  const rUpd = await withTransaction(lab, async () => {
    const pId = (await lab.query(`INSERT INTO prestadores (nome_completo, cpf_cnpj, status) VALUES ('Test Update M66', '12345678902', 'ativo') RETURNING id`)).rows[0].id;
    const cId = (await lab.query(`INSERT INTO clientes (nome_fantasia, razao_social, status) VALUES ('Cliente Update M66', 'Cliente Update M66 LTDA', 'ativo') RETURNING id`)).rows[0].id;
    const aId = (await lab.query(`INSERT INTO alocacoes_escala (cliente_id, prestador_id, status, finalizada, data_escala, tipo_veiculo, origem, destino, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
      VALUES ($1, $2, 'concluida', true, CURRENT_DATE, 'HR', 'Origem A', 'Destino B', 1000, 700, 50, 0, 0, 0) RETURNING id`, [cId, pId])).rows[0].id;

    const osCount1 = (await lab.query(`SELECT COUNT(*)::int AS n FROM ordens_servico WHERE id = $1`, [aId])).rows[0].n;
    if (osCount1 !== 1) throw new Error(`OS inicial não criada: ${osCount1}`);

    await lab.query(`UPDATE alocacoes_escala SET valor_adicional = 100 WHERE id = $1`, [aId]);

    const osCount2 = (await lab.query(`SELECT COUNT(*)::int AS n FROM ordens_servico WHERE id = $1`, [aId])).rows[0].n;
    if (osCount2 !== 1) throw new Error(`OS duplicada após update: count=${osCount2}`);

    const fpValor = (await lab.query(`SELECT valor FROM financeiro_pagar WHERE os_id = $1`, [aId])).rows[0].valor;
    const esperado = 700 + 50 + 100; // 850
    if (Math.round(fpValor * 100) !== Math.round(esperado * 100)) throw new Error(`fp.valor=${fpValor}, esperado=${esperado}`);

    const fpCount = (await lab.query(`SELECT COUNT(*)::int AS n FROM financeiro_pagar WHERE os_id = $1`, [aId])).rows[0].n;
    if (fpCount !== 1) throw new Error(`financeiro_pagar duplicado: ${fpCount}`);

    const ppCount = (await lab.query(`SELECT COUNT(*)::int AS n FROM pagamentos_prestadores WHERE os_id = $1`, [aId])).rows[0].n;
    if (ppCount !== 1) throw new Error(`pagamentos_prestadores duplicado: ${ppCount}`);

    return { message: 'UPDATE alocacao -> mesma OS OK, fp.valor=850' };
  });
  results.push({ step: 'Teste UPDATE alocacao', ...rUpd });

  // 7. Rollback
  const rRb = await execSql(lab, rollback, 'Aplicar rollback');
  results.push(rRb);

  // 8. Verificar rollback: M66 volta a usar v_valor_prestador e mantém OS
  const rCheckRb = await withTransaction(lab, async () => {
    const pId = (await lab.query(`INSERT INTO prestadores (nome_completo, cpf_cnpj, status) VALUES ('Test Rollback', '12345678903', 'ativo') RETURNING id`)).rows[0].id;
    const cId = (await lab.query(`INSERT INTO clientes (nome_fantasia, razao_social, status) VALUES ('Cliente Rollback', 'Cliente Rollback LTDA', 'ativo') RETURNING id`)).rows[0].id;
    const aId = (await lab.query(`INSERT INTO alocacoes_escala (cliente_id, prestador_id, status, finalizada, data_escala, tipo_veiculo, origem, destino, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
      VALUES ($1, $2, 'concluida', true, CURRENT_DATE, 'HR', 'Origem A', 'Destino B', 1000, 700, 50, 80, 30, 100) RETURNING id`, [cId, pId])).rows[0].id;

    const os = await lab.query(`SELECT * FROM ordens_servico WHERE id = $1`, [aId]);
    const fp = await lab.query(`SELECT valor FROM financeiro_pagar WHERE os_id = $1`, [aId]);
    if (os.rowCount !== 1) throw new Error('OS não criada após rollback');
    // rollback usa v_valor_prestador = 700
    if (Math.round(fp.rows[0].valor * 100) !== Math.round(700 * 100)) throw new Error(`fp.valor rollback=${fp.rows[0].valor}, esperado=700`);

    const rpcExist = await lab.query(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_confirmar_pagamento_fechamento'`);
    if (rpcExist.rowCount > 0) throw new Error('RPC f_confirmar_pagamento_fechamento não foi removida');

    return { message: 'Rollback OK: OS preservada, fp.valor=700 (base), RPC removida' };
  });
  results.push({ step: 'Verificacao rollback', ...rCheckRb });

  // 9. Reaplicar forward
  const rFwd2 = await execSql(lab, forward, 'Reaplicar forward 02B corrigida');
  results.push(rFwd2);

  // 10. Verificar reaplicação
  const rCheckRe = await withTransaction(lab, async () => {
    const pId = (await lab.query(`INSERT INTO prestadores (nome_completo, cpf_cnpj, status) VALUES ('Test Reaplicacao', '12345678904', 'ativo') RETURNING id`)).rows[0].id;
    const cId = (await lab.query(`INSERT INTO clientes (nome_fantasia, razao_social, status) VALUES ('Cliente Reaplicacao', 'Cliente Reaplicacao LTDA', 'ativo') RETURNING id`)).rows[0].id;
    const aId = (await lab.query(`INSERT INTO alocacoes_escala (cliente_id, prestador_id, status, finalizada, data_escala, tipo_veiculo, origem, destino, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_ajudante, valor_desconto_prestador)
      VALUES ($1, $2, 'concluida', true, CURRENT_DATE, 'HR', 'Origem A', 'Destino B', 1000, 700, 50, 80, 30, 100) RETURNING id`, [cId, pId])).rows[0].id;

    const fp = await lab.query(`SELECT valor FROM financeiro_pagar WHERE os_id = $1`, [aId]);
    const esperado = 700 + 50 + 80 + 30 - 100; // 760
    if (Math.round(fp.rows[0].valor * 100) !== Math.round(esperado * 100)) throw new Error(`fp.valor reaplicacao=${fp.rows[0].valor}, esperado=${esperado}`);

    const os = await lab.query(`SELECT * FROM ordens_servico WHERE id = $1`, [aId]);
    if (os.rowCount !== 1) throw new Error('OS não criada após reaplicação');

    const rpcExist = await lab.query(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_confirmar_pagamento_fechamento'`);
    if (rpcExist.rowCount === 0) throw new Error('RPC f_confirmar_pagamento_fechamento não recriada');

    return { message: 'Reaplicacao OK: OS criada, fp.valor=760, RPC existe' };
  });
  results.push({ step: 'Verificacao reaplicacao', ...rCheckRe });

  // 11. Reexecutar 12 cenários após reaplicação
  const rCen2 = await withTransaction(lab, async () => {
    const blocks = cenariosClean.split(/DO \$\$|\$\$;/).filter((_, i) => i % 2 === 1);
    for (let i = 0; i < blocks.length; i++) {
      await lab.query(`DO $$${blocks[i]}$$;`);
    }
    return { message: '12 cenários reaplicados sem ASSERT failure' };
  });
  results.push({ step: '12 cenários apos reaplicacao', ...rCen2 });

  await lab.end();

  printResults(results);
}

function printResults(results) {
  console.log('\n=== RESULTADOS FIN-SANE-02F ===\n');
  let allOk = true;
  for (const r of results) {
    const status = r.ok ? 'PASS' : 'FAIL';
    if (!r.ok) allOk = false;
    console.log(`${status}: ${r.step}`);
    if (r.message) console.log(`  -> ${r.message}`);
    if (r.error) console.log(`  -> ERRO: ${r.error}`);
  }
  console.log(`\nGATE FINAL: ${allOk ? 'PASS' : 'BLOCKED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
