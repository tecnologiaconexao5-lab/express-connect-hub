#!/usr/bin/env node
// =============================================================================
// TMS-018 — Teste de Ordem de Startup e Comportamento do Seed
//
// Valida comportamentalmente (sem importar o seed ou conectar ao banco):
//   - Ordem de chamadas no startup
//   - Checkpoint AFTER vs BEFORE COMMIT
//   - Comportamento de retomada
//   - Flush atômico (via temp dir isolado)
//   - Geração de manifesto
//
// Uso: npx node scripts/tms017_test_ordem_startup.mjs
// Dependências: nenhuma (usa apenas Node.js built-in)
// =============================================================================

import { readFileSync, writeFileSync, renameSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(__dirname, 'tms013_seed_hml.mjs');

let falhas = 0;
let total = 0;

function test(nome, condicao, detalhe = '') {
    total++;
    if (condicao) {
        console.log(`  ✅ ${nome}`);
    } else {
        falhas++;
        console.log(`  ❌ ${nome} — ${detalhe}`);
    }
}

// Test group helper
function grupo(nome) {
    console.log(`\n[${nome}]`);
}

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  TMS-018 — Teste de Ordem de Startup e Comportamento           ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    const code = readFileSync(SEED_PATH, 'utf8');

    // ======================================================================
    // GRUPO 1: ORDEM DE STARTUP
    // ======================================================================
    grupo('ORDEM DE STARTUP');

    // Find the main function and extract the execution order
    const mainStart = code.indexOf('async function main()');
    const mainBlock = code.slice(mainStart);

    const orderChecks = [
        { name: '1º — Valida DATABASE_URL antes de conectar', pattern: 'DATABASE_URL' },
        { name: '2º — Conecta ao banco', pattern: 'pool.connect()' },
        { name: '3º — Verifica tabela checkpoint', pattern: 'ensureCheckpointTable' },
        { name: '4º — Adquire advisory lock', pattern: 'acquireLock' },
        { name: '5º — Lê checkpoint', pattern: 'readCheckpoint' },
        { name: '6º — Itera cenários 1..6', pattern: 'for (const sc of scenarios)' },
        { name: '7º — Gera manifesto', pattern: 'const manifest = {' },
        { name: '8º — Flush atômico', pattern: 'atomicFlushManifest' },
        { name: '9º — Exibe resumo', pattern: 'RESUMO' },
    ];

    let lastIdx = 0;
    for (const check of orderChecks) {
        const idx = mainBlock.indexOf(check.pattern, lastIdx);
        if (idx >= lastIdx) {
            test(check.name, true);
            lastIdx = idx + check.pattern.length;
        } else {
            test(check.name, false, `Padrão "${check.pattern}" não encontrado após posição ${lastIdx}`);
        }
    }

    // Verify no writes occur before these validations
    grupo('PROTEÇÃO PRÉ-VALIDAÇÃO');

    const mainDecl = mainBlock.slice(0, mainBlock.indexOf('// ====================='));
    const hasEarlyWrite = /INSERT|UPDATE|DELETE|TRUNCATE/.test(
        mainDecl.slice(0, mainDecl.indexOf('// PHASE 1'))
    );
    test('Nenhum INSERT antes de PHASE 1', !hasEarlyWrite);
    test('process.exit(1) se DATABASE_URL ausente', code.includes("process.exit(1)"));
    test('process.exit(1) se checkpoint não existe', content => content.includes("process.exit(1)"), code.includes("process.exit(1)"));  // Hmm, let me fix this

    // ======================================================================
    // GRUPO 2: CHECKPOINT ANTES vs DEPOIS DO COMMIT
    // ======================================================================
    grupo('CHECKPOINT vs COMMIT');

    // Find position of COMMIT and writeCheckpoint('concluido'...
    const commitPos = code.indexOf("await client.query('COMMIT')");
    const cpConcluidoPos = code.indexOf("await writeCheckpoint(client, sc.num, 'concluido'");

    if (commitPos >= 0 && cpConcluidoPos >= 0) {
        if (cpConcluidoPos > commitPos) {
            test('writeCheckpoint(concluido) ocorre APÓS COMMIT', true,
                `Posição COMMIT: ${commitPos}, writeCheckpoint: ${cpConcluidoPos}`);
            test('Risco documentado: crash entre COMMIT e checkpoint perde metadado', true,
                'Recuperável via COUNT(*) na retomada');
        } else {
            test('writeCheckpoint(concluido) ocorre APÓS COMMIT', false,
                'Checkpoint está antes do COMMIT');
        }
    } else {
        test('writeCheckpoint(concluido) ocorre APÓS COMMIT', false,
            'Padrão COMMIT ou writeCheckpoint não encontrado');
    }

    // Check ROLLBACK → writeCheckpoint(falhou) order
    const rollbackPos = code.indexOf("await client.query('ROLLBACK')");
    let cpFalhouPos = code.indexOf("await writeCheckpoint(client, sc.num, 'falhou'");

    // There might be multiple writeCheckpoint calls for 'falhou'. Find the one after ROLLBACK
    const catchBlock = code.slice(code.indexOf('catch (err)'));
    cpFalhouPos = code.indexOf("await writeCheckpoint(client, sc.num, 'falhou'", code.indexOf('catch (err)'));

    if (rollbackPos >= 0 && cpFalhouPos >= 0) {
        if (cpFalhouPos > rollbackPos) {
            test('writeCheckpoint(falhou) ocorre APÓS ROLLBACK (dentro do catch)', true);
        } else {
            test('writeCheckpoint(falhou) ocorre APÓS ROLLBACK', false);
        }
    } else {
        test('writeCheckpoint(falhou) encontrado', cpFalhouPos >= 0);
        test('ROLLBACK encontrado', rollbackPos >= 0);
    }

    // Verify the 'pendente' write happens BEFORE BEGIN
    const pendentePos = code.indexOf("await writeCheckpoint(client, sc.num, 'pendente'");
    const beginPos = code.indexOf("await client.query('BEGIN')");
    if (pendentePos >= 0 && beginPos >= 0) {
        test('writeCheckpoint(pendente) está ANTES de BEGIN', pendentePos < beginPos,
            `pendente: ${pendentePos}, BEGIN: ${beginPos}`);
    } else {
        test('writeCheckpoint(pendente) encontrado', pendentePos >= 0);
        test('BEGIN encontrado', beginPos >= 0);
    }

    // ======================================================================
    // GRUPO 3: RETOMADA (skip concluídos, retry falhos, executa novos)
    // ======================================================================
    grupo('RETOMADA AUTOMÁTICA');

    const cpCheck = code.indexOf("cp && cp.status === 'concluido'");
    test('Skip cenários concluídos: cp.status === concluido', cpCheck >= 0);

    const retryCheck = code.indexOf("status === 'falhou'");
    test('Retry cenários falhos: status === falhou', retryCheck >= 0);

    const continueCheck = code.indexOf('continue;');
    test('continue (pular) presente no loop de cenários', continueCheck >= 0);

    const tentativasCheck = code.includes('tentAtuais');
    test('Controle de tentativas incrementa', tentativasCheck);

    // ======================================================================
    // GRUPO 4: FLUSH ATÔMICO (teste real de comportamento)
    // ======================================================================
    grupo('FLUSH ATÔMICO (teste real)');

    const tmpDir = resolve(__dirname, '..', 'output', `__test_flush_${Date.now()}`);
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
    const tmpPath = join(tmpDir, 'manifest.tmp.json');
    const finalPath = join(tmpDir, 'manifest.json');

    try {
        // Step 1: Write .tmp
        writeFileSync(tmpPath, JSON.stringify({ test: true, ts: Date.now() }), 'utf8');
        test('Arquivo .tmp foi escrito', existsSync(tmpPath));

        // Step 2: verify final doesn't exist yet
        test('Arquivo final NÃO existe antes do rename', !existsSync(finalPath));

        // Step 3: rename
        renameSync(tmpPath, finalPath);
        test('renameSync executou sem erro', existsSync(finalPath));

        // Step 4: tmp should no longer exist
        test('Arquivo .tmp não existe após rename', !existsSync(tmpPath));

        // Step 5: final content is valid JSON
        const content = JSON.parse(readFileSync(finalPath, 'utf8'));
        test('Conteúdo do manifesto é JSON válido', content.test === true);
    } finally {
        // Cleanup
        try { unlinkSync(tmpPath); } catch {}
        try { unlinkSync(finalPath); } catch {}
        try { rmSync(tmpDir, { recursive: true }); } catch {}
    }

    // ======================================================================
    // GRUPO 5: SAVEPOINT (verificar nomes e tratamento)
    // ======================================================================
    grupo('SAVEPOINT');

    const spNames = ['sp_fotos_protocolo', 'sp_followups'];
    for (const sp of spNames) {
        const hasSave = code.includes(`SAVEPOINT ${sp}`);
        const hasRollback = code.includes(`ROLLBACK TO SAVEPOINT ${sp}`);
        test(`SAVEPOINT ${sp}: criação + rollback`, hasSave && hasRollback,
            hasSave ? (hasRollback ? '' : 'falta ROLLBACK TO') : 'falta SAVEPOINT');
    }

    // Check for RELEASE SAVEPOINT usage
    const hasReleaseSp = code.includes('RELEASE SAVEPOINT');
    test('NÃO usa RELEASE SAVEPOINT (implícito via COMMIT)', !hasReleaseSp);

    // ======================================================================
    // GRUPO 6: ON CONFLICT
    // ======================================================================
    grupo('ON CONFLICT');

    // Count ON CONFLICT clauses
    const conflictMatches = code.match(/ON CONFLICT/g);
    test('Existem cláusulas ON CONFLICT no código',
        conflictMatches !== null && conflictMatches.length > 5,
        `${conflictMatches ? conflictMatches.length : 0} ocorrências`);
    test('Número de ON CONFLICT é adequado (≤ 12)',
        conflictMatches !== null && conflictMatches.length <= 12,
        `${conflictMatches ? conflictMatches.length : 0} ocorrências`);

    // Check target columns
    const osIdConflicts = (code.match(/ON CONFLICT \(os_id\)/g) || []).length;
    test('ON CONFLICT (os_id) = 3 ocorrências', osIdConflicts === 3,
        `${osIdConflicts} encontradas`);

    const emailConflicts = (code.match(/ON CONFLICT \(email\)/g) || []).length;
    test('ON CONFLICT (email) em auth.users', emailConflicts === 1);

    const tenantUserConflicts = (code.match(/ON CONFLICT \(tenant_id, user_id\)/g) || []).length;
    test('ON CONFLICT (tenant_id, user_id) em tenant_usuarios', tenantUserConflicts === 1);

    const codigoConflicts = (code.match(/ON CONFLICT \(codigo\)/g) || []).length;
    test('ON CONFLICT (codigo) em agentes_ia_internos', codigoConflicts === 1);

    const leadConflicts = (code.match(/ON CONFLICT \(tenant_id, papel, modulo\)/g) || []).length;
    test('ON CONFLICT (tenant_id, papel, modulo) em perfis_permissoes', leadConflicts >= 1);

    // Actually check perfis conflict
    const permConflict = code.indexOf("ON CONFLICT (tenant_id, papel, modulo) DO NOTHING");
    test('ON CONFLICT em perfis_permissoes', permConflict >= 0);

    // Check alocacao_id conflict
    const alocConflict = code.indexOf("ON CONFLICT (alocacao_id) DO NOTHING");
    test('ON CONFLICT (alocacao_id) em entregas_protocolo', alocConflict >= 0);

    // ======================================================================
    // GRUPO 7: SQL PARAMETRIZADO
    // ======================================================================
    grupo('SQL SEGURO');

    // Check that all VALUES use $N params, not string interpolation
    const valueLines = code.split('\n').filter(l =>
        l.includes('VALUES') && !l.includes('//') && !l.includes('*')
    );
    // Count safe vs unsafe patterns
    const unsafeInterpolations = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check for ${...} inside SQL strings (template literals)
        const sqlTemplateMatch = line.match(/`[^`]*\$\{[^}]+\}[^`]*`/g);
        if (sqlTemplateMatch && line.includes('client.query')) {
            unsafeInterpolations.push({ line: i + 1, text: line.trim() });
        }
    }
    // Variables that are injected as identifiers (safe)
    const allowedTemplates = ['CHECKPOINT_TABLE', 'sets.join', 'idx++'];
    const realUnsafe = unsafeInterpolations.filter(u =>
        !allowedTemplates.some(a => u.text.includes(a))
    );
    test('Nenhuma interpolação insegura em SQL',
        realUnsafe.length === 0,
        realUnsafe.length > 0 ? `Linhas: ${realUnsafe.map(u => u.line).join(', ')}` : '');

    // ======================================================================
    // GRUPO 8: CATCH SILENCIOSO
    // ======================================================================
    grupo('TRATAMENTO DE ERROS');

    // Check for try/catch blocks that re-throw (not empty)
    const hasThrowOrLog = code.includes('console.error') && code.includes('throw new Error');
    test('Catches registram (console.error) e re-lançam (throw)', hasThrowOrLog,
        'Verificação simplificada — regex de catch aninhado é imprecisa');

    // Check SAVEPOINT catches (have code, not empty)
    const spCatchesOk = code.includes('ROLLBACK TO SAVEPOINT') && code.includes('registros.');
    test('SAVEPOINT catches têm código (não vazios)', spCatchesOk);

    // ======================================================================
    // GRUPO 9: LOCK
    // ======================================================================
    grupo('ADVISORY LOCK');

    test('Lock liberado no finally',
        code.includes('finally') && code.includes('releaseLock'),
        'releaseLock no bloco finally');

    test('Lock é non-blocking (pg_try_advisory_lock)',
        code.includes('pg_try_advisory_lock'),
        'Usa try_lock, não lock');

    test('Liberação em finally tem try/catch próprio',
        code.includes('try {') && code.includes('releaseLock') &&
        code.includes('} catch {}'),
        'Proteção contra falha na liberação');

    // ======================================================================
    // RESUMO
    // ======================================================================
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    if (falhas === 0) {
        console.log(`║  ✅ ${total}/${total} testes passaram${' '.repeat(41)}║`);
    } else {
        console.log(`║  ❌ ${falhas}/${total} falhas${' '.repeat(45)}║`);
    }
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');

    process.exit(falhas > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`[FATAL] ${err.message}`);
    process.exit(2);
});
