// FIN-SANE-02B — Executor dos 12 cenários no lab local
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  });

  await client.connect();
  console.log('Connected to local lab DB');

  const sqlPath = path.join(__dirname, '..', 'tests', 'sql', 'fin_sane_02b_cenarios.sql');
  let sql = fs.readFileSync(sqlPath, 'utf8');

  // Remove psql-specific \set command
  sql = sql.replace(/^\\set.*$/gm, '');

  // Split into scenarios by comment headers
  const scenarioRegex = /(-- =+\r?\n-- CENÁRIO \d+:[^\n]*\r?\n-- =+[\s\S]*?)(?=-- =+\r?\n-- CENÁRIO \d+:|-- =+\r?\n-- TEARDOWN|$)/g;
  const scenarios = [];
  let match;
  while ((match = scenarioRegex.exec(sql)) !== null) {
    let block = match[1].trim();
    // Remove any trailing SQL outside the final END $$; (e.g. standalone RAISE NOTICE)
    const lastEndIdx = block.lastIndexOf('END $$;');
    if (lastEndIdx !== -1) {
      block = block.substring(0, lastEndIdx + 'END $$;'.length);
    }
    scenarios.push(block);
  }

  // Also include teardown if present
  const teardownMatch = sql.match(/-- =+\r?\n-- TEARDOWN[\s\S]*$/);
  if (teardownMatch) scenarios.push(teardownMatch[0].trim());

  console.log(`Found ${scenarios.length} scenario blocks`);

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenarioSql = scenarios[i];
    const titleMatch = scenarioSql.match(/-- CENÁRIO (\d+):[^\n]*/);
    const title = titleMatch ? titleMatch[0].replace(/^--\s*/, '') : `Block ${i + 1}`;

    try {
      await client.query('BEGIN');
      await client.query(scenarioSql);
      await client.query('ROLLBACK');
      console.log(`✅ PASS: ${title}`);
      passed++;
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error(`❌ FAIL: ${title}`);
      console.error(err.message);
      failed++;
    }
  }

  await client.end();
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
