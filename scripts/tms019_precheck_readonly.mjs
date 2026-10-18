#!/usr/bin/env node
// TMS-019 — Pre-check Read-Only (FASE 4)
// Apenas SELECT — nenhuma escrita.
import 'dotenv/config';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error('[ERRO] DATABASE_URL não definida no .env');
    process.exit(1);
}

async function main() {
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 1 });
    const client = await pool.connect();
    let exitCode = 0;

    try {
        console.log('╔══════════════════════════════════════════════════════════════════╗');
        console.log('║  TMS-019 — PRÉ-CHECK READ-ONLY                                  ║');
        console.log('║  Apenas SELECT — nenhuma escrita no banco                       ║');
        console.log('╚══════════════════════════════════════════════════════════════════╝');
        console.log('');

        // 1. Checkpoint table
        console.log('[01/20] Tabela _hml_seed_checkpoint...');
        const cpExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = '_hml_seed_checkpoint'
            ) AS exists
        `);
        console.log(`       Existe: ${cpExists.rows[0].exists}`);

        if (cpExists.rows[0].exists) {
            const cpRows = await client.query(`SELECT COUNT(*) AS t FROM public._hml_seed_checkpoint`);
            console.log(`       Registros: ${cpRows.rows[0].t}`);

            const cpMarker = await client.query(
                `SELECT marcador, cenario, status FROM public._hml_seed_checkpoint WHERE marcador LIKE 'HML-%'`
            );
            if (cpMarker.rows.length > 0) {
                for (const r of cpMarker.rows) {
                    console.log(`       Marcador: ${r.marcador}, cenário ${r.cenario}, status: ${r.status}`);
                }
            } else {
                console.log(`       Nenhum marcador HML-* encontrado.`);
            }
        }

        // 2. Prestadores com auth_user_id
        console.log('');
        console.log('[02/20] Prestadores com auth_user_id (podem usar o app)...');
        const prestadoresComAuth = await client.query(`
            SELECT id, nome_completo, auth_user_id, cpf_cnpj
            FROM public.prestadores
            WHERE auth_user_id IS NOT NULL
        `);
        console.log(`       Total: ${prestadoresComAuth.rows.length}`);
        for (const p of prestadoresComAuth.rows) {
            console.log(`       - ${p.nome_completo} (${p.id}) auth_user_id: ${p.auth_user_id}`);
        }

        // 3. App test user
        console.log('');
        console.log('[03/20] Usuário auth de teste (teste@conexao.com)...');
        const testUser = await client.query(`
            SELECT id, email, raw_user_meta_data
            FROM auth.users
            WHERE email LIKE '%teste@%' OR email LIKE '%hml%' OR email LIKE '%homolog%'
        `);
        console.log(`       Total: ${testUser.rows.length}`);
        for (const u of testUser.rows) {
            console.log(`       - ${u.email} (${u.id})`);
        }

        // 4. All auth users (brief)
        console.log('');
        console.log('[04/20] Todos os usuários auth...');
        const allUsers = await client.query(`SELECT id, email FROM auth.users ORDER BY email`);
        console.log(`       Total: ${allUsers.rows.length}`);
        for (const u of allUsers.rows) {
            console.log(`       - ${u.email} (${u.id})`);
        }

        // 5. f_buscar_operacoes_motorista definition
        console.log('');
        console.log('[05/20] RPC f_buscar_operacoes_motorista...');
        const rpcDef = await client.query(`
            SELECT proname, prolang, prosecdef, provolatile
            FROM pg_proc
            WHERE proname = 'f_buscar_operacoes_motorista'
        `);
        if (rpcDef.rows.length > 0) {
            const r = rpcDef.rows[0];
            console.log(`       Provolatile: ${r.provolatile}, Security definer: ${r.prosecdef}`);

            // Get full source
            const rpcSrc = await client.query(`
                SELECT pg_get_functiondef(p.oid) AS source
                FROM pg_proc p
                WHERE p.proname = 'f_buscar_operacoes_motorista'
            `);
            console.log(`       Source:`);
            console.log(rpcSrc.rows[0].source.slice(0, 2000));
        } else {
            console.log('       RPC NÃO ENCONTRADA!');
        }

        // 6. Alocações existentes (contagem por status)
        console.log('');
        console.log('[06/20] Alocações existentes (todas)...');
        const alocStatus = await client.query(`
            SELECT status, COUNT(*) AS total
            FROM public.alocacoes_escala
            GROUP BY status
            ORDER BY status
        `);
        console.log(`       Total por status:`);
        for (const r of alocStatus.rows) {
            console.log(`       - ${r.status}: ${r.total}`);
        }

        // 7. Alocações sem prestador_id ou cliente_id
        console.log('');
        console.log('[07/20] Alocações órfãs...');
        const orphanAloc = await client.query(`
            SELECT COUNT(*) AS total FROM public.alocacoes_escala
            WHERE prestador_id IS NULL OR cliente_id IS NULL
        `);
        console.log(`       Sem prestador OU cliente: ${orphanAloc.rows[0].total}`);

        // 8. Tables needed by the seed
        console.log('');
        console.log('[08/20] Tabelas necessárias pelo seed (existência)...');
        const requiredTables = [
            'auth.users', 'public.tenant_usuarios', 'public.perfis_permissoes',
            'public.agentes_ia_internos', 'public.financeiro_receber',
            'public.financeiro_pagar', 'public.pagamentos_prestadores',
            'public.alocacoes_escala', 'public.entregas_protocolo',
            'public.entregas_protocolo_fotos', 'public.crm_leads', 'public.crm_followups'
        ];
        for (const t of requiredTables) {
            const parts = t.split('.');
            const schema = parts[0];
            const table = parts[1];
            try {
                const res = await client.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = $1 AND table_name = $2
                    ) AS exists
                `, [schema === 'public' ? 'public' : schema, table]);
                console.log(`       ${t}: ${res.rows[0].exists ? '✅' : '❌ AUSENTE'}`);
                if (!res.rows[0].exists) exitCode = 1;
            } catch (e) {
                console.log(`       ${t}: ❌ ERRO: ${e.message}`);
                exitCode = 1;
            }
        }

        // 9. Prestador M43 (used in TMS-006 tests)
        console.log('');
        console.log('[09/20] Prestador M43 (referência TMS-006)...');
        const prestM43 = await client.query(`
            SELECT id, nome_completo, cpf_cnpj, auth_user_id
            FROM public.prestadores
            WHERE nome_completo LIKE '%M43%' OR cpf_cnpj LIKE '%M43%'
        `);
        if (prestM43.rows.length > 0) {
            for (const p of prestM43.rows) {
                console.log(`       - ${p.nome_completo} (${p.id}) auth: ${p.auth_user_id || 'NENHUM'}`);
            }
        } else {
            console.log(`       Nenhum prestador M43 encontrado.`);
        }

        // 10. Grants on the checkpoint table (if exists)
        if (cpExists.rows[0].exists) {
            console.log('');
            console.log('[10/20] Grants na _hml_seed_checkpoint...');
            const grants = await client.query(`
                SELECT grantee, privilege_type
                FROM information_schema.role_table_grants
                WHERE table_schema = 'public' AND table_name = '_hml_seed_checkpoint'
            `);
            for (const g of grants.rows) {
                console.log(`       ${g.grantee}: ${g.privilege_type}`);
            }
        }

        // 11. f_avancar_etapa_app_motorista definition
        console.log('');
        console.log('[11/20] RPC f_avancar_etapa_app_motorista...');
        const rpcAvan = await client.query(`
            SELECT pg_get_functiondef(p.oid) AS source
            FROM pg_proc p
            WHERE p.proname = 'f_avancar_etapa_app_motorista'
        `);
        if (rpcAvan.rows.length > 0) {
            console.log(rpcAvan.rows[0].source.slice(0, 1000));
        }

        // 12. Alocações do PRESTADOR TESTE APP
        console.log('');
        console.log('[12/20] Alocações do PRESTADOR TESTE APP (e6646799)...');
        const alocPrestTest = await client.query(`
            SELECT COUNT(*) AS t FROM public.alocacoes_escala
            WHERE prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'::uuid
        `);
        console.log(`       Total: ${alocPrestTest.rows[0].t}`);
        if (parseInt(alocPrestTest.rows[0].t) > 0) {
            const detalhes = await client.query(`
                SELECT id, status, origem, destino, aceite_prestador, created_at
                FROM public.alocacoes_escala
                WHERE prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'::uuid
                LIMIT 10
            `);
            for (const a of detalhes.rows) {
                console.log(`       - ${a.id} status: ${a.status}, aceite: ${a.aceite_prestador}`);
            }
        }

        // 13. Also check prestador.teste.app@gmail.com
        console.log('');
        console.log('[13/20] prestador.teste.app@gmail.com (auth: 4d21e0c4)...');
        const prestGmail = await client.query(`
            SELECT id, nome_completo, cpf_cnpj, auth_user_id
            FROM public.prestadores
            WHERE auth_user_id = '4d21e0c4-8947-4834-8068-409fdd1b9f14'::uuid
        `);
        if (prestGmail.rows.length > 0) {
            for (const p of prestGmail.rows) {
                console.log(`       - ${p.nome_completo} (${p.id}) auth: ${p.auth_user_id}`);
                const alocGmail = await client.query(`
                    SELECT COUNT(*) AS t FROM public.alocacoes_escala
                    WHERE prestador_id = $1
                `, [p.id]);
                console.log(`       Alocações: ${alocGmail.rows[0].t}`);
            }
        } else {
            console.log('       Nenhum prestador vinculado a este auth.');
        }

        // PRESTADOR TESTE APP — check what alocações this prestador has in "app-ready" status
        console.log('');
        console.log('[14/20] Alocações do PRESTADOR TESTE APP em status compatível com o app...');
        const alocAppReady = await client.query(`
            SELECT COUNT(*) AS t FROM public.alocacoes_escala
            WHERE prestador_id = 'e6646799-fbac-453e-a3ef-afdfc01a7085'::uuid
              AND status IN ('pendente','aguardando_aceite','aceita','em_andamento','em_rota')
        `);
        console.log(`       Total disponível para o app: ${alocAppReady.rows[0].t}`);

        // CRITICAL: check if seed's gen_random_uuid() would match this prestador
        console.log('');
        console.log('[15/20] ⚠️ CRÍTICO: Seed cria alocações com gen_random_uuid() para prestador_id');
        console.log('       O PRESTADOR TESTE APP tem ID: e6646799-fbac-453e-a3ef-afdfc01a7085');
        console.log('       O seed gera prestador_id = gen_random_uuid() → UUID aleatório');
        console.log('       O App Motorista filtra por prestador_id via auth.uid()');
        console.log('       → Alocações do seed NUNCA aparecerão no app');
        const prestTeste = await client.query(`
            SELECT id, nome_completo, cpf_cnpj, auth_user_id
            FROM public.prestadores
            WHERE nome_completo ILIKE '%teste%app%' OR nome_completo ILIKE '%teste%'
        `);
        if (prestTeste.rows.length > 0) {
            for (const p of prestTeste.rows) {
                console.log(`       - ${p.nome_completo} (${p.id}) auth: ${p.auth_user_id || 'NENHUM'}`);
            }
        } else {
            console.log(`       Nenhum "PRESTADOR TESTE APP" encontrado.`);
        }

        // 14. Auth users that are linked to prestadores
        console.log('');
        console.log('[14/20] Auth users vinculados a prestadores...');
        const authPrest = await client.query(`
            SELECT u.email, p.nome_completo, p.id AS prestador_id, u.id AS user_id
            FROM auth.users u
            JOIN public.prestadores p ON p.auth_user_id = u.id
            ORDER BY u.email
        `);
        console.log(`       Total: ${authPrest.rows.length}`);
        for (const r of authPrest.rows) {
            console.log(`       - ${r.email} → ${r.nome_completo} (prestador: ${r.prestador_id})`);
        }

        // 15. Tenant Conexao Express
        console.log('');
        console.log('[15/20] Tenant Conexao Express...');
        const tenant = await client.query(`
            SELECT id, nome, slug FROM public.tenants
            WHERE nome ILIKE '%conexao%' OR slug = 'conexao-express'
        `);
        console.log(`       Total: ${tenant.rows.length}`);
        for (const t of tenant.rows) {
            console.log(`       - ${t.nome} (${t.id}) slug: ${t.slug}`);
        }

        // 16. total OS count
        console.log('');
        console.log('[16/20] Total de OS...');
        const totalOs = await client.query(`SELECT COUNT(*) AS t FROM public.ordens_servico`);
        console.log(`       ${totalOs.rows[0].t} OS no total`);

        // 17. Existence of prestador that matches seed marker
        console.log('');
        console.log('[17/20] Alocações com origem ou destino contendo HML...');
        const alocHml = await client.query(`
            SELECT id, status, prestador_id, cliente_id, aceite_prestador, created_at
            FROM public.alocacoes_escala
            WHERE origem ILIKE '%HML%' OR destino ILIKE '%HML%'
               OR observacoes_internas ILIKE '%HML%'
        `);
        console.log(`       Total: ${alocHml.rows.length}`);
        for (const a of alocHml.rows) {
            console.log(`       - ${a.id} status: ${a.status}, prestador: ${a.prestador_id}, tenant: ${a.tenant_id}`);
        }

        // 18. Check grants on key tables for the app user role
        console.log('');
        console.log('[18/20] Grants anon em tabelas críticas...');
        const anonTables = ['alocacoes_escala', 'entregas_protocolo', 'ordens_servico'];
        for (const t of anonTables) {
            const g = await client.query(`
                SELECT grantee, privilege_type
                FROM information_schema.role_table_grants
                WHERE table_schema = 'public' AND table_name = $1
                  AND grantee = 'anon'
            `, [t]);
            if (g.rows.length > 0) {
                console.log(`       ${t}: anon tem ${g.rows.map(r => r.privilege_type).join(', ')}`);
            } else {
                console.log(`       ${t}: anon NÃO tem grants diretos ✅`);
            }
        }

        console.log('');
        console.log('[19/20] Alocações na fila do app (status aceitos pelo app)...');
        // App typically queries: pendente, aguardando_aceite, aceita, em_andamento
        const alocApp = await client.query(`
            SELECT status, COUNT(*) AS t
            FROM public.alocacoes_escala
            WHERE status IN ('pendente','aguardando_aceite','aceita','em_andamento')
            GROUP BY status ORDER BY status
        `);
        let totalAppAloc = 0;
        for (const r of alocApp.rows) {
            console.log(`       ${r.status}: ${r.t}`);
            totalAppAloc += parseInt(r.t);
        }
        console.log(`       Total disponível para o app: ${totalAppAloc}`);

        console.log('');
        console.log('[20/20] tenant_usuarios para o tenant alvo...');
        const tu = await client.query(`
            SELECT id, user_id, papel, nome_exibicao, tenant_id
            FROM public.tenant_usuarios
            WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
        `);
        console.log(`       Total: ${tu.rows.length}`);
        for (const r of tu.rows) {
            console.log(`       - ${r.nome_exibicao} (user: ${r.user_id}) papel: ${r.papel}`);
        }

    } catch (err) {
        console.error(`[ERRO NO PRÉ-CHECK] ${err.message}`);
        exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }

    process.exit(exitCode);
}

main();
