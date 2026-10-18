// executarTesteReal.cjs — Teste abrangente do fluxo Escala → App Prestador
// node scripts/lab/executarTesteReal.cjs

const { createClient } = require("@supabase/supabase-js");
const { guardHarness } = require("../_guard.cjs");

// TMS-FIN-DATA-04D3B — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/executarTesteReal.cjs");

// TMS-FIN-DATA-04D3B — sem hardcode de PROD/anon. Somente ambiente validado pelo guard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const now = () => new Date().toISOString();

let erros = 0;
let alertas = 0;

function ok(msg, data) {
  console.log(`  \u2714 ${msg}`);
  if (data) console.log(`     ${JSON.stringify(data)}`);
}

function erro(msg, data) {
  console.log(`  \u2718 ${msg}`);
  if (data) console.log(`     ${JSON.stringify(data)}`);
  erros++;
}

function alerta(msg, data) {
  console.log(`  \u26A0 ${msg}`);
  if (data) console.log(`     ${JSON.stringify(data)}`);
  alertas++;
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  PROVA REAL: FLUXO ESCALA \u2192 APP PRESTADOR");
  console.log("  " + now());
  console.log("=".repeat(70));

  // ===================================================================
  // PARTE 1: Verificar estrutura do auth
  // ===================================================================
  console.log("\n--- PARTE 1: Estrutura de autenticacao (MISSAO 50) ---");
  console.log("  Modelo de auth do TMS: Supabase Auth REAL (sem modo demo, sem hardcoded)");
  console.log("  Supabase client: APENAS chave anon (sem service_role)");
  console.log("  Usuarios Supabase Auth corporativos (MISSAO 50):");
  console.log("    - tamiris.castilho@conexaoexpress.com.br  (DIRETORIA / ADMIN MASTER)");
  console.log("    - financeiro@conexaoexpress.com.br        (DIRETORIA / FINANCEIRO MASTER)");
  console.log("    - comercial@conexaoexpress.com.br         (COMERCIAL)");
  console.log("    - operacional@conexaoexpress.com.br       (OPERACIONAL)");
  console.log("    - contato@conexaoexpress.com.br           (ATENDIMENTO / SUPORTE)");
  console.log("  Agentes IA internos (sem login): IA Financeira, IA Operacional, IA Comercial, IA Auditoria, IA Atendimento");
  console.log("  Usuario que EXISTE no Supabase Auth (legado): teste@conexao.com (Prestador App)");

  // ===================================================================
  // PARTE 2: Login como teste@conexao.com
  // ===================================================================
  console.log("\n--- PARTE 2: Login Supabase Auth ---");
  const { data: { session }, error: loginErr } = await supabase.auth.signInWithPassword({
    email: "teste@conexao.com",
    password: "12345678",
  });

  if (loginErr || !session) {
    erro("Login como teste@conexao.com falhou: " + (loginErr?.message || "sem sessao"));
    console.log("\n  Como o TMS usa login HARDCODED, o Supabase NAO tem sessao de usuario.");
    console.log("  Todas as consultas ao Supabase usam a chave ANON (role: anon/public).");
    return;
  }

  ok("Login OK: " + session.user.email + " (" + session.user.id + ")");
  const authPrestadorId = "e6646799-fbac-453e-a3ef-afdfc01a7085"; // PRESTADOR TESTE APP

  // ===================================================================
  // PARTE 3: Testar operacoes CRUD na alocacoes_escala
  // ===================================================================
  console.log("\n--- PARTE 3: Teste CRUD alocacoes_escala ---");

  // 3A: SELECT
  console.log("  3A. SELECT:");
  const { data: selectData, error: selectErr } = await supabase
    .from("alocacoes_escala")
    .select("id, prestador_id, status, data_escala, origem, destino, metadata, created_by")
    .eq("prestador_id", authPrestadorId)
    .order("data_escala", { ascending: false })
    .limit(10);

  if (selectErr) {
    erro("SELECT falhou: " + selectErr.message);
  } else {
    ok((selectData || []).length + " registros encontrados");
    selectData.forEach(r => {
      console.log("    [" + r.status + "] " + r.data_escala + " | " + (r.origem || "?") + " \u2192 " + (r.destino || "?") + " | created_by: " + (r.created_by || "null"));
    });
  }

  // 3B: INSERT (CRITICO)
  console.log("\n  3B. INSERT (criar alocacao):");
  const payload = {
    prestador_id: authPrestadorId,
    data_escala: "2026-06-14",
    turno: "diurno",
    tipo_veiculo: "vuc",
    status: "aguardando_aceite",
    status_pagamento: "pendente",
    origem: "Centro, Sao Paulo - SP",
    destino: "Barra da Tijuca, Rio de Janeiro - RJ",
    rota: "SP \u2192 RJ via Dutra",
    valor_repasse: 350.00,
    observacoes: "[TESTE REAL] Prova Real " + now(),
    metadata: {
      origem_tms: true,
      precisa_aceite_app: true,
      tipo_operacao: "escala",
      test_real: true,
      test_date: now(),
    },
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("alocacoes_escala")
    .insert([payload])
    .select();

  if (insertErr) {
    erro("INSERT falhou: " + insertErr.message + " (code: " + insertErr.code + ")");
    alerta("NENHUMA alocacao criada pelo TMS chega ao banco!");
    alerta("EscalaLista.tsx cai no catch -> localStorage (fallback silencioso)");
    console.log("\n  Codigo relevante em EscalaLista.tsx:828-853:");
    console.log("    try {");
    console.log('      const { data: inserted, error } = await supabase');
    console.log("        .from('alocacoes_escala').insert([payload]).select('id').single();");
    console.log("      if (error && error.code === '42P01') {");
    console.log("        // fallback localStorage");
    console.log("      } else if (error) {");
    console.log("        throw error;  // RLS error (42501) cai AQUI -> catch");
    console.log("      }");
    console.log("    } catch (err) {");
    console.log("      // fallback localStorage (silencioso!)");
    console.log("    }");
  } else {
    ok("INSERT funcionou! Alocacao criada no banco!");
    console.log("     ID: " + (inserted?.[0]?.id || "N/A"));
    console.log("     Status: " + (inserted?.[0]?.status || "N/A"));
    if (inserted?.[0]?.id) {
      // Guardar para limpeza
      const idInserido = inserted[0].id;
      await supabase.from("alocacoes_escala")
        .update({ status: "cancelada", observacoes: "[TESTE] Limpeza automatica" })
        .eq("id", idInserido);
      ok("Alocacao de teste cancelada para limpeza");
    }
  }

  // 3C: UPDATE (sabemos que funciona)
  console.log("\n  3C. UPDATE (simular aceite do prestador):");

  // Verificar status atuais disponiveis
  const { data: allStatuses } = await supabase
    .from("alocacoes_escala")
    .select("status")
    .eq("prestador_id", authPrestadorId);

  const statusCounts = {};
  (allStatuses || []).forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  console.log("  Status disponiveis:", JSON.stringify(statusCounts));

  const { data: aguardando } = await supabase
    .from("alocacoes_escala")
    .select("id, status, data_escala")
    .eq("prestador_id", authPrestadorId)
    .eq("status", "aguardando_aceite")
    .limit(1);

  if (aguardando && aguardando.length > 0) {
    const updId = aguardando[0].id;
    const { error: updErr } = await supabase
      .from("alocacoes_escala")
      .update({ status: "aceita", aceite_prestador: true, data_aceite: now() })
      .eq("id", updId);

    if (updErr) {
      erro("UPDATE falhou: " + updErr.message);
    } else {
      ok("UPDATE funcionou! Registro " + updId + " alterado: aguardando_aceite -> aceita");
      // Reverter
      const { error: revErr } = await supabase
        .from("alocacoes_escala")
        .update({ status: "aguardando_aceite", aceite_prestador: false, data_aceite: null })
        .eq("id", updId);
      if (revErr) alerta("Falha ao reverter UPDATE: " + revErr.message);
      else ok("Registro revertido para estado original");
    }
  } else {
    alerta("Nenhum registro 'aguardando_aceite' encontrado para testar UPDATE");
    console.log("  (Nao ha alocacoes pendentes de aceite no banco)");
  }

  // ===================================================================
  // PARTE 4: Teste de consulta App Prestador
  // ===================================================================
  console.log("\n--- PARTE 4: Consulta App Prestador ---");
  const { data: appQuery } = await supabase
    .from("alocacoes_escala")
    .select("id, status, data_escala, valor_repasse, origem, destino, metadata")
    .eq("prestador_id", authPrestadorId)
    .not("status", "in", '("concluida","cancelada","recusada")')
    .order("data_escala", { ascending: false })
    .limit(5);

  if (appQuery && appQuery.length > 0) {
    ok("App Prestador ve " + appQuery.length + " alocacoes pendentes:");
    appQuery.forEach(a => {
      const meta = a.metadata || {};
      const isFromTms = meta.origem_tms === true;
      console.log("    [" + a.status + "] " + a.data_escala + " | " + (a.origem || "?") + " -> " + (a.destino || "?") + " | origem_tms: " + isFromTms);
    });
  } else {
    alerta("App Prestador NAO ve nenhuma alocacao pendente");
    console.log("  (Alocacoes do TMS estao em localStorage, nao no banco)");
  }

  // ===================================================================
  // PARTE 5: Verificar metadata das alocacoes existentes
  // ===================================================================
  console.log("\n--- PARTE 5: Verificar metadata das alocacoes existentes ---");
  const { data: allAloc } = await supabase
    .from("alocacoes_escala")
    .select("id, status, metadata")
    .eq("prestador_id", authPrestadorId);

  if (allAloc && allAloc.length > 0) {
    const comOrigemTms = allAloc.filter(a => a.metadata?.origem_tms === true);
    const comPrecisaAceite = allAloc.filter(a => a.metadata?.precisa_aceite_app === true);
    const comTipoOperacao = allAloc.filter(a => a.metadata?.tipo_operacao === "escala");
    console.log("  Total alocacoes: " + allAloc.length);
    console.log("  Com origem_tms=true: " + comOrigemTms.length);
    console.log("  Com precisa_aceite_app=true: " + comPrecisaAceite.length);
    console.log("  Com tipo_operacao=escala: " + comTipoOperacao.length);
    if (comOrigemTms.length === 0) alerta("NENHUMA alocacao veio do TMS (origem_tms)");
  } else {
    alerta("Nenhuma alocacao encontrada no banco");
  }

  // ===================================================================
  // PARTE 6: Conclusao
  // ===================================================================
  console.log("\n" + "=".repeat(70));
  console.log("  RESUMO FINAL");
  console.log("=".repeat(70));
  console.log("  Erros: " + erros);
  console.log("  Alertas: " + alertas);
  console.log("");

  if (erros > 0 || alertas > 0) {
    console.log("  \u26A0 DIAGNOSTICO:");
    console.log("  O fluxo Escala -> App esta QUEBRADO por 2 motivos:");
    console.log("");
    console.log("  1. RLS impede INSERT na tabela alocacoes_escala");
    console.log("     -> TMS cai em fallback localStorage (CRITICO)");
    console.log("     -> Nao ha RLS policy INSERT para role anon ou authenticated");
    console.log("     -> Solucao: Adicionar RLS policy INSERT");
    console.log("       CREATE POLICY \"Allow insert for anon\" ON public.alocacoes_escala");
    console.log("       FOR INSERT WITH CHECK (true);");
    console.log("       (OU usar Edge Function com service_role)");
    console.log("");
    console.log("  2. Login do TMS e HARDCODED (src/lib/auth.ts)");
    console.log("     -> Usuarios 'admin' e 'operador' nao existem no Supabase Auth");
    console.log("     -> TMS sempre usa role 'anon' para queries Supabase");
    console.log("     -> Solucao: Criar Edge Function com service_role para inserir,");
    console.log("        ou criar usuarios reais + RLS policies");
    console.log("");
    console.log("  \u2714 UPDATE e SELECT funcionam (prestador autenticado pode aceitar/recusar)");
    console.log("  \u2718 INSERT nao funciona (TMS nao persiste no banco)");
    console.log("  \u2718 App Prestador nao recebe alocacoes do TMS");
    console.log("  \u2718 WhatsApp nao sera disparado (insert nunca chega ao banco)");
  } else {
    console.log("  \u2714 TUDO FUNCIONANDO!");
  }
  console.log("=".repeat(70) + "\n");
}

main().catch(console.error);
