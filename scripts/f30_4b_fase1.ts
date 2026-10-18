import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TestResult {
  name: string;
  status: "PASS" | "FAIL";
  details: string;
}

const results: TestResult[] = [];

function pass(name: string, details: string) {
  results.push({ name, status: "PASS", details });
  console.log(`  \u2705 PASS: ${name} — ${details}`);
}

function fail(name: string, details: string) {
  results.push({ name, status: "FAIL", details });
  console.log(`  \u274c FAIL: ${name} — ${details}`);
}

async function fase1() {
  console.log("========================================");
  console.log("F30.4B — FASE 1 - TESTES REAIS DO BANCO");
  console.log("========================================\n");

  // === 1. Get the test tool (COM_ENVIAR_EMAIL) ===
  console.log("--- 1. FERRAMENTA EXEMPLO ---");
  const { data: ferramentas, error: fErr } = await supabase
    .from("ia_ferramentas")
    .select("id, codigo_unico, nome, categoria, precisa_aprovacao")
    .eq("codigo_unico", "COM_ENVIAR_EMAIL")
    .single();
  
  if (fErr || !ferramentas) {
    fail("Buscar ferramenta COM_ENVIAR_EMAIL", `Erro: ${fErr?.message}`);
    return;
  }
  const ferramenta = ferramentas;
  pass("Ferramenta encontrada", `"${ferramenta.nome}" (${ferramenta.codigo_unico}) ID: ${ferramenta.id.slice(0, 8)}...`);

  // === 2. Get the robot "Comercial IA" ===
  console.log("\n--- 2. VINCULAR AO ROBO ---");
  const { data: robos, error: rErr } = await supabase
    .from("automacoes_robos")
    .select("id, nome, setor")
    .eq("nome", "Comercial IA")
    .limit(1);
  
  if (rErr || !robos || robos.length === 0) {
    fail("Buscar robo Comercial IA", `Erro: ${rErr?.message || "Nao encontrado"}`);
    return;
  }
  const robo = robos[0];
  pass("Robo encontrado", `"${robo.nome}" (${robo.setor}) ID: ${robo.id.slice(0, 8)}...`);

  // === 3. Vincular ferramenta ao robô ===
  const { data: permissao, error: pErr } = await supabase
    .from("ia_robo_ferramentas")
    .upsert({
      robo_id: robo.id,
      ferramenta_id: ferramenta.id,
      nivel_autonomia: "EXECUTAR_COM_APROVACAO",
      ativo: true,
    }, { onConflict: "robo_id, ferramenta_id" })
    .select()
    .single();
  
  if (pErr) {
    fail("Vincular ferramenta ao robo", `Erro: ${pErr.message}`);
    return;
  }
  pass("Permissao criada", `ID: ${permissao.id.slice(0, 8)}... | Autonomia: ${permissao.nivel_autonomia}`);

  // === 4. Criar execução ===
  console.log("\n--- 3. CRIAR EXECUCAO ---");
  const { data: execucao, error: eErr } = await supabase
    .from("ia_execucoes_ferramentas")
    .insert({
      robo_id: robo.id,
      ferramenta_id: ferramenta.id,
      solicitacao: "Enviar apresentacao institucional para empresa teste.",
      contexto: { origem: "teste_f30_4b", solicitado_por: "gestor" },
      status: "AGUARDANDO_APROVACAO",
    })
    .select()
    .single();
  
  if (eErr) {
    fail("Criar execucao", `Erro: ${eErr.message}`);
    return;
  }
  const exec = execucao;
  pass("Execucao criada", `ID: ${exec.id.slice(0, 8)}... | Status: ${exec.status} | Data: ${exec.created_at}`);
  
  // Validate fields
  const checks = [
    { label: "robo_id correto", value: exec.robo_id === robo.id },
    { label: "ferramenta_id correto", value: exec.ferramenta_id === ferramenta.id },
    { label: "status inicial AGUARDANDO_APROVACAO", value: exec.status === "AGUARDANDO_APROVACAO" },
    { label: "solicitacao preenchida", value: exec.solicitacao.length > 0 },
    { label: "created_at preenchido", value: !!exec.created_at },
  ];
  for (const c of checks) {
    if (c.value) pass(c.label, "OK");
    else fail(c.label, "Falhou");
  }

  // === 5. Simular aprovação ===
  console.log("\n--- 4. FLUXO DE APROVACAO ---");
  
  // AGUARDANDO_APROVACAO -> APROVADA
  const { error: apErr } = await supabase
    .from("ia_execucoes_ferramentas")
    .update({
      status: "APROVADA",
      aprovado_por: null,
      aprovado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", exec.id);
  
  if (apErr) {
    fail("Aprovar execucao (AGUARDANDO_APROVACAO -> APROVADA)", `Erro: ${apErr.message}`);
  } else {
    pass("Status alterado para APROVADA", "AGUARDANDO_APROVACAO -> APROVADA");
  }

  // APROVADA -> EM_EXECUCAO
  const { error: exErr } = await supabase
    .from("ia_execucoes_ferramentas")
    .update({
      status: "EM_EXECUCAO",
      inicio_execucao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", exec.id);
  
  if (exErr) {
    fail("Iniciar execucao (APROVADA -> EM_EXECUCAO)", `Erro: ${exErr.message}`);
  } else {
    pass("Status alterado para EM_EXECUCAO", "APROVADA -> EM_EXECUCAO");
  }

  // EM_EXECUCAO -> CONCLUIDA
  const resultado = {
    status: "sucesso",
    mensagem: "E-mail enviado com sucesso",
    destinatario: "teste@empresa.com",
    timestamp: new Date().toISOString(),
  };
  const { error: coErr } = await supabase
    .from("ia_execucoes_ferramentas")
    .update({
      status: "CONCLUIDA",
      resultado: resultado,
      fim_execucao: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", exec.id);
  
  if (coErr) {
    fail("Concluir execucao (EM_EXECUCAO -> CONCLUIDA)", `Erro: ${coErr.message}`);
  } else {
    pass("Status alterado para CONCLUIDA", "EM_EXECUCAO -> CONCLUIDA");
  }

  // === 6. Validar histórico completo ===
  console.log("\n--- 5. VALIDAR HISTORICO ---");
  const { data: hist, error: hErr } = await supabase
    .from("ia_execucoes_ferramentas")
    .select("*, ia_ferramentas!left(nome), automacoes_robos!left(nome)")
    .eq("id", exec.id)
    .single();
  
  if (hErr || !hist) {
    fail("Buscar historico completo", `Erro: ${hErr?.message}`);
  } else {
    const h = hist as Record<string, unknown>;
    pass("Historico completo", [
      `Status: ${h.status}`,
      `Solicitacao: ${h.solicitacao}`,
      `Inicio: ${h.inicio_execucao || "-"}`,
      `Fim: ${h.fim_execucao || "-"}`,
      `Resultado: ${JSON.stringify(h.resultado)}`,
      `Aprovado por: ${h.aprovado_por || "-"}`,
      `Aprovado em: ${h.aprovado_em || "-"}`,
      `Robo: ${(h as { automacoes_robos?: { nome: string } }).automacoes_robos?.nome || h.robo_id}`,
      `Ferramenta: ${(h as { ia_ferramentas?: { nome: string } }).ia_ferramentas?.nome || h.ferramenta_id}`,
    ].join(" | "));
  }

  // === 7. List all execucoes for this robo/ferramenta ===
  const { data: allExecs } = await supabase
    .from("ia_execucoes_ferramentas")
    .select("id, status, created_at")
    .eq("robo_id", robo.id)
    .eq("ferramenta_id", ferramenta.id)
    .order("created_at", { ascending: false });
  
  if (allExecs) {
    pass("Historico de execucoes listado", `${allExecs.length} execucoes encontradas para ${robo.nome} + ${ferramenta.nome}`);
  }

  // === SUMMARY ===
  console.log("\n========================================");
  console.log("FASE 1 - RELATORIO DE TESTES");
  console.log("========================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Total: ${results.length} | PASS: ${passed} | FAIL: ${failed}`);
  
  if (failed > 0) {
    console.log("\nTESTES FALHOS:");
    for (const r of results.filter(r => r.status === "FAIL")) {
      console.log(`  - ${r.name}: ${r.details}`);
    }
  }

  console.log("\n========================================");
  console.log("IDs DOS REGISTROS CRIADOS:");
  console.log(`  Ferramenta ID: ${ferramenta.id}`);
  console.log(`  Robo ID: ${robo.id}`);
  console.log(`  Permissao ID: ${permissao.id}`);
  console.log(`  Execucao ID: ${exec.id}`);
  console.log("========================================");

  process.exit(failed > 0 ? 1 : 0);
}

fase1().catch(console.error);
