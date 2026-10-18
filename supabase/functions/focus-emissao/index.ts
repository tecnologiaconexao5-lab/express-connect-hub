import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { converterPayloadInternoParaFocusCteOficial, validarPayloadAntesDeEnviar } from "./mapper.ts";
import type { ClienteDb, FocusCtePayloadInterno } from "./mapper.ts";

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

function tokenPreview(token: string | undefined): string {
  if (!token) return "ausente";
  return token.slice(0, 4) + "*** (" + token.length + " chars)";
}

function respostaSimulada(label: string, documentoId: string, statusAtual: string, ambiente: string) {
  return {
    ok: true,
    modo: "simulado",
    mensagem: "Edge Function Focus preparada. Nenhuma chamada externa foi feita. " +
      "A emissao real deve ser ativada futuramente via integracao com API Focus NFe.",
    tipoDocumento: label,
    documentoId,
    statusAtual,
    prontoParaEmissao: true,
    ambiente,
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

    if (body.action === "ping") {
      const tokenHomologacao = Deno.env.get("FOCUS_TOKEN");
      const tokenProducao = Deno.env.get("FOCUS_TOKEN_PRODUCAO");
      const realEnabled = Deno.env.get("FOCUS_REAL_ENABLED");
      const ambiente = Deno.env.get("FOCUS_AMBIENTE") || "homologacao";

      return new Response(JSON.stringify({
        ok: true,
        modo: "ping",
        mensagem: "Edge Function Focus NFe operacional.",
        ambiente: ambiente,
        secrets: {
          focus_token_homologacao_existe: !!tokenHomologacao,
          focus_token_homologacao_preview: tokenPreview(tokenHomologacao),
          focus_token_producao_existe: !!tokenProducao,
          focus_token_producao_preview: tokenPreview(tokenProducao),
          focus_real_enabled: realEnabled === "true",
        },
      }), { status: 200, headers: corsHeaders });
    }

    if (body.action === "cadastrar_cliente") {
      const cliente = body.cliente as Record<string, any> | undefined;
      if (!cliente || !cliente.cnpj || !cliente.razao_social) {
        return new Response(JSON.stringify({ ok: false, error: "Dados do cliente incompletos (cnpj, razao_social obrigatorios)." }), { status: 400, headers: corsHeaders });
      }

      const cnpjLimpo = String(cliente.cnpj).replace(/[^0-9]/g, "");
      if (cnpjLimpo.length !== 14) {
        return new Response(JSON.stringify({ ok: false, error: "CNPJ deve ter 14 digitos." }), { status: 400, headers: corsHeaders });
      }

      // Upsert por CNPJ
      const { data: existente } = await supabase.from("clientes").select("id").filter("cnpj", "eq", cnpjLimpo).maybeSingle();

      const payloadCliente: Record<string, any> = {
        razao_social: cliente.razao_social,
        nome_fantasia: cliente.nome_fantasia || cliente.razao_social,
        cnpj: cnpjLimpo,
      };
      if (cliente.ie) payloadCliente.ie = cliente.ie;
      if (cliente.telefone) payloadCliente.telefone = cliente.telefone;
      if (cliente.email) payloadCliente.email = cliente.email;
      if (cliente.segmento) payloadCliente.segmento = cliente.segmento;
      // Note: clientes table does NOT have logradouro/numero/bairro/cidade/uf/cep columns.
      // Address data is stored in the CT-e payload_focus directly.

      let resultId: string | null = null;
      if (existente) {
        const { error: updErr } = await supabase.from("clientes").update(payloadCliente).eq("id", existente.id);
        if (updErr) return new Response(JSON.stringify({ ok: false, error: `Erro ao atualizar: ${updErr.message}` }), { status: 500, headers: corsHeaders });
        resultId = existente.id;
      } else {
        const { data: inserted, error: insErr } = await supabase.from("clientes").insert([payloadCliente]).select("id").single();
        if (insErr || !inserted) return new Response(JSON.stringify({ ok: false, error: `Erro ao inserir: ${insErr?.message || "desconhecido"}` }), { status: 500, headers: corsHeaders });
        resultId = inserted.id;
      }

      console.log(`[FocusEmissao] Cliente cadastrado: ${cliente.razao_social} | CNPJ ${cnpjLimpo.slice(0,5)}*** | id=${resultId?.slice(0,8)}`);
      return new Response(JSON.stringify({ ok: true, action: "cadastrar_cliente", id: resultId, razao_social: cliente.razao_social }), { status: 200, headers: corsHeaders });
    }

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

    // 3a. Buscar dados completos do cliente tomador/remetente
    let clienteRemetente: ClienteDb | null = null;
    if (tipoDocumento === "cte") {
      const nomeTomador = payload.tomador?.nome || metadata.tomador_nome || payload.remetente?.nome || "";
      if (nomeTomador) {
        const termo = nomeTomador.slice(0, 10);
        const { data: clienteResult } = await supabase
          .from("clientes")
          .select("id, cnpj, ie, razao_social, nome_fantasia, logradouro, numero, bairro, cidade, uf, cep")
          .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
          .limit(1)
          .maybeSingle();
        if (clienteResult) {
          clienteRemetente = clienteResult as ClienteDb;
          console.log(`[FocusEmissao] Cliente remetente encontrado: ${clienteRemetente.razao_social} | CNPJ ${clienteRemetente.cnpj?.slice(0, 5) || "ausente"}***`);
        } else {
          console.log(`[FocusEmissao] Cliente remetente NAO encontrado para: "${nomeTomador}"`);
        }
      }
    }

    // 3b. Validar pendente_conferencia_endereco
    if (tipoDocumento === "cte" && metadata.pendente_conferencia_endereco === true) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `${label} ID=${documentoId} possui endereco real de entrega pendente de conferencia. Preencha o endereco real antes de emitir.`,
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    // 3c. Validar pronto_para_emissao
    if (tipoDocumento === "cte" && metadata.pronto_para_emissao === false) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `${label} ID=${documentoId} nao esta pronto para emissao. Verifique as validacoes pendentes.`,
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
      const focusAmbiente = (Deno.env.get("FOCUS_AMBIENTE") || "homologacao").toLowerCase();
      const ambienteSolicitado = (body.ambiente || "homologacao").toLowerCase();
      const producaoLiberada = Deno.env.get("FOCUS_PRODUCAO_LIBERADA") === "true";

      if (ambienteSolicitado === "producao") {
        if (focusAmbiente !== "producao" || !producaoLiberada) {
          return new Response(JSON.stringify({
            ok: false,
            error: "Producao bloqueada. FOCUS_AMBIENTE deve ser producao e FOCUS_PRODUCAO_LIBERADA=true.",
            ambiente_configurado: focusAmbiente,
            producao_liberada: producaoLiberada,
          }), { status: 403, headers: corsHeaders });
        }
      } else if (ambienteSolicitado !== "homologacao" || focusAmbiente !== "homologacao") {
        return new Response(JSON.stringify({
          ok: false,
          error: "Producao bloqueada nesta etapa. Somente homologacao permitida.",
          ambiente_configurado: focusAmbiente,
          ambiente_solicitado: ambienteSolicitado,
        }), { status: 403, headers: corsHeaders });
      }

      const focusRealEnabled = Deno.env.get("FOCUS_REAL_ENABLED");
      const focusToken = ambienteSolicitado === "producao"
        ? Deno.env.get("FOCUS_TOKEN_PRODUCAO") || Deno.env.get("FOCUS_TOKEN")
        : Deno.env.get("FOCUS_TOKEN");
      const focusBaseUrl = ambienteSolicitado === "producao"
        ? (Deno.env.get("FOCUS_BASE_URL_PRODUCAO") || "https://api.focusnfe.com.br/v2")
        : (Deno.env.get("FOCUS_BASE_URL") || "https://homologacao.focusnfe.com.br/v2");

      // ============================================================
      // Validar emitente fiscal completo (bloqueio preventivo)
      // ============================================================
      if (focusRealEnabled === "true" && focusToken) {
        const cnpjRaw = (payload.emitente?.cnpj || "").replace(/[^0-9]/g, "");
        const ieRaw = (payload.emitente?.ie || "").trim();
        const nomeEmitente = (payload.emitente?.nome || "").trim();
        const endLogradouro = (payload.emitente?.endereco?.logradouro || "").trim();
        const endCidade = (payload.emitente?.endereco?.cidade || "").trim();
        const endUf = (payload.emitente?.endereco?.uf || "").trim();
        const endCep = (payload.emitente?.endereco?.cep || "").replace(/[^0-9]/g, "");

        const cnpjsPlaceholder = ["11111111000111", "00000000000000", "00000000000199", "12345678901234"];
        const iesPlaceholder = ["123456789", "987654321", "000000000", "123456", "000000"];

        const errosEmitente: string[] = [];

        if (!cnpjRaw || cnpjRaw.length < 14) {
          errosEmitente.push("CNPJ do emitente ausente ou incompleto (14 digitos)");
        } else if (cnpjsPlaceholder.includes(cnpjRaw)) {
          errosEmitente.push("CNPJ do emitente e placeholder/ficticio");
        }

        if (!ieRaw || iesPlaceholder.includes(ieRaw)) {
          errosEmitente.push("Inscricao Estadual do emitente ausente ou placeholder");
        }

        if (!nomeEmitente) {
          errosEmitente.push("Razao social do emitente ausente");
        }

        if (!endLogradouro) {
          errosEmitente.push("Logradouro do emitente ausente");
        }

        if (!endCidade) {
          errosEmitente.push("Cidade/municipio do emitente ausente");
        }

        if (!endUf || endUf.length !== 2) {
          errosEmitente.push("UF do emitente ausente ou invalida");
        }

        if (!endCep || endCep.length < 8) {
          errosEmitente.push("CEP do emitente ausente ou incompleto (8 digitos)");
        }

        if (errosEmitente.length > 0) {
          return new Response(JSON.stringify({
            ok: false,
            success: false,
            etapa: "validacao_emitente_fiscal",
            error: "EMITENTE_FISCAL_NAO_CONFIGURADO",
            mensagem: "Emitente fiscal nao configurado. Cadastre CNPJ, IE e endereco fiscal antes de enviar CT-e.",
            detalhes: errosEmitente,
            ambiente: ambienteSolicitado,
            emitente_atual: {
              nome: nomeEmitente || null,
              cnpj: payload.emitente?.cnpj || null,
              ie: ieRaw || null,
              cidade: endCidade || null,
              uf: endUf || null,
            },
          }), { status: 422, headers: corsHeaders });
        }

        console.log(`[FocusEmissao] Emitente fiscal validado: ${nomeEmitente} | CNPJ ${payload.emitente?.cnpj} | IE ${ieRaw.slice(0, 4)}*** | ${endCidade}/${endUf}`);
      }

      // Validacao pre-envio do remetente/tomador (CNPJ e endereco)
      if (tipoDocumento === "cte") {
        const errosPreEnvio = validarPayloadAntesDeEnviar(payload as FocusCtePayloadInterno, clienteRemetente);
        if (errosPreEnvio.length > 0) {
          return new Response(JSON.stringify({
            ok: false,
            success: false,
            etapa: "validacao_pre_envio",
            error: "DADOS_INCOMPLETOS_PARA_EMISSAO",
            mensagem: "Dados obrigatorios do remetente/tomador ausentes ou incompletos.",
            detalhes: errosPreEnvio.map((e) => `${e.campo}: ${e.mensagem}`),
            ambiente: ambienteSolicitado,
          }), { status: 422, headers: corsHeaders });
        }
      }

      if (focusRealEnabled === "true" && focusToken) {
        const baseUrl = focusBaseUrl || "https://homologacao.focusnfe.com.br/v2";
        const ref = `cte-${documentoId}`;

        console.log(`[FocusEmissao] MODO REAL — CT-e Homologacao. URL: ${baseUrl}/cte?ref=${ref}`);
        console.log(`[FocusEmissao] Token preview: ${tokenPreview(focusToken)}`);

        // Validar FOCUS_REAL_ENABLED explicitamente
        const urlFinal = `${baseUrl}/cte?ref=${ref}`;

        // Montar autenticacao Basic correta: base64(token:)
        const authHeader = `Basic ${btoa(focusToken + ":")}`;
        console.log(`[FocusEmissao] Authorization: Basic ${btoa(focusToken.slice(0, 4) + "***:")} (masked)`);

        // Atualizar status para processando
        await supabase.from(tabela).update({ status: "processando" }).eq("id", documentoId);

        // Converter payload interno para formato oficial Focus antes de enviar
        const payloadOficial = tipoDocumento === "cte"
          ? converterPayloadInternoParaFocusCteOficial(payload as FocusCtePayloadInterno, clienteRemetente)
          : payload;

        console.log(`[FocusEmissao] Payload oficial Focus:`, JSON.stringify(payloadOficial, null, 2));

        // Registrar log de request
        await supabase.from("fiscal_logs").insert([{
          entidade_tipo: label,
          entidade_id: documentoId,
          acao: "focus_cte_request",
          request: { url: urlFinal, ref, payload_resumo: { emitente: payload.emitente?.nome, valor: payload.valores?.valor_total }, payload_convertido: payloadOficial },
          status_code: null,
        }]);

        let focusText = "";
        let focusData: any = null;
        let statusCode = 0;

        try {
          const focusResponse = await fetch(urlFinal, {
            method: "POST",
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify(payloadOficial),
          });

          statusCode = focusResponse.status;

          // Capturar corpo como texto primeiro (evita crash se nao for JSON)
          try {
            focusText = await focusResponse.text();
            try {
              focusData = JSON.parse(focusText);
            } catch {
              focusData = { raw_body: focusText.slice(0, 2000) };
            }
          } catch {
            focusText = "(erro ao ler corpo da resposta)";
            focusData = null;
          }

          console.log(`[FocusEmissao] Focus Response HTTP ${statusCode}:`, JSON.stringify(focusData).slice(0, 500));

          if (statusCode === 200 || statusCode === 202) {
            // Aceito para processamento
            await supabase.from(tabela).update({
              status: "processando",
              protocolo: focusData.protocolo || focusData.ref || null,
              metadata: { ...metadata, focus_response: focusData, focus_enviado_em: new Date().toISOString() },
            }).eq("id", documentoId);

            await supabase.from("fiscal_events").insert([{
              documento_tipo: label,
              documento_id: documentoId,
              tipo_evento: "ENVIO_FOCUS_HOMOLOGACAO",
              descricao: `CT-e enviado para Focus Homologacao. Protocolo: ${focusData.protocolo || "pendente"}`,
              protocolo: focusData.protocolo || null,
              metadata: { focus_response: focusData },
            }]);

            await supabase.from("fiscal_logs").insert([{
              entidade_tipo: label,
              entidade_id: documentoId,
              acao: "focus_cte_accepted",
              request: { ref, payload_resumo: { emitente: payload.emitente?.nome } },
              response: focusData,
              status_code: statusCode,
            }]);

            return new Response(JSON.stringify({
              ok: true,
              success: true,
              etapa: "envio_focus",
              modo: "real",
              ambiente: ambienteSolicitado,
              mensagem: `CT-e enviado para homologacao Focus. Protocolo: ${focusData.protocolo || "pendente"}. Aguarde o processamento.`,
              tipoDocumento: label,
              documentoId,
              statusAtual: "processando",
              focusResponse: focusData,
            }), { status: 200, headers: corsHeaders });
          }

          // Erro da Focus
          const motivo = focusData?.erro || focusData?.mensagem || focusData?.message || JSON.stringify(focusData || {}).slice(0, 300);
          await supabase.from(tabela).update({
            status: "rejeitado",
            motivo_rejeicao: motivo,
            metadata: { ...metadata, focus_response: focusData, focus_erro_em: new Date().toISOString(), focus_status_code: statusCode },
          }).eq("id", documentoId);

          await supabase.from("fiscal_events").insert([{
            documento_tipo: label,
            documento_id: documentoId,
            tipo_evento: "ERRO_FOCUS_HOMOLOGACAO",
            descricao: `Focus retornou erro HTTP ${statusCode}: ${motivo}`,
            metadata: { focus_response: focusData, status_code: statusCode },
          }]);

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
            success: false,
            etapa: "resposta_focus",
            modo: "real",
            ambiente: ambienteSolicitado,
            error: `Focus retornou erro HTTP ${statusCode}`,
            status: statusCode,
            motivo,
            focus_body: focusData,
            payload_enviado: payloadOficial,
          }), { status: 422, headers: corsHeaders });

        } catch (fetchError: any) {
          console.error("[FocusEmissao] Erro na chamada Focus:", fetchError);

          await supabase.from(tabela).update({
            status: "erro_emissao",
            motivo_rejeicao: fetchError.message || "Erro de rede ao chamar Focus",
            metadata: { ...metadata, focus_erro: { error: fetchError.message, em: new Date().toISOString() }, focus_status_code: statusCode },
          }).eq("id", documentoId);

          await supabase.from("fiscal_events").insert([{
            documento_tipo: label,
            documento_id: documentoId,
            tipo_evento: "ERRO_REDE_FOCUS",
            descricao: `Erro de rede ao chamar Focus: ${fetchError.message}`,
            metadata: { error: fetchError.message },
          }]);

          await supabase.from("fiscal_logs").insert([{
            entidade_tipo: label,
            entidade_id: documentoId,
            acao: "focus_cte_error",
            request: { ref, baseUrl },
            response: { error: fetchError.message, focus_text: focusText.slice(0, 500), status_code: statusCode },
            status_code: statusCode || 0,
          }]);

          return new Response(JSON.stringify({
            ok: false,
            success: false,
            etapa: "chamada_http_focus",
            modo: "real",
            ambiente: ambienteSolicitado,
            error: `Erro ao chamar Focus: ${fetchError.message}`,
            status: statusCode || 0,
            focus_body: focusText ? focusText.slice(0, 2000) : null,
            url: urlFinal,
          }), { status: 502, headers: corsHeaders });
        }
      }

      // Focus Real nao habilitado ou sem token
      if (focusRealEnabled !== "true") {
        console.log(`[FocusEmissao] CT-e — FOCUS_REAL_ENABLED=${focusRealEnabled}. Modo simulado.`);
      } else if (!focusToken) {
        console.log(`[FocusEmissao] CT-e — TOKEN_HOMOLOGACAO_AUSENTE. FOCUS_TOKEN nao configurado nos secrets.`);
        return new Response(JSON.stringify({
          ok: false,
          success: false,
          etapa: "validacao_token",
          error: "TOKEN_HOMOLOGACAO_AUSENTE",
          mensagem: "FOCUS_TOKEN nao configurado nos secrets da Edge Function. Configure o token de homologacao para emissao real.",
          ambiente: ambienteSolicitado,
        }), { status: 500, headers: corsHeaders });
      } else {
        console.log(`[FocusEmissao] CT-e — token=${!!focusToken}. Modo simulado.`);
      }
    }

    // ============================================================
    // MODO SIMULADO — MDF-e, NFS-e ou CT-e sem Focus Real habilitado
    // ============================================================

    console.log(`[FocusEmissao] MODO SIMULADO — Nenhuma chamada externa a API Focus foi feita.`);
    const simulada = respostaSimulada(label, documentoId, doc.status, (Deno.env.get("FOCUS_AMBIENTE") || "homologacao"));

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
    console.error("[FocusEmissao] Erro fatal:", error?.message || error);
    if (error?.stack) console.error("[FocusEmissao] Stack:", error.stack);
    return new Response(
      JSON.stringify({
        ok: false,
        success: false,
        etapa: "erro_interno",
        error: error.message || "Erro interno na Edge Function",
        stack: error.stack ? error.stack.slice(0, 500) : undefined,
        ambiente: Deno.env.get("FOCUS_AMBIENTE") || "homologacao",
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
