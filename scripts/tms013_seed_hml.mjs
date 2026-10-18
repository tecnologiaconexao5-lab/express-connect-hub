#!/usr/bin/env node
// =============================================================================
// TMS013-SEED-v2 — Seed de Homologação com Idempotência C (Arquitetura TMS-016)
// MISSÃO TMS-017 — Implementação Completa
//
// Dependências: pg (node-postgres)
// Uso: npx node scripts/tms013_seed_hml.mjs
// .env necessário: DATABASE_URL
//
// @version TMS013-SEED-v2
// @marker  HML-APP-20260729
// =============================================================================

import pg from 'pg';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostname } from 'node:os';
import { guardHarness } from './_guard.mjs';

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness('scripts/tms013_seed_hml.mjs');

// =============================================================================
// SEED VERSION
// =============================================================================
const SEED_VERSION = 'TMS013-SEED-v2';
const TOTAL_CENARIOS = 6;
const CHECKPOINT_TABLE = 'public._hml_seed_checkpoint';
const MARKER = process.env.HML_MARKER || 'HML-APP-20260729';
const TENANT_ID_RAW = process.env.HML_TENANT_ID || '00000000-0000-0000-0000-000000000001';
const HOSTNAME = hostname();
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Advisory lock IDs (2-arg form: pg_try_advisory_lock(classid, objid))
const LOCK_CLASSID = 20260729;     // TMS-017 date
const LOCK_OBJID_SEED = 0;         // Global seed lock
const LOCK_OBJID_BASE_SCENARIO = 100; // Per-scenario lock = 100 + scenarioNum

// Manifest path
const MANIFEST_DIR = resolve(PROJECT_ROOT, 'output');
if (!existsSync(MANIFEST_DIR)) {
    mkdirSync(MANIFEST_DIR, { recursive: true });
}
const MANIFEST_PATH = resolve(MANIFEST_DIR, `hml_seed_manifest.${MARKER}.json`);
const MANIFEST_TMP_PATH = MANIFEST_PATH.replace('.json', '.tmp.json');

// =============================================================================
// TENANT
// =============================================================================
const TENANT_ID = TENANT_ID_RAW;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sha256(data) {
    return createHash('sha256').update(data, 'utf8').digest('hex').toUpperCase();
}

function computeFileHash(filePath) {
    const content = readFileSync(filePath, 'utf8');
    return sha256(content);
}

function formatISO() {
    return new Date().toISOString();
}

/**
 * Get advisory lock key for a scenario or operation.
 * Returns two integers for pg_try_advisory_lock(classid, objid).
 * classid is always LOCK_CLASSID; objid identifies the resource.
 */
function lockKey(objid) {
    return [LOCK_CLASSID, objid];
}

/**
 * Helper: aquire advisory lock (non-blocking try).
 * Returns true if lock was acquired, false if already held.
 */
async function acquireLock(client, objid) {
    const [cls, obj] = lockKey(objid);
    const res = await client.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [cls, obj]);
    return res.rows[0].locked;
}

/**
 * Helper: release advisory lock.
 */
async function releaseLock(client, objid) {
    const [cls, obj] = lockKey(objid);
    await client.query('SELECT pg_advisory_unlock($1, $2)', [cls, obj]);
}

/**
 * Ensure checkpoint table exists. Will NOT create it — only verify and guide.
 */
async function ensureCheckpointTable(client) {
    const res = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = '_hml_seed_checkpoint'
        ) AS exists
    `);
    if (!res.rows[0].exists) {
        console.error('');
        console.error('╔══════════════════════════════════════════════════════════════════╗');
        console.error('║  ERRO: Tabela de checkpoint NÃO existe.                        ║');
        console.error('║                                                                ║');
        console.error('║  Para criar, execute manualmente:                              ║');
        console.error('║    psql -f supabase/scripts/create_hml_seed_checkpoint.sql     ║');
        console.error('║                                                                ║');
        console.error('║  Ou via Supabase Dashboard > SQL Editor: cole e execute        ║');
        console.error('║  o conteúdo de supabase/scripts/create_hml_seed_checkpoint.sql ║');
        console.error('╚══════════════════════════════════════════════════════════════════╝');
        console.error('');
        process.exit(1);
    }
}

/**
 * Read current checkpoint state for this MARKER.
 * Returns a Map<cenario, row>.
 */
async function readCheckpoint(client) {
    const res = await client.query(`
        SELECT cenario, status, tentativas, erro, iniciado_em, concluido_em, duracao_ms
        FROM ${CHECKPOINT_TABLE}
        WHERE marcador = $1
        ORDER BY cenario ASC
    `, [MARKER]);
    const map = new Map();
    for (const row of res.rows) {
        map.set(row.cenario, row);
    }
    return map;
}

/**
 * Write or update checkpoint for a given scenario.
 */
async function writeCheckpoint(client, cenario, status, opts = {}) {
    const { erro = null, duracao_ms = null, tentativas = null, iniciado_em = null } = opts;
    // Check if row exists
    const exists = await client.query(`
        SELECT 1 FROM ${CHECKPOINT_TABLE}
        WHERE marcador = $1 AND cenario = $2
    `, [MARKER, cenario]);

    if (exists.rows.length > 0) {
        // Update existing
        const sets = ['status = $3', 'updated_at = now()'];
        const params = [MARKER, cenario, status];
        let idx = 4;
        if (erro !== null) { sets.push(`erro = $${idx++}`); params.push(erro); }
        if (duracao_ms !== null) { sets.push(`duracao_ms = $${idx++}`); params.push(duracao_ms); }
        if (tentativas !== null) { sets.push(`tentativas = $${idx++}`); params.push(tentativas); }
        if (iniciado_em !== null) { sets.push(`iniciado_em = $${idx++}`); params.push(iniciado_em); }
        if (status === 'concluido') { sets.push(`concluido_em = $${idx++}`); params.push(formatISO()); }
        await client.query(
            `UPDATE ${CHECKPOINT_TABLE} SET ${sets.join(', ')} WHERE marcador = $1 AND cenario = $2`,
            params
        );
    } else {
        // Insert new
        await client.query(`
            INSERT INTO ${CHECKPOINT_TABLE}
                (marcador, cenario, seed_version, status, tentativas, erro, iniciado_em, executado_por)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            MARKER, cenario, SEED_VERSION, status,
            tentativas ?? 0, erro, iniciado_em ?? formatISO(), HOSTNAME
        ]);
    }
}

/**
 * Atomic manifest flush: write to .tmp, then rename to final.
 * This prevents partial/corrupt manifest reads.
 */
function atomicFlushManifest(manifest) {
    const json = JSON.stringify(manifest, null, 2);
    writeFileSync(MANIFEST_TMP_PATH, json, 'utf8');
    renameSync(MANIFEST_TMP_PATH, MANIFEST_PATH);
    const sizeBytes = Buffer.byteLength(json, 'utf8');
    return { path: MANIFEST_PATH, sizeBytes };
}

// =============================================================================
// SCENARIO 1 — Usuário super_admin + tenant_usuarios + perfis_permissoes
// =============================================================================
async function cenario01(client) {
    const registros = {};

    // 1a. Verificar se super_admin já existe em auth.users
    const authRes = await client.query(
        `SELECT id FROM auth.users WHERE email = $1`,
        ['tamiris.castilho@conexaoexpress.com.br']
    );
    let authUserId;
    if (authRes.rows.length > 0) {
        authUserId = authRes.rows[0].id;
        registros.auth_users = { status: 'ja_existia', id: authUserId };
    } else {
        // Criar em auth.users
        const insertRes = await client.query(`
            INSERT INTO auth.users
                (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                 raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                 confirmation_token, email_change, email_change_token_new, recovery_token)
            VALUES
                ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
                 'authenticated', 'authenticated',
                 'tamiris.castilho@conexaoexpress.com.br',
                 '$2a$10$/placeholder_do_not_use_directly',
                 now(),
                 '{"provider":"email","providers":["email"]}',
                 '{"papel":"super_admin","nome":"Tamiris Castilho"}',
                 now(), now(),
                 '', '', '', '')
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        `);
        // If ON CONFLICT did nothing, fetch existing
        if (insertRes.rows.length > 0) {
            authUserId = insertRes.rows[0].id;
            registros.auth_users = { status: 'criado', id: authUserId };
        } else {
            const fallbackRes = await client.query(
                `SELECT id FROM auth.users WHERE email = $1`,
                ['tamiris.castilho@conexaoexpress.com.br']
            );
            authUserId = fallbackRes.rows[0].id;
            registros.auth_users = { status: 'ja_existia_conflito', id: authUserId };
        }
    }

    // 1b. Upsert tenant_usuarios
    const tenantRes = await client.query(`
        INSERT INTO public.tenant_usuarios
            (tenant_id, user_id, papel, nome_exibicao, ativo, created_at)
        VALUES
            ($1, $2, 'super_admin', 'Tamiris Castilho (HML)', true, now())
        ON CONFLICT (tenant_id, user_id) DO UPDATE
            SET papel = 'super_admin',
                nome_exibicao = 'Tamiris Castilho (HML)',
                ativo = true
        RETURNING id
    `, [TENANT_ID, authUserId]);
    registros.tenant_usuarios = { status: 'upserted', id: tenantRes.rows[0].id };

    // 1c. Verificar se perfis_permissoes já existem para este tenant
    const permCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.perfis_permissoes WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const permTotal = parseInt(permCount.rows[0].total, 10);

    if (permTotal === 0) {
        // Inserir 75 perfis_permissoes (7 papeis × ~11 módulos com sobreposições)
        const perfis = [
            // super_admin — tudo
            ...['dashboard', 'clientes', 'prestadores', 'ordens_servico', 'financeiro',
               'frota', 'cadastros_auxiliares', 'relatorios', 'configuracoes', 'admin_tenants',
               'operacao', 'contratos', 'comercial', 'rh', 'fiscal', 'comunicacao'].map(m => ({
                papel: 'super_admin', modulo: m, permissao: 'tudo'
            })),
            // admin_tenant — quase tudo
            ...['dashboard', 'clientes', 'prestadores', 'ordens_servico', 'financeiro',
               'frota', 'cadastros_auxiliares', 'relatorios', 'configuracoes', 'operacao',
               'contratos', 'comercial', 'rh', 'fiscal', 'comunicacao'].map(m => ({
                papel: 'admin_tenant', modulo: m, permissao: 'tudo'
            })),
            // financeiro
            { papel: 'financeiro', modulo: 'dashboard', permissao: 'ver' },
            { papel: 'financeiro', modulo: 'clientes', permissao: 'ver' },
            { papel: 'financeiro', modulo: 'prestadores', permissao: 'ver' },
            { papel: 'financeiro', modulo: 'ordens_servico', permissao: 'ver' },
            { papel: 'financeiro', modulo: 'financeiro', permissao: 'tudo' },
            { papel: 'financeiro', modulo: 'relatorios', permissao: 'ver_editar' },
            // comercial
            { papel: 'comercial', modulo: 'dashboard', permissao: 'ver' },
            { papel: 'comercial', modulo: 'clientes', permissao: 'ver_editar' },
            { papel: 'comercial', modulo: 'prestadores', permissao: 'ver' },
            { papel: 'comercial', modulo: 'ordens_servico', permissao: 'ver' },
            { papel: 'comercial', modulo: 'financeiro', permissao: 'ver' },
            { papel: 'comercial', modulo: 'cadastros_auxiliares', permissao: 'ver' },
            { papel: 'comercial', modulo: 'relatorios', permissao: 'ver' },
            { papel: 'comercial', modulo: 'contratos', permissao: 'tudo' },
            { papel: 'comercial', modulo: 'comercial', permissao: 'tudo' },
            // operacional
            { papel: 'operacional', modulo: 'dashboard', permissao: 'ver_editar' },
            { papel: 'operacional', modulo: 'clientes', permissao: 'ver_editar' },
            { papel: 'operacional', modulo: 'prestadores', permissao: 'ver_editar' },
            { papel: 'operacional', modulo: 'ordens_servico', permissao: 'ver_editar' },
            { papel: 'operacional', modulo: 'financeiro', permissao: 'ver' },
            { papel: 'operacional', modulo: 'frota', permissao: 'ver_editar' },
            { papel: 'operacional', modulo: 'cadastros_auxiliares', permissao: 'ver' },
            { papel: 'operacional', modulo: 'relatorios', permissao: 'ver' },
            { papel: 'operacional', modulo: 'operacao', permissao: 'tudo' },
            // atendimento
            { papel: 'atendimento', modulo: 'dashboard', permissao: 'ver' },
            { papel: 'atendimento', modulo: 'clientes', permissao: 'ver' },
            { papel: 'atendimento', modulo: 'prestadores', permissao: 'ver' },
            { papel: 'atendimento', modulo: 'ordens_servico', permissao: 'ver' },
            { papel: 'atendimento', modulo: 'frota', permissao: 'ver' },
            { papel: 'atendimento', modulo: 'comunicacao', permissao: 'tudo' },
            // cliente
            { papel: 'cliente', modulo: 'dashboard', permissao: 'ver' },
            { papel: 'cliente', modulo: 'ordens_servico', permissao: 'ver' },
            { papel: 'cliente', modulo: 'financeiro', permissao: 'ver' },
            { papel: 'cliente', modulo: 'relatorios', permissao: 'ver' },
            // prestador
            { papel: 'prestador', modulo: 'dashboard', permissao: 'ver' },
            { papel: 'prestador', modulo: 'ordens_servico', permissao: 'ver' },
            { papel: 'prestador', modulo: 'financeiro', permissao: 'ver' }
        ];

        let inserted = 0;
        for (const p of perfis) {
            await client.query(`
                INSERT INTO public.perfis_permissoes
                    (tenant_id, papel, modulo, permissao)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (tenant_id, papel, modulo) DO NOTHING
            `, [TENANT_ID, p.papel, p.modulo, p.permissao]);
            inserted++;
        }
        registros.perfis_permissoes = { status: 'inserido', total: inserted };
    } else {
        registros.perfis_permissoes = { status: 'ja_existia', total: permTotal };
    }

    return {
        cenario: 1,
        nome: 'Usuário super_admin + tenant_usuarios + perfis_permissoes',
        registros
    };
}

// =============================================================================
// SCENARIO 2 — Agentes IA Internos
// =============================================================================
async function cenario02(client) {
    const registros = {};
    const agentes = [
        {
            codigo: 'IA-FINANCEIRA', nome: 'IA Financeira',
            setor: 'financeiro', funcao: 'auditoria_calculos',
            email: 'ia.financeira@conexaoexpress.com.br',
            assinatura: 'IA-FINANCEIRA'
        },
        {
            codigo: 'IA-OPERACIONAL', nome: 'IA Operacional',
            setor: 'operacional', funcao: 'monitoramento_execucao',
            email: 'ia.operacional@conexaoexpress.com.br',
            assinatura: 'IA-OPERACIONAL'
        },
        {
            codigo: 'IA-COMERCIAL', nome: 'IA Comercial',
            setor: 'comercial', funcao: 'analise_prospeccao',
            email: 'ia.comercial@conexaoexpress.com.br',
            assinatura: 'IA-COMERCIAL'
        },
        {
            codigo: 'IA-AUDITORIA', nome: 'IA Auditoria',
            setor: 'ti', funcao: 'auditoria_logs',
            email: 'ia.auditoria@conexaoexpress.com.br',
            assinatura: 'IA-AUDITORIA'
        },
        {
            codigo: 'IA-ATENDIMENTO', nome: 'IA Atendimento',
            setor: 'atendimento', funcao: 'triagem_suporte',
            email: 'ia.atendimento@conexaoexpress.com.br',
            assinatura: 'IA-ATENDIMENTO'
        }
    ];

    let criados = 0;
    let existentes = 0;
    for (const a of agentes) {
        const res = await client.query(`
            INSERT INTO public.agentes_ia_internos
                (codigo, nome, setor, funcao, email_institucional, assinatura_execucao)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (codigo) DO UPDATE
                SET nome = EXCLUDED.nome,
                    setor = EXCLUDED.setor,
                    funcao = EXCLUDED.funcao,
                    email_institucional = EXCLUDED.email_institucional,
                    assinatura_execucao = EXCLUDED.assinatura_execucao
            RETURNING (xmax = 0) AS foi_inserido
        `, [a.codigo, a.nome, a.setor, a.funcao, a.email, a.assinatura]);

        if (res.rows[0]?.foi_inserido === true || res.rows[0]?.foi_inserido === null) {
            // xmax = 0 means inserted fresh; null means no conflict happened
            if (res.rows[0]?.foi_inserido !== false) criados++;
            else existentes++;
        } else {
            existentes++;
        }
    }
    registros.agentes_ia_internos = { status: criados > 0 ? 'inserido' : 'ja_existia', criados, existentes };

    return {
        cenario: 2,
        nome: '5 Agentes IA Internos',
        registros
    };
}

// =============================================================================
// SCENARIO 3 — Financeiro (receber + pagar + pagamentos_prestadores)
// =============================================================================
async function cenario03(client) {
    const registros = {};

    // Data base para lançamentos
    const hoje = new Date();
    const mesPassado = new Date(hoje);
    mesPassado.setMonth(mesPassado.getMonth() - 1);
    const mesQueVem = new Date(hoje);
    mesQueVem.setMonth(mesQueVem.getMonth() + 1);

    // —— financeiro_receber (3 registros) ——
    const receberCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.financeiro_receber WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const receberTotal = parseInt(receberCount.rows[0].total, 10);

    if (receberTotal === 0) {
        await client.query(`
            INSERT INTO public.financeiro_receber
                (tenant_id, cliente_id, cliente_nome, valor, data_vencimento, status, descricao, created_at)
            VALUES
                ($1, gen_random_uuid(), 'Cliente HML A', 1500.00, $2, 'pendente', 'Serviço de transporte HML A', now()),
                ($1, gen_random_uuid(), 'Cliente HML B', 3200.50, $3, 'pendente', 'Serviço de transporte HML B', now()),
                ($1, gen_random_uuid(), 'Cliente HML C', 875.75, $4, 'recebido', 'Serviço de transporte HML C', now())
            ON CONFLICT (os_id) DO NOTHING
        `, [TENANT_ID, mesPassado.toISOString(), hoje.toISOString(), mesQueVem.toISOString()]);
        registros.financeiro_receber = { status: 'inserido', total: 3 };
    } else {
        registros.financeiro_receber = { status: 'ja_existia', total: receberTotal };
    }

    // —— financeiro_pagar (2 registros) ——
    const pagarCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.financeiro_pagar WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const pagarTotal = parseInt(pagarCount.rows[0].total, 10);

    if (pagarTotal === 0) {
        await client.query(`
            INSERT INTO public.financeiro_pagar
                (tenant_id, prestador, fornecedor_id, valor, data_vencimento, status, descricao, created_at)
            VALUES
                ($1, 'Prestador HML X', gen_random_uuid(), 1200.00, $2, 'pendente', 'Frete HML X', now()),
                ($1, 'Prestador HML Y', gen_random_uuid(), 890.50, $3, 'pago', 'Frete HML Y', now())
            ON CONFLICT (os_id) DO NOTHING
        `, [TENANT_ID, mesPassado.toISOString(), hoje.toISOString()]);
        registros.financeiro_pagar = { status: 'inserido', total: 2 };
    } else {
        registros.financeiro_pagar = { status: 'ja_existia', total: pagarTotal };
    }

    // —— pagamentos_prestadores (2 registros) ——
    const ppCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.pagamentos_prestadores WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const ppTotal = parseInt(ppCount.rows[0].total, 10);

    if (ppTotal === 0) {
        const prestadorRes = await client.query(`
            SELECT id FROM public.prestadores LIMIT 1
        `);
        const prestadorId = prestadorRes.rows[0]?.id || null;

        await client.query(`
            INSERT INTO public.pagamentos_prestadores
                (tenant_id, prestador_id, valor_bruto, valor_liquido, status, periodo_inicio, periodo_fim, created_at)
            VALUES
                ($1, $2, 1200.00, 1080.00, 'pendente', $3, $4, now()),
                ($1, $2, 2500.00, 2250.00, 'pago', $5, $3, now())
            ON CONFLICT (os_id) DO NOTHING
        `, [
            TENANT_ID, prestadorId,
            mesPassado.toISOString(), hoje.toISOString(),
            new Date(mesPassado.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        ]);
        registros.pagamentos_prestadores = { status: 'inserido', total: 2 };
    } else {
        registros.pagamentos_prestadores = { status: 'ja_existia', total: ppTotal };
    }

    return {
        cenario: 3,
        nome: 'Financeiro (receber + pagar + pagamentos_prestadores)',
        registros
    };
}

// =============================================================================
// SCENARIO 4 — Alocações de Escala (para aparecer no App Motorista)
// =============================================================================
const PRESTADOR_APP_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085'; // PRESTADOR TESTE APP

async function cenario04(client) {
    const registros = {};

    const escalaCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.alocacoes_escala WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const escalaTotal = parseInt(escalaCount.rows[0].total, 10);

    if (escalaTotal === 0) {
        await client.query(`
            INSERT INTO public.alocacoes_escala
                (tenant_id, prestador_id, status, data_escala, tipo_veiculo,
                 origem, destino, aceite_prestador, created_at)
            VALUES
                ($1, $2, 'aguardando_aceite', CURRENT_DATE, 'moto',
                 'Rua Teste HML, 100 - Guarulhos/SP', 'Av. Homologação, 200 - São Paulo/SP',
                 false, now())
        `, [TENANT_ID, PRESTADOR_APP_ID]);
        registros.alocacoes_escala = { status: 'inserido', total: 1, prestador_id: PRESTADOR_APP_ID };

        // Segunda alocação para ter mais de uma operação no app
        await client.query(`
            INSERT INTO public.alocacoes_escala
                (tenant_id, prestador_id, status, data_escala, tipo_veiculo,
                 origem, destino, aceite_prestador, created_at)
            VALUES
                ($1, $2, 'aguardando_aceite', CURRENT_DATE + 1, 'carro',
                 'Av. Teste HML, 500 - São Paulo/SP', 'Rua Homologação, 300 - Guarulhos/SP',
                 false, now())
        `, [TENANT_ID, PRESTADOR_APP_ID]);
        registros.alocacoes_escala.total = 2;
    } else {
        registros.alocacoes_escala = { status: 'ja_existia', total: escalaTotal };
    }

    return {
        cenario: 4,
        nome: 'Alocações de Escala',
        registros
    };
}

// =============================================================================
// SCENARIO 5 — Entregas Protocolo (POD)
// =============================================================================
async function cenario05(client) {
    const registros = {};

    // Buscar alocação existente (se houver)
    const alocRes = await client.query(`
        SELECT id FROM public.alocacoes_escala WHERE tenant_id = $1 LIMIT 1
    `, [TENANT_ID]);

    const entregaCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.entregas_protocolo WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const entregaTotal = parseInt(entregaCount.rows[0].total, 10);

    if (entregaTotal === 0) {
        const alocId = alocRes.rows[0]?.id || null;
        await client.query(`
            INSERT INTO public.entregas_protocolo
                (tenant_id, alocacao_id, nome_recebedor, documento_recebedor,
                 data_hora_entrega, status_entrega, observacao, created_at)
            VALUES
                ($1, $2, 'João Silva HML', '123.456.789-00',
                 now(), 'realizada', 'Entrega HML - Ok', now())
            ON CONFLICT (alocacao_id) DO NOTHING
        `, [TENANT_ID, alocId]);
        registros.entregas_protocolo = { status: 'inserido', total: 1, alocacao_id_usada: alocId };
    } else {
        registros.entregas_protocolo = { status: 'ja_existia', total: entregaTotal };
    }

    // —— SAVEPOINT: entregas_protocolo_fotos (opcional) ——
    await client.query('SAVEPOINT sp_fotos_protocolo');
    try {
        await client.query(`
            INSERT INTO public.entregas_protocolo_fotos
                (entrega_id, url, tipo, created_at)
            SELECT id, 'https://placehold.co/400x300?text=Foto+Entrega+HML', 'foto_entrega', now()
            FROM public.entregas_protocolo
            WHERE tenant_id = $1 AND alocacao_id IS NOT NULL
            LIMIT 1
            ON CONFLICT DO NOTHING
        `, [TENANT_ID]);
        registros.entregas_protocolo_fotos = { status: 'inserido' };
    } catch {
        await client.query('ROLLBACK TO SAVEPOINT sp_fotos_protocolo');
        registros.entregas_protocolo_fotos = { status: 'ignorado_opcional' };
    }

    return {
        cenario: 5,
        nome: 'Entregas Protocolo (POD)',
        registros
    };
}

// =============================================================================
// SCENARIO 6 — CRM (Leads + Follow-ups)
// =============================================================================
async function cenario06(client) {
    const registros = {};

    const leadCount = await client.query(
        `SELECT COUNT(*) AS total FROM public.crm_leads WHERE tenant_id = $1`,
        [TENANT_ID]
    );
    const leadTotal = parseInt(leadCount.rows[0].total, 10);

    if (leadTotal === 0) {
        await client.query(`
            INSERT INTO public.crm_leads
                (tenant_id, nome, email, telefone, origem, status, created_at)
            VALUES
                ($1, 'Lead HML 1 (Transportes)', 'lead1.hml@email.com', '11999990001',
                 'site', 'novo', now()),
                ($1, 'Lead HML 2 (Logística)', 'lead2.hml@email.com', '11999990002',
                 'indicacao', 'qualificado', now())
        `, [TENANT_ID]);
        registros.crm_leads = { status: 'inserido', total: 2 };
    } else {
        registros.crm_leads = { status: 'ja_existia', total: leadTotal };
    }

    // Follow-ups
    const leadIds = await client.query(`
        SELECT id FROM public.crm_leads WHERE tenant_id = $1 LIMIT 2
    `, [TENANT_ID]);

    if (leadIds.rows.length > 0 && registros.crm_leads.status === 'inserido') {
        // —— SAVEPOINT: follow-ups (opcional: depende de leads) ——
        await client.query('SAVEPOINT sp_followups');
        try {
            for (const lead of leadIds.rows) {
                await client.query(`
                    INSERT INTO public.crm_followups
                        (lead_id, tipo, descricao, data_contato, created_at)
                    VALUES
                        ($1, 'email', 'Primeiro contato HML', now(), now())
                    ON CONFLICT DO NOTHING
                `, [lead.id]);
            }
            registros.crm_followups = { status: 'inserido', total: leadIds.rows.length };
        } catch {
            await client.query('ROLLBACK TO SAVEPOINT sp_followups');
            registros.crm_followups = { status: 'ignorado_opcional' };
        }
    } else {
        registros.crm_followups = { status: 'ignorado_sem_leads_novos' };
    }

    return {
        cenario: 6,
        nome: 'CRM (Leads + Follow-ups)',
        registros
    };
}

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log(`║  ${SEED_VERSION.padEnd(54)}║`);
    console.log(`║  Marcador: ${MARKER.padEnd(48)}║`);
    console.log(`║  Tenant:   ${TENANT_ID.padEnd(48)}║`);
    console.log(`║  Data:     ${formatISO().padEnd(48)}║`);
    console.log(`║  Host:     ${HOSTNAME.padEnd(48)}║`);
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Seed file hash (self-check)
    const __filename = fileURLToPath(import.meta.url);
    const seedHash = computeFileHash(__filename);
    console.log(`[SEED] Hash: ${seedHash}`);
    console.log(`[SEED] Cenários: 1..${TOTAL_CENARIOS}`);
    console.log('');

    // Connect
    const DATABASE_URL = process.env.DATABASE_URL;
    if (!DATABASE_URL) {
        console.error('[ERRO] DATABASE_URL não definida no .env');
        process.exit(1);
    }

    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
    const client = await pool.connect();

    let lockAcquired = false;

    try {
        // ================================================================
        // PHASE 1: Pre-conditions
        // ================================================================
        console.log('[1/6] Verificando pré-condições...');

        // Ensure checkpoint table exists (abort if not)
        await ensureCheckpointTable(client);

        // Acquire global advisory lock (prevent concurrent seed execution)
        lockAcquired = await acquireLock(client, LOCK_OBJID_SEED);
        if (!lockAcquired) {
            console.error('');
            console.error('╔══════════════════════════════════════════════════════════════════╗');
            console.error('║  ERRO: Outra execução do seed está em andamento.               ║');
            console.error('║  O lock de aplicação (advisory) não pôde ser adquirido.        ║');
            console.error('║  Aguarde a execução atual terminar ou force liberação via:     ║');
            console.error('║    SELECT pg_advisory_unlock(20260729, 0);                     ║');
            console.error('╚══════════════════════════════════════════════════════════════════╝');
            console.error('');
            process.exit(1);
        }
        console.log('[1/6] Lock adquirido com sucesso.');
        console.log('');

        // Read checkpoint state
        const checkpoint = await readCheckpoint(client);
        console.log(`[CHECKPOINT] ${checkpoint.size} cenários registrados.`);

        // ================================================================
        // PHASE 2: Execute scenarios
        // ================================================================
        const manifestEntries = [];
        const startTime = Date.now();

        const scenarios = [
            { num: 1, nome: 'Usuário super_admin + tenant_usuarios + perfis_permissoes', fn: cenario01 },
            { num: 2, nome: '5 Agentes IA Internos',                           fn: cenario02 },
            { num: 3, nome: 'Financeiro (receber + pagar + pagamentos)',       fn: cenario03 },
            { num: 4, nome: 'Alocações de Escala',                             fn: cenario04 },
            { num: 5, nome: 'Entregas Protocolo (POD) com SAVEPOINT',          fn: cenario05 },
            { num: 6, nome: 'CRM (Leads + Follow-ups) com SAVEPOINT',          fn: cenario06 }
        ];

        for (const sc of scenarios) {
            const cp = checkpoint.get(sc.num);
            const tentAtuais = cp ? cp.tentativas + 1 : 1;

            // Determine if this scenario should run
            if (cp && cp.status === 'concluido') {
                console.log(`[CENÁRIO ${sc.num}/6] ✅ Pulando — já concluído.`);
                manifestEntries.push({
                    cenario: sc.num,
                    nome: sc.nome,
                    status: 'concluido_anteriormente',
                    duracao_ms: cp.duracao_ms ?? null,
                    registros: {},
                    erro: null
                });
                continue;
            }

            const runLabel = cp && cp.status === 'falhou'
                ? `🔄 Retentativa #${tentAtuais}`
                : `▶️  Executando`;
            console.log(`[CENÁRIO ${sc.num}/6] ${runLabel}: ${sc.nome}`);

            // Mark as pending
            const iniciadoEm = formatISO();
            await writeCheckpoint(client, sc.num, 'pendente', {
                tentativas: tentAtuais, iniciado_em: iniciadoEm
            });

            // Execute in per-scenario transaction
            const scStart = Date.now();
            try {
                await client.query('BEGIN');

                // Acquire per-scenario advisory lock (isolates concurrent scenario runs)
                const scLocked = await acquireLock(client, LOCK_OBJID_BASE_SCENARIO + sc.num);
                if (scLocked) {
                    // Execute
                    const entry = await sc.fn(client);
                    const scDuration = Date.now() - scStart;
                    entry.duracao_ms = scDuration;

                    await client.query('COMMIT');

                    // Release per-scenario lock (if was acquired)
                    if (scLocked) {
                        await releaseLock(client, LOCK_OBJID_BASE_SCENARIO + sc.num);
                    }

                    entry.status = 'concluido';
                    manifestEntries.push(entry);

                    // Write checkpoint as completed
                    await writeCheckpoint(client, sc.num, 'concluido', {
                        duracao_ms: scDuration
                    });

                    console.log(`[CENÁRIO ${sc.num}/6] ✅ Concluído (${scDuration}ms)`);
                } else {
                    await client.query('ROLLBACK');
                    const msg = 'Lock por cenário não adquirido (contention)';
                    manifestEntries.push({
                        cenario: sc.num, nome: sc.nome, status: 'falhou',
                        duracao_ms: Date.now() - scStart, registros: {}, erro: msg
                    });
                    await writeCheckpoint(client, sc.num, 'falhou', {
                        erro: msg, duracao_ms: Date.now() - scStart, tentativas: tentAtuais
                    });
                    console.error(`[CENÁRIO ${sc.num}/6] ❌ ${msg}`);
                }
            } catch (err) {
                // Rollback in case of error
                try { await client.query('ROLLBACK'); } catch {}

                const errMsg = err.message || String(err);
                const scDuration = Date.now() - scStart;
                manifestEntries.push({
                    cenario: sc.num, nome: sc.nome, status: 'falhou',
                    duracao_ms: scDuration, registros: {}, erro: errMsg
                });

                await writeCheckpoint(client, sc.num, 'falhou', {
                    erro: errMsg, duracao_ms: scDuration, tentativas: tentAtuais
                });

                console.error(`[CENÁRIO ${sc.num}/6] ❌ Falhou: ${errMsg}`);
                // Re-throw to abort the seed
                throw new Error(`Cenário ${sc.num} falhou: ${errMsg}`);
            }
            console.log('');
        }

        // ================================================================
        // PHASE 3: Manifest
        // ================================================================
        const elapsed = Date.now() - startTime;

        const manifest = {
            seed_version: SEED_VERSION,
            marker: MARKER,
            tenant_id: TENANT_ID,
            executado_em: formatISO(),
            executado_por: HOSTNAME,
            seed_file_hash: seedHash,
            duracao_total_ms: elapsed,
            cenarios: manifestEntries,
            resumo: {
                total: TOTAL_CENARIOS,
                concluidos: manifestEntries.filter(e => e.status === 'concluido' || e.status === 'concluido_anteriormente').length,
                falhas: manifestEntries.filter(e => e.status === 'falhou').length
            }
        };

        const flushInfo = atomicFlushManifest(manifest);
        console.log(`[MANIFEST] Escrito em: ${flushInfo.path}`);
        console.log(`[MANIFEST] Tamanho: ${flushInfo.sizeBytes} bytes`);
        console.log('');

        // Summary
        console.log('╔══════════════════════════════════════════════════════════════════╗');
        console.log(`║  RESUMO — ${MARKER.padEnd(48)}║`);
        console.log(`║  Status: ${manifest.resumo.falhas > 0 ? '❌ FALHAS' : '✅ SUCESSO'.padEnd(49)}║`);
        console.log(`║  Cenários: ${(`${manifest.resumo.concluidos}/${TOTAL_CENARIOS} concluídos`).padEnd(47)}║`);
        if (manifest.resumo.falhas > 0) {
            console.log(`║  Falhas: ${String(manifest.resumo.falhas).padEnd(49)}║`);
        }
        console.log(`║  Duração: ${(`${elapsed}ms`).padEnd(48)}║`);
        console.log('╚══════════════════════════════════════════════════════════════════╝');
        console.log('');

        if (manifest.resumo.falhas > 0) {
            process.exit(2);
        }

    } finally {
        // ================================================================
        // PHASE 4: Cleanup (always)
        // ================================================================
        try {
            if (lockAcquired) {
                await releaseLock(client, LOCK_OBJID_SEED);
                console.log('[LOCK] Liberado.');
            }
        } catch {}
        try { client.release(); } catch {}
        try { await pool.end(); } catch {}
    }
}

main().catch(err => {
    console.error('');
    console.error(`[FATAL] ${err.message}`);
    console.error('');
    process.exit(3);
});
