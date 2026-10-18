/**
 * MISSÃO 127-E.1-TMS-B — DIAGNÓSTICO PRÉ-MIGRATION
 *
 * Verifica o estado atual do banco antes de aplicar a migration.
 * Uso: npx tsx -r dotenv/config scripts/m127e1b_diagnostico_pre_migration.ts
 */

import pg from "pg";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL não definida no .env"); process.exit(1); }

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

function section(title: string) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}`);
}

function info(label: string, value: string) {
  console.log(`  📋 ${label}: ${value}`);
}

async function q(text: string, params?: any[]) {
  const c = await pool.connect();
  try { return await c.query(text, params); } finally { c.release(); }
}

async function main() {
  section("FASE 1.1 — COLUNA romaneio EM ordens_servico");

  try {
    const { rows } = await q(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ordens_servico' AND column_name = 'romaneio'`
    );
    if (rows.length > 0) {
      info("romaneio já existe", `tipo=${rows[0].data_type}, nullable=${rows[0].is_nullable}`);
    } else {
      info("romaneio", "NÃO existe — será criado pela migration");
    }
  } catch (err: any) {
    info("romaneio check erro", err.message);
  }

  section("FASE 1.2 — VIEW vw_app_motorista_operacoes (definição atual)");

  try {
    const { rows: viewDef } = await q(
      `SELECT pg_get_viewdef('public.vw_app_motorista_operacoes'::regclass, true) AS definition`
    );
    if (viewDef.length > 0) {
      const def = viewDef[0].definition || "";
      const colCount = (def.match(/AS\s+/g) || []).length;
      info("View existe", "definição encontrada");
      info("Tamanho definição", `${def.length} caracteres`);
      // Extrair campos da view
      const camposView = def.match(/\b\w+\.\w+\s+(?:AS\s+)?(\w+)/g) || [];
      camposView.push(...(def.match(/AS\s+(\w+)/g) || []));
      info("Campos estimados", `${camposView.length}`);
      // Mostrar primeiras linhas
      const linhas = def.split('\n').slice(0, 5);
      info("Primeiras linhas", linhas.join(' ').substring(0, 150));
    } else {
      info("View", "NÃO existe");
    }
  } catch (err: any) {
    info("View check erro", err.message);
  }

  // Contar colunas da view via information_schema
  try {
    // Primeiro verificar se a view existe em pg_views
    const { rows: pgView } = await q(
      `SELECT schemaname, viewname, definition FROM pg_views
       WHERE schemaname = 'public' AND viewname = 'vw_app_motorista_operacoes'`
    );
    if (pgView.length > 0) {
      info("View em pg_views", "encontrada");
      // Contar colunas tentando SELECT *
      const { rows: colInfo } = await q(
        `SELECT count(*)::int AS col_count FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'vw_app_motorista_operacoes'`
      );
      info("Colunas atuais na view", `${colInfo[0]?.col_count || 0} colunas`);

      // Listar colunas
      const { rows: colNomes } = await q(
        `SELECT column_name, data_type, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'vw_app_motorista_operacoes'
         ORDER BY ordinal_position`
      );
      console.log("  Colunas atuais:");
      for (const c of colNomes) {
        console.log(`    ${c.ordinal_position}. ${c.column_name} (${c.data_type})`);
      }
    } else {
      info("View em pg_views", "NÃO encontrada");
    }
  } catch (err: any) {
    info("Colunas view erro", err.message);
  }

  section("FASE 1.3 — VIEW vw_app_motorista_paradas (definição)");

  try {
    const { rows: viewParadas } = await q(
      `SELECT pg_get_viewdef('public.vw_app_motorista_paradas'::regclass, true) AS definition`
    );
    if (viewParadas.length > 0) {
      info("View paradas existe", `${(viewParadas[0].definition || "").length} caracteres`);
    } else {
      info("View paradas", "NÃO encontrada");
    }
  } catch (err: any) {
    info("View paradas", err.message);
  }

  section("FASE 1.4 — RPC f_buscar_operacoes_motorista (assinatura atual)");

  try {
    const { rows: rpcDef } = await q(
      `SELECT proname, pronargs, proargnames, prosrc, prolang
       FROM pg_proc
       WHERE proname = 'f_buscar_operacoes_motorista'
       AND pronamespace = 'public'::regnamespace`
    );
    if (rpcDef.length > 0) {
      const r = rpcDef[0];
      info("RPC existe", `argumentos: ${r.pronargs}`);
      info("Nomes args", (r.proargnames || []).join(", "));
      const fontes = (r.prosrc || "").split('\n');
      info("Linhas fonte", `${fontes.length}`);

      // Verificar se RPC usa view ou query inline
      if (r.prosrc && r.prosrc.includes('vw_app_motorista_operacoes')) {
        info("RPC fonte", "CONSOME VIEW (contrato único)");
      } else {
        info("RPC fonte", "QUERY INLINE (divergente da view)");
        // Mostrar SELECT columns
        const selectCols = r.prosrc?.match(/SELECT\s+([\s\S]*?)\s+FROM/im);
        if (selectCols) {
          info("SELECT inline", selectCols[1].substring(0, 300));
        }
      }

      // Verificar SECURITY DEFINER
      if (r.prosrc?.includes('SECURITY DEFINER')) {
        info("RPC security", "SECURITY DEFINER");
      } else {
        info("RPC security", "SECURITY INVOKER (padrão)");
      }
    } else {
      info("RPC", "NÃO existe");
    }
  } catch (err: any) {
    info("RPC check erro", err.message);
  }

  section("FASE 1.5 — GRANTS ATUAIS");

  try {
    // View grants
    const { rows: viewGrants } = await q(
      `SELECT grantee, privilege_type
       FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND table_name = 'vw_app_motorista_operacoes'
       ORDER BY grantee, privilege_type`
    );
    if (viewGrants.length > 0) {
      console.log("  View grants:");
      for (const g of viewGrants) {
        console.log(`    ${g.grantee}: ${g.privilege_type}`);
      }
    } else {
      info("View grants", "Nenhum grant explícito encontrado");
    }
  } catch (err: any) {
    info("View grants erro", err.message);
  }

  // RPC grants
  try {
    const { rows: rpcGrants } = await q(
      `SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
       FROM pg_proc p
       WHERE p.proname = 'f_buscar_operacoes_motorista'
       AND p.pronamespace = 'public'::regnamespace`
    );
    if (rpcGrants.length > 0) {
      const r = rpcGrants[0];
      info("RPC anon EXECUTE", r.anon_exec ? "✅ SIM" : "❌ NÃO");
      info("RPC authenticated EXECUTE", r.auth_exec ? "✅ SIM" : "❌ NÃO");
    }
  } catch (err: any) {
    info("RPC grants erro", err.message);
  }

  section("FASE 1.6 — TABELAS RELACIONADAS");

  // Verificar colunas de veiculos
  try {
    const { rows: veiCols } = await q(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'veiculos'
       AND column_name IN ('placa', 'prestador_vinculado', 'status')
       ORDER BY column_name`
    );
    console.log("  Colunas veiculos:");
    for (const c of veiCols) {
      info(`  ${c.column_name}`, c.data_type);
    }
  } catch (err: any) {
    info("veiculos cols erro", err.message);
  }

  // Verificar column prestadores.auth_user_id
  try {
    const { rows: pCols } = await q(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'prestadores'
       AND column_name = 'auth_user_id'`
    );
    info("prestadores.auth_user_id", pCols.length > 0 ? `✅ existe (${pCols[0].data_type})` : "❌ NÃO existe");
  } catch (err: any) {
    info("auth_user_id check erro", err.message);
  }

  // Verificar placa UNIQUE
  try {
    const { rows: pkInfo } = await q(
      `SELECT conname, contype FROM pg_constraint
       WHERE conrelid = 'public.veiculos'::regclass AND conname LIKE '%placa%'`
    );
    if (pkInfo.length > 0) {
      info("veiculos.placa constraint", `${pkInfo[0].conname} (${pkInfo[0].contype})`);
      // contype: u = UNIQUE, p = PRIMARY KEY
    } else {
      // Check if placa has a unique constraint by checking pg_index
      const { rows: idxInfo } = await q(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE tablename = 'veiculos' AND indexdef ILIKE '%placa%'`
      );
      if (idxInfo.length > 0) {
        info("veiculos.placa índice", idxInfo[0].indexdef);
      } else {
        info("veiculos.placa", "SEM constraint UNIQUE");
      }
    }
  } catch (err: any) {
    info("placa constraint erro", err.message);
  }

  // Verificar rotas.horario_previsto
  try {
    const { rows: rCols } = await q(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'rotas'
       AND column_name = 'horario_previsto'`
    );
    info("rotas.horario_previsto", rCols.length > 0 ? `✅ existe (${rCols[0].data_type})` : "❌ NÃO existe");
  } catch (err: any) {
    info("horario_previsto check erro", err.message);
  }

  section("FASE 1.7 — OPERAÇÃO DE TESTE");

  const OS_ID = "405fe001-4947-44a6-8cd2-c0203a701cfd";
  const ALOC_ID = "1e9b311e-c701-4469-8f8e-ed99b9cd9a73";

  try {
    const { rows: osData } = await q(
      `SELECT id, numero, cliente, status, tipo_operacao, tipo_carga, carga_tipo,
              volumes, peso, cubagem, romaneio
       FROM ordens_servico WHERE id = $1`, [OS_ID]
    );
    if (osData.length > 0) {
      const os = osData[0];
      info("OS encontrada", `${os.numero} (status: ${os.status})`);
      info("OS romaneio", os.romaneio || "null (não preenchido)");
      info("OS tipo_carga", os.tipo_carga || "null");
      info("OS volumes/peso/cubagem", `${os.volumes}/${os.peso}/${os.cubagem}`);
    } else {
      info("OS", "NÃO encontrada");
    }
  } catch (err: any) {
    info("OS check erro", err.message);
  }

  try {
    const { rows: alocData } = await q(
      `SELECT id, prestador_id, status, tipo_veiculo, placa, tipo_reversa,
              valor_repasse, km_previstos
       FROM alocacoes_escala WHERE id = $1`, [ALOC_ID]
    );
    if (alocData.length > 0) {
      const a = alocData[0];
      info("Alocação encontrada", `prestador=${a.prestador_id}, status=${a.status}`);
      info("Alocação veículo", `${a.tipo_veiculo} / ${a.placa}`);
      info("Alocação reversa", a.tipo_reversa || "null");
      info("Alocação valor repasse", `${a.valor_repasse}`);
    } else {
      info("Alocação", "NÃO encontrada");
    }
  } catch (err: any) {
    info("Aloc check erro", err.message);
  }

  // Testar SELECT atual da view para esta alocação
  try {
    const { rows: viewTest } = await q(
      `SELECT alocacao_id, os_numero, cliente_nome, cliente_razao_social, status,
              tipo_veiculo, placa, motorista_id, tipo_operacao
       FROM vw_app_motorista_operacoes WHERE alocacao_id = $1`, [ALOC_ID]
    );
    if (viewTest.length > 0) {
      info("View atual — alocação visível", "✅ SIM");
      info("View atual — campos retornados", Object.keys(viewTest[0]).join(", "));
    } else {
      info("View atual — alocação visível", "❌ NÃO (não encontrada na view)");
    }
  } catch (err: any) {
    if (err.message?.includes('does not exist')) {
      info("View atual — consulta", "❌ VIEW NÃO EXISTE");
    } else {
      info("View atual — consulta erro", err.message);
    }
  }

  // Testar RPC atual
  try {
    const { rows: prestRows } = await q(
      `SELECT id FROM alocacoes_escala WHERE id = $1`, [ALOC_ID]
    );
    if (prestRows.length > 0) {
      // Try RPC - might fail gracefully
      try {
        const { rows: rpcTest } = await q(
          `SELECT * FROM f_buscar_operacoes_motorista($1, NULL::text, 10, 0)`,
          [prestRows[0].prestador_id]
        );
        info("RPC atual — resposta", rpcTest.length > 0 ? "✅ retornou dados" : "❌ vazio");
      } catch (rpcErr: any) {
        info("RPC atual — erro", rpcErr.message.substring(0, 100));
      }
    }
  } catch (err: any) {
    info("RPC test error", err.message);
  }

  await pool.end();
  console.log("\n  📋 Diagnóstico pré-migration concluído.");
}

main().catch(console.error);
