import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'C:\\Users\\DIEGO BALBINO\\Desktop\\Pasta Compartilhada\\DOCUMENTOS EMPRESA\\08_TECNOLOGIA_SISTEMAS\\express-connect-hub\\supabase\\migrations';

const createdTables = new Set();
const referencedTables = new Map(); // table -> Set of "file:CONTEXT"

const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

for (const file of files) {
  let content = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
  
  // Remove single-line comments
  content = content.replace(/--[^\r\n]*/g, '');
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove string literals (simple single-quote)
  // Be careful not to break escaped quotes
  content = content.replace(/'[^']*'/g, "''");

  // --- CREATED TABLES ---
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s*\(/gi;
  let m;
  while ((m = createRe.exec(content)) !== null) {
    const table = (m[2] || '').toLowerCase();
    if (table) createdTables.add(table);
  }

  // CREATE OR REPLACE VIEW
  const createViewRe = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\s/gi;
  while ((m = createViewRe.exec(content)) !== null) {
    const table = (m[2] || '').toLowerCase();
    if (table) createdTables.add(table);
  }

  // --- REFERENCED TABLES ---
  function addRef(tableName, context) {
    if (!tableName) return;
    const t = tableName.toLowerCase();
    if (!referencedTables.has(t)) referencedTables.set(t, new Set());
    referencedTables.get(t).add(`${file}:${context}`);
  }

  // REFERENCES <table>(
  const refRe = /REFERENCES\s+(?:(\w+)\.)?(\w+)\s*\(/gi;
  while ((m = refRe.exec(content)) !== null) {
    addRef(m[2], 'REFERENCES');
  }

  // FROM <table> — only bare table name, not followed by (
  // Also exclude LATERAL, generate_series, unnest, etc.
  const fromRe = /\bFROM\s+(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = fromRe.exec(content)) !== null) {
    const schema = m[1];
    const table = m[2];
    // Skip if followed by ( — it's a function/subquery
    const afterMatch = content.slice(m.index + m[0].length);
    if (/^\s*\(/.test(afterMatch)) continue;
    // Skip if preceded by LATERAL
    const beforeMatch = content.slice(Math.max(0, m.index - 20), m.index);
    if (/\bLATERAL\s*$/.test(beforeMatch)) continue;
    // Skip table-valued functions
    if (/^(generate_series|unnest|jsonb_array_elements|jsonb_each|jsonb_each_text|jsonb_object_keys|jsonb_populate_record|jsonb_to_record|jsonb_to_recordset|jsonb_array_elements_text|regexp_split_to_table|regexp_split_to_array|string_to_array|unnest_with_ordinality|inet_client_addr|inet_server_addr|pg_catalog)$/i.test(table)) continue;
    addRef(table, 'FROM');
  }

  // JOIN <table>
  const joinRe = /\b(?:INNER\s+|LEFT\s+(?:OUTER\s+)?|RIGHT\s+(?:OUTER\s+)?|FULL\s+(?:OUTER\s+)?|CROSS\s+)?JOIN\s+(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = joinRe.exec(content)) !== null) {
    addRef(m[2], 'JOIN');
  }

  // INSERT INTO <table>
  const insertRe = /\bINSERT\s+INTO\s+(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = insertRe.exec(content)) !== null) {
    addRef(m[2], 'INSERT');
  }

  // UPDATE <table>
  const updateRe = /\bUPDATE\s+(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = updateRe.exec(content)) !== null) {
    addRef(m[2], 'UPDATE');
  }

  // DELETE FROM <table>
  const deleteRe = /\bDELETE\s+FROM\s+(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = deleteRe.exec(content)) !== null) {
    addRef(m[2], 'DELETE');
  }

  // ALTER TABLE [IF EXISTS] <table>
  const alterRe = /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = alterRe.exec(content)) !== null) {
    addRef(m[2], 'ALTER');
  }

  // DROP TABLE [IF EXISTS] <table>
  const dropRe = /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = dropRe.exec(content)) !== null) {
    addRef(m[2], 'DROP');
  }

  // TRUNCATE [TABLE] [IF EXISTS] <table>
  const truncateRe = /\bTRUNCATE\s+(?:TABLE\s+)?(?:IF\s+EXISTS\s+)?(?:(\w+)\.)?(\w+)\b/gi;
  while ((m = truncateRe.exec(content)) !== null) {
    addRef(m[2], 'TRUNCATE');
  }

  // SELECT ... INTO [STRICT] <var> — PL/pgSQL variables, NOT tables
  // We need to NOT capture these as table references
  // The regex captures them anyway; we'll filter them out below
}

// --- Exclusion lists ---

// PL/pgSQL variable prefixes and known variable patterns
const plpgsqlVarPatterns = [
  /^v_\w+$/,           // v_cliente_id, v_prestador, v_os_record, etc.
  /^r\d*$/,            // r, r1, r2, r3
  /^rec\d*$/,          // rec, rec1
  /^rw\d*$/,           // rw
  /^tmp\w*$/,          // tmp, tmprow
  /^row\d*$/,          // row
  /^new\.\w+$/,        // new.column
  /^old\.\w+$/,        // old.column
  /^excluded\.\w+$/,   // excluded.column
  /^tg_\w+$/,          // tg_name, tg_table_name, etc.
];

// Known column names that get matched as "table" names
const knownColumns = new Set([
  'aceite_prestador', 'finalizada', 'liberado_app', 'score', 'status',
  'valor', 'valor_adicional', 'valor_ajudante', 'valor_cliente',
  'valor_combustivel', 'valor_desconto', 'valor_frete', 'valor_pedagio',
  'valor_repasse', 'custo_prestador', 'fatura_id', 'cliente_id',
  'prestador_id', 'motorista_id', 'prestadores_filtrados', 'selecionados',
  'conflito', 'proximo', 'travadas', 'orfaos', 'orfaos_rc', 'cross_tenant',
  'total_candidatos_com_docs', 'total_docs', 'resultado_cruzado',
  'resultado_pedidos_c1', 'resultado_pedidos_c2', 'veiculo_alocado',
  'operation_km', 'for', 'using', 'own', 'skip', 'strict',
  'documentos', 'columns', 'tables', 'users',
]);

// System catalogs / information_schema
const systemSchemas = new Set([
  'information_schema', 'pg_catalog', 'pg_toast',
]);

// SQL keywords that get matched
const sqlKeywords = new Set([
  'auth', 'jwt', 'public', 'authenticated', 'anon', 'service_role',
  'current_date', 'current_timestamp', 'now', 'clock_timestamp',
  'session_user', 'current_user', 'current_database', 'current_schema',
  'generate_series', 'unnest', 'lateral', 'cross', 'with', 'recursive',
  'true', 'false', 'null', 'new', 'old', 'excluded',
  'constraint_column_usage', 'table_constraints', 'table_privileges',
  'using', 'for', 'own', 'skip', 'strict', 'or', 'and', 'not',
  'in', 'exists', 'between', 'like', 'is', 'select', 'from',
  'where', 'join', 'inner', 'left', 'right', 'full',
  'on', 'insert', 'into', 'values', 'update', 'set', 'delete',
  'create', 'alter', 'drop', 'table', 'index', 'view',
  'trigger', 'function', 'procedure', 'constraint',
  'primary', 'foreign', 'key', 'references',
  'unique', 'check', 'default', 'column', 'add', 'modify', 'rename',
  'grant', 'revoke', 'do', 'nothing', 'conflict',
  'returning', 'case', 'when', 'then', 'else', 'end', 'as',
  'interval', 'day', 'month', 'year', 'hour', 'minute', 'second',
  'coalesce', 'nullif', 'least', 'greatest', 'abs', 'round',
  'sum', 'count', 'avg', 'min', 'max', 'array_agg', 'string_agg',
  'row_number', 'rank', 'dense_rank', 'ntile', 'lag', 'lead',
  'first_value', 'last_value', 'nth_value',
  'buckets',  // storage.buckets, not a user table
  'conflito', // alias in a SELECT INTO
]);

function isLikelyTable(name) {
  if (!name || name.length < 3) return false;
  const n = name.toLowerCase();
  
  // SQL keywords
  if (sqlKeywords.has(n)) return false;
  
  // System schemas
  if (systemSchemas.has(n)) return false;
  
  // pg_ system catalogs
  if (/^pg_/.test(n)) return false;
  
  // PL/pgSQL variables
  for (const pat of plpgsqlVarPatterns) {
    if (pat.test(n)) return false;
  }
  
  // Known columns
  if (knownColumns.has(n)) return false;
  
  // Looks like a variable (v_ prefix)
  if (/^v_/.test(n)) return false;
  
  // Single letter or very short
  if (n.length <= 2) return false;
  
  // Numbers only
  if (/^\d+$/.test(n)) return false;
  
  // Must be a valid identifier
  if (!/^[a-z][a-z0-9_]*$/.test(n)) return false;
  
  return true;
}

// Find missing tables
const missing = [];
for (const [table, contexts] of referencedTables) {
  if (createdTables.has(table)) continue;
  if (!isLikelyTable(table)) continue;
  missing.push({ table, contexts: [...contexts].join(', ') });
}

missing.sort((a, b) => a.table.localeCompare(b.table));

console.log(`Created tables: ${createdTables.size}`);
console.log(`Referenced tables: ${referencedTables.size}`);
console.log(`\nMissing tables (referenced but never created): ${missing.length}\n`);
for (const { table, contexts } of missing) {
  console.log(`  ${table}`);
  console.log(`    ${contexts}`);
}
