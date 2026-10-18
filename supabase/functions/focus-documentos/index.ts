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
    const documentos = (body.documentos || ["xml", "dacte"]) as string[];
    const force = body.force === true;

    if (tipoDocumento !== "cte") {
      return new Response(
        JSON.stringify({ ok: false, error: "Apenas CT-e suportado." }),
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

    // Montar autenticacao Basic correta: base64(token:)
    const authHeader = `Basic ${btoa(focusToken + ":")}`;

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

    // 2. Validar status autorizado
    if (doc.status !== "autorizado") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `CT-e com status "${doc.status}". Apenas documentos autorizados podem ter XML/DACTE baixados.`,
          statusAtual: doc.status,
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    const metadata = doc.metadata || {};
    const chaveAcesso = doc.chave_acesso || null;

    if (!chaveAcesso) {
      return new Response(
        JSON.stringify({ ok: false, error: "CT-e sem chave_acesso. Nao e possivel identificar o documento." }),
        { status: 422, headers: corsHeaders }
      );
    }

    // 3. Verificar se documentos ja foram salvos
    const docsStorage = metadata.documentos_storage || {};
    const resultados: Record<string, any> = {};
    let algumSalvo = false;

    // 4. Para cada documento solicitado
    for (const tipoDoc of documentos) {
      if (tipoDoc !== "xml" && tipoDoc !== "dacte") continue;

      // Verificar se ja foi salvo
      if (!force && docsStorage[tipoDoc]?.salvo && docsStorage[tipoDoc]?.storage_path) {
        const { data: signedData } = await supabase.storage
          .from("fiscal-documentos")
          .createSignedUrl(docsStorage[tipoDoc].storage_path, 600);

        resultados[tipoDoc] = {
          salvo: true,
          ja_existia: true,
          storage_path: docsStorage[tipoDoc].storage_path,
          signed_url: signedData?.signedUrl || null,
        };
        continue;
      }

      // 5. Localizar URL externa
      let urlExterna: string | null = null;
      const focusConsulta = metadata.focus_consulta || metadata.focus_response || {};

      if (tipoDoc === "xml") {
        urlExterna = doc.xml_url || focusConsulta.xml_url || focusConsulta.xml || null;
      } else {
        urlExterna = doc.pdf_url || focusConsulta.pdf_url || focusConsulta.dacte_url || focusConsulta.dacte || null;
      }

      if (!urlExterna) {
        resultados[tipoDoc] = {
          salvo: false,
          erro: `Nenhuma URL externa de ${tipoDoc.toUpperCase()} encontrada. A Focus ainda pode estar processando o documento.`,
        };
        continue;
      }

      // 6. Baixar arquivo da Focus
      console.log(`[FocusDocumentos] Baixando ${tipoDoc} de: ${urlExterna}`);

      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "CTE",
        entidade_id: documentoId,
        acao: "focus_documentos_request",
        request: { tipo: tipoDoc, url_origem: urlExterna, chave_acesso: chaveAcesso },
        status_code: null,
      }]);

      try {
        const downloadResponse = await fetch(urlExterna, {
          method: "GET",
          headers: {
            "Accept": tipoDoc === "xml" ? "application/xml, text/xml" : "application/pdf",
          },
        });

        if (!downloadResponse.ok) {
          throw new Error(`HTTP ${downloadResponse.status}: ${downloadResponse.statusText}`);
        }

        const conteudo = await downloadResponse.arrayBuffer();
        const contentType = downloadResponse.headers.get("content-type") || "";
        const bytes = new Uint8Array(conteudo);

        if (bytes.length < 100) {
          throw new Error(`Arquivo ${tipoDoc} muito pequeno (${bytes.length} bytes). Possivelmente invalido.`);
        }

        // Validar conteudo minimo
        if (tipoDoc === "xml" && !contentType.includes("xml") && !contentType.includes("html")) {
          const text = new TextDecoder().decode(bytes.slice(0, 200));
          if (!text.includes("<")) {
            throw new Error("Conteudo do XML nao parece ser XML valido.");
          }
        }

        // 7. Montar storage path
        const agora = new Date();
        const ano = agora.getFullYear().toString();
        const mes = (agora.getMonth() + 1).toString().padStart(2, "0");
        const subAmbiente = ambiente === "producao" ? "producao" : "homologacao";
        const storagePath = `cte/${subAmbiente}/${ano}/${mes}/${documentoId}/${tipoDoc}-${chaveAcesso}.${tipoDoc === "xml" ? "xml" : "pdf"}`;

        // 8. Salvar no Supabase Storage
        const mimeType = tipoDoc === "xml" ? "application/xml" : "application/pdf";

        const { error: uploadError } = await supabase.storage
          .from("fiscal-documentos")
          .upload(storagePath, bytes, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Erro ao salvar ${tipoDoc} no Storage: ${uploadError.message}`);
        }

        // Gerar signed URL (bucket privado)
        const { data: signedData } = await supabase.storage
          .from("fiscal-documentos")
          .createSignedUrl(storagePath, 3600);

        // 9. Atualizar metadata — salvar APENAS storage_path, NUNCA signed URL permanente
        const docInfo = {
          salvo: true,
          storage_path: storagePath,
          content_type: mimeType,
          tamanho_bytes: bytes.length,
          origem: "focus",
          salvo_em: new Date().toISOString(),
          ultimo_acesso_em: null,
          reprocessado: force || undefined,
        };
        docsStorage[tipoDoc] = docInfo;

        // Atualizar fiscal_ctes
        const updateFields: Record<string, any> = {
          metadata: {
            ...metadata,
            documentos_storage: docsStorage,
            [`focus_${tipoDoc}_url_original`]: urlExterna,
          },
        };
        // xml_url/pdf_url ficam null — a verdade e storage_path
        if (tipoDoc === "xml") updateFields.xml_url = null;
        if (tipoDoc === "dacte") updateFields.pdf_url = null;

        await supabase.from("fiscal_ctes").update(updateFields).eq("id", documentoId);

        // Gerar signed URL temporaria apenas para o response
        const { data: signedResp } = await supabase.storage
          .from("fiscal-documentos")
          .createSignedUrl(storagePath, 600);

        // Evento
        const eventoTipo = force ? "DOCUMENTOS_CTE_REPROCESSADOS_STORAGE" : (tipoDoc === "xml" ? "XML_CTE_SALVO_STORAGE" : "DACTE_CTE_SALVO_STORAGE");
        await supabase.from("fiscal_events").insert([{
          documento_tipo: "CTE",
          documento_id: documentoId,
          tipo_evento: eventoTipo,
          descricao: `${tipoDoc.toUpperCase()} do CT-e ${force ? "reprocessado e salvo" : "salvo"} no Storage. Path: ${storagePath}`,
          metadata: { storage_path: storagePath, tamanho_bytes: bytes.length, reprocessado: force || false },
        }]);

        // Log
        const logAcao = force ? "focus_documentos_reprocess" : `focus_${tipoDoc}_download_success`;
        await supabase.from("fiscal_logs").insert([{
          entidade_tipo: "CTE",
          entidade_id: documentoId,
          acao: logAcao,
          request: { url_origem: urlExterna },
          response: {
            storage_path: storagePath,
            tamanho_bytes: bytes.length,
            content_type: mimeType,
          },
          status_code: 200,
        }]);

        resultados[tipoDoc] = {
          salvo: true,
          ja_existia: false,
          storage_path: storagePath,
          signed_url: signedResp?.signedUrl || null,
          tamanho_bytes: bytes.length,
          reprocessado: force || false,
        };
        algumSalvo = true;

      } catch (err: any) {
        console.error(`[FocusDocumentos] Erro ao baixar ${tipoDoc}:`, err);

        await supabase.from("fiscal_logs").insert([{
          entidade_tipo: "CTE",
          entidade_id: documentoId,
          acao: "focus_documentos_error",
          request: { tipo: tipoDoc, url_origem: urlExterna },
          response: { error: err.message },
          status_code: 0,
        }]);

        resultados[tipoDoc] = {
          salvo: false,
          erro: err.message || `Erro ao baixar ${tipoDoc}`,
        };
      }
    }

    // Evento consolidado se algum foi salvo
    if (algumSalvo) {
      await supabase.from("fiscal_events").insert([{
        documento_tipo: "CTE",
        documento_id: documentoId,
        tipo_evento: "DOCUMENTOS_CTE_SALVOS_STORAGE",
        descricao: `Documentos fiscais do CT-e salvos no Storage.`,
        metadata: { resultados },
      }]);

      await supabase.from("fiscal_logs").insert([{
        entidade_tipo: "CTE",
        entidade_id: documentoId,
        acao: "focus_documentos_storage_success",
        request: { chave_acesso: chaveAcesso },
        response: { resultados },
        status_code: 200,
      }]);
    }

    return new Response(JSON.stringify({
      ok: true,
      mensagem: algumSalvo ? "Documentos processados com sucesso." : "Nenhum documento foi salvo.",
      documentoId,
      chave_acesso: chaveAcesso,
      resultados,
    }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[FocusDocumentos] Erro fatal:", error?.message || error);
    if (error?.stack) console.error("[FocusDocumentos] Stack:", error.stack);
    return new Response(
      JSON.stringify({ ok: false, success: false, etapa: "erro_interno", error: error.message || "Erro interno" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
