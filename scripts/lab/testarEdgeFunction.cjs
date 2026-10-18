// testarEdgeFunction.cjs — Teste da Edge Function criar-alocacao-escala
// node scripts/lab/testarEdgeFunction.cjs
// Deve ser executado APÓS deploy: supabase functions deploy criar-alocacao-escala
//
// NOTA: A Edge Function usa service_role para inserir. O SELECT com anon key
// pode ser bloqueado por RLS. Por isso a validacao usa os dados retornados
// pela propria Edge Function (fnResp.dados) como prova do insert.

const { createClient } = require("@supabase/supabase-js");
const { guardHarness } = require("../_guard.cjs");

// TMS-FIN-DATA-04D3B — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/lab/testarEdgeFunction.cjs");

// TMS-FIN-DATA-04D3B — sem hardcode de PROD/anon/token. Somente ambiente validado pelo guard.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "";
const TMS_TOKEN = process.env.TMS_EDGE_INTERNAL_TOKEN || process.env.VITE_TMS_EDGE_INTERNAL_TOKEN || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const now = () => new Date().toISOString();
const dataHoje = () => now().split("T")[0];

let step = 0;
let erros = 0;

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  TESTE: EDGE FUNCTION criar-alocacao-escala");
  console.log("  " + now());
  console.log("=".repeat(70));

  // STEP 1: Verificar se o prestador TESTE APP existe
  step++;
  console.log(`\n--- STEP ${step}: Verificar PRESTADOR TESTE APP ---`);
  const { data: prest, error: errP } = await supabase
    .from("prestadores")
    .select("id, nome_completo, telefone, auth_user_id")
    .eq("auth_user_id", "a5e51631-5ed8-430d-9041-4b185c03d821")
    .single();

  if (errP || !prest) {
    console.log("  ERRO: PRESTADOR TESTE APP nao encontrado");
    console.log("  ", errP?.message || "sem dados");
    erros++;
    return;
  }
  console.log("  Prestador:", prest.nome_completo);
  console.log("  ID:", prest.id);
  console.log("  Telefone:", prest.telefone);

  // STEP 2: Chamar Edge Function (deve estar deployada)
  step++;
  console.log(`\n--- STEP ${step}: Chamar Edge Function criar-alocacao-escala ---`);

  const payload = {
    prestador_id: prest.id,
    data_escala: dataHoje(),
    turno: "diurno",
    tipo_veiculo: "vuc",
    origem: "Centro, Sao Paulo - SP",
    destino: "Barra da Tijuca, Rio de Janeiro - RJ",
    rota: "SP \u2192 RJ via Dutra",
    valor_repasse: 350.00,
    observacoes: "[TESTE EF] Criado via Edge Function",
    metadata: {
      test_via_edge_function: true,
      test_date: now(),
    },
  };

  console.log("  Payload enviado:", JSON.stringify(payload, null, 2));

  try {
    const { data: fnResp, error: fnErr } = await supabase.functions.invoke("criar-alocacao-escala", {
      body: payload,
      headers: { "x-tms-internal-token": TMS_TOKEN },
    });

    if (fnErr) {
      console.log("  \u2718 ERRO na chamada da Edge Function:");
      console.log("  ", fnErr.message);

      if (typeof fnErr === "object" && "context" in fnErr) {
        try {
          const ctx = await fnErr.context.json();
          console.log("  Detalhes:", JSON.stringify(ctx));
        } catch {}
      }
      erros++;
      return;
    }

    console.log("  \u2714 Resposta da Edge Function:", JSON.stringify(fnResp, null, 2));

    if (!fnResp?.ok) {
      console.log("  \u2718 Edge Function retornou erro:", fnResp?.error);
      erros++;
      return;
    }

    const idAlocacao = fnResp.id;
    console.log("\n  \u2714 Alocacao criada! ID:", idAlocacao);
    console.log("  Status:", fnResp.dados?.status);

    // STEP 3: Validar campos usando os dados retornados pela Edge Function
    // (A Edge Function insere com service_role e retorna o registro completo
    //  via .select().single(). Usamos fnResp.dados como prova do insert,
    //  evitando depender de SELECT com anon key que pode ser bloqueado por RLS.)
    step++;
    console.log(`\n--- STEP ${step}: Validar campos (via resposta da EF) ---`);

    const dados = fnResp.dados;
    if (!dados) {
      console.log("  \u2718 Edge Function nao retornou dados do registro!");
      erros++;
      return;
    }

    console.log("  Registro completo:", JSON.stringify(dados, null, 2));

    const validacoes = [
      { campo: "prestador_id", resultado: dados.prestador_id === prest.id, esperado: prest.id, obtido: dados.prestador_id },
      { campo: "status", resultado: dados.status === "aguardando_aceite", esperado: "aguardando_aceite", obtido: dados.status },
      { campo: "data_escala", resultado: !!dados.data_escala, esperado: "preenchida", obtido: dados.data_escala },
      { campo: "metadata.origem_tms", resultado: dados.metadata?.origem_tms === true, esperado: "true", obtido: dados.metadata?.origem_tms },
      { campo: "metadata.precisa_aceite_app", resultado: dados.metadata?.precisa_aceite_app === true, esperado: "true", obtido: dados.metadata?.precisa_aceite_app },
      { campo: "metadata.tipo_operacao", resultado: dados.metadata?.tipo_operacao === "escala", esperado: "escala", obtido: dados.metadata?.tipo_operacao },
      { campo: "metadata.fonte", resultado: dados.metadata?.fonte === "tms_escala", esperado: "tms_escala", obtido: dados.metadata?.fonte },
      { campo: "origem", resultado: !!dados.origem, esperado: "preenchido", obtido: dados.origem },
      { campo: "destino", resultado: !!dados.destino, esperado: "preenchido", obtido: dados.destino },
    ];

    let todasOk = true;
    validacoes.forEach(v => {
      const icone = v.resultado ? "\u2714" : "\u2718";
      console.log(`  ${icone} ${v.campo}: esperado=${v.esperado}, obtido=${v.obtido}`);
      if (!v.resultado) { todasOk = false; erros++; }
    });

    if (todasOk) console.log("  \u2714 Todos os campos OK!");

    // Diagnostico: testar SELECT com anon key para identificar se RLS bloqueia
    console.log("\n  [DIAGNOSTICO] Testando SELECT com anon key...");
    const { data: alocDiag, error: errDiag } = await supabase
      .from("alocacoes_escala")
      .select("id")
      .eq("id", idAlocacao)
      .maybeSingle();
    if (errDiag) {
      console.log("  [DIAG] Erro no SELECT anon:", errDiag.message);
    } else if (!alocDiag) {
      console.log("  [DIAG] SELECT anon retornou vazio -> provavelmente RLS bloqueia leitura para anon");
    } else {
      console.log("  [DIAG] SELECT anon OK -> RLS nao esta bloqueando anon");
    }

    // STEP 4: Autenticar como prestador e consultar (simula App Prestador)
    step++;
    console.log(`\n--- STEP ${step}: Autenticar e consultar como App Prestador ---`);

    const { data: { session }, error: signInErr } = await supabase.auth.signInWithPassword({
      email: "teste@conexao.com", password: "12345678"
    });

    if (signInErr || !session) {
      console.log("  \u2718 Erro ao autenticar como prestador:", signInErr?.message || "sem sessao");
      console.log("  \u26A0 Pulando validacao App Prestador (nao afeta resultado da EF)");
    } else {
      console.log("  \u2714 Autenticado como prestador");

      const { data: appQuery, error: appErr } = await supabase
        .from("alocacoes_escala")
        .select("id, status")
        .eq("prestador_id", prest.id)
        .not("status", "in", '("concluida","cancelada","recusada")')
        .order("created_at", { ascending: false })
        .limit(5);

      if (appErr) {
        console.log("  \u2718 Erro na query do App:", appErr.message);
        erros++;
      } else {
        const encontrada = (appQuery || []).find(a => a.id === idAlocacao);
        if (encontrada) {
          console.log(`  \u2714 Alocacao encontrada na query do App! Status: ${encontrada.status}`);
        } else {
          console.log(`  \u2718 Alocacao NAO encontrada na query do App!`);
          console.log(`  IDs retornados: ${(appQuery || []).map(a => a.id).join(", ")}`);
          erros++;
        }
      }

      // STEP 5: Simular aceite (já autenticado como prestador)
      step++;
      console.log(`\n--- STEP ${step}: Simular aceite do prestador ---`);

      const { error: aceiteErr } = await supabase
        .from("alocacoes_escala")
        .update({ status: "aceita", aceite_prestador: true, data_aceite: now() })
        .eq("id", idAlocacao);

      if (aceiteErr) {
        console.log(`  \u2718 Erro ao aceitar: ${aceiteErr.message}`);
        erros++;
      } else {
        console.log(`  \u2714 Aceite simulado!`);

        const { data: verif } = await supabase
          .from("alocacoes_escala")
          .select("status, aceite_prestador")
          .eq("id", idAlocacao)
          .single();
        console.log(`  Status apos aceite: ${verif?.status}, aceite_prestador: ${verif?.aceite_prestador}`);

        // Reverter para limpeza
        await supabase.from("alocacoes_escala")
          .update({ status: "cancelada", observacoes: "[TESTE EF] Limpeza automatica" })
          .eq("id", idAlocacao);
        console.log(`  \u2714 Alocacao de teste cancelada (mantida para auditoria)`);
      }
    }

    // RESUMO
    const totalSteps = step;
    console.log("\n" + "=".repeat(70));
    console.log("  RESUMO DO TESTE");
    console.log("=".repeat(70));
    console.log(`  ID da alocacao criada: ${idAlocacao}`);
    console.log(`  Prestador: ${prest.nome_completo} (${prest.id})`);
    console.log(`  Status criado: aguardando_aceite`);
    console.log(`  Erros: ${erros}`);
    console.log(`  Resultado: ${erros === 0 ? "\u2714 APROVADO" : "\u2718 COM FALHAS"}`);
    console.log("=".repeat(70) + "\n");

  } catch (err) {
    console.log("  \u2718 Excecao na chamada da Edge Function:", err.message);
    console.log("  A Edge Function precisa estar deployada no Supabase.");
    console.log("  Execute: supabase functions deploy criar-alocacao-escala");
    console.log("  E configure as envs: EDGE_SUPABASE_URL, EDGE_SERVICE_ROLE_KEY, TMS_EDGE_INTERNAL_TOKEN");
    erros++;
  }
}

main().catch(console.error);
