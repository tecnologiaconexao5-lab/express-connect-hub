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
    const tipoArquivo = (body.tipoArquivo || "").toLowerCase() as "xml" | "dacte";
    const ambiente = (body.ambiente || "homologacao").toLowerCase();

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

    if (tipoArquivo !== "xml" && tipoArquivo !== "dacte") {
      return new Response(
        JSON.stringify({ ok: false, error: 'tipoArquivo deve ser "xml" ou "dacte".' }),
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

    // 1. Buscar CT-e
    const { data: doc, error: docError } = await supabase
      .from("fiscal_ctes")
      .select("id, status, metadata")
      .eq("id", documentoId)
      .maybeSingle();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ ok: false, error: `CT-e ID=${documentoId} nao encontrado.` }),
        { status: 404, headers: corsHeaders }
      );
    }

    if (doc.status !== "autorizado") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `CT-e com status "${doc.status}". Apenas autorizados tem documentos disponiveis.`,
          statusAtual: doc.status,
        }),
        { status: 422, headers: corsHeaders }
      );
    }

    // 2. Ler storage_path
    const metadata = doc.metadata || {};
    const docsStorage = metadata.documentos_storage || {};
    const docInfo = docsStorage[tipoArquivo];

    if (!docInfo?.salvo || !docInfo?.storage_path) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Documento ${tipoArquivo.toUpperCase()} nao encontrado no Storage para este CT-e.`,
          tipoArquivo,
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 3. Gerar signed URL com expiracao curta
    const expiresIn = 600;
    const { data: signedData, error: signedError } = await supabase.storage
      .from("fiscal-documentos")
      .createSignedUrl(docInfo.storage_path, expiresIn);

    if (signedError || !signedData?.signedUrl) {
      console.error("[FiscalDocUrl] Erro signed URL:", signedError);
      return new Response(
        JSON.stringify({ ok: false, error: `Erro ao gerar URL assinada: ${signedError?.message || "desconhecido"}` }),
        { status: 500, headers: corsHeaders }
      );
    }

    // 4. Atualizar ultimo_acesso_em
    const docsAtualizado = { ...docsStorage };
    docsAtualizado[tipoArquivo] = {
      ...docInfo,
      ultimo_acesso_em: new Date().toISOString(),
    };

    await supabase.from("fiscal_ctes").update({
      metadata: { ...metadata, documentos_storage: docsAtualizado },
    }).eq("id", documentoId);

    // 5. Log
    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: "CTE",
      entidade_id: documentoId,
      acao: "fiscal_documento_signed_url",
      request: { tipo_arquivo: tipoArquivo, storage_path: docInfo.storage_path },
      response: { expires_in: expiresIn },
      status_code: 200,
    }]);

    return new Response(JSON.stringify({
      ok: true,
      signedUrl: signedData.signedUrl,
      expiresIn,
      storagePath: docInfo.storage_path,
      tipoArquivo,
    }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[FiscalDocUrl] Erro:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || "Erro interno" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
