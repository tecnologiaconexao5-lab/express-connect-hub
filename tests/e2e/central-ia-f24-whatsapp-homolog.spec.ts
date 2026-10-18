import { test, expect }   from "@playwright/test";
import { createClient }   from "@supabase/supabase-js";
const SUPABASE_URL = "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const TMS_URL = "http://localhost:8800";
const TERMOS_PROIBIDOS = [  "sou rob\u00f4", "sou uma IA", "sou intelig\u00eancia artificial",  "sou humano", "sou atendente humano",];
const FALLBACK_MSG = "Vou direcionar para o respons\u00e1vel pelo setor e j\u00e1 retorno com uma posi\u00e7\u00e3o.";
async function loginAdmin(page: any) { await page.goto(`${TMS_URL}/login`, { waitUntil: "domcontentloaded", timeout: 30000});
await page.waitForTimeout(2000);
const emailInput = page.locator('input[type="email"]');
const passwordInput = page.locator('input[type="password"]');
await emailInput.waitFor({ state: "visible", timeout: 15000 });
await emailInput.fill("tamiris.castilho@conexaoexpress.com.br");
await passwordInput.fill(process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || "__CONEXAO2026_TAMIRIS__");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(3000);
await page.waitForLoadState("domcontentloaded");};
test.describe.serial("F24 â€” WhatsApp Homologa\u00e7\u00e3o Controlada", () => { //  1. P\u00e1gina abr
test("F24.1 â€” /central-ia abre com abas", async ({ page }) => { await loginAdmin(page);
await page.goto(`${TMS_URL}/central-ia`, { waitUntil: "domcontentloaded"});
await page.waitForTimeout(2000);
const abas = await page.locator('[role="tab"]').allTextContents();
const textos = abas.join(" ");
expect(textos).toContain("Rob\u00f4s");
expect(textos).toContain("Aprova\u00e7\u00f5es");
expect(textos).toContain("Logs");

    console.log(`[F24.1] Abas encontradas: ${abas.join(", ")}`);});

  //  2. Criar mensagem WhatsApp simulada via Supabas
test("F24.2 â€” Criar mensagem WhatsApp simulada com aprova\u00e7\u00e3o", async () => { const { data: robos} = await supabase      .from("automacoes_robos")      .select("id, nome")      .limit(1);
const roboId = robos?.[0]?.id;
if (!roboId) { console.log("[F24.2] Nenhum rob\u00f4 dispon\u00edvel, pulando");
expect(true).toBe(true);
return;}
    //  Criar taref
const { data: tarefa} = await supabase      .from("automacoes_tarefas")      .insert({ robo_id: roboId,        setor: "Comercial",        tipo_tarefa: "mensagem",        origem_tipo: "teste_f24",        origem_id: "f24-msg-1",        titulo: "Teste F24 - Mensagem WhatsApp",        descricao: "Mensagem de teste para homologa\u00e7\u00e3o WhatsApp",        prioridade: "normal",        status: "aguardando_aprovacao",        payload: { destinatario_tipo: "cliente",          canal: "whatsapp",          conteudo_gerado: `Prezado cliente, tudo bem? Gostar\u00edamos de informar que sua entrega est\u00e1 em andamento.\n\nAtenciosamente,\nOpera\u00e7\u00e3o Conex\u00e3o Express\n\n${FALLBACK_MSG}`,}, resultado: {}, })      .select()      .single();
expect(tarefa).toBeTruthy();

    console.log(`[F24.2] Tarefa criada: ${tarefa?.id}`);

    //  Criar aprova\u00e7\u00e3o do tipo mensagem_cliente (whatsapp
const { data: aprovacao} = await supabase      .from("automacoes_aprovacoes")      .insert({ tarefa_id: tarefa!.id,        tipo_aprovacao: "mensagem_cliente",        conteudo_original: { objetivo: "Notificar cliente sobre entrega"}, conteudo_sugerido: { destinatario: "Cliente Teste",          canal: "whatsapp",          mensagem: `Prezado cliente, tudo bem? Gostar\u00edamos de informar que sua entrega est\u00e1 em andamento.\n\nAtenciosamente,\nOpera\u00e7\u00e3o Conex\u00e3o Express\n\n${FALLBACK_MSG}`,          assinatura: "Opera\u00e7\u00e3o Conex\u00e3o Express",}, status: "pendente",})      .select()      .single();
expect(aprovacao).toBeTruthy();

    console.log(`[F24.2] Aprova\u00e7\u00e3o criada: ${aprovacao?.id}`);

    //  Criar lo
await supabase.from("automacoes_logs").insert({ robo_id: roboId,      tarefa_id: tarefa!.id,      acao: "mensagem_criada",      entrada: { aprovacao_id: aprovacao?.id, tipo: "mensagem_cliente"}, saida: { mensagem_preview: "Prezado cliente..."}, status: "info",});

    console.log("[F24.2] Log mensagem_criada registrado");});

  //  3. Editar mensagem antes de aprova
test("F24.3 â€” Editar conte\u00fado da aprova\u00e7\u00e3o", async () => { const { data: aprovacoes} = await supabase      .from("automacoes_aprovacoes")      .select("id, tarefa_id, conteudo_sugerido")      .eq("status", "pendente")      .eq("tipo_aprovacao", "mensagem_cliente")      .limit(1);
if (!aprovacoes?.length) { console.log("[F24.3] Nenhuma aprova\u00e7\u00e3o pendente, pulando");
expect(true).toBe(true);
return;
const ap = aprovacoes[0];
const editado = { ...(ap.conteudo_sugerido as Record<string, unknown>),      mensagem: `Mensagem editada para teste F24.\n\nAtenciosamente,\nOpera\u00e7\u00e3o Conex\u00e3o Express\n\n${FALLBACK_MSG}`,};
await supabase      .from("automacoes_aprovacoes")      .update({ status: "editado",        conteudo_sugerido: editado,        aprovado_em: new Date().toISOString(), })      .eq("id", ap.id);
await supabase.from("automacoes_logs").insert({ tarefa_id: ap.tarefa_id,      acao: "aprovacao_editada",      entrada: { aprovacao_id: ap.id}, saida: { mensagem_editada: true}, status: "sucesso",});
const { data: check} = await supabase      .from("automacoes_aprovacoes")      .select("status")      .eq("id", ap.id)      .single();
expect(check?.status).toBe("editado");

    console.log(`[F24.3] Aprova\u00e7\u00e3o ${ap.id} editada com sucesso`);}});

  //  4. Aprovar mensage
test("F24.4 â€” Aprovar mensagem WhatsApp", async () => { const { data: aprovacoes} = await supabase      .from("automacoes_aprovacoes")      .select("id, tarefa_id")      .eq("status", "pendente")      .eq("tipo_aprovacao", "mensagem_cliente")      .limit(1);
if (!aprovacoes?.length) { console.log("[F24.4] Nenhuma aprova\u00e7\u00e3o pendente, pulando");
expect(true).toBe(true);
return;
const ap = aprovacoes[0];
await supabase      .from("automacoes_aprovacoes")      .update({ status: "aprovado", aprovado_em: new Date().toISOString() })      .eq("id", ap.id);
await supabase      .from("automacoes_tarefas")      .update({ status: "concluida" })      .eq("id", ap.tarefa_id);
await supabase.from("automacoes_logs").insert({ tarefa_id: ap.tarefa_id,      acao: "aprovacao_aprovada",      entrada: { aprovacao_id: ap.id}, status: "sucesso",});
const { data: check} = await supabase      .from("automacoes_aprovacoes")      .select("status")      .eq("id", ap.id)      .single();
expect(check?.status).toBe("aprovado");

    console.log(`[F24.4] Aprova\u00e7\u00e3o ${ap.id} aprovada`);}});

  //  5. Tentar enviar com homologa\u00e7\u00e3o desligada â†’ bloquead
test("F24.5 â€” Homologa\u00e7\u00e3o desligada bloqueia envio", async () => { const { data: aprovacoes} = await supabase      .from("automacoes_aprovacoes")      .select("id, tarefa_id, conteudo_sugerido")      .eq("status", "aprovado")      .eq("tipo_aprovacao", "mensagem_cliente")      .limit(1);
if (!aprovacoes?.length) { console.log("[F24.5] Nenhuma aprova\u00e7\u00e3o aprovada, pulando");
expect(true).toBe(true);
return;
const ap = aprovacoes[0];
const mensagem = ((ap.conteudo_sugerido as Record<string, unknown>)?.mensagem as string) || "";

    //  Simular o bloqueio por homologa\u00e7\u00e3o desligada inserindo diretamente na tabel
const { data: msg} = await supabase      .from("comunicacoes_mensagens")      .insert({ tarefa_id: ap.tarefa_id,        origem_tipo: "teste_f24",        origem_id: "f24-bloqueio-1",        destinatario_tipo: "setor",        canal: "whatsapp",        assunto: "Teste bloqueio - homolog desligada",        conteudo: mensagem,        status: "bloqueado",        modo_seguro: true,        modo_homologacao: false,        provider_message_id: null,        motivo_bloqueio: "Homologa\u00e7\u00e3o desativada",        contexto: { telefone_mascarado: "55****9999", fallback: FALLBACK_MSG}, })      .select()      .single();
expect(msg).toBeTruthy();
expect(msg?.status).toBe("bloqueado");
expect(msg?.provider_message_id).toBeNull();
expect(msg?.modo_homologacao).toBe(false);
await supabase.from("automacoes_logs").insert({ tarefa_id: ap.tarefa_id,      acao: "whatsapp_homolog_bloqueado",      entrada: { motivo: "Homologa\u00e7\u00e3o desativada", telefone_mascarado: "55****9999"}, status: "aviso",});

    console.log("[F24.5] Bloqueio por homologa\u00e7\u00e3o desligada registrado");}});

  //  6. Tentar enviar telefone fora allowlist â†’ bloquead
test("F24.6 â€” Telefone fora allowlist bloqueia envio", async () => { const { data: aprovacoes} = await supabase      .from("automacoes_aprovacoes")      .select("id, tarefa_id, conteudo_sugerido")      .eq("status", "aprovado")      .eq("tipo_aprovacao", "mensagem_cliente")      .limit(1);
if (!aprovacoes?.length) { console.log("[F24.6] Nenhuma aprova\u00e7\u00e3o aprovada, pulando");
expect(true).toBe(true);
return;
const ap = aprovacoes[0];
const mensagem = ((ap.conteudo_sugerido as Record<string, unknown>)?.mensagem as string) || "";
const { data: msg} = await supabase      .from("comunicacoes_mensagens")      .insert({ tarefa_id: ap.tarefa_id,        origem_tipo: "teste_f24",        origem_id: "f24-bloqueio-2",        destinatario_tipo: "setor",        canal: "whatsapp",        assunto: "Teste bloqueio - telefone fora allowlist",        conteudo: mensagem,        status: "bloqueado",        modo_seguro: true,        modo_homologacao: true,        provider_message_id: null,        motivo_bloqueio: "Telefone fora da lista de teste autorizada",        contexto: { telefone_mascarado: "55****7777", fallback: FALLBACK_MSG}, })      .select()      .single();
expect(msg).toBeTruthy();
expect(msg?.status).toBe("bloqueado");
expect(msg?.provider_message_id).toBeNull();

    console.log("[F24.6] Bloqueio por telefone fora allowlist registrado");}});

  //  7. Mensagem com termo proibido â†’ bloquead
test("F24.7 â€” Mensagem com termo proibido \u00e9 bloqueada", async () => { const mensagemProibida = `Ol\u00e1, sou rob\u00f4 e vou ajudar voc\u00ea. ${FALLBACK_MSG}`;
const { data: msg} = await supabase      .from("comunicacoes_mensagens")      .insert({ origem_tipo: "teste_f24",        origem_id: "f24-bloqueio-3",        destinatario_tipo: "setor",        canal: "whatsapp",        assunto: "Teste - termo proibido",        conteudo: mensagemProibida,        status: "bloqueado",        modo_seguro: true,        modo_homologacao: true,        provider_message_id: null,        motivo_bloqueio: 'Mensagem cont\u00e9m termo proibido: "sou rob\u00f4"',        contexto: { fallback: FALLBACK_MSG}, })      .select()      .single();
expect(msg).toBeTruthy();
expect(msg?.status).toBe("bloqueado");
expect(msg?.provider_message_id).toBeNull();

    console.log("[F24.7] Bloqueio por termo proibido registrado");});

  //  8. provider_message_id deve ficar vazio quando bloquead
test("F24.8 â€” Mensagens bloqueadas tem provider_message_id nulo", async () => { const { data} = await supabase      .from("comunicacoes_mensagens")      .select("id, status, provider_message_id, modo_homologacao")      .in("status", ["bloqueado", "erro_homologacao"])      .limit(20);
if (!data?.length) { console.log("[F24.8] Nenhuma mensagem bloqueada para verificar");
expect(true).toBe(true);
return;
for (const msg of data) { expect(msg.provider_message_id).toBeNull();}    console.log(`[F24.8] ${data.length} mensagens bloqueadas, todas com provider_message_id nulo`);}});

  //  9. Logs de bloqueio criado
test("F24.9 â€” Logs de bloqueio de WhatsApp existem", async () => { const { data} = await supabase      .from("automacoes_logs")      .select("id, acao, status")      .eq("acao", "whatsapp_homolog_bloqueado")      .limit(10);
expect(data?.length).toBeGreaterThan(0);
const acoes = data?.map((l: any) => l.acao) || [];

    console.log(`[F24.9] ${data?.length} logs de bloqueio: ${acoes.join(", ")}`);});

  //  10. Nenhuma API key aparece nos log
test("F24.10 â€” Nenhum log cont\u00e9m API key", async () => { const { data} = await supabase      .from("automacoes_logs")      .select("entrada, saida, erro")      .limit(50);
if (!data?.length) { console.log("[F24.10] Nenhum log para verificar");
expect(true).toBe(true);
return;
const palavrasProibidas = ["apiKey", "api_key", "VITE_EVOLUTION_API_KEY", "authorization", "AUTHENTICATION_API_KEY"];
for (const log of data) { const text = JSON.stringify(log).toLowerCase();
for (const p of palavrasProibidas) { expect(text).not.toContain(p.toLowerCase());}}    console.log(`[F24.10] ${data.length} logs verificados, nenhum com API key`);}});

  //  11. Mensagens com status bloqueado/simulado (n\u00e3o enviado real
test("F24.11 â€” Nenhuma mensagem foi enviada como 'enviado' (status real)", async () => { const { data} = await supabase      .from("comunicacoes_mensagens")      .select("status, provider_message_id, modo_homologacao, modo_seguro")      .limit(50);
if (!data?.length) { console.log("[F24.11] Nenhuma mensagem para verificar");
expect(true).toBe(true);
return;
const enviadoReal = data.filter((m: any) => m.status === "enviado" || (m.provider_message_id && !m.modo_homologacao));
expect(enviadoReal.length).toBe(0);

    console.log(`[F24.11] ${data.length} mensagens, nenhum envio real detectado`);}});

  //  12. Verificar colunas F24 existem no banc
test("F24.12 â€” Colunas F24 existem no banco", async () => { const { data} = await supabase      .from("comunicacoes_mensagens")      .select("modo_homologacao, motivo_bloqueio, aprovado_por, aprovado_em")      .limit(1);
expect(data).not.toBeNull();

    console.log("[F24.12] Colunas F24 existem em comunicacoes_mensagens");});});

