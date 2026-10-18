import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Metodo nao permitido." }), { status: 405, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nao configurados.");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { cteIds, destinatarios, cc, assunto, mensagem, romaneioNumero, loteId } = body;

    if (!cteIds || !Array.isArray(cteIds) || cteIds.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "cteIds obrigatorio (array)." }), { status: 400, headers: corsHeaders });
    }
    if (!destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "destinatarios obrigatorio (array)." }), { status: 400, headers: corsHeaders });
    }

    // Buscar CT-es
    const { data: ctes, error: ctesErr } = await supabase.from("fiscal_ctes").select("*").in("id", cteIds);
    if (ctesErr || !ctes || ctes.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "CT-es nao encontrados." }), { status: 404, headers: corsHeaders });
    }

    // Validar
    const erros: string[] = [];
    const docsStorage: any[] = [];
    for (const cte of ctes) {
      if (cte.status !== "autorizado") erros.push(`CT-e ${cte.numero || cte.id.substring(0, 8)}: status "${cte.status}" — apenas autorizados.`);
      const ds = cte.metadata?.documentos_storage || {};
      if (!ds.xml?.salvo || !ds.xml?.storage_path) erros.push(`CT-e ${cte.numero || "S/N"}: XML nao salvo.`);
      if (!ds.dacte?.salvo || !ds.dacte?.storage_path) erros.push(`CT-e ${cte.numero || "S/N"}: DACTE nao salvo.`);
      docsStorage.push({ cteId: cte.id, xml: ds.xml, dacte: ds.dacte });
    }

    if (erros.length > 0) {
      return new Response(JSON.stringify({ ok: false, error: "Validacao falhou.", detalhes: erros }), { status: 422, headers: corsHeaders });
    }

    // Gerar dados de anexos para o n8n (storage_path + signed_url temp)
    const anexos: { nome_arquivo: string; tipo: string; content_type: string; storage_path: string; signed_url: string | null; signed_url_temporaria: boolean; expires_in: number; cte_id: string; chave_acesso: string | null }[] = [];
    for (const ds of docsStorage) {
      const cte = ctes.find((c) => c.id === ds.cteId);
      if (ds.xml?.salvo && ds.xml?.storage_path) {
        const { data: s } = await supabase.storage.from("fiscal-documentos").createSignedUrl(ds.xml.storage_path, 600);
        anexos.push({
          nome_arquivo: `CTe-${cte?.chave_acesso?.substring(0, 10) || ds.cteId.substring(0, 8)}.xml`,
          tipo: "xml",
          content_type: "application/xml",
          storage_path: ds.xml.storage_path,
          signed_url: s?.signedUrl || null,
          signed_url_temporaria: true,
          expires_in: 600,
          cte_id: ds.cteId,
          chave_acesso: cte?.chave_acesso || null,
        });
      }
      if (ds.dacte?.salvo && ds.dacte?.storage_path) {
        const { data: s } = await supabase.storage.from("fiscal-documentos").createSignedUrl(ds.dacte.storage_path, 600);
        anexos.push({
          nome_arquivo: `DACTE-${cte?.chave_acesso?.substring(0, 10) || ds.cteId.substring(0, 8)}.pdf`,
          tipo: "dacte",
          content_type: "application/pdf",
          storage_path: ds.dacte.storage_path,
          signed_url: s?.signedUrl || null,
          signed_url_temporaria: true,
          expires_in: 600,
          cte_id: ds.cteId,
          chave_acesso: cte?.chave_acesso || null,
        });
      }
    }

    // Tentar enviar via n8n webhook (mesmo padrao do Zoho existente)
    const n8nWebhook = Deno.env.get("FISCAL_EMAIL_WEBHOOK") || Deno.env.get("N8N_WEBHOOK_ZOHO_EMAIL");
    let providerMessageId: string | null = null;
    let envioReal = false;

    if (n8nWebhook) {
      try {
        const n8nResp = await fetch(n8nWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: destinatarios,
            cc: cc || [],
            subject: assunto || "Documentos Fiscais CT-e",
            body: mensagem || "",
            romaneio: romaneioNumero,
            lote_id: loteId,
            modulo: "fiscal",
            cte_ids: cteIds,
            total_ctes: cteIds.length,
            anexos,
            instrucao: "Use as signed_urls ABAIXO para baixar os arquivos e anexa-los ao e-mail. NAO encaminhe as URLs ao cliente. As URLs expiram em 10 minutos.",
          }),
        });
        if (n8nResp.ok) {
          const n8nData = await n8nResp.json();
          providerMessageId = n8nData.id || n8nData.messageId || null;
          envioReal = true;
        }
      } catch (e) {
        console.error("[FiscalEmail] Erro n8n:", e);
      }
    }

    // Atualizar metadata de cada CT-e
    const agora = new Date().toISOString();
    for (const cte of ctes) {
      const meta = cte.metadata || {};
      await supabase.from("fiscal_ctes").update({
        metadata: {
          ...meta,
          email_cliente: {
            enviado: envioReal,
            enviado_em: agora,
            destinatarios,
            cc: cc || [],
            assunto: assunto || "",
            romaneio_numero: romaneioNumero || null,
            lote_id: loteId || null,
            provider_message_id: providerMessageId,
            envio_real: envioReal,
            anexos_xml: anexos.filter((a) => a.cteId === cte.id).length > 0,
            anexos_dacte: anexos.filter((a) => a.cteId === cte.id).length > 0,
          },
        },
      }).eq("id", cte.id);
    }

    // Eventos e logs
    const eventoTipo = envioReal ? "EMAIL_DOCUMENTOS_CLIENTE_ENVIADO" : "EMAIL_DOCUMENTOS_CLIENTE_MARCADO_MANUAL";
    await supabase.from("fiscal_events").insert([{
      documento_tipo: "CTE_LOTE",
      documento_id: loteId || romaneioNumero || cteIds[0],
      tipo_evento: eventoTipo,
      descricao: envioReal
        ? `Documentos fiscais enviados para ${destinatarios.join(", ")}. ${cteIds.length} CT-es.`
        : `Envio registrado manualmente (webhook nao configurado). ${cteIds.length} CT-es.`,
      metadata: { cte_ids: cteIds, destinatarios, romaneio_numero: romaneioNumero, lote_id: loteId, envio_real: envioReal },
    }]);

    await supabase.from("fiscal_logs").insert([{
      entidade_tipo: "CTE_LOTE",
      entidade_id: loteId || romaneioNumero || cteIds[0],
      acao: envioReal ? "fiscal_email_documentos_success" : "fiscal_email_documentos_manual",
      request: { cte_ids: cteIds, destinatarios, assunto },
      response: { envio_real: envioReal, provider_message_id: providerMessageId, total_ctes: cteIds.length },
      status_code: envioReal ? 200 : 201,
    }]);

    return new Response(JSON.stringify({
      ok: true,
      envio_real: envioReal,
      mensagem: envioReal
        ? `E-mail enviado para ${destinatarios.join(", ")} com ${cteIds.length} CT-es.`
        : "Registro de envio salvo. Webhook de e-mail fiscal nao configurado — configure FISCAL_EMAIL_WEBHOOK nos Secrets.",
      provider_message_id: providerMessageId,
      total_ctes: cteIds.length,
    }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error("[FiscalEmail] Erro:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: corsHeaders });
  }
});
