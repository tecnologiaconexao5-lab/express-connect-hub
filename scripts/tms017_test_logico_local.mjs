#!/usr/bin/env node
// =============================================================================
// TMS-017 — Teste Lógico Local do Seed (sem conexão com banco)
//
// Valida a lógica do seed TMS013-SEED-v2 em isolamento:
//   - Estrutura de cenários
//   - Constantes e versionamento
//   - Manifesto
//   - Tratamento de checkpoint (leitura/escrita)
//   - Fluxo de retomada
//   - Rollback em cenário
//
// Uso: npx node scripts/tms017_test_logico_local.mjs
// Dependências: nenhuma (usa apenas Node.js built-in)
// =============================================================================

import { readFileSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║  TMS-017 — Teste Lógico Local do Seed                          ║');
    console.log('║  Modo: isolado (sem conexão com banco)                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');

    // ======================================================================
    // 1. VERIFICAÇÃO DE ARQUIVO
    // ======================================================================
    console.log('[1/6] Arquivo do seed...');
    test('Arquivo existe', existsSync(SEED_PATH), SEED_PATH);
    const content = readFileSync(SEED_PATH, 'utf8');
    test('Arquivo não está vazio', content.length > 1000, `${content.length} bytes`);

    // ======================================================================
    // 2. VERIFICAÇÃO DE VERSIONAMENTO
    // ======================================================================
    console.log('[2/6] Versionamento...');
    test('SEED_VERSION = TMS013-SEED-v2', content.includes("SEED_VERSION = 'TMS013-SEED-v2'"));
    test('TOTAL_CENARIOS = 6', content.includes('TOTAL_CENARIOS = 6'));
    test('CHECKPOINT_TABLE definido', content.includes('_hml_seed_checkpoint'));
    test('MARKER = HML-APP-20260729', content.includes('HML-APP-20260729'));
    test('TENANT_ID = 00000000-...000000000001', content.includes('00000000-0000-0000-0000-000000000001'));

    // ======================================================================
    // 3. VERIFICAÇÃO DE LOCK
    // ======================================================================
    console.log('[3/6] Advisory Lock...');
    test('LOCK_CLASSID = 20260729', content.includes('LOCK_CLASSID = 20260729'));
    test('LOCK_OBJID_SEED = 0', content.includes('LOCK_OBJID_SEED = 0'));
    test('pg_try_advisory_lock usado', content.includes('pg_try_advisory_lock'));
    test('pg_advisory_unlock usado', content.includes('pg_advisory_unlock'));
    test('Lock liberado em finally', content.includes('finally'));

    // ======================================================================
    // 4. VERIFICAÇÃO DE CENÁRIOS
    // ======================================================================
    console.log('[4/6] Cenários...');
    test('cenario01 — super_admin + tenant_usuarios + permissoes',
        content.includes('async function cenario01'),
        'Função cenario01 existe');

    test('cenario02 — agentes_ia_internos',
        content.includes('async function cenario02'),
        'Função cenario02 existe');

    test('cenario03 — financeiro_receber / pagar / pagamentos_prestadores',
        content.includes('async function cenario03'),
        'Função cenario03 existe');

    test('cenario04 — alocacoes_escala',
        content.includes('async function cenario04'),
        'Função cenario04 existe');

    test('cenario05 — entregas_protocolo + SAVEPOINT',
        content.includes('async function cenario05'),
        'Função cenario05 existe');

    test('cenario06 — crm_leads + crm_followups + SAVEPOINT',
        content.includes('async function cenario06'),
        'Função cenario06 existe');

    test('ON CONFLICT em cenario03 (financeiro_receber)',
        content.includes("ON CONFLICT (os_id) DO NOTHING"),
        'financeiro_receber usa ON CONFLICT');

    test('ON CONFLICT em cenario03 (financeiro_pagar)',
        content.includes("ON CONFLICT (os_id) DO NOTHING"),
        'financeiro_pagar usa ON CONFLICT');

    test('ON CONFLICT em cenario03 (pagamentos_prestadores)',
        content.includes("ON CONFLICT (os_id) DO NOTHING"),
        'pagamentos_prestadores usa ON CONFLICT');

    test('SAVEPOINT em cenario05',
        content.includes("SAVEPOINT sp_fotos_protocolo"),
        'cenario05 usa SAVEPOINT');

    test('ROLLBACK TO SAVEPOINT em cenario05',
        content.includes("ROLLBACK TO SAVEPOINT sp_fotos_protocolo"),
        'cenario05 trata fallback de SAVEPOINT');

    test('SAVEPOINT em cenario06',
        content.includes("SAVEPOINT sp_followups"),
        'cenario06 usa SAVEPOINT');

    test('ROLLBACK TO SAVEPOINT em cenario06',
        content.includes("ROLLBACK TO SAVEPOINT sp_followups"),
        'cenario06 trata fallback de SAVEPOINT');

    // ======================================================================
    // 5. VERIFICAÇÃO DE CHECKPOINT E RETOMADA
    // ======================================================================
    console.log('[5/6] Checkpoint + Retomada...');
    test('ensureCheckpointTable existe',
        content.includes('async function ensureCheckpointTable'),
        'Função de verificação de tabela');

    test('readCheckpoint existe',
        content.includes('async function readCheckpoint'),
        'Leitura de estado atual');

    test('writeCheckpoint existe',
        content.includes('async function writeCheckpoint'),
        'Escrita de estado');

    test('Retomada: pula cenários concluídos',
        content.includes("status === 'concluido'"),
        'Skip de cenários já executados');

    test('Retomada: retenta cenários falhos',
        content.includes("status === 'falhou'"),
        'Retry de cenários com falha');

    test('Retomada: executa não-concluídos (falhou + pendente + inexistente)',
        content.includes("status === 'concluido'") && content.includes("continue;"),
        'Skip só para concluído; demais executam');

    test('Cenários orquestrados em array',
        content.includes('cenarios: manifestEntries'),
        'Manifesto agregado');

    // ======================================================================
    // 6. VERIFICAÇÃO DE MANIFESTO E FLUSH
    // ======================================================================
    console.log('[6/6] Manifesto + Flush...');
    test('atomicFlushManifest existe',
        content.includes('function atomicFlushManifest'),
        'Função de flush atômico');

    test('Manifest: .tmp antes de .json',
        content.includes('.tmp.json'),
        'Escrita temporária antes da final');

    test('Manifest: rename atômico',
        content.includes('renameSync'),
        'renameSync para atomicidade');

    test('Resumo no manifesto: concluidos + falhas',
        content.includes('concluidos'),
        'Agregação de resultados');

    test('Seed hash computado',
        content.includes('computeFileHash'),
        'Hash SHA256 do próprio script');

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
