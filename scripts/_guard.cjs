'use strict';
// =============================================================================
// TMS-FIN-DATA-04D1 — GUARD CENTRAL FAIL-CLOSED (scripts/harnesses de teste)
// =============================================================================
// Objetivo: impedir que harnesses de TESTE escrevam em PRODUCAO por padrao.
// NAO acessa rede, banco, Supabase, fetch ou process spawn. Modulo PURO e testavel.
// Compat: CJS (require), ESM (_guard.mjs), TS/tsx (via _guard.d.ts + _guard.mjs).
//
// Contrato:
//   - Escrita de teste SO e permitida quando: destino = projeto QA/HML
//     (URL/DATABASE_URL) E ENVIRONMENT/VITE_MODE coerente (qa/hml ou ausente)
//     E ALLOW_TEST_WRITES=true.
//   - PROD bloqueia SEMPRE (inclusive com ALLOW_TEST_WRITES=true).
//   - Ausente / desconhecido / contraditorio => BLOQUEIA (fail closed).
//   - Nenhuma mensagem expoe segredos (service_role/anon/senha). Apenas project ref.
// =============================================================================

const PROD_REF = 'uwrvzsjtpgaifkktpepn';
const QA_REF = 'aqpfayildtcnrkfeeyjg';
const ALLOW_TEST_WRITES_FLAG = 'ALLOW_TEST_WRITES';

const QA_ENVS = new Set(['qa', 'hml', 'homolog', 'homologacao']);
const PROD_ENVS = new Set(['production', 'prod', 'producao']);

/** Extrai o project ref de uma URL Supabase (https://<ref>.supabase.co|in). */
function refFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in)\b/i);
  return m ? m[1].toLowerCase() : null;
}

/** Extrai o project ref de uma DATABASE_URL (pooler/direto). Nao retorna senha. */
function refFromDatabaseUrl(db) {
  if (!db || typeof db !== 'string') return null;
  // Pooler/session: usuario "postgres.<ref>" (seguido de ':' ou '@').
  let m = db.match(/postgres\.([a-z0-9]{15,})[:@/]/i);
  if (m) return m[1].toLowerCase();
  // Direto: db.<ref>.supabase.<tld>
  m = db.match(/@?db\.([a-z0-9]{15,})\.supabase\./i);
  if (m) return m[1].toLowerCase();
  // Host <ref>.supabase.<tld> (refs tem 15+ chars; exclui "pooler").
  m = db.match(/([a-z0-9]{15,})\.supabase\.(co|com|in)/i);
  return m ? m[1].toLowerCase() : null;
}

function tipoFromRef(ref) {
  if (ref === PROD_REF) return 'prod';
  if (ref === QA_REF) return 'qa';
  return ref ? 'unknown' : 'absent';
}

/** Detecta ambiente a partir do env (nao imprime segredos). */
function detectAmbiente(env) {
  const e = env || process.env;
  const urlRef = refFromUrl(e.VITE_SUPABASE_URL || e.SUPABASE_URL || '');
  const dbRef = refFromDatabaseUrl(e.DATABASE_URL || '');
  const declared = String(e.ENVIRONMENT || e.VITE_MODE || '').toLowerCase().trim();
  return { urlRef, dbRef, declared, ref: urlRef || dbRef || null };
}

/**
 * Avalia (sem lancar) se escrita de teste e permitida. Fail-closed.
 * Retorna { bloqueado, motivo[], tipo, ref, optIn, declared, acao }.
 */
function avaliarTestWrite(acao, env) {
  const e = env || process.env;
  const a = acao || 'escrita de teste';
  const d = detectAmbiente(e);
  const optIn = String(e[ALLOW_TEST_WRITES_FLAG] || '').toLowerCase() === 'true';
  const declQA = QA_ENVS.has(d.declared);
  const declProd = PROD_ENVS.has(d.declared);
  const tipo = tipoFromRef(d.ref);
  const motivo = [];
  const block = (m) => motivo.push(m);

  if (!d.ref) block('URL/PROJECT REF ausente (fail-closed)');
  if (tipo === 'unknown') block('Project ref nao reconhecido: ' + d.ref);
  if (d.urlRef && d.dbRef && d.urlRef !== d.dbRef) {
    block('Contradicao: VITE_SUPABASE_URL e DATABASE_URL apontam para projetos diferentes');
  }
  if (tipo === 'prod') {
    block('Destino = PRODUCAO (' + PROD_REF + '). Test writes bloqueados por padrao.');
  }
  if (declQA && tipo === 'prod') block('Contradicao: ENVIRONMENT=qa/hml mas destino=PRODUCAO.');
  if (declProd && tipo === 'qa') block('Contradicao: ENVIRONMENT=prod mas destino=QA.');
  if (declProd) block('ENVIRONMENT declara producao (test writes nao permitidos).');
  if (!declQA && !declProd && d.declared) block('ENVIRONMENT nao reconhecido: ' + d.declared);
  if (tipo !== 'qa') block('Somente projeto QA/HML permite escrita de teste.');
  if (!optIn) block('Opt-in ausente: defina ' + ALLOW_TEST_WRITES_FLAG + '=true para escrita de teste.');

  return { bloqueado: motivo.length > 0, motivo, tipo, ref: d.ref, optIn, declared: d.declared, acao: a };
}

/** Lanca se escrita de teste nao for permitida (uso nos harnesses de escrita). */
function guardTestWrite(acao, env) {
  const r = avaliarTestWrite(acao, env);
  if (r.bloqueado) {
    const err = new Error('TEST WRITE BLOCKED — ' + r.acao + ' | ' + r.motivo.join(' ; '));
    err.code = 'GUARD_BLOCKED';
    err.info = r;
    throw err;
  }
  return r;
}

/** Variante booleana (sem lancar). */
function canTestWrite(acao, env) {
  return !avaliarTestWrite(acao, env).bloqueado;
}

/**
 * Carrega env do harness preferindo .env.qa (QA) e, como fallback, .env.
 * NAO sobrescreve variaveis ja definidas (dotenv nao override por padrao):
 * logo, se .env.qa existir, seus valores tem prioridade sobre .env.
 * Nao altera arquivos. Retorna string de status (sem segredos).
 */
function loadHarnessEnv(baseDir) {
  try {
    const dotenv = require('dotenv');
    const path = require('path');
    const dir = baseDir || process.cwd();
    const r1 = dotenv.config({ path: path.resolve(dir, '.env.qa') });
    const r2 = dotenv.config({ path: path.resolve(dir, '.env') });
    const qa = !r1.error;
    const base = !r2.error;
    return qa ? 'qa' : (base ? 'env' : 'none');
  } catch (err) {
    return 'none';
  }
}

/**
 * Entrada padronizada para harnesses: carrega env (QA preferencial) e aplica o
 * guard fail-closed ANTES de qualquer conexao/escrita. Lanca se bloqueado.
 */
function guardHarness(nome, opts) {
  const o = opts || {};
  let envSource = null;
  if (o.loadEnv !== false) envSource = loadHarnessEnv(o.baseDir);
  const r = guardTestWrite(nome);
  return { ...r, envSource };
}

module.exports = {
  PROD_REF,
  QA_REF,
  ALLOW_TEST_WRITES_FLAG,
  PROD: PROD_REF,
  QA: QA_REF,
  refFromUrl,
  refFromDatabaseUrl,
  tipoFromRef,
  detectAmbiente,
  avaliarTestWrite,
  guardTestWrite,
  canTestWrite,
  loadHarnessEnv,
  guardHarness,
};
module.exports.default = module.exports;
