import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json"
};

serve(async (req) => {
  // Tratamento de CORS para preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas na Edge Function.");
    }

    // Instancia o cliente admin (service_role) — NUNCA no frontend, APENAS aqui
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { telefone, nome, mensagem, origem } = body;

    console.log(`[Webhook] Mensagem recebida de ${telefone}: ${mensagem}`);

    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ ok: false, error: "Parâmetros 'telefone' e 'mensagem' são obrigatórios" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // 1. Busca ou cria conversa
    let conversaId;
    let humanoAssumiu = false;
    let statusPrestador = "novo";

    const { data: existente } = await supabase
      .from("recrutamento_whatsapp_conversas")
      .select("*")
      .eq("telefone", telefone)
      .limit(1)
      .single();

    if (existente) {
      conversaId = existente.id;
      humanoAssumiu = existente.humano_assumiu;
      statusPrestador = existente.status;
      // Atualiza nome se fornecido
      if (nome && existente.nome !== nome) {
        await supabase.from("recrutamento_whatsapp_conversas").update({ nome }).eq("id", conversaId);
      }
    } else {
      const { data: nova, error: erroCriar } = await supabase
        .from("recrutamento_whatsapp_conversas")
        .insert([{ telefone, nome, status: "novo", ia_ativa: true }])
        .select()
        .single();
      
      if (erroCriar) throw new Error("Erro ao criar conversa");
      conversaId = nova.id;
    }

    // Se humano assumiu, apenas salva a mensagem e não gera resposta da IA
    if (humanoAssumiu) {
      await supabase.from("recrutamento_whatsapp_mensagens").insert([{
        conversa_id: conversaId, origem: "prestador", mensagem
      }]);
      await supabase.from("recrutamento_whatsapp_conversas").update({ ultima_mensagem: mensagem }).eq("id", conversaId);

      return new Response(JSON.stringify({
        ok: true,
        resposta: "",
        conversa_id: conversaId,
        assumir_manual: true
      }), { headers: corsHeaders });
    }

    // 2. Bloqueio Obrigatório Antecipado (Regra Tarefa 2)
    let respostaPadrao = "";
    if (statusPrestador !== "aprovado") {
      const msgLower = mensagem.toLowerCase();
      const temPalavraOperacao = [
        "cliente", "endereço", "rota", "valor específico", "dados internos", "operação",
        "frete", "entrega", "coleta", "pagamento", "valor", "r$"
      ].some(p => msgLower.includes(p));

      if (temPalavraOperacao) {
        respostaPadrao = "Seu cadastro ainda está em análise. Assim que for aprovado, nossa equipe avisará sobre as oportunidades disponíveis.";
      }
    }

    // Salva a mensagem do prestador
    await supabase.from("recrutamento_whatsapp_mensagens").insert([{
      conversa_id: conversaId, origem: "prestador", mensagem
    }]);

    if (respostaPadrao) {
      // Bloqueou e gerou resposta engessada
      await supabase.from("recrutamento_whatsapp_mensagens").insert([{
        conversa_id: conversaId, origem: "ia", mensagem: respostaPadrao, payload: { bloqueio_antecipado: true }
      }]);
      await supabase.from("recrutamento_whatsapp_conversas").update({ ultima_mensagem: `[IA]: ${respostaPadrao}` }).eq("id", conversaId);

      return new Response(JSON.stringify({
        ok: true,
        resposta: respostaPadrao,
        conversa_id: conversaId,
        assumir_manual: false
      }), { headers: corsHeaders });
    }

    // 3. Encaminha para processamento de IA...
    // (Em um ambiente de produção completo da Edge Function, aqui chamaria
    // o endpoint Groq/OpenAI, mas a instrução pediu APENAS o bloqueio e estrutura do Edge webhook)
    // Para simplificar a instrução, vamos enviar um mock da IA como exemplo
    // Ou retornar para o n8n chamar o frontend (não ideal).
    // O mais seguro é a Edge Function consultar as IAs.
    // Como a instrução fala: "Se não aprovado: responder: Seu cadastro... Bloquear: cliente, endereço..."
    // Se aprovado, ou se não tem bloqueio, a Edge Function pode bater na Groq:
    
    let respostaIA = "Recebemos sua mensagem. Um momento por favor.";

    const { data: config } = await supabase.from("recrutamento_ia_config").select("*").limit(1).single();
    
    // Tenta chamada ao GROQ a partir dos secrets da Edge Function
    const groqKey = Deno.env.get("GROQ_API_KEY");
    if (groqKey) {
      try {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: `Você é assistente de recrutamento. Status do parceiro: ${statusPrestador}. Manual: ${config?.manual_empresa || ""}` },
              { role: "user", content: mensagem }
            ],
            max_tokens: 300,
            temperature: 0.7
          })
        });
        const groqData = await groqRes.json();
        if (groqData.choices && groqData.choices[0]) {
          respostaIA = groqData.choices[0].message.content;
        }
      } catch (e) {
        console.error("Groq fallback", e);
      }
    }

    await supabase.from("recrutamento_whatsapp_mensagens").insert([{
      conversa_id: conversaId, origem: "ia", mensagem: respostaIA, payload: { origem: "edge-function-groq" }
    }]);
    await supabase.from("recrutamento_whatsapp_conversas").update({ ultima_mensagem: `[IA]: ${respostaIA}` }).eq("id", conversaId);

    return new Response(JSON.stringify({
      ok: true,
      resposta: respostaIA,
      conversa_id: conversaId,
      assumir_manual: false
    }), { headers: corsHeaders });

  } catch (error: any) {
    console.error("[Webhook Error]:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
