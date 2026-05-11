/**
 * SERVICE: Recrutamento WhatsApp IA Prestadores
 * Responsável por todo o fluxo de atendimento automático via IA para
 * prestadores que entram em contato pelo WhatsApp.
 *
 * Prioridade de IA: GROQ → OPENAI → Fallback heurístico
 * Segurança: Bloqueios fixos por status do prestador (NUNCA contornáveis)
 */

import { supabase } from "@/lib/supabase";

// ============================================================
// ENUMS E TIPOS
// ============================================================

export type StatusPrestador =
  | "novo"
  | "em_analise"
  | "aprovado"
  | "reprovado"
  | "bloqueado";

export type OrigemMensagem = "prestador" | "ia" | "humano" | "sistema";

export interface Conversa {
  id: string;
  telefone: string;
  nome?: string;
  prestador_id?: string;
  status: StatusPrestador;
  ia_ativa: boolean;
  humano_assumiu: boolean;
  ultima_mensagem?: string;
  created_at: string;
  updated_at: string;
}

export interface Mensagem {
  id: string;
  conversa_id: string;
  origem: OrigemMensagem;
  mensagem: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface IAConfig {
  id: string;
  manual_empresa?: string;
  regras_permitidas?: string;
  regras_bloqueadas?: string;
  ia_ativa: boolean;
  updated_at: string;
}

export type StatusConexao = "desconectado" | "aguardando_qr" | "conectado";

export interface WhatsAppConfig {
  id?: string;
  evolution_api_url: string;
  instance_name: string;
  n8n_webhook_url: string;
  numero_operacional: string;
  status: StatusConexao;
  qr_code?: string;
  ia_ativa: boolean;
  updated_at?: string;
}

export interface RespostaIA {
  texto: string;
  bloqueios_aplicados: string[];
  fallback_usado: "groq" | "openai" | "heuristico";
  prompt_enviado?: string;
  seguro: boolean;
}

// Removidos fallbacks locais e verificação de tabelas

// ============================================================
// CONVERSAS — CRUD
// ============================================================

export async function listarConversas(): Promise<Conversa[]> {
  try {
    const { data, error } = await supabase
      .from("recrutamento_whatsapp_conversas")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as Conversa[]) ?? [];
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao listar conversas:", err);
    return [];
  }
}

export async function buscarOuCriarConversa(
  telefone: string,
  nome?: string
): Promise<Conversa> {
  try {
    // Tenta buscar existente
    const { data: existente } = await supabase
      .from("recrutamento_whatsapp_conversas")
      .select("*")
      .eq("telefone", telefone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(); // Usar maybeSingle para não disparar erro 406 se não houver

    if (existente) return existente as Conversa;

    // Cria nova
    const { data: nova, error } = await supabase
      .from("recrutamento_whatsapp_conversas")
      .insert([{ telefone, nome, status: "novo", ia_ativa: true }])
      .select()
      .single();

    if (error) throw error;
    return nova as Conversa;
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao buscar/criar conversa:", err);
    throw err;
  }
}

export async function atualizarConversa(
  id: string,
  campos: Partial<Conversa>
): Promise<void> {
  try {
    await supabase
      .from("recrutamento_whatsapp_conversas")
      .update({ ...campos, updated_at: new Date().toISOString() })
      .eq("id", id);
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao atualizar conversa:", err);
  }
}

// ============================================================
// MENSAGENS — CRUD
// ============================================================

export async function listarMensagens(conversaId: string): Promise<Mensagem[]> {
  try {
    const { data, error } = await supabase
      .from("recrutamento_whatsapp_mensagens")
      .select("*")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as Mensagem[]) ?? [];
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao listar mensagens:", err);
    return [];
  }
}

export async function salvarMensagem(
  conversaId: string,
  origem: OrigemMensagem,
  mensagem: string,
  payload?: Record<string, unknown>
): Promise<Mensagem> {
  try {
    const { data, error } = await supabase
      .from("recrutamento_whatsapp_mensagens")
      .insert([{ conversa_id: conversaId, origem, mensagem, payload }])
      .select()
      .single();
    if (error) throw error;
    return data as Mensagem;
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao salvar mensagem:", err);
    throw err;
  }
}

// ============================================================
// CONFIG DA IA
// ============================================================

export async function carregarConfigIA(): Promise<IAConfig> {
  try {
    const { data, error } = await supabase
      .from("recrutamento_ia_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Registro não encontrado - retorna objeto vazio/default sem erro crítico
        return { id: "", manual_empresa: "", regras_permitidas: "", regras_bloqueadas: "", ia_ativa: true, updated_at: "" };
      }
      throw error;
    }
    
    console.log("[IA CONFIG] CARREGADO DO SUPABASE", data);
    return data as IAConfig;
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao carregar config IA:", err);
    return { id: "", manual_empresa: "", regras_permitidas: "", regras_bloqueadas: "", ia_ativa: true, updated_at: "" };
  }
}

export async function salvarConfigIA(config: Partial<IAConfig>): Promise<void> {
  try {
    const payload: any = { 
      ...config, 
      updated_at: new Date().toISOString() 
    };
    
    // Remove ID para o upsert se for vazio para deixar o banco gerar, 
    // mas mantém se vier da consulta anterior para garantir o update
    if (!payload.id) delete payload.id;

    const { data, error } = await supabase
      .from("recrutamento_ia_config")
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    console.log("[IA CONFIG] SALVO NO SUPABASE", data);
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao salvar config IA:", err);
    throw err;
  }
}

// ============================================================
// CONFIG DO WHATSAPP (CONEXÃO)
// ============================================================

export async function carregarConfigWhatsApp(): Promise<WhatsAppConfig> {
  const defaultConfig: WhatsAppConfig = {
    evolution_api_url: "",
    instance_name: "recrutamento-conexao-express",
    n8n_webhook_url: "",
    numero_operacional: "",
    status: "desconectado",
    ia_ativa: true,
  };

  try {
    const { data, error } = await supabase
      .from("recrutamento_whatsapp_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") return defaultConfig;
      throw error;
    }

    console.log("[WPP CONFIG] CARREGADO DO SUPABASE", data);
    return data as WhatsAppConfig;
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao carregar config WhatsApp:", err);
    return defaultConfig;
  }
}

export async function salvarConfigWhatsApp(cfg: WhatsAppConfig): Promise<boolean> {
  try {
    const payload: any = {
      evolution_api_url: cfg.evolution_api_url,
      instance_name: cfg.instance_name,
      n8n_webhook_url: cfg.n8n_webhook_url,
      numero_operacional: cfg.numero_operacional,
      status: cfg.status,
      ia_ativa: cfg.ia_ativa,
      updated_at: new Date().toISOString(),
    };

    if (cfg.id) payload.id = cfg.id;

    const { data, error } = await supabase
      .from("recrutamento_whatsapp_config")
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    
    console.log("[WPP CONFIG] SALVO NO SUPABASE", data);
    return true;
  } catch (err) {
    console.error("[WhatsAppIA] Erro ao salvar config WhatsApp:", err);
    return false;
  }
}

// ============================================================
// REGRAS DE SEGURANÇA (FIXAS — NUNCA CONTORNÁVEIS)
// ============================================================

const PALAVRAS_BLOQUEADAS_SEMPRE = [
  "cliente",
  "endereço",
  "rota",
  "cep",
  "cpf do cliente",
  "cnpj do cliente",
  "nota fiscal",
  "dados internos",
  "sistema interno",
  "senha",
  "login",
  "tabela de preços",
  "contrato",
  "outros prestadores",
  "outros motoristas",
];

const PALAVRAS_BLOQUEADAS_NAO_APROVADO = [
  "valor específico",
  "r$",
  "reais",
  "frete valor",
  "operação hoje",
  "operação amanhã",
  "entrega em",
  "coleta em",
  "nome do cliente",
  "destinatário",
];

function aplicarBloqueiosSeguranca(
  resposta: string,
  status: StatusPrestador
): { textoSeguro: string; bloqueios: string[] } {
  const bloqueios: string[] = [];
  let textoSeguro = resposta;

  const palavrasParaVerificar = [
    ...PALAVRAS_BLOQUEADAS_SEMPRE,
    ...(status !== "aprovado" ? PALAVRAS_BLOQUEADAS_NAO_APROVADO : []),
  ];

  for (const palavra of palavrasParaVerificar) {
    if (textoSeguro.toLowerCase().includes(palavra.toLowerCase())) {
      bloqueios.push(palavra);
      // Substituir menção pelo aviso
      const regex = new RegExp(palavra, "gi");
      textoSeguro = textoSeguro.replace(regex, "[INFORMAÇÃO RESTRITA]");
    }
  }

  return { textoSeguro, bloqueios };
}

// ============================================================
// CHAMADA APIs DE IA
// ============================================================

async function chamarGroq(
  prompt: string,
  systemPrompt: string
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[WhatsAppIA] Erro Groq:", err);
    return null;
  }
}

async function chamarOpenAI(
  prompt: string,
  systemPrompt: string
): Promise<string | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      }),
    });
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[WhatsAppIA] Erro OpenAI:", err);
    return null;
  }
}

function fallbackHeuristico(
  mensagem: string,
  status: StatusPrestador
): string {
  const msg = mensagem.toLowerCase();

  if (
    msg.includes("oi") ||
    msg.includes("olá") ||
    msg.includes("bom dia") ||
    msg.includes("boa tarde")
  ) {
    return `Olá! Bem-vindo à Conexão Express! 👋 Sou o assistente virtual de recrutamento. Como posso te ajudar hoje?`;
  }

  if (msg.includes("cadastro") || msg.includes("cadastrar") || msg.includes("trabalhar")) {
    return `Para se cadastrar como prestador parceiro, você precisará de:\n\n📄 CNH válida\n🚗 Veículo próprio\n📱 WhatsApp ativo\n🔢 CPF ou CNPJ\n\nQuer que eu te explique o próximo passo?`;
  }

  if (msg.includes("document") || msg.includes("doc")) {
    return `Os documentos necessários são:\n\n✅ CNH (frente e verso)\n✅ CRLV do veículo\n✅ Comprovante de endereço\n✅ Foto do veículo\n✅ CPF ou CNPJ\n\nTodos devem estar válidos e legíveis.`;
  }

  if (msg.includes("veículo") || msg.includes("veiculo") || msg.includes("carro") || msg.includes("moto")) {
    return `Trabalhamos com diversos tipos de veículos:\n\n🏍️ Moto\n🚙 Carro (utilitário)\n🚐 VUC / Van\n🚚 3/4 e Toco\n🚛 Truck e Carreta\n\nQual é o seu veículo?`;
  }

  if (msg.includes("pagamento") || msg.includes("salário") || msg.includes("receber") || msg.includes("ganhar")) {
    if (status !== "aprovado") {
      return `O pagamento é realizado de forma regular após a aprovação e ativação no sistema. Temos bonificações por produtividade e pontualidade! 💰\n\nPara mais detalhes, finalize seu cadastro primeiro.`;
    }
    return `Para detalhes sobre seu pagamento específico, entre em contato com nossa equipe financeira. 💰`;
  }

  if (msg.includes("prazo") || msg.includes("quanto tempo") || msg.includes("demora")) {
    return `O processo de análise geralmente leva de 2 a 5 dias úteis após envio de todos os documentos. ⏱️`;
  }

  if (msg.includes("aplicativo") || msg.includes("app")) {
    return `Temos um aplicativo exclusivo para prestadores! Após aprovação, você receberá o link de instalação e acesso às suas operações. 📱`;
  }

  if (status === "reprovado") {
    return `No momento, seu cadastro não pôde ser aprovado. Para mais informações, entre em contato com nossa equipe pelo canal oficial.`;
  }

  if (status === "bloqueado") {
    return `Seu acesso está temporariamente suspenso. Por favor, entre em contato com nossa equipe de suporte.`;
  }

  return `Entendi! Nossa equipe de recrutamento está aqui para ajudar. Pode me dizer mais detalhes sobre o que você precisa saber? 😊`;
}

// ============================================================
// FUNÇÃO PRINCIPAL: GERAR RESPOSTA DA IA
// ============================================================

export async function gerarRespostaIA(
  mensagemPrestador: string,
  conversa: Conversa,
  historicoRecente: Mensagem[] = []
): Promise<RespostaIA> {
  const config = await carregarConfigIA();

  // Monta histórico (últimas 5 msgs)
  const historicoTexto = historicoRecente
    .slice(-5)
    .map((m) => `[${m.origem.toUpperCase()}]: ${m.mensagem}`)
    .join("\n");

  // ---- SYSTEM PROMPT com regras de segurança embutidas ----
  const systemPrompt = `Você é o assistente virtual de recrutamento da Conexão Express.
Seu papel é APENAS atender prestadores (motoristas/parceiros) interessados em trabalhar com a empresa.

MANUAL DA EMPRESA:
${config.manual_empresa || "Empresa de logística buscando prestadores parceiros."}

REGRAS PERMITIDAS:
${config.regras_permitidas || "Explicar processo de cadastro, documentação e tipos de veículos."}

REGRAS BLOQUEADAS (NUNCA RESPONDA SOBRE ISSO):
${config.regras_bloqueadas || "Dados de clientes, rotas, valores específicos, dados internos."}

STATUS ATUAL DO PRESTADOR: "${conversa.status}"

RESTRIÇÕES DE SEGURANÇA ABSOLUTAS (NUNCA QUEBRE ESTAS REGRAS):
${
  conversa.status !== "aprovado"
    ? `- PODE: explicar cadastro, documentação, tipos de veículos, pagamento genérico, bonificações genéricas
- NÃO PODE: revelar nomes de clientes, endereços de clientes, rotas específicas, valores específicos de frete, dados internos da operação`
    : `- PODE: responder sobre dados vinculados a ESTE prestador especificamente
- NÃO PODE: revelar dados de outros prestadores, clientes, operações de terceiros`
}

Responda de forma amigável, direta e profissional. Use emojis moderadamente.
Responda em português do Brasil. Máximo 200 palavras.`;

  const userPrompt = `HISTÓRICO RECENTE:
${historicoTexto || "(sem histórico)"}

NOVA MENSAGEM DO PRESTADOR:
"${mensagemPrestador}"

Responda de forma adequada ao contexto e ao status "${conversa.status}" do prestador.`;

  let respostaTexto: string | null = null;
  let fallback_usado: RespostaIA["fallback_usado"] = "heuristico";

  // 1️⃣ Tenta GROQ
  respostaTexto = await chamarGroq(userPrompt, systemPrompt);
  if (respostaTexto) {
    fallback_usado = "groq";
    console.log("[WhatsAppIA] ✅ Resposta via GROQ");
  }

  // 2️⃣ Tenta OPENAI
  if (!respostaTexto) {
    respostaTexto = await chamarOpenAI(userPrompt, systemPrompt);
    if (respostaTexto) {
      fallback_usado = "openai";
      console.log("[WhatsAppIA] ✅ Resposta via OpenAI");
    }
  }

  // 3️⃣ Fallback heurístico
  if (!respostaTexto) {
    respostaTexto = fallbackHeuristico(mensagemPrestador, conversa.status);
    fallback_usado = "heuristico";
    console.log("[WhatsAppIA] ⚠️ Resposta via fallback heurístico");
  }

  // Aplica bloqueios de segurança na resposta final
  const { textoSeguro, bloqueios } = aplicarBloqueiosSeguranca(
    respostaTexto,
    conversa.status
  );

  if (bloqueios.length > 0) {
    console.warn("[WhatsAppIA] 🚫 Bloqueios aplicados:", bloqueios);
  }

  return {
    texto: textoSeguro,
    bloqueios_aplicados: bloqueios,
    fallback_usado,
    prompt_enviado: userPrompt,
    seguro: bloqueios.length === 0,
  };
}

// ============================================================
// FLUXO COMPLETO: PROCESSAR MENSAGEM DO PRESTADOR
// ============================================================

export async function processarMensagemPrestador(
  telefone: string,
  mensagem: string,
  nome?: string
): Promise<{
  conversa: Conversa;
  mensagemSalva: Mensagem;
  resposta: RespostaIA;
  respostaSalva: Mensagem;
}> {
  console.log(`[WhatsAppIA] 📨 Nova mensagem de ${telefone}: "${mensagem}"`);

  // 1. Busca ou cria conversa
  const conversa = await buscarOuCriarConversa(telefone, nome);

  // 2. Salva mensagem do prestador
  const mensagemSalva = await salvarMensagem(
    conversa.id,
    "prestador",
    mensagem
  );
  console.log(`[WhatsAppIA] 💾 Mensagem do prestador salva: ${mensagemSalva.id}`);

  // 3. Atualiza última mensagem da conversa
  await atualizarConversa(conversa.id, { ultima_mensagem: mensagem });

  // Se humano assumiu, não gera resposta da IA
  if (conversa.humano_assumiu || !conversa.ia_ativa) {
    console.log("[WhatsAppIA] 👤 Conversa com humano ativo — IA não responde");
    return {
      conversa,
      mensagemSalva,
      resposta: {
        texto: "",
        bloqueios_aplicados: [],
        fallback_usado: "heuristico",
        seguro: true,
      },
      respostaSalva: mensagemSalva,
    };
  }

  // 4. Carrega histórico
  const historico = await listarMensagens(conversa.id);

  // 5. Gera resposta da IA
  const resposta = await gerarRespostaIA(mensagem, conversa, historico);
  console.log(`[WhatsAppIA] 🤖 Resposta gerada (${resposta.fallback_usado}): "${resposta.texto.substring(0, 80)}..."`);

  // 6. Salva resposta da IA com payload de auditoria
  const respostaSalva = await salvarMensagem(
    conversa.id,
    "ia",
    resposta.texto,
    {
      fallback_usado: resposta.fallback_usado,
      bloqueios_aplicados: resposta.bloqueios_aplicados,
      seguro: resposta.seguro,
      status_prestador: conversa.status,
    }
  );

  // 7. Atualiza última mensagem (com resposta da IA)
  await atualizarConversa(conversa.id, {
    ultima_mensagem: `[IA]: ${resposta.texto.substring(0, 80)}...`,
  });

  return { conversa, mensagemSalva, resposta, respostaSalva };
}

// ============================================================
// CONTROLE HUMANO
// ============================================================

export async function assumirConversa(conversaId: string): Promise<void> {
  await atualizarConversa(conversaId, {
    humano_assumiu: true,
    ia_ativa: false,
  });
  await salvarMensagem(
    conversaId,
    "sistema",
    "🔵 Conversa assumida por humano. IA pausada."
  );
  console.log(`[WhatsAppIA] 👤 Humano assumiu conversa ${conversaId}`);
}

export async function voltarParaIA(conversaId: string): Promise<void> {
  await atualizarConversa(conversaId, {
    humano_assumiu: false,
    ia_ativa: true,
  });
  await salvarMensagem(
    conversaId,
    "sistema",
    "🟢 IA reativada. Atendimento automático retomado."
  );
  console.log(`[WhatsAppIA] 🤖 IA retomou conversa ${conversaId}`);
}

export async function enviarRespostaHumano(
  conversaId: string,
  mensagem: string
): Promise<Mensagem> {
  const salva = await salvarMensagem(conversaId, "humano", mensagem);
  await atualizarConversa(conversaId, {
    ultima_mensagem: `[Humano]: ${mensagem.substring(0, 80)}`,
  });
  return salva;
}

// ============================================================
// ENDPOINT: RECEBIMENTO VIA N8N WEBHOOK
// ============================================================

export interface PayloadWebhookN8N {
  telefone: string;
  nome?: string;
  mensagem: string;
  origem: "whatsapp";
  aprovado?: boolean;
  conversa_id?: string;
}

export interface RespostaWebhookN8N {
  ok: boolean;
  resposta: string;
  conversa_id?: string;
  assumir_manual?: boolean;
  error?: string;
}

export async function processarWebhookN8N(payload: PayloadWebhookN8N): Promise<RespostaWebhookN8N> {
  try {
    console.log(`[WhatsAppIA - N8N] 📨 Recebido webhook:`, payload);

    if (!payload.telefone || !payload.mensagem) {
      return { ok: false, resposta: "", error: "Telefone e mensagem são obrigatórios" };
    }

    // 1. Busca conversa
    const conversa = await buscarOuCriarConversa(payload.telefone, payload.nome);

    // 2. Bloqueio Obrigatório Antecipado (Regra Tarefa 2)
    // Se o prestador não for aprovado e enviar palavras relacionadas a operação
    if (conversa.status !== "aprovado") {
      const msgLower = payload.mensagem.toLowerCase();
      const temPalavraOperacao = [
        "cliente", "endereço", "rota", "valor específico", "dados internos", "operação",
        "frete", "entrega", "coleta", "pagamento"
      ].some(p => msgLower.includes(p));

      if (temPalavraOperacao) {
        // Salva mensagem do prestador
        await salvarMensagem(conversa.id, "prestador", payload.mensagem);
        
        const respPadrao = "Seu cadastro ainda está em análise. Assim que for aprovado, nossa equipe avisará sobre as oportunidades disponíveis.";
        
        await salvarMensagem(conversa.id, "ia", respPadrao, { bloqueio_antecipado: true });
        await atualizarConversa(conversa.id, { ultima_mensagem: `[IA]: ${respPadrao.substring(0, 80)}` });
        
        return {
          ok: true,
          resposta: respPadrao,
          conversa_id: conversa.id,
          assumir_manual: conversa.humano_assumiu
        };
      }
    }

    // 3. Processa normalmente com a IA
    const result = await processarMensagemPrestador(payload.telefone, payload.mensagem, payload.nome);

    return {
      ok: true,
      resposta: result.resposta.texto,
      conversa_id: result.conversa.id,
      assumir_manual: result.conversa.humano_assumiu
    };
  } catch (error: any) {
    console.error("[WhatsAppIA - N8N] Erro ao processar webhook:", error);
    return {
      ok: false,
      resposta: "Desculpe, ocorreu um erro interno ao processar sua mensagem.",
      error: error.message
    };
  }
}
