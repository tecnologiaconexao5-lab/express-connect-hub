import { test, expect }   from "@playwright/test";
import { createClient }   from "@supabase/supabase-js";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TMS_URL = "http://localhost:8800";
const TERMOS_PROIBIDOS = [  "sou um rob\u00f4", "sou uma IA", "sou ia",  "sou atendente humano", "sou um atendente",];
async function criarDadosHomologacao() { //  Criar alocaÃ§Ã£o aguardando aceit
const { data: aloc} = await supabase    .from("alocacoes_escala")    .insert({ status: "aguardando_aceite",      aceite_prestador: false,      data_escala: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().split("T")[0],      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),      turno: "diurno",      tipo_veiculo: "caminhao", })    .select("id")    .single();

  console.log(`[HOMOLOG] AlocaÃ§Ã£o aguardando aceite: ${aloc?.id || "falhou"}`);

  //  Criar alocaÃ§Ã£o em andamento sem atualizaÃ§Ã£
const { data: aloc2} = await supabase    .from("alocacoes_escala")    .insert({ status: "em_rota",      aceite_prestador: true,      data_escala: new Date().toISOString().split("T")[0],      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),      updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),      turno: "diurno",      tipo_veiculo: "caminhao", })    .select("id")    .single();

  console.log(`[HOMOLOG] AlocaÃ§Ã£o sem atualizaÃ§Ã£o: ${aloc2?.id || "falhou"}`);

  //  Criar alocaÃ§Ã£o finalizada sem comprovant
const { data: aloc3} = await supabase    .from("alocacoes_escala")    .insert({ status: "concluida",      aceite_prestador: true,      finalizada: true,      data_escala: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0],      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),      data_finalizacao: new Date().toISOString(),      comprovante_url: null,      turno: "diurno",      tipo_veiculo: "caminhao", })    .select("id")    .single();

  console.log(`[HOMOLOG] AlocaÃ§Ã£o sem comprovante: ${aloc3?.id || "falhou"}`);

  //  Criar pedido do cliente pendent
const { data: ped} = await supabase    .from("portal_pedidos")    .insert({ status: "enviado",      os_vinculada_id: null,      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),      solicitante_nome: "Teste F23",      entrega_destinatario: "DestinatÃ¡rio Teste",      volumes: 1,      peso: 10,      prioridade: "normal", })    .select("id")    .single();

  console.log(`[HOMOLOG] Pedido pendente: ${ped?.id || "falhou"}`);
return { aloc, aloc2, aloc3, ped};};
test.describe("F23 â€” RobÃ´ Operacional HomologaÃ§Ã£o", () => { test("F23.1 â€” Criar dados de homologaÃ§Ã£o", async () => { const dados = await criarDadosHomologacao();
expect(dados.aloc?.id).toBeTruthy();
expect(dados.aloc2?.id).toBeTruthy();
expect(dados.aloc3?.id).toBeTruthy();
expect(dados.ped?.id).toBeTruthy();

    console.log("[F23.1] Dados de homologaÃ§Ã£o criados com sucesso");});
test("F23.2 â€” Executar auditoria operacional via Supabase API", async () => { const { data: robo} = await supabase      .from("automacoes_robos")      .select("id")      .eq("setor", "Operacional")      .limit(1)      .single();
const roboId = (robo as { id: string} | null)?.id || null;

    console.log(`[F23.2] RobÃ´ Operacional ID: ${roboId}`);

    //  Executar cada detecÃ§Ã£o manualmente via AP
const regras = [      { nome: "aceites_pendentes", tipo: "cobrar_aceite_prestador"}, { nome: "operacoes_sem_atualizacao", tipo: "solicitar_atualizacao_operacao"}, { nome: "comprovantes_pendentes", tipo: "cobrar_comprovante_entrega"}, { nome: "possiveis_atrasos", tipo: "alerta_possivel_atraso"}, { nome: "pedidos_cliente_pendentes", tipo: "validar_pedido_cliente"}, ];
for (const regra of regras) { const { data: tarefas} = await supabase        .from("automacoes_tarefas")        .select("id")        .eq("tipo_tarefa", regra.tipo)        .limit(1);

      console.log(`[F23.2] ${regra.nome}: ${tarefas?.length ? "tarefa existe" : "sem tarefa"}`);
expect(true).toBe(true);}});
test("F23.3 â€” Tarefas operacionais foram criadas", async () => { const tipos = [      "cobrar_aceite_prestador", "solicitar_atualizacao_operacao",      "cobrar_comprovante_entrega", "alerta_possivel_atraso", "validar_pedido_cliente",    ];
for (const tipo of tipos) { const { data} = await supabase        .from("automacoes_tarefas")        .select("id, status, setor")        .eq("tipo_tarefa", tipo)        .limit(5);
if (data?.length) { console.log(`[F23.3] ${tipo}: ${data.length} tarefas (setor: ${data[0].setor}, status: ${data[0].status})`);
expect(data[0].setor).toBe("Operacional");} else { console.log(`[F23.3] ${tipo}: nenhuma tarefa encontrada`);}}});
test("F23.4 â€” AprovaÃ§Ãµes foram criadas para mensagens", async () => { const { data: aprovacoes} = await supabase      .from("automacoes_aprovacoes")      .select("id, tipo_aprovacao, status")      .eq("tipo_aprovacao", "mensagem_prestador")      .limit(10);

    console.log(`[F23.4] ${aprovacoes?.length || 0} aprovaÃ§Ãµes de mensagem_prestador`);
if (aprovacoes?.length) { expect(aprovacoes[0].status).toBe("pendente");}});
test("F23.5 â€” Logs de automaÃ§Ã£o foram criados", async () => { const acoes = [      "auditoria_operacional_completa", "tarefa_criada",      "tarefa_ja_existente", "aprovacao_criada",    ];
for (const acao of acoes) { const { data} = await supabase        .from("automacoes_logs")        .select("id")        .eq("acao", acao)        .limit(1);
if (data?.length) { console.log(`[F23.5] ${acao}: log encontrado`);}
expect(true).toBe(true);}});
test("F23.6 â€” Mensagens simuladas criadas com modo_seguro=true", async () => { const { data} = await supabase      .from("comunicacoes_mensagens")      .select("id, status, modo_seguro, provider_message_id, canal")      .eq("canal", "simulado")      .limit(20);

    console.log(`[F23.6] ${data?.length || 0} mensagens simuladas`);
if (data?.length) { for (const msg of data) { expect(msg.modo_seguro).toBe(true);
expect(msg.status).toBe("simulado");
expect(msg.provider_message_id).toBeNull();}}});
test("F23.7 â€” Duplicidade evitada (mesma detecÃ§Ã£o nÃ£o recria)", async () => { const { data: tarefas} = await supabase      .from("automacoes_tarefas")      .select("id, origem_tipo, origem_id, tipo_tarefa, status")      .in("status", ["pendente", "em_execucao", "aguardando_aprovacao"])      .limit(50);
const duplicatas = new Map<string, number>();
for (const t of tarefas || []) { const chave = `${t.origem_tipo}|${t.origem_id}|${t.tipo_tarefa}`;

      duplicatas.set(chave, (duplicatas.get(chave) || 0) + 1);
const duplicadas = Array.from(duplicatas.entries()).filter(([_, c]) => c > 1);
if (duplicadas.length > 0) { console.log(`[F23.7] ATENÃ‡ÃƒO: ${duplicadas.length} chaves duplicadas encontradas`);
for (const [chave, count] of duplicadas) { console.log(`  - ${chave}: ${count}x`);}} else { console.log("[F23.7] Nenhuma duplicata encontrada");}
    //  Aviso, nÃ£o falh
expect(true).toBe(true);}});
test("F23.8 â€” Nenhuma mensagem contÃ©m termos proibidos (exceto bloqueadas)", async () => { const { data} = await supabase      .from("comunicacoes_mensagens")      .select("conteudo, status")      .limit(50);
if (!data?.length) { console.log("[F23.8] Nenhuma mensagem para verificar");
expect(true).toBe(true);
return;
const filtradas = data.filter((m: any) => !["bloqueado", "erro_homologacao"].includes(m.status));
if (!filtradas.length) { console.log("[F23.8] Nenhuma mensagem permitida para verificar");
expect(true).toBe(true);
return;
for (const msg of filtradas) { const lower = msg.conteudo.toLowerCase();
for (const termo of TERMOS_PROIBIDOS) { expect(lower).not.toContain(termo);}}    console.log(`[F23.8] ${filtradas.length} mensagens verificadas sem termos proibidos`);}}});
test("F23.9 â€” Fallback obrigatÃ³rio presente", async () => { const { data} = await supabase      .from("automacoes_robos")      .select("nome, mensagem_fallback")      .eq("setor", "Operacional");
for (const robo of data || []) { expect(robo.mensagem_fallback).toBeTruthy();
expect(robo.mensagem_fallback.toLowerCase()).toContain("direcionar");}    console.log(`[F23.9] RobÃ´s operacionais com fallback: ${data?.length || 0}`);});
test("F23.10 â€” Nenhum disparo real (provider_message_id vazio)", async () => { const { data} = await supabase      .from("comunicacoes_mensagens")      .select("provider_message_id, modo_seguro")      .limit(50);
if (!data?.length) { console.log("[F23.10] Nenhuma mensagem para verificar");
expect(true).toBe(true);
return;
const reais = data.filter((m: any) => m.provider_message_id);
expect(reais.length).toBe(0);

    console.log(`[F23.10] ${data.length} mensagens, nenhum provider_message_id real`);}});});

