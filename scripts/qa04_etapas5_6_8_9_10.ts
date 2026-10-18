import { createClient } from "@supabase/supabase-js";

const URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

// ─── ANON CLIENT (no auth) ───
const anon = createClient(URL, ANON_KEY);

// ─── AUTHED CLIENT ───
async function getAuthed() {
  const c = createClient(URL, ANON_KEY);
  const { data, error } = await c.auth.signInWithPassword({
    email: "tamiris.castilho@conexaoexpress.com.br",
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "Conexao@2026",
  });
  if (error) {
    console.error("Auth ERROR:", error.message);
    process.exit(1);
  }
  console.log("Auth OK:", data.user?.email);
  return c;
}

async function main() {
  const authed = await getAuthed();

  console.log("\n═══════════════════════════════════════");
  console.log("ETAPA 5 — MÉTODO DE ACESSO AO BANCO");
  console.log("═══════════════════════════════════════");
  console.log("Método: Supabase JavaScript Client via anon key");
  console.log("Autenticação: signInWithPassword (tamiris.castilho)");
  console.log("Service Role Key: NÃO DISPONÍVEL");
  console.log("PostgreSQL Direto: NÃO DISPONÍVEL");
  console.log("Afetado por RLS: SIM — todas as consultas passam por RLS");
  console.log("Bypass RLS: NÃO — consultas individuais por ID não bypassam RLS;");
  console.log("  apenas a policy não filtra quando o row é encontrado por ID específico");
  console.log("  (comportamento normal do PostgreSQL: RLS avalia row-level, não block-level)");
  console.log("Scripts criados: qa03_auditoria_banco.ts, qa03_count_os.ts, qa03_etapa4_*.ts, qa03_etapa5_*.ts");
  console.log("Método real: Supabase REST via supabase-js (anon key + JWT session)");

  console.log("\n═══════════════════════════════════════");
  console.log("ETAPA 6 — CATÁLOGO REAL (tabelas acessíveis)");
  console.log("═══════════════════════════════════════");

  // Try to get table list via information_schema RPC
  const tablesToCheck = [
    // Core business
    "clientes", "ordens_servico", "alocacoes_escala", "prestadores", "veiculos",
    "entregas_protocolo", "ocorrencias",
    // Finance
    "financeiro_receber", "financeiro_pagar", "pagamentos_prestadores",
    "composicao_financeira_os",
    // App motorista
    "motorista_app_sessoes", "prestador_acesso", "prestador_disponibilidade",
    "prestador_notificacoes", "prestador_engajamento", "prestador_candidaturas",
    "prestador_reembolsos", "reembolsos_prestador",
    "motorista_checkins",
    // Tracking
    "tracking_links", "tracking_eventos", "tracking_notificacoes_destinatario",
    "portal_tracking_realtime", "portal_comprovantes", "portal_protocolos",
    "delivery_proofs",
    // Other
    "enderecos_favoritos", "operacao_localizacao", "recrutamento_prestadores",
    "portal_pedidos", "tenant_usuarios",
    // Auth
    "auth.users", "auth.sessions",
  ];

  const results: Record<string, { exists: boolean; count: number }> = {};
  for (const tbl of tablesToCheck) {
    const { count, error } = await authed
      .from(tbl)
      .select("*", { count: "exact", head: true });
    if (error) {
      if (
        error.message?.includes("does not exist") ||
        error.message?.includes("relation") ||
        error.message?.includes("not found") ||
        error.code === "PGRST116"
      ) {
        results[tbl] = { exists: false, count: -1 };
      } else {
        results[tbl] = { exists: "ERROR", count: -1 };
        console.log(`  ${tbl}: ERROR - ${error.message?.slice(0, 80)}`);
      }
    } else {
      results[tbl] = { exists: true, count: count ?? 0 };
    }
  }

  // Print catalog
  const categories: Record<string, string[]> = {
    CORE: ["clientes", "ordens_servico", "alocacoes_escala", "prestadores", "veiculos", "entregas_protocolo", "ocorrencias"],
    FINANCE: ["financeiro_receber", "financeiro_pagar", "pagamentos_prestadores", "composicao_financeira_os"],
    APP_MOTORISTA: ["motorista_app_sessoes", "prestador_acesso", "prestador_disponibilidade", "prestador_notificacoes", "prestador_engajamento", "prestador_candidaturas", "prestador_reembolsos", "reembolsos_prestador", "motorista_checkins"],
    TRACKING: ["tracking_links", "tracking_eventos", "tracking_notificacoes_destinatario", "portal_tracking_realtime", "portal_comprovantes", "portal_protocolos", "delivery_proofs"],
    OTHER: ["enderecos_favoritos", "operacao_localizacao", "recrutamento_prestadores", "portal_pedidos", "tenant_usuarios"],
  };

  for (const [cat, tbls] of Object.entries(categories)) {
    console.log(`\n--- ${cat} ---`);
    for (const tbl of tbls) {
      const r = results[tbl];
      if (!r) {
        console.log(`  ${tbl}: NÃO VERIFICADO`);
      } else if (r.exists === "ERROR") {
        console.log(`  ${tbl}: ⚠️ ERRO (pode existir mas RLS bloqueia head query)`);
      } else if (!r.exists) {
        console.log(`  ${tbl}: ❌ NÃO EXISTE`);
      } else {
        const status = r.count > 0 ? "✅ TEM DADOS" : "⚠️ EXISTE VAZIA";
        console.log(`  ${tbl}: ${status} (${r.count} registos)`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("ETAPA 8 — TENTATIVA DE EXTRAIR RLS POLICIES");
  console.log("═══════════════════════════════════════");

  // Try to query pg_policies via RPC
  try {
    const { data: policies, error: polErr } = await authed.rpc("get_policies_info");
    if (polErr) {
      console.log("RPC get_policies_info não disponível:", polErr.message);
    } else if (policies) {
      console.log("Policies found:", Array.isArray(policies) ? policies.length : "?");
      const ordensPolicies = Array.isArray(policies)
        ? policies.filter((p: any) => p.tablename === "ordens_servico")
        : [];
      console.log("ordens_servico policies:", ordensPolicies.length);
      ordensPolicies.forEach((p: any) => console.log(`  ${JSON.stringify(p)}`));
    }
  } catch (e: any) {
    console.log("Cannot query pg_policies:", e.message);
  }

  // Try direct SQL via RPC
  try {
    const { data: sqlResult, error: sqlErr } = await authed.rpc("exec_sql", {
      query_text: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'ordens_servico'",
    });
    if (sqlErr) {
      console.log("RPC exec_sql not available:", sqlErr.message);
    } else {
      console.log("ordens_servico policies:", JSON.stringify(sqlResult, null, 2));
    }
  } catch (e: any) {
    console.log("Cannot exec_sql:", e.message);
  }

  // Try to examine the specific RLS function
  try {
    const { data: funcs, error: funcErr } = await authed.rpc("get_rpc_definition", {
      func_name: "f_usuario_pode_acessar_cliente",
    });
    if (funcErr) {
      console.log("RPC get_rpc_definition not available:", funcErr.message);
    } else {
      console.log("f_usuario_pode_acessar_cliente def:", JSON.stringify(funcs).slice(0, 200));
    }
  } catch {}

  // Try to examine the ordens_servico policy specifically via looking at the migration
  console.log("\n--- Checking migrations for ordens_servico RLS definitions ---");
  const { data: migs, error: migErr } = await authed
    .from("_migrations")
    .select("name")
    .order("name", { ascending: false })
    .limit(10);
  if (migErr) {
    console.log("_migrations table not accessible:", migErr.message);
  } else {
    console.log("Recent migrations:", migs?.map((m: any) => m.name).join(", "));
  }

  console.log("\n═══════════════════════════════════════");
  console.log("ETAPA 9 — AUDITORIA ANÔNIMA");
  console.log("═══════════════════════════════════════");

  const anonTables = [
    "clientes", "ordens_servico", "alocacoes_escala", "entregas_protocolo",
    "financeiro_receber", "financeiro_pagar", "prestadores", "veiculos",
    "operacao_localizacao", "portal_tracking_realtime",
  ];

  for (const tbl of anonTables) {
    const { data, error, count } = await anon
      .from(tbl)
      .select("*", { count: "exact", head: true });
    if (error) {
      if (error.message?.includes("does not exist") || error.code === "PGRST116") {
        console.log(`  ${tbl}: ❌ TABLE NOT FOUND`);
      } else if (error.message?.includes("permission denied") || error.code === "42501") {
        console.log(`  ${tbl}: 🔒 BLOQUEADO (401/403)`);
      } else if (error.message?.includes("uuid")) {
        console.log(`  ${tbl}: ❌ QUEBRADO (uuid cast error)`);
      } else {
        console.log(`  ${tbl}: ⚠️ ERRO (${error.message?.slice(0, 60)})`);
      }
    } else {
      const status = count && count > 0 ? "✅ ACESSÍVEL" : "⚠️ VAZIO (acessível)";
      const sensivel =
        tbl === "alocacoes_escala" || tbl === "entregas_protocolo"
          ? " — DADOS OPERACIONAIS SENSÍVEIS"
          : tbl === "financeiro_receber" || tbl === "financeiro_pagar"
          ? " — DADOS FINANCEIROS"
          : "";
      console.log(`  ${tbl}: ${status} (${count} registos)${sensivel}`);
    }
  }

  // Anon sample - try to get actual data from alocacoes_escala
  console.log("\n--- Anon data sample (alocacoes_escala) ---");
  const { data: anonAloc } = await anon
    .from("alocacoes_escala")
    .select("id, status, cliente_id, prestador_id, created_at")
    .limit(3);
  if (anonAloc && anonAloc.length > 0) {
    anonAloc.forEach((a, i) => {
      console.log(`  ${i+1}. ID=${(a.id||"").slice(0,8)} Status=${a.status} Cli=${(a.cliente_id||"").slice(0,8)||"null"}`);
    });
  } else {
    console.log("  No data returned (RLS filtering?)");
  }

  // Anon - try entregas_protocolo
  const { data: anonEntr } = await anon
    .from("entregas_protocolo")
    .select("id, foto_entrega_url, assinatura_url, created_at")
    .limit(3);
  console.log(`\nentregas_protocolo anon: ${anonEntr?.length || 0} records`);
  if (anonEntr && anonEntr.length > 0) {
    anonEntr.forEach((e, i) => {
      console.log(`  ${i+1}. ID=${(e.id||"").slice(0,8)} tem_foto=${!!e.foto_entrega_url} tem_assinatura=${!!e.assinatura_url}`);
    });
  }

  console.log("\n═══════════════════════════════════════");
  console.log("ETAPA 10 — PRESTADOR vs MOTORISTA (conclusão)");
  console.log("═══════════════════════════════════════");

  // How do pagamentos_prestadores have prestador_id if prestadores is empty?
  const { data: pagSample, count: pagTotal } = await authed
    .from("pagamentos_prestadores")
    .select("prestador_id, os_id, valor, created_at")
    .limit(10);
  console.log(`pagamentos_prestadores (${pagTotal} total, ${pagSample?.length || 0} sample):`);
  if (pagSample && pagSample.length > 0) {
    pagSample.forEach((p, i) => {
      console.log(`  ${i+1}. prestador_id=${(p.prestador_id||"").slice(0,8)} os_id=${(p.os_id||"").slice(0,8)||"null"} valor=${p.valor}`);
    });
    // Check if any prestador_id exists in prestadores
    const prestIds = [...new Set(pagSample.map(p => p.prestador_id).filter(Boolean))] as string[];
    if (prestIds.length > 0) {
      const { count: match } = await authed
        .from("prestadores")
        .select("*", { count: "exact", head: true })
        .in("id", prestIds);
      console.log(`  prestadores matching pagamentos prestador_id: ${match ?? 0} (out of ${prestIds.length} checked)`);

      // Also check if these IDs exist as auth.users
      for (const pid of prestIds.slice(0, 3)) {
        const { data: user } = await authed.auth.admin.getUserById(pid);
        if (user?.user) {
          console.log(`  ID ${pid.slice(0,8)}: FOUND in auth.users as ${user.user.email}`);
        } else {
          console.log(`  ID ${pid.slice(0,8)}: NOT in auth.users`);
        }
      }
    }
  }

  // Check financeiro_pagar fornecedor_id
  const { data: fpSample } = await authed
    .from("financeiro_pagar")
    .select("id, fornecedor_id, os_id, valor, favorecido_nome")
    .limit(10);
  console.log("\nfinanceiro_pagar sample:");
  if (fpSample) {
    fpSample.forEach((f, i) => {
      console.log(`  ${i+1}. fornecedor_id=${(f.fornecedor_id||"").slice(0,8)||"null"} os_id=${(f.os_id||"").slice(0,8)||"null"} valor=${f.valor} favorecido=${f.favorecido_nome || "?"}`);
    });
  }

  // Check financeiro_receber for cliente relationship
  const { data: frSample } = await authed
    .from("financeiro_receber")
    .select("id, cliente_id, os_id, valor")
    .limit(10);
  console.log("\nfinanceiro_receber sample:");
  if (frSample) {
    frSample.forEach((f, i) => {
      console.log(`  ${i+1}. cliente_id=${(f.cliente_id||"").slice(0,8)||"null"} os_id=${(f.os_id||"").slice(0,8)||"null"} valor=${f.valor}`);
    });
  }

  // All clientes for reference
  const { data: clis } = await authed.from("clientes").select("id, razao_social, cpf_cnpj");
  console.log(`\nAll ${clis?.length || 0} clientes:`);
  if (clis) {
    clis.forEach((c, i) => {
      console.log(`  ${i+1}. ${c.razao_social || "?"} (${(c.id||"").slice(0,8)}) CNPJ=${c.cpf_cnpj || "?"}`);
    });
  }

  console.log("\n═══════════════════════════════════════");
  console.log("CONCLUSÃO: ETAPAS 5, 6, 8, 9, 10");
  console.log("═══════════════════════════════════════");
}

main().catch(console.error);
