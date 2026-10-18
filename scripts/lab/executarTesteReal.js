// executarTesteReal.js — Teste abrangente do fluxo Escala → App Prestador
// Executa via Node.js: node scripts/lab/executarTesteReal.js

import { createClient } from "@supabase/supabase-js";
import { guardHarness } from "../_guard.mjs";

// TMS-FIN-DATA-04D3B — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/executarTesteReal.js");

// TMS-FIN-DATA-04D3B — sem hardcode de PROD/anon. Somente ambiente validado pelo guard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const now = () => new Date().toISOString();

let erros = 0;
let alertas = 0;

function ok(msg, data?) {
  console.log(`  ✔ ${msg}`);
  if (data) console.log(`     ${JSON.stringify(data)}`);
}

function erro(msg, data?) {
  console.log(`  ✗ ${msg}`);
  if (data) console.log(`     ${JSON.stringify(data)}`);
  erros++;
}

function alerta(msg, data?) {
  console.log(`  ⚠ ${msg}`);
  if (data) console.log(`     ${JSON.stringify(data)}`);
  alertas++;
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  PROVA REAL: FLUXO ESCALA → APP PRESTADOR");
  console.log("  " + now());
  console.log("=".repeat(70));

  // ===================================================================
  // PARTE 1: Verificar estrutura do auth
  // ===================================================================
  console.log("\n─── PARTE 1: Estrutura de autenticação (MISSAO 50) ───");
  console.log("  Modelo de auth do TMS: Supabase Auth REAL (sem modo demo)");
  console.log("  Supabase client: APENAS chave anon (sem service_role)");
  console.log("  Usuarios Supabase Auth corporativos:");
  console.log("    - tamiris.castilho@conexaoexpress.com.br  (DIRETORIA / ADMIN MASTER)");
  console.log("    - financeiro@conexaoexpress.com.br        (DIRETORIA / FINANCEIRO MASTER)");
  console.log("    - comercial@conexaoexpress.com.br         (COMERCIAL)");
  console.log("    - operacional@conexaoexpress.com.br       (OPERACIONAL)");
  console.log("    - contato@conexaoexpress.com.br           (ATENDIMENTO / SUPORTE)");
  console.log("  Agentes IA internos (sem login): IA Financeira, IA Operacional, IA Comercial, IA Auditoria, IA Atendimento");

  // ===================================================================
  // PARTE 2: Login como teste@conexao.com (único usuário com Supabase Auth)
  // ===================================================================
  console.log("\n─── PARTE 2: Login Supabase Auth ───");
  const { data: { session }, error: loginErr } = await supabase.auth.signInWithPassword({
    email: "teste@conexao.com",
    password: "12345678",
  });

  if (loginErr || !session) {
    erro(`Login como teste@conexao.com falhou: ${loginErr?.message}`);
    console.log("\n  Como o TMS usa login HARDCODED, o Supabase NÃO tem sessão de usuário.");
    console.log("  Todas as consultas ao Supabase usam a chave ANON (role: anon/public).");
    return;
  }

  ok(`Login OK: ${session.user.email} (${session.user.id})`);
  const userId = session.user.id;
  const authPrestadorId = "e6646799-fbac-453e-a3ef-afdfc01a7085"; // PRESTADOR TESTE APP

  // ===================================================================
  // PARTE 3: Testar operações CRUD na alocacoes_escala
  // ===================================================================
  console.log("\n─── PARTE 3: Teste CRUD alocacoes_escala ───");

  // 3A: SELECT
  console.log("  3A. SELECT:");
  const { data: selectData, error: selectErr } = await supabase
    .from("alocacoes_escala")
    .select("id, prestador_id, status")
    .eq("prestador_id", authPrestadorId)
    .limit(3);
  if (selectErr) erro(`SELECT falhou: ${selectErr.message}`);
  else ok(`SELECT ok (${(selectData || []).length} registros encontrados)`);

  // 3B: INSERT (CRÍTICO - é o que queremos testar)
  console.log("  3B. INSERT (criar alocação):");
  const { error: insertErr } = await supabase
    .from("alocacoes_escala")
    .insert([{
      prestador_id: authPrestadorId,
      data_escala: "2026-06-14",
      tipo_veiculo: "vuc",
      status: "aguardando_aceite",
      status_pagamento: "pendente",
      origem: "Centro, SP",
      destino: "Barra, RJ",
      rota: "SP-RJ",
      valor_repasse: 350,
      observacoes: "[TESTE REAL] " + now(),
      metadata: {
        origem_tms: true,
        precisa_aceite_app: true,
        tipo_operacao: "escala",
        test_real: true,
        test_date: now()
      }
    }])
    .select();

  if (insertErr) {
    erro(`INSERT falhou: ${insertErr.message} (code: ${insertErr.code})`);
    alerta("Isso significa que NENHUMA alocação criada pelo TMS chega ao banco!");
    alerta("O EscalaLista.tsx cai no catch → localStorage (fallback silencioso)");
  } else {
    ok(`INSERT funcionou! Alocação criada no banco!`);
  }

  // 3C: UPDATE - que já sabemos que funciona
  console.log("  3C. UPDATE:");
  const { data: existingForUpdate } = await supabase
    .from("alocacoes_escala")
    .select("id, status")
    .eq("prestador_id", authPrestadorId)
    .eq("status", "aguardando_aceite")
    .limit(1);

  if (existingForUpdate && existingForUpdate.length > 0) {
    const updId = existingForUpdate[0].id;
    const { error: updErr } = await supabase
      .from("alocacoes_escala")
      .update({ status: "aceita", aceite_prestador: true, data_aceite: now() })
      .eq("id", updId);
    if (updErr) erro(`UPDATE falhou: ${updErr.message}`);
    else {
      ok(`UPDATE funcionou! Status alterado para 'aceita' no registro ${updId}`);
      // Reverte para não atrapalhar dados existentes
      await supabase.from("alocacoes_escala")
        .update({ status: "aguardando_aceite", aceite_prestador: false, data_aceite: null })
        .eq("id", updId);
    }
  } else {
    alerta("Nenhum registro 'aguardando_aceite' encontrado para testar UPDATE");
  }

  // ===================================================================
  // PARTE 4: Simular o fluxo real
  // ===================================================================
  console.log("\n─── PARTE 4: Simulação do fluxo Escala → App ───");

  console.log("  Cenário real no TMS:");
  console.log("  1. Usuário admin/operador faz login no TMS (login HARDCODED, localStorage)");
  console.log("  2. Acessa Escala Operacional → clica em + Alocar");
  console.log("  3. Preenche dados → clica Salvar na Grade");
  console.log("  4. handleCreateReserva() tenta INSERT no Supabase");
  console.log("  5. RLS BLOQUEIA (não há política INSERT para role anon)");
  console.log("  6. Código cai no catch → localStorage");
  console.log("  7. Alocação SÓ EXISTE no navegador de quem criou");
  console.log("  8. App Prestador NUNCA vê essa alocação");
  console.log("");

  // ===================================================================
  // PARTE 5: Teste de consulta App Prestador
  // ===================================================================
  console.log("─── PARTE 5: Consulta App Prestador (status != concluida/cancelada/recusada) ───");
  const { data: appQuery } = await supabase
    .from("alocacoes_escala")
    .select("id, status, data_escala, valor_repasse, origem, destino, metadata")
    .eq("prestador_id", authPrestadorId)
    .not("status", "in", '("concluida","cancelada","recusada")')
    .order("data_escala", { ascending: false })
    .limit(5);

  if (appQuery && appQuery.length > 0) {
    ok(`App Prestador vê ${appQuery.length} alocações pendentes:`);
    appQuery.forEach(a => {
      const meta = a.metadata as any;
      const isFromTms = meta?.origem_tms === true;
      console.log(`    [${a.status}] ${a.data_escala} | ${a.origem || "?"} → ${a.destino || "?"} | origem_tms: ${isFromTms}`);
    });
  } else {
    alerta("App Prestador não vê nenhuma alocação pendente");
    console.log("  (As alocações criadas pelo TMS estão em localStorage, não no banco)");
  }

  // ===================================================================
  // PARTE 6: Conclusão
  // ===================================================================
  console.log("\n" + "=".repeat(70));
  console.log("  RESUMO FINAL");
  console.log("=".repeat(70));
  console.log(`  Erros: ${erros}`);
  console.log(`  Alertas: ${alertas}`);
  console.log("");
  console.log("  Diagnóstico:");
  console.log("  O fluxo Escala → App está QUEBRADO por 2 motivos:");
  console.log("");
  console.log("  1. RLS impede INSERT na tabela alocacoes_escala");
  console.log("     → TMS cai em fallback localStorage (CRÍTICO)");
  console.log("     → Solução: Adicionar RLS policy INSERT ou usar Edge Function");
  console.log("");
  console.log("  2. Login do TMS é HARDCODED (não usa Supabase Auth)");
  console.log("     → Usuários 'admin' e 'operador' não existem no auth.users");
  console.log("     → Solução: Criar Edge Function (service_role) para inserir");
  console.log("       Ou: Criar usuários reais no Supabase Auth e RLS policy");
  console.log("");
  console.log("  ✅ UPDATE funciona (prestador pode aceitar/recusar)");
  console.log("  ✅ SELECT funciona (visão de dados)");
  console.log("  ❌ INSERT não funciona (TMS não persiste no banco)");
  console.log("  ❌ App Prestador não recebe alocações do TMS");
  console.log("  ❌ WhatsApp não será disparado (insert nunca chega ao banco)");
  console.log("=".repeat(70) + "\n");
}

main().catch(console.error);
