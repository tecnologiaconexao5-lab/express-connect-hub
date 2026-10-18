import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
});

const TABLES = [
  'contratos_gerados', 'contratos_modelos', 'contratos_historico',
  'portal_notificacoes', 'portal_ocorrencias', 'portal_avaliacoes',
  'portal_comprovantes', 'portal_protocolos', 'portal_rotas',
  'portal_tracking_realtime', 'portal_relatorios', 'portal_faturas',
  'portal_preferencias_cliente',
  'operacoes', 'operacoes_financeiro', 'match_operacoes_prestadores'
];

try {
  await client.connect();

  for (const table of TABLES) {
    // Check if exists
    const exists = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) as e`,
      [table]
    );
    if (!exists.rows[0].e) {
      console.log(`-- TABLE public.${table} DOES NOT EXIST in production, skipping`);
      continue;
    }

    // Columns
    const cols = await client.query(`
      SELECT column_name, is_nullable, udt_name, character_maximum_length,
             numeric_precision, numeric_scale, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    // PK
    const pk = await client.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.table_name = $1 AND tc.constraint_type = 'PRIMARY KEY'
    `, [table]);

    // UNIQUE
    const uniq = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as condef
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'u'
      ORDER BY conname
    `, [`public.${table}`]);

    // FKs
    const fks = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as condef
      FROM pg_constraint
      WHERE conrelid = $1::regclass AND contype = 'f'
      ORDER BY conname
    `, [`public.${table}`]);

    // Build DDL
    let sql = `-- ============================================================\n-- ${table}\n-- ============================================================\n`;
    sql += `CREATE TABLE IF NOT EXISTS public.${table} (\n`;

    const colLines = [];
    for (const c of cols.rows) {
      let type = c.udt_name;
      if (c.numeric_precision && c.udt_name === 'numeric') {
        type = `numeric(${c.numeric_precision},${c.numeric_scale})`;
      } else if (c.udt_name === '_text') {
        type = 'text[]';
      } else if (c.udt_name === 'timestamp') {
        type = 'timestamp without time zone';
      } else if (c.udt_name === 'timestamptz') {
        type = 'timestamp with time zone';
      } else if (c.udt_name === 'bool') {
        type = 'boolean';
      } else if (c.udt_name === 'int4') {
        type = 'integer';
      } else if (c.udt_name === 'float8') {
        type = 'double precision';
      }

      let line = `    ${c.column_name} ${type}`;
      if (c.is_nullable === 'NO') line += ' NOT NULL';
      if (c.column_default) {
        let def = c.column_default;
        if (def.startsWith('nextval(')) {
          const seqMatch = def.match(/'([^']+)'/);
          // skip sequence defaults, PK handles them
        } else {
          line += ` DEFAULT ${def}`;
        }
      }
      colLines.push(line);
    }

    // PK
    if (pk.rows.length > 0) {
      const pkCols = pk.rows.map(r => r.column_name).join(', ');
      colLines.push(`    PRIMARY KEY (${pkCols})`);
    }

    // UNIQUE
    for (const u of uniq.rows) {
      const match = u.condef.match(/UNIQUE\s*\((.+)\)/i);
      if (match) {
        colLines.push(`    UNIQUE (${match[1]})`);
      }
    }

    sql += colLines.join(',\n');
    sql += '\n);\n';

    // FKs
    for (const fk of fks.rows) {
      sql += `\nALTER TABLE ONLY public.${table}\n    ADD CONSTRAINT ${fk.conname} ${fk.condef};\n`;
    }

    console.log(sql + '\n');
  }

  await client.end();
} catch (e) {
  console.error('ERRO:', e.message);
  try { await client.end(); } catch(_) {}
}
