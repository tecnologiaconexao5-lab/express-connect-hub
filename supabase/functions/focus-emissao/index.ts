import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TIPOS_VALIDOS = ["cte", "mdfe", "nfse"] as const;
type TipoDocumento = (typeof TIPOS_VALIDOS)[number];

const TABELAS: Record<TipoDocumento, string> = {
  cte: "fiscal_ctes",
  mdfe: "fiscal_mdfes",
  nfse: "fiscal_nfse",
};

const TIPO_LABEL: Record<TipoDocumento, string> = {
  cte: "CTE",
  mdfe: "MDFE",
  nfse: "NFSE",
};

function respostaSimulada(label: string, documentoId: string, statusAtual: string) {
  return {
    ok: true,
    modo: "simulado",
    mensagem: "Edge Function Focus preparada. Nenhuma chamada externa foi feita. " +
      "A emissao real deve ser ativada futuramente via integracao com API Focus NFe.",
    tipoDocumento: label,
    documentoId,
    statusAtual,
    prontoParaEmissao: true,
  };
}

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
      throw new Error("Variaveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao configuradas.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const tipoDocumento = (body.tipoDocumento || "").toLowerCase() as TipoDocumento;
    const documentoId = body.documentoId as string | undefined;

    if (!TIPOS_VALIDOS.includes(tipoDocumento)) {
      return new Response(
        JSON.stringify({ ok: false, error: `tipoDocumento invalido: "${tipoDocumento}". Use: cte, mdfe ou nfse.` }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!documentoId || typeof documentoId !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: "documentoId e obrigatorio (string)." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const tabela = TABELAS[tipoDocumento];
    const label = TIPO_LABEL[tipoDocumento];

    console.log(`[FocusEmissao] Processando ${label} ID=${documentoId}`);

    // 1. Buscar documento fiscal
    const { data: doc, error: docError } = await supabase
      .from(tabela)
      .select("*")
      .eq("id", documentoId)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ ok: false, error: `${label} nao encontrado: ID=${documentoId}` }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Validar status (deve ser rascunho)
    if (doc.status !== "rascunho") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `${label} ID=${documentoId} nao esta em rascunho. Status atual: "${doc.status}".`,
          statusAtual: doc.status,
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    // 3. Validar payload_focus / metadata
    const metadata = doc.metadata || {};
    const payload = metadata.payload_focus || metadata;

    if (!payload || Object.keys(payload).length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `${label} ID=${documentoId} nao possui payload_focus no metadata.`,
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    // 4. Validar pendencias bloqueantes (erros)
    const validacoes: { campo: string; mensagem: string; severidade: string }[] =
      metadata.validacoes_pendentes || [];
    const erros = validacoes.filter((v) => v.severidade === "erro");

    if (erros.length > 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `${label} possui ${erros.length} pendencia(s) de erro.`,
          pendencias: erros.map((e) => e.mensagem),
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    // ============================================================
    // CT-e: MODO REAL (se habilitado via secrets)
    // ============================================================

    if (tipoDocumento === "cte") {
      const focusRealEnabled = Deno.env.get("FOCUS_REAL_ENABLED");
      const focusToken = Deno.env.get("FOCUS_TOKEN");
      const focusBaseUrl = Deno.env.get("FOCUS_BASE_URL");

      if (focusRealEnabled === "true" && focusToken) {
        const baseUrl = focusBaseUrl || "https://homologacao.focusnfe.com.br/v2";
        const ref = `cte-${documentoId}`;

        console.log(`[FocusEmissao] MODO REAL — CT-e Homologacao. URL: ${baseUrl}/cte?ref=${ref}`);

        // Atualizar status para processando
        await supabase.from(tabela).update({ status: "processando" }).eq("id", documentoId);

        // Registrar log de request
        await supabase.from("fiscal_logs").insert([{
          entidade_tipo: label,
          entidade_id: documentoId,
          acao: "focus_cte_request",
          request: { url: `${baseUrl}/cte`, ref, payload_resumo: { emitente: payload.emitente?.nome, valor: payload.valores?.valor_total } },
          status_code: null,
        }]);

        try {
          const focusResponse = await fetch(`${baseUrl}/cte?ref=${ref}`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${focusToken}`,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const focusData = await focusResponse.json();
          const statusCode = focusResponse.status;

          console.log(`[FocusEmissao] Focus Response HTTP ${statusCode}:`, JSON.stringify(focusData).slice(0, 500));

          if (statusCode === 202) {
            // Aceito para processamento
            await supabase.from(tabela).update({
              status: "processando",
              protocolo: focusData.protocolo || focusData.ref || null,
              metadata: { ...metadata, focus_response: focusData },
            }).eq("id", documentoId);

            await supabase.from("fiscal_logs").insert([{
              entidade_tipo: label,
              entidade_id: documentoId,
              acao: "focus_cte_accepted",
              request: { ref, payload_resumo: { emitente: payload.emitente?.nome } },
              response: focusData,
              status_code: 202,
            }]);

            return new Response(JSON.stringify({
              ok: true,
              modo: "real",
              mensagem: `CT-e enviado para homologacao Focus. Protocolo: ${focusData.protocolo || "pendente"}. Aguarde o processamento.`,
              tipoDocumento: label,
              documentoId,
              statusAtual: "processando",
              focusResponse: focusData,
            }), { status: 200, headers: corsHeaders });
          }

          // Erro da Focus
          const motivo = focusData.erro || focusData.mensagem || focusData.message || JSON.stringify(focusData).slice(0, 300);
          await supabase.from(tabela).update({
            status: "rejeitado",
            motivo_rejeicao: motivo,
            metadata: { ...metadata, focus_response: focusData },
          }).eq("id", documentoId);

          await supabase.from("fiscal_logs").insert([{
            entidade_tipo: label,
            entidade_id: documentoId,
            acao: "focus_cte_error",
            request: { ref, payload_resumo: { emitente: payload.emitente?.nome } },
            response: focusData,
            status_code: statusCode,
          }]);

          return new Response(JSON.stringify({
            ok: false,
            modo: "real",
            erro: `Focus retornou erro HTTP ${statusCode}`,
            motivo,
            focusResponse: focusData,
          }), { status: 422, headers: corsHeaders });

        } catch (fetchError: any) {
          console.error("[FocusEmissao] Erro na chamada Focus:", fetchError);

          await supabase.from(tabela).update({
            status: "erro",
            motivo_rejeicao: fetchError.message || "Erro de rede ao chamar Focus",
          }).eq("id", documentoId);

          await supabase.from("fiscal_logs").insert([{
            entidade_tipo: label,
            entidade_id: documentoId,
            acao: "focus_cte_error",
            request: { ref, baseUrl },
            response: { error: fetchError.message },
            status_code: 0,
          }]);

          return new Response(JSON.stringify({
            ok: false,
            modo: "real",
            erro: `Erro ao chamar Focus: ${fetchError.message}`,
          }), { status: 502, headers: corsHeaders });
        }
      }

      // Focus Real nao habilitado ou sem token
      console.log(`[FocusEmissao] CT-e — Focus Real desabilitado (FOCUS_REAL_ENABLED=${focusRealEnabled}, token=${!!focusToken}). Modo simulado.`);
    }

    // ============================================================
    // MODO SIMULADO — MDF-e, NFS-e ou CT-e sem Focus Real habilitado
    // ============================================================

    console.log(`[FocusEmissao] MODO SIMULADO — Nenhuma chamada externa a API Focus foi feita.`);
    const simulada = respostaSimulada(label, documentoId, doc.status);

    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: label,
      entidade_id: documentoId,
      acao: "focus_simulado",
      request: { tipoDocumento, documentoId, validado: true, modo: "simulado" },
      response: simulada,
      status_code: 200,
    }]);

    return new Response(JSON.stringify(simulada), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[FocusEmissao] Erro:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || "Erro interno na Edge Function" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
