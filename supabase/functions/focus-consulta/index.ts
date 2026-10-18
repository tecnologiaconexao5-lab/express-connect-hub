import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ ok: false, error: "Metodo nao permitido. Use POST." }),
        { status: 405, headers: corsHeaders }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao configurados.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const tipoDocumento = (body.tipoDocumento || "").toLowerCase();
    const documentoId = body.documentoId as string | undefined;
    const ambiente = (body.ambiente || "homologacao").toLowerCase();

    if (tipoDocumento !== "cte") {
      return new Response(
        JSON.stringify({ ok: false, error: "Apenas CT-e suportado nesta Edge Function." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!documentoId) {
      return new Response(
        JSON.stringify({ ok: false, error: "documentoId obrigatorio." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Bloquear producao — dupla trava
    const focusAmbiente = (Deno.env.get("FOCUS_AMBIENTE") || "homologacao").toLowerCase();
    const producaoLiberada = Deno.env.get("FOCUS_PRODUCAO_LIBERADA") === "true";

    if (ambiente === "producao") {
      if (focusAmbiente !== "producao" || !producaoLiberada) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Producao bloqueada. FOCUS_AMBIENTE deve ser producao e FOCUS_PRODUCAO_LIBERADA=true.",
        }), { status: 403, headers: corsHeaders });
      }
    } else if (ambiente !== "homologacao" || focusAmbiente !== "homologacao") {
      return new Response(JSON.stringify({
        ok: false,
        error: "Producao bloqueada nesta etapa. Somente homologacao permitida.",
      }), { status: 403, headers: corsHeaders });
    }

    const focusToken = ambiente === "producao"
      ? Deno.env.get("FOCUS_TOKEN_PRODUCAO") || Deno.env.get("FOCUS_TOKEN")
      : Deno.env.get("FOCUS_TOKEN");

    if (!focusToken) {
      return new Response(
        JSON.stringify({ ok: false, error: "FOCUS_TOKEN nao configurado nos secrets." }),
        { status: 500, headers: corsHeaders }
      );
    }

    const focusBaseUrl = ambiente === "producao"
      ? (Deno.env.get("FOCUS_BASE_URL_PRODUCAO") || "https://api.focusnfe.com.br/v2")
      : (Deno.env.get("FOCUS_BASE_URL") || "https://homologacao.focusnfe.com.br/v2");

    // 1. Buscar CT-e
    const { data: doc, error: docError } = await supabase
      .from("fiscal_ctes")
      .select("*")
      .eq("id", documentoId)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ ok: false, error: `CT-e ID=${documentoId} nao encontrado.` }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Validar status consultavel
    const statusConsultaveis = ["processando", "erro_emissao", "rejeitado", "rascunho", "autorizado"];
    if (!statusConsultaveis.includes(doc.status)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `CT-e com status "${doc.status}" nao esta em status consultavel. Status consultaveis: ${statusConsultaveis.join(", ")}.`,
          statusAtual: doc.status,
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    // 3. Localizar identificador Focus
    const metadata = doc.metadata || {};
    const focusResponse = metadata.focus_response || {};

    const refEmit = focusResponse.ref || `cte-${documentoId}`;
    const codigo = focusResponse.codigo || null;
    const protocoloFocus = focusResponse.protocolo || doc.protocolo || null;
    const chaveFocus = focusResponse.chave_acesso || focusResponse.chave || doc.chave_acesso || null;

    let identificador: string | null = null;
    let tipoIdentificador: string = "";

    if (refEmit) {
      identificador = refEmit;
      tipoIdentificador = "ref";
    } else if (codigo) {
      identificador = codigo;
      tipoIdentificador = "codigo";
    } else if (protocoloFocus) {
      identificador = protocoloFocus;
      tipoIdentificador = "protocolo";
    } else if (chaveFocus) {
      identificador = chaveFocus;
      tipoIdentificador = "chave";
    }

    if (!identificador) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Nenhum identificador Focus encontrado para consulta. O CT-e precisa ter sido enviado primeiro (ref, protocolo, codigo ou chave).",
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    const consultaUrl = `${focusBaseUrl}/cte/${identificador}`;
    console.log(`[FocusConsulta] Consultando CT-e. URL: ${consultaUrl} (tipo: ${tipoIdentificador})`);

    // 4. Registrar log de request
    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: "CTE",
      entidade_id: documentoId,
      acao: "focus_cte_consulta_request",
      request: { url: consultaUrl, tipo_identificador: tipoIdentificador, identificador },
      status_code: null,
    }]);

    // Montar autenticacao Basic correta: base64(token:)
    const authHeader = `Basic ${btoa(focusToken + ":")}`;

    // 5. Chamar API Focus (GET)
    try {
      const focusResponseData = await fetch(consultaUrl, {
        method: "GET",
        headers: {
          "Authorization": authHeader,
          "Accept": "application/json",
        },
      });

      const statusCode = focusResponseData.status;
      let focusText = "";
      let focusData: any;

      // Capturar corpo como texto primeiro (evita crash se nao for JSON)
      try {
        focusText = await focusResponseData.text();
        try {
          focusData = JSON.parse(focusText);
        } catch {
          focusData = { raw_body: focusText.slice(0, 2000) };
        }
      } catch {
        focusText = "(erro ao ler corpo da resposta)";
        focusData = null;
      }

      console.log(`[FocusConsulta] Focus Response HTTP ${statusCode}:`, JSON.stringify(focusData).slice(0, 500));

      // Determinar status
      const statusSefaz = focusData.status_sefaz || focusData.status || "";
      const statusFocus = focusData.status || "";
      const isAutorizado =
        statusCode === 200 &&
        (statusSefaz === "autorizado" || statusSefaz === "100" || statusFocus === "autorizado");
      const isRejeitado =
        statusSefaz === "rejeitado" || statusSefaz === "denegado" || statusFocus === "rejeitado";
      const isProcessando =
        statusSefaz === "processando_autorizacao" ||
        statusSefaz === "em_processamento" ||
        statusFocus === "processando_autorizacao" ||
        statusFocus === "em_processamento";

      const updates: Record<string, any> = {};
      const evento: Record<string, any> = {};
      const logRes: Record<string, any> = {};

      if (isAutorizado) {
        updates.status = "autorizado";
        updates.chave_acesso = focusData.chave_acesso || focusData.chave || chaveFocus || null;
        updates.protocolo = focusData.protocolo || protocoloFocus || null;
        updates.xml_url = focusData.caminho_xml || focusData.xml_url || focusData.xml || null;
        updates.pdf_url = focusData.caminho_dacte || focusData.pdf_url || focusData.dacte_url || focusData.dacte || null;
        updates.motivo_rejeicao = null;

        evento.tipo_evento = "CTE_AUTORIZADO_FOCUS";
        evento.descricao = `CT-e autorizado na Focus. Chave: ${updates.chave_acesso || "N/D"}`;
        logRes.acao = "focus_cte_consulta_autorizado";
      } else if (isRejeitado) {
        updates.status = "rejeitado";
        updates.motivo_rejeicao = focusData.motivo || focusData.mensagem || focusData.erro || "Rejeitado pela SEFAZ";

        evento.tipo_evento = "CTE_REJEITADO_FOCUS";
        evento.descricao = `CT-e rejeitado: ${updates.motivo_rejeicao}`;
        logRes.acao = "focus_cte_consulta_rejeitado";
      } else if (isProcessando) {
        updates.status = "processando";

        evento.tipo_evento = "CTE_PROCESSANDO_FOCUS";
        evento.descricao = "CT-e ainda em processamento na Focus.";
        logRes.acao = "focus_cte_consulta_processando";
      } else {
        updates.status = doc.status;

        evento.tipo_evento = "CONSULTA_FOCUS_HOMOLOGACAO";
        evento.descricao = `Consulta Focus: status retornado "${statusSefaz || statusFocus || "desconhecido"}"`;
        logRes.acao = "focus_cte_consulta_success";
      }

      const novoMetadata = {
        ...metadata,
        focus_consulta: focusData,
        focus_consultado_em: new Date().toISOString(),
        ...(isAutorizado ? { autorizado_em: new Date().toISOString() } : {}),
        ...(isRejeitado ? { rejeitado_em: new Date().toISOString() } : {}),
      };

      await supabase.from("fiscal_ctes").update({
        ...updates,
        metadata: novoMetadata,
      }).eq("id", documentoId);

      await supabase.from("fiscal_events").insert([{
        documento_tipo: "CTE",
        documento_id: documentoId,
        ...evento,
        metadata: { focus_data: focusData, status_code: statusCode },
      }]);

      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "CTE",
        entidade_id: documentoId,
        acao: logRes.acao,
        request: { url: consultaUrl, tipo_identificador: tipoIdentificador },
        response: {
          status_sefaz: statusSefaz,
          autorizado: isAutorizado,
          rejeitado: isRejeitado,
          chave: focusData.chave_acesso || focusData.chave || null,
        },
        status_code: statusCode,
      }]);

      return new Response(JSON.stringify({
        ok: true,
        modo: "consulta",
        mensagem: isAutorizado
          ? "CT-e autorizado na Focus!"
          : isRejeitado
          ? `CT-e rejeitado: ${updates.motivo_rejeicao}`
          : `Status Focus: ${statusSefaz || statusFocus || "consulta realizada"}`,
        documentoId,
        statusAtual: updates.status || doc.status,
        autorizado: isAutorizado,
        rejeitado: isRejeitado,
        processando: isProcessando,
        chave_acesso: updates.chave_acesso || null,
        protocolo: updates.protocolo || null,
        xml_url: updates.xml_url || null,
        pdf_url: updates.pdf_url || null,
        focusResponse: focusData,
      }), { status: 200, headers: corsHeaders });

    } catch (fetchError: any) {
      console.error("[FocusConsulta] Erro na chamada:", fetchError);

      const novoMetadata = {
        ...metadata,
        focus_consulta_erro: { error: fetchError.message, status_code: 0 },
        focus_consulta_erro_em: new Date().toISOString(),
      };

      await supabase.from("fiscal_ctes").update({
        metadata: novoMetadata,
      }).eq("id", documentoId);

      await supabase.from("fiscal_events").insert([{
        documento_tipo: "CTE",
        documento_id: documentoId,
        tipo_evento: "ERRO_CONSULTA_FOCUS",
        descricao: `Erro ao consultar Focus: ${fetchError.message}`,
        metadata: { error: fetchError.message },
      }]);

      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "CTE",
        entidade_id: documentoId,
        acao: "focus_cte_consulta_error",
        request: { url: consultaUrl, tipo_identificador: tipoIdentificador },
        response: { error: fetchError.message },
        status_code: 0,
      }]);

      return new Response(JSON.stringify({
        ok: false,
        success: false,
        etapa: "consulta_focus",
        erro: `Erro ao consultar Focus: ${fetchError.message}`,
        documentoId,
        statusAtual: doc.status,
      }), { status: 502, headers: corsHeaders });
    }

  } catch (error: any) {
    console.error("[FocusConsulta] Erro fatal:", error?.message || error);
    if (error?.stack) console.error("[FocusConsulta] Stack:", error.stack);
    return new Response(
      JSON.stringify({ ok: false, success: false, etapa: "erro_interno", error: error.message || "Erro interno" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
